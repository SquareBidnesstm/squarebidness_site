/* /public/scripts/global.js
   Square Bidness — Global JS
   Analytics · Year update · Mailchimp · Nav toggle
*/
(() => {
  // HARD guarantee: SB + SB.ga exist
  const SB = (window.SB = window.SB || {});
  SB.ga = SB.ga || {};

  // Never crashes if GA not loaded yet
  SB.ga.evt = function(name, params = {}) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
    } catch {}
  };

  SB.ga.view_item      = (data) => SB.ga.evt('view_item', data);
  SB.ga.add_to_cart    = (data) => SB.ga.evt('add_to_cart', data);
  SB.ga.begin_checkout = (data) => SB.ga.evt('begin_checkout', data);
  SB.ga.purchase       = (data) => SB.ga.evt('purchase', data);
  SB.ga.subscribe      = (where = 'footer') => SB.ga.evt('generate_lead', { method: `mailchimp_${where}` });
  SB.ga.search         = (q) => SB.ga.evt('search', { search_term: q || '' });

  function syncYears() {
    const y = String(new Date().getFullYear());
    const a = document.getElementById('sb-year');
    const b = document.getElementById('y');
    const c = document.getElementById('tech-year');
    if (a) a.textContent = y;
    if (b) b.textContent = y;
    if (c) c.textContent = y;
  }

  document.addEventListener('submit', (e) => {
    const f = e.target && e.target.closest && e.target.closest('#mc-embedded-subscribe-form');
    if (!f) return;
    SB.ga.subscribe('footer');
  });

  window.addEventListener('sb:add_to_cart', (e) => {
    const d = (e && e.detail) || {};
    SB.ga.add_to_cart({
      currency: 'USD',
      value: (d.price || 0) * (d.quantity || 1),
      items: [{
        item_id: d.item_id || '',
        item_name: d.item_name || '',
        price: d.price || 0,
        quantity: d.quantity || 1
      }]
    });
  });

  // Search tracking (?q=)
  try {
    const u = new URL(location.href);
    const q = u.searchParams.get('q');
    if (q) SB.ga.search(q);
  } catch {}

  // Nav toggle (works for injected nav)
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('.nav-menu-toggle');
    if (!btn) return;
    const header = btn.closest('.site-header');
    if (!header) return;
    const open = header.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  syncYears();
  window.addEventListener('sb:partials_loaded', syncYears);
})();
