/* ==========================================================================
   LUMĒ — Luxury Commerce (demo front end)
   No backend: "checkout", "payment", etc. mutate local state so every
   control has a real, visible effect instead of doing nothing.

   Structure:
   1. Data
   2. State
   3. Utilities
   4. Icons
   5. Chrome — top bar / tab bar / app shell
   6. Views  — one function per screen, returns HTML for <main>
   7. Bindings — wires up the buttons a view just rendered
   8. Router
   ========================================================================== */

/* ---------------------------------------------------------------------- */
/* 1. Data                                                                 */
/* ---------------------------------------------------------------------- */
const image = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=88`;

let products = [];

const categories = [
  ["Furniture", image("photo-1618221195710-dd6b41faaea6")],
  ["Lighting", image("photo-1524484485831-a92ffc0de03f")],
  ["Decor", image("photo-1600210492486-724fe5c67fb0")],
  ["Dining", image("photo-1600566753086-00f18fb6b3ea")]
];

const PROMO_CODE = "LUME10"; // 10% off — the only code the demo recognises

/* ---------------------------------------------------------------------- */
/* 2. State                                                                */
/* ---------------------------------------------------------------------- */
const state = {
  user: { id: '', name: 'Customer', email: '', phone: '', avatar: '' },
  wishlist: new Set(),
  cart: [],
  query: "",
  detailImage: 0,
  color: 0,
  size: 0,
  quantity: 1,
  tab: "Overview",
  promoInput: "",
  promoApplied: false,
  addresses: [],
  payments: [
    { id: 1, brand: "Mastercard", last4: "4587", exp: "08/28", isDefault: true }
  ],
  settings: { orderUpdates: true, newArrivals: true, promoEmails: false },
  faqOpen: null,
  lastOrder: null,
  nextAddressId: 1,
  nextPaymentId: 2
};

/* ---------------------------------------------------------------------- */
/* 3. Utilities                                                            */
/* ---------------------------------------------------------------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const money = n => `₦${Math.round(n).toLocaleString("en-NG")}`;
const product = id => products.find(p => String(p.id) === String(id));

async function loadProductsFromSupabase() {
  const { data, error } = await window.sb.from('products').select('*').eq('status','published').order('created_at',{ascending:false});
  if (error) { console.error(error); toast('Could not load products.'); return; }
  products = (data || []).map(window.mapProduct);
  render();
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const cartCount = () => state.cart.reduce((a, x) => a + x.quantity, 0);
const cartLines = () => state.cart.map(line => ({ line, item: product(line.id) }));
const cartSubtotal = () => cartLines().reduce((a, { line, item }) => a + item.price * line.quantity, 0);
const cartDiscount = () => (state.promoApplied ? cartSubtotal() * 0.1 : 0);
const cartTotal = () => cartSubtotal() - cartDiscount();

function on(selector, event, handler) {
  $$(selector).forEach(el => el.addEventListener(event, handler));
}

let toastTimer = null;
function toast(message) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

function go(hash) {
  location.hash = hash;
}

/* ---------------------------------------------------------------------- */
/* 4. Icons                                                                */
/* ---------------------------------------------------------------------- */
function icon(name) {
  const paths = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    heart: '<path d="M20.8 8.7c0 5.2-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/>',
    bag: '<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
    returns: '<path d="M4 7v5h5"/><path d="M20 17v-5h-5"/><path d="M6 12a7 7 0 0 1 12-4M18 12a7 7 0 0 1-12 4"/>',
    expand: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.5-4 4-5.5 7-5.5s5.5 1.5 7 5.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M4.6 12a7.4 7.4 0 0 1 .3-2.1L3 8.4l1.6-2.8 2.3.9c.7-.7 1.5-1.2 2.4-1.6L9.7 2h3.2l.4 2.9c.9.4 1.7.9 2.4 1.6l2.3-.9L19.6 8.4l-1.9 1.5c.2.7.3 1.4.3 2.1s-.1 1.4-.3 2.1l1.9 1.5-1.6 2.8-2.3-.9c-.7.7-1.5 1.2-2.4 1.6l-.4 2.9H9.7l-.4-2.9a7 7 0 0 1-2.4-1.6l-2.3.9L3 15.6l1.9-1.5c-.2-.7-.3-1.4-.3-2.1Z"/>',
    mail: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
    card: '<path d="M3 7h18v10H3z"/><path d="M3 10h18"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
    phone: '<path d="M6.5 3.5 9 7l-2 2.2c.9 2 2.8 3.9 4.8 4.8L14 12l3.5 2.5-.7 3a17 17 0 0 1-13.8-13.8Z"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ""}</svg>`;
}

