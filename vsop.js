// ======== CONFIG ========
console.log("✅ VSOP JS loaded and running");

const PREORDER_END = '2025-10-16T23:59:59';

// Plug in your live checkout URLs (Stripe or cart endpoints)
const CHECKOUT_URLS = {
  bundle: '#', // e.g. 'https://checkout.stripe.com/pay/xyz?sku=bundle'
  jacket: '#', // e.g. 'https://checkout.stripe.com/pay/abc?sku=jacket'
  shorts: '#', // e.g. 'https://checkout.stripe.com/pay/def?sku=shorts'
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

    // 1) Swap countdown block to a clear closed message
    if (cdWrap) {
      cdWrap.innerHTML = `
        <strong style="color:#800020">Preorder Closed</strong> — 
        follow <strong>@squarebidnesstm</strong> for the next drop.
      `;
      cdWrap.classList.add('is-closed');
    }

    // 2) Disable buttons
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
  setInterval(tick, 30000); // update every 30s

  // ======== CHECKOUT HELPERS ========
function goToCheckout(url, params) {
  if (!url || url === '#') {
    alert('⚠️ Connect this button to your Stripe Checkout URL.');
    return;
  }
  // GTM event
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'preorder_click',
    sku: params?.sku || 'unknown',
    size: params?.size || params?.jacket || 'unknown',
    qty: params?.qty || '1',
    page: 'vsop'
  });

  console.log("➡️ Redirecting to checkout:", url, params);
  window.location.href = url + (function(p){const q=new URLSearchParams(p);return q.toString()?`?${q}`:''})(params);
}


  // ======== BUNDLE CHECKOUT ========
  if (bundleBtn) {
    bundleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const j = (document.getElementById('bundle-jacket-size') || {}).value || 'M';
      const s = (document.getElementById('bundle-shorts-size') || {}).value || 'M';
      const q = (document.getElementById('bundle-qty') || {}).value || '1';
      goToCheckout(CHECKOUT_URLS.bundle, { sku:'bundle', jacket:j, shorts:s, qty:q });
    });
  }

  // ======== JACKET CHECKOUT ========
  if (jacketBtn) {
    jacketBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const size = (document.getElementById('jacket-size') || {}).value || 'M';
      const qty  = (document.getElementById('jacket-qty') || {}).value  || '1';
      goToCheckout(CHECKOUT_URLS.jacket, { sku:'jacket', size, qty });
    });
  }

  // ======== SHORTS CHECKOUT ========
  if (shortsBtn) {
    shortsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const size = (document.getElementById('shorts-size') || {}).value || 'M';
      const qty  = (document.getElementById('shorts-qty') || {}).value  || '1';
      goToCheckout(CHECKOUT_URLS.shorts, { sku:'shorts', size, qty });
    });
  }
});
