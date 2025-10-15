<script>
(function () {
  // --- Countdown (closes Oct 25, 2025 23:59 local) ---
  const end = new Date(2025, 9, 25, 23, 59, 59); // month is 0-indexed
  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMins  = document.getElementById('cd-mins');
  const cdWrap  = document.getElementById('countdown');

  function tick() {
    const now = new Date();
    const diff = Math.max(0, end - now);
    if (diff <= 0) {
      cdWrap && cdWrap.classList.add('is-closed');
      cdDays  && (cdDays.textContent  = '00');
      cdHours && (cdHours.textContent = '00');
      cdMins  && (cdMins.textContent  = '00');
      return;
    }
    const mins    = Math.floor(diff / 60000);
    const days    = Math.floor(mins / (60 * 24));
    const hours   = Math.floor((mins % (60 * 24)) / 60);
    const minutes = mins % 60;
    cdDays  && (cdDays.textContent  = String(days).padStart(2,'0'));
    cdHours && (cdHours.textContent = String(hours).padStart(2,'0'));
    cdMins  && (cdMins.textContent  = String(minutes).padStart(2,'0'));
  }
  tick();
  setInterval(tick, 30000);

  // --- Cart helpers (ALIGN with site: uses 'sb_cart_v1') ---
  const CART_KEY = 'sb_cart_v1';

  const readCart = () => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  };

  const writeCart = (items) => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    // ping listeners so the nav badge updates
    dispatchEvent(new CustomEvent('sb:cart:update', { detail: { cart: items } }));
  };

  const addItem = (item) => {
    const cart = readCart();
    const i = cart.findIndex(x => x.id === item.id);
    if (i >= 0) cart[i].qty += item.qty || 1;
    else cart.push({ ...item, qty: item.qty || 1 });
    writeCart(cart);
  };

  // --- Catalog meta for quick enrichment ---
  const CATALOG = {
    'vsop-jacket': { name: 'VSOP Hooded Jacket — Burgundy + Brown', price: 129.99, image: '/vsop/assets/vsop-jacket.jpg' },
    'vsop-shorts': { name: 'VSOP Shorts — Burgundy + Brown',       price:  89.99, image: '/vsop/assets/vsop-shorts.jpg' },
    'vsop-set':    { name: 'VSOP Set (Jacket + Shorts)',            price: 199.99, image: '/vsop/assets/vsop-set.jpg' }
  };

  // --- Wire up buttons (delegated) ---
  document.addEventListener('click', (e) => {
    // Bundle
    const bundleBtn = e.target.closest('#bundle-checkout');
    if (bundleBtn) {
      e.preventDefault();
      const jSize = (document.getElementById('bundle-jacket-size') || {}).value || 'M';
      const sSize = (document.getElementById('bundle-shorts-size') || {}).value || 'M';
      const qty   = Math.max(1, parseInt((document.getElementById('bundle-qty') || {}).value || '1', 10));

      addItem({
        id: `vsop-jacket-${jSize}`,
        name: `${CATALOG['vsop-jacket'].name} — ${jSize}`,
        price: CATALOG['vsop-jacket'].price,
        image: CATALOG['vsop-jacket'].image,
        qty
      });
      addItem({
        id: `vsop-shorts-${sSize}`,
        name: `${CATALOG['vsop-shorts'].name} — ${sSize}`,
        price: CATALOG['vsop-shorts'].price,
        image: CATALOG['vsop-shorts'].image,
        qty
      });

      location.href = '/cart.html';
      return;
    }

    // Jacket
    const jacketBtn = e.target.closest('#jacket-checkout');
    if (jacketBtn) {
      e.preventDefault();
      const size = (document.getElementById('jacket-size') || {}).value || 'M';
      const qty  = Math.max(1, parseInt((document.getElementById('jacket-qty') || {}).value || '1', 10));
      addItem({
        id: `vsop-jacket-${size}`,
        name: `${CATALOG['vsop-jacket'].name} — ${size}`,
        price: CATALOG['vsop-jacket'].price,
        image: CATALOG['vsop-jacket'].image,
        qty
      });
      location.href = '/cart.html';
      return;
    }

    // Shorts
    const shortsBtn = e.target.closest('#shorts-checkout');
    if (shortsBtn) {
      e.preventDefault();
      const size = (document.getElementById('shorts-size') || {}).value || 'M';
      const qty  = Math.max(1, parseInt((document.getElementById('shorts-qty') || {}).value || '1', 10));
      addItem({
        id: `vsop-shorts-${size}`,
        name: `${CATALOG['vsop-shorts'].name} — ${size}`,
        price: CATALOG['vsop-shorts'].price,
        image: CATALOG['vsop-shorts'].image,
        qty
      });
      location.href = '/cart.html';
      return;
    }
  });
})();
</script>