/* ---------------------------------------------------------------------- */
/* 5. Chrome                                                               */
/* ---------------------------------------------------------------------- */
function topbar({ title = "", back = false } = {}) {
  if (back) {
    return `<header class="topbar sub">
      <button class="icon-circle" data-back aria-label="Go back">${icon("back")}</button>
      <span class="bar-title">${title}</span>
    </header>`;
  }
  return `<header class="topbar">
    <a class="brand-lockup" href="#" data-nav="home" aria-label="Clarehil Styles home">
      <img class="brand-logo" src="assets/clarehil-styles-logo.png" alt="Clarehil Styles" decoding="async">
    </a>
    <button class="icon-circle topbar-account" data-nav="account" aria-label="Account">
      ${state.user.avatar
        ? `<img class="topbar-avatar" src="${escapeHtml(state.user.avatar)}" data-profile-avatar="${escapeHtml(state.user.id || '')}" onerror="window.handleProfileAvatarError && window.handleProfileAvatarError(this)" alt="${escapeHtml(state.user.name || 'Account')}">`
        : `<span class="topbar-initial">${escapeHtml((state.user.name || 'C').trim().charAt(0).toUpperCase())}</span>`}
    </button>
  </header>`;
}

function tabbar(active) {
  const wishCount = state.wishlist.size;
  const bagCount = cartCount();
  const item = (key, label, iconName, badge) => `
    <button class="menu-item ${active === key ? "active" : ""}" data-nav="${key}">
      <span class="menu-item-icon">${icon(iconName)}${badge ? `<b>${badge}</b>` : ""}</span>
      <span>${label}</span>
    </button>`;
  return `
    <button class="menu-fab" id="menuFab" aria-label="Open menu">${icon("menu")}</button>
    <div class="menu-popup-overlay" id="menuOverlay">
      <div class="menu-popup" role="dialog" aria-label="Navigation menu">
        <button class="menu-popup-close" id="menuPopupClose" aria-label="Close menu">${icon("close")}</button>
        <div class="menu-popup-title">Menu</div>
        <div class="menu-popup-rule"></div>
        <div class="menu-popup-grid">
          ${item("home", "Home", "home")}
          ${item("wishlist", "Wishlist", "heart", wishCount || "")}
          ${item("cart", "Bag", "bag", bagCount || "")}
          ${item("account", "Account", "user")}
        </div>
      </div>
    </div>`;
}

function lightbox(src) {
  return `<div class="lightbox" id="lightbox">
    <button id="closeLightbox" aria-label="Close">${icon("close")}</button>
    <img id="lightboxImg" src="${src || ""}" alt="">
  </div>`;
}

/**
 * Renders a full screen: chrome + view content, then rebinds events.
 * @param {string} inner - HTML for <main>
 * @param {object} opts - { title, back, tab } — tab shows the tab bar; back shows a back header
 */
function paint(inner, opts = {}) {
  $("#app").innerHTML = `
    ${topbar(opts)}
    <main class="screen ${opts.tab ? "has-menu-fab" : ""}">${inner}</main>
    ${opts.tab ? tabbar(opts.tab) : ""}
    <div class="toast" id="toast"></div>
    ${lightbox()}
  `;
  bindChrome();
}

/* ---------------------------------------------------------------------- */
/* 6. Views                                                                */
/* ---------------------------------------------------------------------- */
function productCard(p) {
  return `<article class="product-card">
    <button class="heart-btn ${state.wishlist.has(p.id) ? "active" : ""}" data-wish-id="${p.id}" aria-label="Toggle wishlist">${icon("heart")}</button>
    <button class="product-image" data-open-product="${p.id}"><img src="${p.images[0]}" alt="${p.name}" loading="lazy"></button>
    <div class="product-info">
      <span class="eyebrow">${p.category}</span>
      <h3>${p.name}</h3>
      <div class="product-price-row">
        <strong>${money(p.price)}</strong>
        <button class="add-btn" data-add="${p.id}" aria-label="Add to bag">${icon("bag")}</button>
      </div>
    </div>
  </article>`;
}

function recentOrderRow(p, i) {
  return `<button class="order-row" data-open-product="${p.id}">
    <span class="order-thumb"><img src="${p.images[0]}" alt=""></span>
    <span class="order-row-mid"><strong>${p.name}</strong><span>Order #LM-${10482 - i * 143}</span></span>
    <span class="order-status ${i ? "transit" : "delivered"}">${i ? "In transit" : "Delivered"}</span>
  </button>`;
}

