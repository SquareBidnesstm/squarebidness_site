// /public/scripts/buybox.js
(() => {
  const root = window;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function findQtyInput(box) {
    // qty input is optional; default 1 if missing
    return box.querySelector("input[type='number'], input#qty");
  }

  function findSizeSelect(box) {
    // if no size select, we allow add-to-cart without size
    return box.querySelector("select#size, select[data-role='size']");
  }

  ready(() => {
    // Click delegation for ANY button with data-add-to-cart
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("[data-add-to-cart]");
        if (!btn) return;

        const box = btn.closest(".buybox");
        if (!box) return;

        e.preventDefault();

        const msgEl =
          box.querySelector(".buybox__msg") ||
          document.getElementById("buybox-msg");

        const skuBase =
          box.getAttribute("data-sku-base") ||
          box.getAttribute("data-id-base") ||
          btn.getAttribute("data-add-to-cart") ||
          "";

        const sizeEl = findSizeSelect(box);
        const qtyEl = findQtyInput(box);

        const size = sizeEl ? String(sizeEl.value || "").trim() : "";
        const qty = qtyEl ? Math.max(1, Number(qtyEl.value || 1)) : 1;

        if (sizeEl && !size) {
          if (msgEl) msgEl.textContent = "Please select a size.";
          try { sizeEl.focus(); } catch (err) {}
          return;
        }

        if (!root.SB || !root.SB.cart || typeof root.SB.cart.add !== "function") {
          if (msgEl) msgEl.textContent = "Cart is still loading—try again in a moment.";
          console.warn("[buybox] SB.cart.add not ready");
          return;
        }

        const item = {
          item_id: skuBase || "unknown-sku",
          item_name: box.getAttribute("data-name") || document.title || "Square Bidness Product",
          price: Number(box.getAttribute("data-price") || "0"),
          quantity: qty,
          size: size || undefined,
          variant: size || undefined,
          image: box.getAttribute("data-image") || undefined,
          url: box.getAttribute("data-url") || location.pathname,
          sku: skuBase || undefined
        };

        root.SB.cart.add(item);

        if (msgEl) msgEl.textContent = "Added to cart.";
      },
      true
    );
  });
})();
