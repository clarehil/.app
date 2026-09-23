-- ============================================================
-- SUPABASE SETUP FOR THE CLAREHIL / LUMĒ WEBAPP
-- Paste this entire script into Supabase -> SQL Editor -> Run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- profiles / roles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  date_of_birth date,
  location text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, date_of_birth, location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.raw_user_meta_data->>'date_of_birth','')::date,
    new.raw_user_meta_data->>'location'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    date_of_birth = coalesce(excluded.date_of_birth, public.profiles.date_of_birth),
    location = coalesce(excluded.location, public.profiles.location),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text,
  price numeric(14,2) not null default 0,
  original_price numeric(14,2) default 0,
  stock integer not null default 0,
  short_description text,
  long_description text,
  images jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  color_names jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  specs jsonb not null default '[]'::jsonb,
  variations jsonb not null default '[]'::jsonb,
  material text,
  weight text,
  dimensions text,
  warranty text,
  tags jsonb not null default '[]'::jsonb,
  rating numeric(3,2) not null default 0,
  reviews_count integer not null default 0,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_idx on public.products(status);
create index if not exists products_category_idx on public.products(category);

-- ---------- updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute procedure public.set_updated_at();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.products enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "products_public_read_published" on public.products;
create policy "products_public_read_published"
on public.products for select
using (status = 'published' or public.is_admin());

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert"
on public.products for insert
with check (public.is_admin());

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
on public.products for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
on public.products for delete
using (public.is_admin());

-- ---------- product image storage ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());

-- ---------- profile photo storage ----------
-- This bucket was missing, which is why uploaded signup photos never
-- reached Supabase: every avatar upload silently failed (bucket not found),
-- so avatar_url stayed empty and the dashboard/admin pages had nothing to
-- show but the per-browser local cache (or, on admin.html, a placeholder).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- AFTER YOU CREATE YOUR ADMIN ACCOUNT:
-- Replace the email below with the admin email you registered.
-- Run this as a separate statement in SQL Editor.
-- ============================================================
-- update public.profiles set role = 'admin' where email = 'your-admin@email.com';

-- Optional: see your users and roles
-- select id, email, full_name, role, created_at from public.profiles order by created_at desc;
