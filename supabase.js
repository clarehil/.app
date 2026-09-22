/* Supabase connection for Clarehil/Lumē webapp.
   The anon key is safe to expose in browser code when Row Level Security is enabled.
   NEVER put a Supabase service_role key in this file. */
const SUPABASE_URL = 'https://mfxwkzmebrasnactoqfr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1meHdrem1lYnJhc25hY3RvcWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNDgzMjEsImV4cCI6MjEwNTYyNDMyMX0.h5OAA3h9BhEJgQNm75tkJV-_9b6NUhtBkyGA18kO2bM';

window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.getCurrentUser = async function () {
  const { data: { user } } = await window.sb.auth.getUser();
  return user || null;
};

window.profileCacheKey = function (userId) {
  return `clarehil_profile_${userId}`;
};

window.cacheProfile = function (profile) {
  if (!profile || !profile.id) return;
  try {
    localStorage.setItem(window.profileCacheKey(profile.id), JSON.stringify(profile));
  } catch (e) {
    console.warn('Could not cache profile locally', e);
  }
};

window.getCachedProfile = function (userId) {
  try {
    const raw = localStorage.getItem(window.profileCacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};


window.fileToProfileDataUrl = function(file, maxSize = 512, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!file.type || !file.type.startsWith('image/')) return reject(new Error('Please select an image file.'));
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read image.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not decode image.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};

window.getProfileAvatarFallback = function(userId) {
  const cached = userId && window.getCachedProfile(userId);
  return cached?.avatar_url || '';
};


window.syncCachedAvatarToSupabase = async function(userId, cachedAvatar) {
  if (!userId || !cachedAvatar || !cachedAvatar.startsWith('data:image/')) return '';
  try {
    const response = await fetch(cachedAvatar);
    const blob = await response.blob();
    const path = `${userId}/profile-${Date.now()}.jpg`;
    const upload = await window.sb.storage.from('avatars').upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600'
    });
    if (upload.error) return '';
    const { data: pub } = window.sb.storage.from('avatars').getPublicUrl(path);
    const publicUrl = pub?.publicUrl || '';
    if (!publicUrl) return '';
    await window.sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
    return publicUrl;
  } catch (e) {
    console.warn('Could not sync cached profile photo to Supabase yet.', e);
    return '';
  }
};

window.getCurrentProfile = async function (options = {}) {
  const user = await window.getCurrentUser();
  if (!user) return null;

  const cached = window.getCachedProfile(user.id);

  try {
    const { data, error } = await window.sb.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    let avatarUrl = data?.avatar_url || cached?.avatar_url || '';
    // If signup saved the photo locally as a data URL because email confirmation
    // prevented Storage upload, sync that photo to Supabase after the first login.
    if (!data?.avatar_url && cached?.avatar_url?.startsWith('data:image/')) {
      const syncedUrl = await window.syncCachedAvatarToSupabase(user.id, cached.avatar_url);
      if (syncedUrl) avatarUrl = syncedUrl;
    }
    const profile = {
      ...(cached || {}),
      ...(data || {}),
      id: user.id,
      email: data?.email || user.email || cached?.email || '',
      full_name: data?.full_name || user.user_metadata?.full_name || cached?.full_name || '',
      avatar_url: avatarUrl
    };
    window.cacheProfile(profile);
    return profile;
  } catch (error) {
    if (cached) return cached;
    if (options.allowAuthMetadataFallback !== false) {
      const fallback = {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        phone: user.user_metadata?.phone || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        role: 'user'
      };
      window.cacheProfile(fallback);
      return fallback;
    }
    throw error;
  }
};

window.requireAuth = async function (redirect = 'auth_updated.html') {
  const user = await window.getCurrentUser();
  if (!user) {
    window.location.href = redirect;
    return null;
  }
  return user;
};

window.requireAdmin = async function (redirect = 'dashboard.html') {
  const user = await window.getCurrentUser();
  if (!user) {
    window.location.href = 'auth_updated.html';
    return null;
  }
  const profile = await window.getCurrentProfile({ allowAuthMetadataFallback: false });
  if (!profile || profile.role !== 'admin') {
    alert('Administrator access is required.');
    window.location.href = redirect;
    return null;
  }
  return { user, profile };
};

window.mapProduct = function (row) {
  const images = Array.isArray(row.images) ? row.images : [];
  return {
    id: row.id,
    name: row.name,
    category: row.category || 'Other',
    brand: row.brand || '',
    price: Number(row.price || 0),
    originalPrice: Number(row.original_price || 0),
    rating: Number(row.rating || 0),
    reviews: Number(row.reviews_count || 0),
    stock: Number(row.stock || 0) > 0 ? 'In Stock' : 'Out of Stock',
    description: row.short_description || '',
    longDescription: row.long_description || '',
    images,
    colors: row.colors || [],
    colorNames: row.color_names || [],
    sizes: row.sizes || [],
    features: row.features || [],
    specs: row.specs || [],
    variations: row.variations || [],
    material: row.material || '',
    weight: row.weight || '',
    dimensions: row.dimensions || '',
    warranty: row.warranty || '',
    tags: row.tags || [],
    status: row.status || 'published'
  };
};