function viewHome() {
  const q = state.query.toLowerCase();
  const filtered = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(q));
  return `
    <section class="search-row">
      ${icon("search")}
      <input id="search" placeholder="Search the collection" value="${escapeHtml(state.query)}">
    </section>

    <section class="hero">
      <span class="eyebrow">Spring 2026</span>
      <h1>Modern living,<br>elevated.</h1>
      <p>Curated pieces designed to make everyday spaces feel extraordinary.</p>
      <button class="btn-primary" data-scroll-shop>Shop now ${icon("arrow")}</button>
    </section>

    <section class="block">
      <div class="block-head"><h2>Shop by category</h2></div>
      <div class="category-scroller">
        ${categories.map(([name, img]) => `
          <button class="category-card" data-cat="${name}">
            <img src="${img}" alt="${name}">
            <span>${name}</span>
          </button>`).join("")}
      </div>
    </section>

    <section class="block" id="shop">
      <div class="block-head"><h2>Featured pieces</h2></div>
      <div class="product-grid">
        ${filtered.length ? filtered.map(productCard).join("") : `<div class="empty-state">${state.query ? `Nothing matches “${escapeHtml(state.query)}” yet.` : `No products have been published yet. Please check back soon.`}</div>`}
      </div>
    </section>

    <section class="block orders-block">
      <div class="block-head"><h2>Recent orders</h2><button class="text-btn" data-nav="account">View all</button></div>
      <div>${products.slice(0, 2).map(recentOrderRow).join("")}</div>
    </section>

    <section class="promo-banner">
      <span class="eyebrow">Members only</span>
      <h3>10% off your<br>first order.</h3>
      <p>Use code <strong>${PROMO_CODE}</strong> at checkout to unlock it.</p>
      <button class="btn-secondary" data-copy-promo>Copy code</button>
    </section>

    <section class="cta-banner">
      <div class="cta-glow"></div>
      <span class="eyebrow">Design without compromise</span>
      <h2>Transform your space.</h2>
      <p>Small details, considered design — a home that feels entirely yours.</p>
      <button class="btn-primary" data-scroll-shop>Explore the collection ${icon("arrow")}</button>
    </section>

    <footer class="app-footer">
      <button data-scroll-shop>Shop</button>
      <button data-cat="Furniture">Collections</button>
      <button data-nav="about">About</button>
      <button data-nav="support">Support</button>
      <span class="foot-line">© 2026 Lumē Studio</span>
    </footer>
  `;
}

function galleryDetail(p) {
  const img = p.images[state.detailImage % p.images.length];
  return `
    <div class="crumb">
      <button data-nav="home">Home</button><span>/</span><span>${p.category}</span><span>/</span><strong>${p.name}</strong>
    </div>
    <div class="gallery">
      <div class="gallery-main">
        <img src="${img}" alt="${p.name}">
        <button class="gallery-expand" id="expand">${icon("expand")}</button>
        <div class="gallery-dots">
          ${p.images.map((_, i) => `<button class="gallery-dot ${i === state.detailImage ? "active" : ""}" data-img="${i}"></button>`).join("")}
        </div>
      </div>
      <div class="thumb-row">
        ${p.images.map((img2, i) => `<button class="thumb ${i === state.detailImage ? "active" : ""}" data-img="${i}"><img src="${img2}" alt=""></button>`).join("")}
      </div>
    </div>`;
}

function tabContent(p) {
  if (state.tab === "Specifications") {
    return `<div class="tab-panel">
      <p>Thoughtfully selected materials and dimensions, presented with quiet precision.</p>
      <div class="spec-list">${p.specs.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("")}</div>
    </div>`;
  }
  if (state.tab === "What's in the Box") {
    return `<div class="tab-panel">
      <p>Everything you need, nothing you don't. Your ${p.name} arrives carefully prepared.</p>
      <div class="box-list">${p.box.map((x, i) => `<div><span>${String(i + 1).padStart(2, "0")}</span><strong>${x}</strong></div>`).join("")}</div>
    </div>`;
  }
  if (state.tab === "Reviews") {
    return `<div class="tab-panel">
      <p>${p.rating} ★★★★★ based on ${p.reviews.toLocaleString()} verified reviews.</p>
      <div class="review-summary">${[92, 6, 2, 0, 0].map((n, i) => `<div><span>${5 - i}</span><i style="--fill:${n}%"></i></div>`).join("")}</div>
      <div class="review-quote">
        <p>"Beautifully considered from every angle — the materials feel exceptional and the piece has become part of the room."</p>
        <small>Verified customer · 14 days ago</small>
      </div>
    </div>`;
  }
  return `<div class="tab-panel">
    <p>${p.description} Every detail is considered to make the experience feel effortless, elevated and quietly personal.</p>
    <ul class="feature-list">${p.features.map(x => `<li>${icon("check")}<span>${x}</span></li>`).join("")}</ul>
  </div>`;
}

