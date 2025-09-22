// ======== CONFIG ========
console.log("✅ VSOP JS loaded and running");

const PREORDER_END = '2025-10-16T23:59:59';

// Plug in your live checkout URLs (Stripe or cart endpoints)
const CHECKOUT_URLS = {
  bundle: '#', // e.g. 'https://checkout.stripe.com/pay/xyz?sku=bundle'
  jacket: '#', // e.g. 'https://checkout.stripe.com/pay/abc?sku=jacket'
  shorts: '#', // e.g. 'https://checkout.stripe.com/pay/def?sku=shorts'
};

// ======== INVENTORY (edit these as stock changes) ========
const INVENTORY = {
  jacket: { XS: 2, S: 2, M: 5, L: 5, XL: 5, "2X": 5, "3X": 4, "4X": 1 },
  shorts: { XS: 2, S: 2, M: 5, L: 5, XL: 5, "2X": 5, "3X": 4, "4X": 1 }
};
const SIZE_ORDER = ["XS","S","M","L","XL","2X","3X","4X"];

// Label logic (no exact counts shown)
function getLabelForStock(size, left) {
  if (left <= 0) return `${size} — SOLD OUT`;
  if (left === 1) return `${size} — Almost Gone`;
  if (left <= 2) return `${size} — Low Stock`;
  return `${size} — Limited Quantity`;
}

// Build <option> list based on stock map
function renderSizeOptions(selectEl, stockMap) {
  if (!selectEl || !stockMap) return;
  const current = selectEl.value;
  selectEl.innerHTML = "";
  SIZE_ORDER.forEach(size => {
    const left = Number(stockMap[size] || 0);
    const opt = document.createElement("option");
    opt.value = size;
    opt.textContent = getLabelForStock(size, left);
    opt.disabled = left <= 0;
    selectEl.appendChild(opt);
  });
  // keep previous selection if still valid
  const exists = Array.from(selectEl.options).some(o => o.value === current && !o.disabled);
  if (exists) selectEl.value = current;
}

// Stock checks / mutations
function ensureStock(kind, size, qty) {
  const left = Number(INVENTORY[kind]?.[size] || 0);
  if (left <= 0) return { ok:false, msg:`${kind} (${size}) is SOLD OUT.` };
  if (qty > left) return { ok:false, msg:`Only ${left} left for ${kind} (${size}). Reduce quantity.` };
  return { ok:true };
}
function reduceStock(kind, size, qty) {
  if (!INVENTORY[kind]) return;
  const left = Number(INVENTORY[kind][size] || 0);
  INVENTORY[kind][size] = Math.max(0, left - qty);
  // re-render all selects using this kind
  renderSizeOptions(document.getElementById(`${kind}-size`), INVENTORY[kind]);
  renderSizeOptions(document.getElementById(`bundle-${kind}-size`), INVENTORY[kind]);
  refreshAllHints();
}

// ---------- STOCK HINT UNDER SIZE DROPDOWNS ----------
function ensureHintEl(selectEl) {
  if (!selectEl) return null;
  let hint = selectEl.parentElement.querySelector('.stock-hint');
  if (!hint) {
    hint = document.createElement('small');
    hint.className = 'stock-hint';
    hint.style.display = 'none';
    hint.style.marginLeft = '10px';
    hint.style.fontSize = '12px';
    hint.style.fontWeight = '700';
    hint.style.color = '#ff4d4f';
    selectEl.parentElement.appendChild(hint);
  }
  return hint;
}
function updateHintFor(kind, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const hint = ensureHintEl(sel);
  const size = sel.value;
  const left = Number(INVENTORY[kind]?.[size] || 0);
  if (left === 1) {
    hint.textContent = '🔥 Only 1 left in this size';
    hint.style.display = 'inline-block';
  } else {
    hint.textContent = '';
    hint.style.display = 'none';
  }
}
function refreshAllHints() {
  updateHintFor('jacket', 'jacket-size');
  updateHintFor('shorts', 'shorts-size');
  updateHintFor('jacket', 'bundle-jacket-size');
  updateHintFor('shorts', 'bundle-shorts-size');
}

// ======== ANALYTICS HELPERS ========
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

