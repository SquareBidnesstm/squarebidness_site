/* =====================================================
   Square Bidness — Global JS
   Analytics · Year update · Mailchimp
===================================================== */

(() => {
  // Always anchor to window (prevents "SB is undefined" issues)
  const SB = (window.SB = window.SB || {});
  SB.ga = SB.ga || {};

  // ---- GA4 helpers ----
  SB.ga.evt = (name, params = {}) => {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
    } catch {}
  };

  SB.ga.view_item = (data) => SB.ga.evt('view_item', data);
  SB.ga.add_to_cart = (data) => SB.ga.evt('add_to_cart', data);
  SB.ga.begin_checkout = (data) => SB.ga.evt('begin_checkout', data);
  SB.ga.purchase = (data) => SB.ga.evt('purchase', data);
  SB.ga.subscribe = (where = 'footer') =>
    SB.ga.evt('generate_lead', { method: `mailchimp_${where}` });
  SB.ga.search = (q) => SB.ga.evt('search', { search_term: q || '' });

  // ---- Footer year (supports multiple ids) ----
  const y = String(new Date().getFullYear());
  ['sb-year', 'y', 'tech-year'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = y;
  });

  // ---- Mailchimp submit ping ----
  document.addEventListener('submit', (e) => {
    const f = e.target && e.target.closest ? e.target.closest('#mc-embedded-subscribe-form') : null;
    if (!f) return;
    SB.ga.subscribe('footer');
  });

  // ---- Track “Add to Cart” custom event ----
  window.addEventListener('sb:add_to_cart', (e) => {
    const d = (e && e.detail) || {};
    SB.ga.add_to_cart({
      currency: 'USD',
      value: (d.price || 0) * (d.quantity || 1),
      items: [
        {
          item_id: d.item_id,
          item_name: d.item_name,
          price: d.price,
          quantity: d.quantity
        }
      ]
    });
  });

  // ---- Track site search (?q=) ----
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get('q');
    if (q) SB.ga.search(q);
  } catch {}
})();