function viewDetail(p) {
  const related = products.filter(x => x.id !== p.id).slice(0, 4);
  return `
    ${galleryDetail(p)}
    <div class="detail-info">
      <span class="eyebrow">${p.brand}</span>
      <h1>${p.name}</h1>
      <p class="detail-sub">${p.category} · Premium Collection</p>
      <div class="detail-rating">
        <span class="stars">★★★★★</span><strong>${p.rating}</strong>
        <button id="reviewsLink">${p.reviews} reviews</button>
      </div>
      <div class="detail-price-row">
        <strong>${money(p.price)}</strong>
        <span class="stock-pill">${p.stock}</span>
      </div>
      <p class="detail-desc">${p.description}</p>

      <div class="option-group">
        <div class="option-label"><strong>Color</strong><span>${p.colorNames[state.color]}</span></div>
        <div class="color-options">
          ${p.colors.map((c, i) => `<button class="color-swatch ${i === state.color ? "selected" : ""}" style="background:${c}" data-color="${i}" aria-label="${p.colorNames[i]}"></button>`).join("")}
        </div>
      </div>
      <div class="option-group">
        <div class="option-label"><strong>Size / Variant</strong><span>${p.sizes[state.size]}</span></div>
        <div class="size-options">
          ${p.sizes.map((s, i) => `<button class="size-option ${i === state.size ? "selected" : ""}" data-size="${i}">${s}</button>`).join("")}
        </div>
      </div>

      <div class="purchase-row">
        <div class="qty-stepper">
          <button data-qty="-1" aria-label="Decrease quantity">−</button>
          <span>${state.quantity}</span>
          <button data-qty="1" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn-dark add-bag-btn" id="addBag">${icon("bag")} Add to bag</button>
        <button class="wish-toggle ${state.wishlist.has(p.id) ? "active" : ""}" id="wishToggle" aria-label="Toggle wishlist">${icon("heart")}</button>
      </div>

      <div class="service-grid">
        <div>${icon("truck")}<div><strong>Free delivery</strong><span>2–5 business days</span></div></div>
        <div>${icon("shield")}<div><strong>Secure checkout</strong><span>100% safe & encrypted</span></div></div>
        <div>${icon("returns")}<div><strong>Easy returns</strong><span>14-day return policy</span></div></div>
      </div>
    </div>

    <div class="detail-tabs">
      ${["Overview", "Specifications", "What's in the Box", "Reviews"].map(t => `<button class="detail-tab ${state.tab === t ? "active" : ""}" data-tab="${t}">${t}</button>`).join("")}
    </div>
    ${tabContent(p)}

    <section class="block">
      <div class="block-head"><h2>You may also like</h2></div>
    </section>
    <div class="related-scroller">${related.map(productCard).join("")}</div>
  `;
}

function viewCart() {
  const lines = cartLines();
  const count = cartCount();
  if (!lines.length) {
    return `
      <div class="page-heading"><h1>Your bag</h1></div>
      <div class="cart-empty">
        <h2>Nothing here yet.</h2>
        <p>Explore the collection and add something you love.</p>
        <button class="btn-primary" data-nav="home">Continue shopping</button>
      </div>`;
  }
  return `
    <div class="page-heading">
      <h1>${count} item${count === 1 ? "" : "s"} in your bag</h1>
      <p>Review your items, make any changes, and check out when you're ready.</p>
    </div>
    <div>${lines.map(({ line, item }) => `
      <article class="cart-item">
        <button class="cart-item-image" data-open-product="${item.id}"><img src="${item.images[0]}" alt=""></button>
        <div class="cart-item-info">
          <span class="eyebrow">${item.brand}</span>
          <h3>${item.name}</h3>
          <p>${item.colorNames[0]} · ${item.sizes[0]}</p>
          <div class="cart-qty">
            <button data-cid="${item.id}" data-cq="-1" aria-label="Decrease quantity">−</button>
            <span>${line.quantity}</span>
            <button data-cid="${item.id}" data-cq="1" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <strong>${money(item.price * line.quantity)}</strong>
          <button class="cart-remove" data-remove="${item.id}">Remove</button>
        </div>
      </article>`).join("")}
    </div>

    <div class="promo-row">
      <input id="promo" placeholder="Promo code" value="${escapeHtml(state.promoInput)}">
      <button id="promoBtn">Apply</button>
    </div>

    <section class="summary-card">
      <h2 style="font-size:15px;margin-bottom:12px;">Order summary</h2>
      <div class="summary-line"><span>Subtotal (${count} item${count === 1 ? "" : "s"})</span><strong>${money(cartSubtotal())}</strong></div>
      ${state.promoApplied ? `<div class="summary-line discount"><span>Promo (${PROMO_CODE})</span><strong>−${money(cartDiscount())}</strong></div>` : ""}
      <div class="summary-line"><span>Shipping</span><strong>Free</strong></div>
      <div class="summary-total"><span>Total</span><strong>${money(cartTotal())}</strong></div>
      <button class="btn-dark btn-block" id="checkout">Proceed to checkout →</button>
      <div class="secure-note">${icon("shield")} Secure checkout · 100% safe & encrypted</div>
    </section>
  `;
}