// Core: attach a listener to a button, compute params, stock-check, fire tracking, redirect
function wireCheckout(buttonSelector, paramGetter, urlKey, stockCheckFn) {
  const btn = document.querySelector(buttonSelector);
  if (!btn) return;
  btn.addEventListener('click', function (e) {
    e.preventDefault();

    const p = paramGetter();                 // { sku, size, qty, price }
    const url = getCheckoutUrl(urlKey, btn.getAttribute('href'));

    // Stock guard(s)
    const sc = stockCheckFn(p);
    if (!sc.ok) { alert(sc.msg); return; }

    // 1) dataLayer for GTM/GA4
    pushDL({
      event: 'preorder_click',
      sku: p.sku,
      size: p.size,
      qty: String(p.qty),
      price: String(p.price),
      page: 'vsop'
    });

    // 2) Meta Pixel (direct)
    fireMetaInitiateCheckout(p);

    // 3) reduce stock (so UI updates immediately)
    sc.reduce();

    // 4) redirect
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
  const jacket = (document.getElementById('bundle-jacket-size') || {}).value || 'M';
  const shorts = (document.getElementById('bundle-shorts-size') || {}).value || 'M';
  const qty    = Number((document.getElementById('bundle-qty') || {}).value || 1);
  return {
    sku: 'bundle',
    size: `jacket:${jacket}|shorts:${shorts}`,
    qty,
    price: PRICE_MAP.bundle
  };
}
function getJacketParams() {
  const size = (document.getElementById('jacket-size') || {}).value || 'M';
  const qty  = Number((document.getElementById('jacket-qty') || {}).value || 1);
  return { sku: 'jacket', size, qty, price: PRICE_MAP.jacket };
}
function getShortsParams() {
  const size = (document.getElementById('shorts-size') || {}).value || 'M';
  const qty  = Number((document.getElementById('shorts-qty') || {}).value || 1);
  return { sku: 'shorts', size, qty, price: PRICE_MAP.shorts };
}

// ------- COUNTDOWN + INIT -------
document.addEventListener('DOMContentLoaded', () => {
  // COUNTDOWN
  const end = new Date(PREORDER_END).getTime();
  const cdWrap  = document.getElementById('countdown');
  const elDays  = document.getElementById('cd-days');
  const elHours = document.getElementById('cd-hours');
  const elMins  = document.getElementById('cd-mins');

  function closePreorderUI() {
    console.warn("⚠️ VSOP Preorder window has ended!");
    if (cdWrap) {
      cdWrap.innerHTML = `
        <strong style="color:#800020">Preorder Closed</strong> —
        follow <strong>@squarebidnesstm</strong> for the next drop.
      `;
      cdWrap.classList.add('is-closed');
    }
    ['bundle-checkout','jacket-checkout','shorts-checkout'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.add('disabled');
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Preorder Closed';
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';
      }
    });

    // Track closed
    pushDL({ event: 'preorder_closed', page: 'vsop' });
    if (typeof fbq === 'function') fbq('trackCustom', 'PreorderClosed', { page: 'vsop' });
  }

  function tick(){
    const now  = Date.now();
    const diff = end - now;
    if (diff <= 0) { closePreorderUI(); return; }
    const d = Math.floor(diff / (1000*60*60*24));
    const h = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const m = Math.floor((diff % (1000*60*60)) / (1000*60));
    if (elDays)  elDays.textContent  = String(d);
    if (elHours) elHours.textContent = String(h).padStart(2,'0');
    if (elMins)  elMins.textContent  = String(m).padStart(2,'0');
  }
  tick();
  setInterval(tick, 30000); // update every 30s

  // Render size selects initially
  renderSizeOptions(document.getElementById("jacket-size"), INVENTORY.jacket);
  renderSizeOptions(document.getElementById("shorts-size"), INVENTORY.shorts);
  renderSizeOptions(document.getElementById("bundle-jacket-size"), INVENTORY.jacket);
  renderSizeOptions(document.getElementById("bundle-shorts-size"), INVENTORY.shorts);

  // Show initial stock hints + listen for changes
  refreshAllHints();

  // WIRE CHECKOUTS with stock guards
  wireCheckout('#jacket-checkout', getJacketParams, 'jacket', (p) => {
    const g = ensureStock('jacket', p.size, p.qty);
    return g.ok ? { ok:true, reduce: () => reduceStock('jacket', p.size, p.qty) } : g;
  });
  wireCheckout('#shorts-checkout', getShortsParams, 'shorts', (p) => {
    const g = ensureStock('shorts', p.size, p.qty);
    return g.ok ? { ok:true, reduce: () => reduceStock('shorts', p.size, p.qty) } : g;
  });
  wireCheckout('#bundle-checkout', getBundleParams, 'bundle', (p) => {
    // size string looks like "jacket:M|shorts:L"
    const [jPair, sPair] = (p.size || '').split('|');
    const jSize = (jPair?.split(':')[1] || 'M');
    const sSize = (sPair?.split(':')[1] || 'M');

    const gj = ensureStock('jacket', jSize, p.qty);
    if (!gj.ok) return gj;
    const gs = ensureStock('shorts', sSize, p.qty);
    if (!gs.ok) return gs;

    return { ok:true, reduce: () => { reduceStock('jacket', jSize, p.qty); reduceStock('shorts', sSize, p.qty); } };
  });
});
