// /scripts/global.js
(() => {
  // Mailchimp submit ping
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!f || !f.id) return;
    if (f.id === 'mc-embedded-subscribe-form' && typeof gtag === 'function') {
      gtag('event', 'subscribe', { method: 'mailchimp' });
    }
  });

  // Add-to-cart button ping (generic fallback)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ga="add_to_cart"]');
    if (!btn || typeof gtag !== 'function') return;
    const price = Number(btn.getAttribute('data-price') || 0);
    const id = btn.getAttribute('data-id') || '';
    const name = btn.getAttribute('data-name') || '';
    const size = btn.getAttribute('data-size') || '';
    const qty = Number(btn.getAttribute('data-qty') || 1);
    gtag('event','add_to_cart',{
      currency:'USD', value: price * qty,
      items: [{ item_id:id, item_name:name, item_variant:size, price, quantity:qty }]
    });
  });
})();