function viewOrderConfirmed() {
  const order = state.lastOrder;
  if (!order) return viewHome();
  return `
    <div class="confirm-screen">
      <div class="confirm-mark">${icon("check")}</div>
      <h1>Order placed</h1>
      <p>Thank you — your order is confirmed and on its way to being prepared with care.</p>
      <div class="confirm-code">Order <strong>#${order.code}</strong> · ${money(order.total)}</div>
      <button class="btn-primary" data-nav="home">Continue shopping</button>
    </div>`;
}

function viewWishlist() {
  const items = products.filter(p => state.wishlist.has(p.id));
  return `
    <div class="page-heading"><h1>Your wishlist</h1><p>Pieces you're keeping an eye on.</p></div>
    ${items.length
      ? `<div class="block"><div class="product-grid">${items.map(productCard).join("")}</div></div>`
      : `<div class="cart-empty"><h2>Nothing saved yet.</h2><p>Tap the heart on any piece to save it here.</p><button class="btn-primary" data-nav="home">Browse the collection</button></div>`}
  `;
}

function viewAccount() {
  const name = state.user.name || 'Customer';
  const email = state.user.email || '';
  const phone = state.user.phone || 'Not provided';
  const initial = escapeHtml(name.trim().charAt(0).toUpperCase() || 'C');
  const avatar = state.user.avatar
    ? `<img src="${escapeHtml(state.user.avatar)}" data-profile-avatar="${escapeHtml(state.user.id || '')}" onerror="window.handleProfileAvatarError && window.handleProfileAvatarError(this)" alt="${escapeHtml(name)}">`
    : initial;
  return `
    <div class="profile-card">
      <div class="profile-avatar ${state.user.avatar ? 'has-image' : ''}">${avatar}</div>
      <div><h2>${escapeHtml(name)}</h2><p>${escapeHtml(email)}</p></div>
    </div>
    <nav class="menu-list">
      <button class="menu-row" data-nav="account-addresses">${icon("pin")}<span>Shipping addresses</span>${icon("chev")}</button>
      <button class="menu-row" data-nav="account-payments">${icon("card")}<span>Payment methods</span>${icon("chev")}</button>
      <button class="menu-row" data-nav="account-settings">${icon("gear")}<span>Settings</span>${icon("chev")}</button>
      <button class="menu-row" data-nav="support">${icon("mail")}<span>Support</span>${icon("chev")}</button>
    </nav>
    <div class="info-card">
      <div class="info-card-top"><h2>Personal information</h2></div>
      <div class="field-grid">
        <div><span>Full name</span><strong>${escapeHtml(name)}</strong></div>
        <div><span>Email address</span><strong>${escapeHtml(email)}</strong></div>
        <div><span>Phone number</span><strong>${escapeHtml(phone)}</strong></div>
      </div>
    </div>
    <div class="info-card">
      <div class="info-card-top"><h2>Recent orders</h2></div>
      <div>${products.slice(1, 4).map(recentOrderRow).join("")}</div>
    </div>
  `;
}
function viewAddresses() {
  return `
    <div class="page-heading"><h1>Shipping addresses</h1></div>
    <div class="info-card">
      ${state.addresses.map(a => `
        <div class="list-row">
          <div class="list-row-icon">${icon("pin")}</div>
          <div class="list-row-body">
            ${a.tag ? `<span class="tag-pill">${a.tag}</span>` : ""}
            <strong>${escapeHtml(a.name)}</strong>
            <p>${escapeHtml(a.line1)}</p>
            <p>${escapeHtml(a.line2)}</p>
          </div>
          <div class="row-actions">
            <button data-edit-address="${a.id}">Edit</button>
            <button class="danger" data-delete-address="${a.id}">Delete</button>
          </div>
        </div>`).join("") || `<p style="font-size:13px;color:var(--ink-soft)">No saved addresses yet.</p>`}
    </div>
    <div class="block" style="padding-top:14px;"><button class="btn-secondary btn-block" id="addAddress">+ Add new address</button></div>
  `;
}

