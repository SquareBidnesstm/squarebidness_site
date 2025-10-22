// /scripts/global.js
(() => {
  // Safe nav/footer loader if you want one place to manage it
  async function hydrateChrome() {
    try { document.getElementById("nav-placeholder").innerHTML = await (await fetch("/nav/")).text(); } catch {}
    try { document.getElementById("footer-placeholder").innerHTML = await (await fetch("/footer/")).text(); } catch {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateChrome);
  } else {
    hydrateChrome();
  }

  // GA4: basic outbound tracking for any link with data-track
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-track]');
    if (!a || typeof gtag !== 'function') return;
    gtag('event','select_promotion',{
      promotion_id: a.dataset.track,
      promotion_name: a.textContent?.trim() || a.getAttribute('aria-label') || 'link',
      items: a.dataset.item ? [{ item_id: a.dataset.item, item_name: a.dataset.item, price: Number(a.dataset.price||0) }] : undefined
    });
  });

  // Cart badge updater for localStorage mini-cart
  function updateBadge() {
    try {
      const badge = document.querySelector('#cart-count');
      if (!badge) return;
      const cart = JSON.parse(localStorage.getItem('sb_cart_v1') || '[]');
      const total = cart.reduce((n, it) => n + (it.quantity || it.qty || 0), 0);
      badge.textContent = String(total);
      badge.style.display = total > 0 ? 'inline-block' : 'none';
    } catch {}
  }
  window.addEventListener('storage', updateBadge);
  window.addEventListener('sb:cart:update', updateBadge);
  updateBadge();
})();
