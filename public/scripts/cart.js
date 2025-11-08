/* scripts/cart.js
   Square Bidness – simple cart (localStorage) + cart page renderer + add-to-cart toast
*/
(() => {
  // -------------------------
  // Config / helpers
  // -------------------------
  const CART_KEY = 'sb_cart';
  const COUPON_KEY = 'sb_coupon';
  const TAX_RATE = 0.0945; // Louisiana sales tax - adjust as needed

  const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const money = n => moneyFmt.format(Number(n || 0));

  const getCoupon = () => localStorage.getItem(COUPON_KEY);
  const setCoupon = (code) => localStorage.setItem(COUPON_KEY, code);
  const removeCoupon = () => localStorage.removeItem(COUPON_KEY);
  
  const applyCoupon = (subtotal) => {
    const code = getCoupon();
    if (!code) return { discount: 0, code: null };

    // Example rule: NYC25 = $25 off $200+
    if (code === 'NYC25' && subtotal >= 200) return { discount: 25, code };
    return { discount: 0, code };
  };

  // Global namespace
  window.SB = window.SB || {};
  window.SB.clearCart = clearCart;
  window.SB.addToCart = addToCart;
  window.SB.readCart = readCart;
  window.SB.setQty = setQty;
  window.SB.removeFromCart = removeFromCart;
  window.SB.setCoupon = setCoupon;
  window.SB.removeCoupon = removeCoupon;
  window.SB.showError = showError;

  // -------------------------
  // Storage
  // -------------------------
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  
  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartCount();
    // If we're on cart page, re-render
    if (typeof renderCart === "function") renderCart();
  }

  // -------------------------
  // Cart ops
  // -------------------------
  function updateCartCount() {
    const count = readCart().reduce((n, i) => n + Number(i.qty || 0), 0);
    const badge = document.getElementById("cart-count");
    if (badge) badge.textContent = count;
  }

  function addToCart(item) {
    const cart = readCart();
    const idx = cart.findIndex(i => i.id === item.id);
    if (idx >= 0) cart[idx].qty += item.qty || 1;
    else cart.push({ ...item, qty: item.qty || 1 });
    writeCart(cart);
    showAddToast(item);
  }

  function removeFromCart(id) {
    const cart = readCart().filter(i => i.id !== id);
    writeCart(cart);
  }

  function setQty(id, qty) {
    const q = Math.max(1, Number(qty || 1));
    const cart = readCart().map(i => i.id === id ? { ...i, qty: q } : i);
    writeCart(cart);
  }

  function clearCart() {
    writeCart([]);
    removeCoupon();
  }

  // -------------------------
  // Toast (mini product card) on Add
  // -------------------------
  let addToastTimer;
  function showAddToast(item) {
    const wrap = document.getElementById('add-toast');
    if (!wrap) return; // if footer not loaded yet, silently skip

    // Fill content
    const img = wrap.querySelector('#addtoast-img');
    const name = wrap.querySelector('#addtoast-name');
    const price = wrap.querySelector('#addtoast-price');

    if (img)   img.src = item.image || '';
    if (name)  name.textContent = item.name || 'Added to cart';
    if (price) {
      const n = Number(item.price);
      price.textContent = Number.isFinite(n) ? money(n) : '';
    }

    // Show toast
    wrap.classList.add('show');

    // Auto-hide
    clearTimeout(addToastTimer);
    addToastTimer = setTimeout(() => wrap.classList.remove('show'), 2500);

    // Close button (bind once)
    const closeBtn = wrap.querySelector('.addtoast__close');
    if (closeBtn && !closeBtn._bound) {
      closeBtn.addEventListener('click', () => wrap.classList.remove('show'));
      closeBtn._bound = true;
    }
  }

  // -------------------------
  // Error toast
  // -------------------------
  function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; 
      background: #ef4444; color: white; 
      padding: 1rem; border-radius: 8px; 
      z-index: 10000; animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // -------------------------
  // Cart page renderer (safe to load on any page)
  // -------------------------
  function renderCart() {
    const items = readCart();

    // Supports either <tbody id="cart-items"> or <div id="cart-items">
    const list = document.querySelector("#cart-items tbody, #cart-items");
    const summary   = document.getElementById("cart-summary");
    const subEl     = document.getElementById("cart-subtotal");
    const taxEl     = document.getElementById("cart-tax");
    const totEl     = document.getElementById("cart-total");
    const checkoutBtn = document.getElementById("checkout-button");

    // If not on a cart page, bail quietly
    if (!list || !summary || !subEl || !taxEl || !totEl) return;

    if (items.length === 0) {
      const empty = (list.tagName.toLowerCase() === "tbody")
        ? `<tr><td colspan="5" style="text-align:center; padding:1rem; opacity:.8">Your cart is empty.</td></tr>`
        : `<div style="text-align:center; padding:1rem; opacity:.8">Your cart is empty.</div>`;
      list.innerHTML = empty;
      summary.style.display = "none";
      if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = "Add items to checkout";
      }
      return;
    }

    // Build rows
    list.innerHTML = items.map(i => {
      const line = Number(i.price || 0) * Number(i.qty || 1);
      if (list.tagName.toLowerCase() === "tbody") {
        return `
          <tr>
            <td>
              <img src="${i.image || ""}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:.5rem">
              ${i.name}
            </td>
            <td>${money(i.price)}</td>
            <td><input type="number" min="1" value="${i.qty}" data-qty-for="${i.id}" style="width:60px"></td>
            <td>${money(line)}</td>
            <td><button data-remove="${i.id}" class="btn btn--ghost">Remove</button></td>
          </tr>
        `;
      } else {
        return `
          <div class="cart-row" style="display:grid;grid-template-columns:1.6fr .8fr .8fr .8fr .8fr;gap:.5rem;align-items:center;padding:.4rem 0;border-bottom:1px solid #222">
            <div>
              <img src="${i.image || ""}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:.5rem">
              ${i.name}
            </div>
            <div>${money(i.price)}</div>
            <div><input type="number" min="1" value="${i.qty}" data-qty-for="${i.id}" style="width:60px"></div>
            <div>${money(line)}</div>
            <div><button data-remove="${i.id}" class="btn btn--ghost">Remove</button></div>
          </div>
        `;
      }
    }).join("");

    // Overwrite handlers each render (no stacking)
    list.oninput = (e) => {
      const inp = e.target.closest("input[data-qty-for]");
      if (!inp) return;
      setQty(inp.getAttribute("data-qty-for"), inp.value);
    };
    list.onclick = (e) => {
      const btn = e.target.closest("button[data-remove]");
      if (!btn) return;
      removeFromCart(btn.getAttribute("data-remove"));
    };

    // Calculate totals with coupon support
    const subtotal = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);
    const { discount, code } = applyCoupon(subtotal);
    const taxedBase = Math.max(0, subtotal - discount);
    const tax = taxedBase * TAX_RATE;
    const total = taxedBase + tax;

    subEl.textContent = money(subtotal);
    taxEl.textContent = money(tax);
    totEl.textContent = money(total);

    // Show discount row if applicable
    const discRow = document.getElementById('cart-discount-row');
    const discEl  = document.getElementById('cart-discount');
    if (discRow && discEl) {
      if (discount > 0) {
        discRow.style.display = '';
        discEl.textContent = `-${money(discount)}`;
        // Optional: show code name
        if (code) {
          const codeLabel = discRow.querySelector('.discount-code-label');
          if (codeLabel) codeLabel.textContent = `Discount (${code})`;
        }
      } else {
        discRow.style.display = 'none';
      }
    }

    // Checkout button state
    if (checkoutBtn) {
      const hasPurchasable = items.some(i => Number(i.qty) > 0 && Number(i.price) > 0);
      checkoutBtn.disabled = !(items.length && hasPurchasable);
      checkoutBtn.textContent = checkoutBtn.disabled ? "Add items to checkout" : "Checkout";
    }

    // Show summary
    summary.style.display = "";
  }

  // -------------------------
  // Global page hooks (delegated)
  // -------------------------
  // Avoid double-binding if the page hot-reloads
  if (!window.__SB_CART_BOUND__) {
    window.__SB_CART_BOUND__ = true;

    // 1) Add-to-cart buttons
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='add-to-cart']");
      if (!btn) return;
      const item = {
        id: btn.dataset.id,
        name: btn.dataset.name,
        price: parseFloat(btn.dataset.price || "0"),
        image: btn.dataset.image || "",
        qty: 1
      };
      addToCart(item);
    });

    // 2) On load: badge + render cart (if present)
    document.addEventListener("DOMContentLoaded", () => {
      updateCartCount();
      renderCart(); // safe on non-cart pages (early return)
    });
  }
})();