function viewPayments() {
  return `
    <div class="page-heading"><h1>Payment methods</h1></div>
    <div class="info-card">
      ${state.payments.map(c => `
        <div class="list-row">
          <div class="list-row-icon">${icon("card")}</div>
          <div class="list-row-body">
            ${c.isDefault ? `<span class="tag-pill">Default</span>` : ""}
            <strong>${c.brand} •••• ${c.last4}</strong>
            <p>Expires ${c.exp}</p>
          </div>
          <div class="row-actions">
            ${c.isDefault ? "" : `<button data-default-payment="${c.id}">Make default</button>`}
            <button class="danger" data-delete-payment="${c.id}">Delete</button>
          </div>
        </div>`).join("") || `<p style="font-size:13px;color:var(--ink-soft)">No saved cards yet.</p>`}
    </div>
    <div class="block" style="padding-top:14px;"><button class="btn-secondary btn-block" id="addPayment">+ Add new card</button></div>
  `;
}

function viewSettings() {
  const rows = [
    ["orderUpdates", "Order updates", "Delivery and order status alerts"],
    ["newArrivals", "New arrivals", "Be first to see new collections"],
    ["promoEmails", "Promotional emails", "Offers, discounts and members' news"]
  ];
  return `
    <div class="page-heading"><h1>Settings</h1></div>
    <div class="info-card">
      ${rows.map(([key, label, desc]) => `
        <div class="toggle-row">
          <div><strong>${label}</strong><span>${desc}</span></div>
          <button class="switch ${state.settings[key] ? "on" : ""}" data-toggle="${key}" aria-label="Toggle ${label}"></button>
        </div>`).join("")}
    </div>
    <div class="block" style="padding-top:14px;"><button class="btn-secondary btn-block" id="signOut">Sign out</button></div>
  `;
}

const faqs = [
  ["How long does delivery take?", "Most pieces arrive within 2–5 business days. Made-to-order items ship in 4–6 weeks and you'll get tracking as soon as it's on the way."],
  ["What is your return policy?", "You have 14 days from delivery to return an item in its original condition for a full refund."],
  ["Do you offer white-glove delivery?", "Yes — large furniture pieces include complimentary white-glove delivery and setup."]
];

function viewSupport() {
  return `
    <div class="page-heading"><h1>Support</h1><p>We're here to help with anything, any time.</p></div>
    <div class="info-card">
      <a class="list-row" href="mailto:hello@lume-studio.example">
        <span class="list-row-icon">${icon("mail")}</span>
        <span class="list-row-body"><strong>Email us</strong><p>hello@lume-studio.example</p></span>
      </a>
      <a class="list-row" href="tel:+2348001234567">
        <span class="list-row-icon">${icon("phone")}</span>
        <span class="list-row-body"><strong>Call us</strong><p>+234 800 123 4567</p></span>
      </a>
    </div>
    <div class="info-card">
      <div class="info-card-top"><h2>Frequently asked</h2></div>
      ${faqs.map((f, i) => `
        <div class="faq-item ${state.faqOpen === i ? "open" : ""}">
          <button class="faq-q" data-faq="${i}"><span>${f[0]}</span>${icon("chevDown")}</button>
          <div class="faq-a">${f[1]}</div>
        </div>`).join("")}
    </div>
  `;
}

function viewAbout() {
  return `
    <div class="page-heading"><h1>About Lumē</h1></div>
    <div class="info-card">
      <p style="font-size:13px;color:var(--ink-soft);line-height:1.7;">
        Lumē was founded on a simple idea: everyday spaces deserve considered design.
        Every piece in the collection is developed with Nuvé Studio, chosen for
        honest materials and quiet, lasting form rather than trend.
      </p>
    </div>
  `;
}

/* ---------------------------------------------------------------------- */
/* 7. Bindings                                                             */
/* ---------------------------------------------------------------------- */
function bindChrome() {
  on("[data-back]", "click", () => history.length > 1 ? history.back() : go(""));
  on("[data-nav]", "click", e => go(e.currentTarget.dataset.nav));
  on("[data-open-product]", "click", e => go("product/" + e.currentTarget.dataset.openProduct));
  on("[data-wish-id]", "click", e => {
    e.stopPropagation();
    toggleWish(Number(e.currentTarget.dataset.wishId));
  });
  on("[data-add]", "click", e => {
    e.stopPropagation();
    addToBag(Number(e.currentTarget.dataset.add));
  });
  $("#menuFab")?.addEventListener("click", () => $("#menuOverlay")?.classList.add("open"));
  $("#menuPopupClose")?.addEventListener("click", () => $("#menuOverlay")?.classList.remove("open"));
  $("#menuOverlay")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
  });
}

