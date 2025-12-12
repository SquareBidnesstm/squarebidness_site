/* =====================================================
   Square Bidness — Global JS
   Analytics · Year update · Mailchimp · Nav toggle
===================================================== */

(() => {
  // Always define SB safely
  window.SB = window.SB || {};
  window.SB.ga = window.SB.ga || {};

  // GA4 helper wrapper
  window.SB.ga = {
    evt: (name, params = {}) => {
      try { window.gtag && window.gtag('event', name, params); } catch (e) {}
    },
    view_item: (data) => window.SB.ga.evt('view_item', data),
    add_to_cart: (data) => window.SB.ga.evt('add_to_cart', data),
    begin_checkout: (data) => window.SB.ga.evt('begin_checkout', data),
    purchase: (data) => window.SB.ga.evt('purchase', data),
    subscribe: (where = 'footer') =>
      window.SB.ga.evt('generate_lead', { method: `mailchimp_${where}` }),
    search: (q) =>
      window.SB.ga.evt('search', { search_term: q || '' })
  };

  // Years (works for injected footer too)
  function syncYears() {
    const y = String(new Date().getFullYear());
    const a = document.getElementById('sb-year');
    const b = document.getElementById('y');
    const c = document.getElementById('tech-year');
    if (a) a.textContent = y;
    if (b) b.textContent = y;
    if (c) c.textContent = y;
  }

  // Mailchimp submit ping
  document.addEventListener('submit', (e) => {
    const f = e.target && e.target.closest && e.target.closest('#mc-embedded-subscribe-form');
    if (!f) return;
    window.SB.ga.subscribe('footer');
  });

  // Track “Add to Cart” custom event
  window.addEventListener('sb:add_to_cart', (e) => {
    const d = (e && e.detail) || {};
    window.SB.ga.add_to_cart({
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

  // Track site search (?q=)
  try {
    const u = new URL(location.href);
    const q = u.searchParams.get('q');
    if (q) window.SB.ga.search(q);
  } catch (e) {}

  // Nav mobile toggle (works for injected nav)
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('.nav-menu-toggle');
    if (!btn) return;

    const header = btn.closest('.site-header');
    if (!header) return;

    const open = header.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Run now + after partials load
  syncYears();
  window.addEventListener('sb:partials_loaded', syncYears);
})();
