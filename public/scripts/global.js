/* =====================================================
   Square Bidness — Global JS
   Analytics · Year update · Mailchimp
   (Service Worker handled separately in sw-register.js)
===================================================== */

// ---- GA4 helpers ----
window.SB = window.SB || {};
SB.ga = {
  evt: (name, params = {}) => {
    try { window.gtag && gtag('event', name, params); } catch {}
  },
  view_item: (data) => SB.ga.evt('view_item', data),
  add_to_cart: (data) => SB.ga.evt('add_to_cart', data),
  begin_checkout: (data) => SB.ga.evt('begin_checkout', data),
  purchase: (data) => SB.ga.evt('purchase', data),
  subscribe: (where = 'footer') =>
    SB.ga.evt('generate_lead', { method: `mailchimp_${where}` }),
  search: (q) => SB.ga.evt('search', { search_term: q || '' })
};

// ---- Footer year + Tech Lab credit ----
(() => {
  const y = new Date().getFullYear();
  const a = document.getElementById('y');
  const b = document.getElementById('tech-year');
  if (a) a.textContent = y;
  if (b) b.textContent = y;
})();

// ---- Mailchimp submit ping ----
document.addEventListener('submit', (e) => {
  const f = e.target.closest('#mc-embedded-subscribe-form');
  if (!f) return;
  SB.ga.subscribe('footer');
});

// ---- Track “Add to Cart” custom event ----
window.addEventListener('sb:add_to_cart', (e) => {
  const d = e.detail || {};
  SB.ga.add_to_cart({
    currency: 'USD',
    value: (d.price || 0) * (d.quantity || 1),
    items: [{
      item_id: d.item_id,
      item_name: d.item_name,
      price: d.price,
      quantity: d.quantity
    }]
  });
});

// ---- Track site search (?q=) ----
(function trackSearchFromURL() {
  const u = new URL(location.href);
  const q = u.searchParams.get('q');
  if (q) SB.ga.search(q);
})();