function bindHome() {
  on("[data-cat]", "click", e => { state.query = e.currentTarget.dataset.cat; go("home"); });
  on("[data-scroll-shop]", "click", () => $("#shop")?.scrollIntoView({ behavior: "smooth" }));
  $("#search")?.addEventListener("input", e => { state.query = e.target.value; render(); });
  on("[data-copy-promo]", "click", async () => {
    try { await navigator.clipboard.writeText(PROMO_CODE); toast("Promo code copied"); }
    catch { toast(`Your code is ${PROMO_CODE}`); }
  });
}

function bindDetail(p) {
  on("[data-img]", "click", e => { state.detailImage = Number(e.currentTarget.dataset.img); render(); });
  on("[data-color]", "click", e => { state.color = Number(e.currentTarget.dataset.color); render(); });
  on("[data-size]", "click", e => { state.size = Number(e.currentTarget.dataset.size); render(); });
  on("[data-qty]", "click", e => { state.quantity = Math.max(1, Math.min(10, state.quantity + Number(e.currentTarget.dataset.qty))); render(); });
  on("[data-tab]", "click", e => { state.tab = e.currentTarget.dataset.tab; render(); scrollTabsIntoView(); });
  $("#addBag")?.addEventListener("click", () => addToBag(p.id, state.quantity));
  $("#wishToggle")?.addEventListener("click", () => toggleWish(p.id));
  $("#reviewsLink")?.addEventListener("click", () => { state.tab = "Reviews"; render(); scrollTabsIntoView(); });
  $("#expand")?.addEventListener("click", () => {
    $("#lightboxImg").src = p.images[state.detailImage % p.images.length];
    $("#lightbox").classList.add("open");
  });
  $("#closeLightbox")?.addEventListener("click", () => $("#lightbox").classList.remove("open"));
}

