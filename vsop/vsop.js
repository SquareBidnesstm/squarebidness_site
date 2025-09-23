// ======== CONFIG ========
console.log("✅ VSOP JS loaded and running");
 
const PREORDER_END = '2025-10-16T23:59:59';

// Plug in your live checkout URLs (Stripe)
const CHECKOUT_URLS = {
  bundle: 'https://buy.stripe.com/8x29ATdW79ipfmt3kQ8N20b',
  jacket: 'https://buy.stripe.com/14AbJ12dpcuBgqx6x28N20c',
  shorts: 'https://buy.stripe.com/dRm14ncS38el0rz7B68N20d'
};

document.addEventListener('DOMContentLoaded', () => {
  // ======== COUNTDOWN ========
  const end = new Date(PREORDER_END).getTime();
  const cdWrap  = document.getElementById('countdown');
  const elDays  = document.getElementById('cd-days');
  const elHours = document.getElementById('cd-hours');
  const elMins  = document.getElementById('cd-mins');

  // Preorder buttons
  const bundleBtn = document.getElementById('bundle-checkout');
  const jacketBtn = document.getElementById('jacket-checkout');
  const shortsBtn = document.getElementById('shorts-checkout');

  function closePreorderUI() {
    console.warn("⚠️ VSOP Preorder window has ended!");

    if (cdWrap) {
      cdWrap.innerHTML = `
        <strong style="color:#800020">Preorder Closed</strong> — 
        follow <strong>@squarebidnesstm</strong> for the next drop.
      `;
      cdWrap.classList.add('is-closed');
    }

    [bundleBtn, jacketBtn, shortsBtn].forEach(btn => {
      if (btn) {
        btn.classList.add('disabled');
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Preorder Closed';
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';
      }
    });
  }

  function tick(){
    const now  = Date.now();
    const diff = end - now;

    if (diff <= 0) {
      closePreorderUI();
      return;
    }

    const d = Math.floor(diff / (1000*60*60*24));
    const h = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const m = Math.floor((diff % (1000*60*60)) / (1000*60));
    if (elDays)  elDays.textContent  = String(d);
    if (elHours) elHours.textContent = String(h).padStart(2,'0');
    if (elMins)  elMins.textContent  = String(m).padStart(2,'0');
  }

  tick();
  setInterval(tick, 30000);
});

// === VSOP click tracking + checkout redirect (GA4 via GTM + Meta Pixel) ===
(function () {
  const PRICE_MAP = { bundle: 199.99, jacket: 129.99, shorts: 89.99 };

  function pushDL(evt) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(evt);
    } catch (_) {}
  }

  function fireMetaInitiateCheckout(params) {
    if (typeof fbq === 'function') {
      fbq('track', 'InitiateCheckout', {
        content_name: `VSOP ${params.sku.toUpperCase()}`,
        content_category: 'VSOP',
        contents: [{ id: 'vsop-' + params.sku, quantity: Number(params.qty || 1) }],
        num_items: Number(params.qty || 1),
        value: Number(params.price || 0) * Number(params.qty || 1),
        currency: 'USD'
      });
    }
  }

  function getCheckoutUrl(key, fallbackHref) {
    if (typeof CHECKOUT_URLS === 'object' && CHECKOUT_URLS && CHECKOUT_URLS[key]) {
      return CHECKOUT_URLS[key];
    }
    return fallbackHref || '#';
  }

  function wireCheckout(buttonSelector, paramGetter, urlKey) {
    const btn = document.querySelector(buttonSelector);
    if (!btn) return;

    btn.addEventListener('click', function (e) {
      e.preventDefault();

      const p = paramGetter();
      const url = getCheckoutUrl(urlKey, btn.getAttribute('href'));

      // 1) dataLayer
      pushDL({
        event: 'preorder_click',
        sku: p.sku,
        size: p.size,
        qty: String(p.qty),
        price: String(p.price),
        page: 'vsop'
      });

      // 2) Meta Pixel
      fireMetaInitiateCheckout(p);

      // 3) Redirect
      if (!url || url === '#') {
        alert('⚠️ Connect this button to your Stripe/checkout URL.');
        return;
      }
      const qs = new URLSearchParams({
        sku: p.sku,
        size: p.size || '',
        qty: String(p.qty || 1)
      });
      window.location.href = url + (qs.toString() ? '?' + qs.toString() : '');
    });
  }

  // ------- PARAM GETTERS -------
  function getBundleParams() {
    const jacket = (document.getElementById('bundle-jacket-size') || {}).value || 'unknown';
    const shorts = (document.getElementById('bundle-shorts-size') || {}).value || 'unknown';
    const qty    = Number((document.getElementById('bundle-qty') || {}).value || 1);
    return {
      sku: 'bundle',
      size: `jacket:${jacket}|shorts:${shorts}`,
      qty,
      price: PRICE_MAP.bundle
    };
  }

  function getJacketParams() {
    const size = (document.getElementById('jacket-size') || {}).value || 'unknown';
    const qty  = Number((document.getElementById('jacket-qty') || {}).value || 1);
    return { sku: 'jacket', size, qty, price: PRICE_MAP.jacket };
  }

  function getShortsParams() {
    const size = (document.getElementById('shorts-size') || {}).value || 'unknown';
    const qty  = Number((document.getElementById('shorts-qty') || {}).value || 1);
    return { sku: 'shorts', size, qty, price: PRICE_MAP.shorts };
  }

  // ------- ATTACH LISTENERS -------
  document.addEventListener('DOMContentLoaded', function () {
    wireCheckout('#bundle-checkout', getBundleParams, 'bundle');
    wireCheckout('#jacket-checkout', getJacketParams, 'jacket');
    wireCheckout('#shorts-checkout', getShortsParams, 'shorts');
  });
})();
