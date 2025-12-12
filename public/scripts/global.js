/* =====================================================
   Square Bidness — Global JS
   Analytics · Year update · Mailchimp
===================================================== */

// ---- GA4 helpers ----
window.SB = window.SB || {};
window.SB.ga = window.SB.ga || {};

SB.ga.evt = (name, params = {}) => {
  try { window.gtag && gtag('event', name, params); } catch {}
};

SB.ga.view_item      = (data) => SB.ga.evt('view_item', data);
SB.ga.add_to_cart    = (data) => SB.ga.evt('add_to_cart', data);
SB.ga.begin_checkout = (data) => SB.ga.evt('begin_checkout', data);
SB.ga.purchase       = (data) => SB.ga.evt('purchase', data);
SB.ga.subscribe      = (where = 'footer') => SB.ga.evt('generate_lead', { method: `mailchimp_${where}` });
SB.ga.search         = (q) => SB.ga.evt('search', { search_term: q || '' });

// ---- Footer year ----
(() => {
  const y = String(new Date().getFullYear());
  const ids = ['sb-year', 'y', 'tech-year'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = y;
  });
})();

// ---- Mailchimp submit ping ----
document.addEventListener('submit', (e) => {
  const form = e.target && e.target.closest ? e.target.closest('#mc-embedded-subscribe-form') : null;
  if (!form) return;
  SB.ga.subscribe('footer');
});

// ---- Track “Add to Cart” custom event ----
window.addEventListener('sb:add_to_cart', (e) => {
  const d = (e && e.detail) ? e.detail : {};
  const price = Number(d.price || 0);
  const qty   = Number(d.quantity || 1);

  SB.ga.add_to_cart({
    currency: 'USD',
    value: price * qty,
    items: [{
      item_id: d.item_id || '',
      item_name: d.item_name || '',
      price,
      quantity: qty
    }]
  });
});

// ---- Track site search (?q=) ----
(() => {
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get('q');
    if (q) SB.ga.search(q);
  } catch {}
})();