function scrollTabsIntoView() {
  $(".detail-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindCart() {
  on("[data-cq]", "click", e => {
    const id = Number(e.currentTarget.dataset.cid);
    const delta = Number(e.currentTarget.dataset.cq);
    const line = state.cart.find(i => i.id === id);
    if (!line) return;
    line.quantity += delta;
    if (line.quantity < 1) state.cart = state.cart.filter(i => i !== line);
    render();
  });
  on("[data-remove]", "click", e => {
    const id = Number(e.currentTarget.dataset.remove);
    state.cart = state.cart.filter(i => i.id !== id);
    toast("Item removed from bag");
    render();
  });
  $("#promo")?.addEventListener("input", e => { state.promoInput = e.target.value; });
  $("#promoBtn")?.addEventListener("click", () => {
    const code = state.promoInput.trim().toUpperCase();
    if (!code) { toast("Enter a promo code first"); return; }
    if (code === PROMO_CODE) { state.promoApplied = true; toast("Promo code applied — 10% off"); }
    else { state.promoApplied = false; toast("That code isn't valid"); }
    render();
  });
  $("#checkout")?.addEventListener("click", () => {
    if (!state.cart.length) { toast("Your bag is empty"); return; }
    state.lastOrder = { code: "LM-" + Math.floor(10000 + Math.random() * 89999), total: cartTotal() };
    state.cart = [];
    state.promoApplied = false;
    state.promoInput = "";
    go("order-confirmed");
  });
}

function bindAddresses() {
  on("[data-delete-address]", "click", e => {
    state.addresses = state.addresses.filter(a => a.id !== Number(e.currentTarget.dataset.deleteAddress));
    toast("Address removed");
    render();
  });
  on("[data-edit-address]", "click", () => toast("Address editing opens here in the full app"));
  $("#addAddress")?.addEventListener("click", () => {
    state.addresses.push({ id: state.nextAddressId++, tag: null, name: state.user.name || "Customer", line1: "New address", line2: "Tap Edit to fill in the details" });
    toast("Address added");
    render();
  });
}

function bindPayments() {
  on("[data-delete-payment]", "click", e => {
    state.payments = state.payments.filter(c => c.id !== Number(e.currentTarget.dataset.deletePayment));
    toast("Card removed");
    render();
  });
  on("[data-default-payment]", "click", e => {
    const id = Number(e.currentTarget.dataset.defaultPayment);
    state.payments.forEach(c => c.isDefault = c.id === id);
    toast("Default card updated");
    render();
  });
  $("#addPayment")?.addEventListener("click", () => {
    state.payments.push({ id: state.nextPaymentId++, brand: "Visa", last4: String(1000 + Math.floor(Math.random() * 8999)), exp: "12/29", isDefault: false });
    toast("Card added");
    render();
  });
}

function bindSettings() {
  on("[data-toggle]", "click", e => {
    const key = e.currentTarget.dataset.toggle;
    state.settings[key] = !state.settings[key];
    render();
  });
  $("#signOut")?.addEventListener("click", async () => { await window.sb.auth.signOut(); window.location.href = "auth_updated.html"; });
}

function bindSupport() {
  on("[data-faq]", "click", e => {
    const i = Number(e.currentTarget.dataset.faq);
    state.faqOpen = state.faqOpen === i ? null : i;
    render();
  });
}

function addToBag(id, qty = 1) {
  const line = state.cart.find(i => i.id === id);
  if (line) line.quantity += qty;
  else state.cart.push({ id, quantity: qty });
  toast(`${product(id).name} added to bag`);
  render();
}

function toggleWish(id) {
  if (state.wishlist.has(id)) { state.wishlist.delete(id); toast("Removed from wishlist"); }
  else { state.wishlist.add(id); toast("Added to wishlist"); }
  render();
}

/* ---------------------------------------------------------------------- */
/* 8. Router                                                               */
/* ---------------------------------------------------------------------- */
function resetProductOptions() {
  state.detailImage = 0;
  state.color = 0;
  state.size = 0;
  state.quantity = 1;
  state.tab = "Overview";
}

function render() {
  const hash = location.hash.replace(/^#/, "");

  if (hash.startsWith("product/")) {
    const p = product(hash.split("/")[1]);
    if (!p) { paint(`<main class="empty-state"><h2>Product not found</h2><p>This product is no longer available.</p></main>`, {back:true,title:"Product"}); return; }
    paint(viewDetail(p), { back: true, title: p.name });
    bindDetail(p);
  } else if (hash === "cart") {
    paint(viewCart(), { tab: "cart" });
    bindCart();
  } else if (hash === "order-confirmed") {
    paint(viewOrderConfirmed(), {});
  } else if (hash === "wishlist") {
    paint(viewWishlist(), { tab: "wishlist" });
  } else if (hash === "account") {
    paint(viewAccount(), { tab: "account" });
  } else if (hash === "account-addresses") {
    paint(viewAddresses(), { back: true, title: "Addresses" });
    bindAddresses();
  } else if (hash === "account-payments") {
    paint(viewPayments(), { back: true, title: "Payment methods" });
    bindPayments();
  } else if (hash === "account-settings") {
    paint(viewSettings(), { back: true, title: "Settings" });
    bindSettings();
  } else if (hash === "support") {
    paint(viewSupport(), { back: true, title: "Support" });
    bindSupport();
  } else if (hash === "about") {
    paint(viewAbout(), { back: true, title: "About" });
  } else {
    paint(viewHome(), { tab: "home" });
    bindHome();
  }
  window.scrollTo(0, 0);
  $(".screen")?.scrollTo(0, 0);
}

window.handleProfileAvatarError = function(img) {
  if (!img || img.dataset.avatarFallbackUsed === '1') return;
  img.dataset.avatarFallbackUsed = '1';
  const userId = img.dataset.profileAvatar || state.user?.id;
  const cached = userId ? window.getCachedProfile(userId) : null;
  const localAvatar = cached?.avatar_url || '';
  if (localAvatar && img.src !== localAvatar) {
    img.src = localAvatar;
    return;
  }
  img.style.display = 'none';
};

window.addEventListener("hashchange", () => {
  // Any real navigation (as opposed to tweaking color/size/qty in place,
  // which re-renders without changing the hash) should reset per-product
  // selection state — otherwise a color index picked on one product could
  // be out of range on the next.
  resetProductOptions();
  render();
});
(async function initApp(){
  const user = await window.requireAuth('auth_updated.html');
  if (!user) return;
  try {
    const profile = await window.getCurrentProfile();
    if (profile) {
      state.user.id = user.id;
      state.user.name = profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer';
      state.user.email = profile.email || user.email || '';
      state.user.phone = profile.phone || user.user_metadata?.phone || '';
      state.user.avatar = profile.avatar_url || user.user_metadata?.avatar_url || '';
      try { localStorage.setItem(window.profileCacheKey(user.id), JSON.stringify(profile)); } catch (e) {}
    }
  } catch (e) {
    console.warn('Profile load failed; using cached/auth profile when available.', e);
    const cached = window.getCachedProfile(user.id);
    state.user.id = user.id;
    state.user.name = cached?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer';
    state.user.email = cached?.email || user.email || '';
    state.user.phone = cached?.phone || user.user_metadata?.phone || '';
    state.user.avatar = cached?.avatar_url || user.user_metadata?.avatar_url || '';
  }
  render();
  await loadProductsFromSupabase();
})();