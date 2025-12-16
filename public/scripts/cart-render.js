/* /public/scripts/cart-render.js
   Square Bidness — Cart Renderer (reads sb_cart_v1)
   Requires: none (works with or without SB namespace)
*/
(() => {
  const root = window;
  if (!root.SB || typeof root.SB !== "object") root.SB = {};
  const SB = root.SB;

  const CART_KEY = "sb_cart_v1";

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }

  // Normalizes different item shapes into one predictable shape
  function normalize(items) {
    return (items || []).map((it) => {
      const qty = Number(it.quantity ?? it.qty ?? 1);
      return {
        item_id:  String(it.item_id ?? it.id ?? it.sku ?? ""),
        name:     String(it.item_name ?? it.name ?? it.title ?? it.sku ?? "Item"),
        variant:  String(it.variant ?? it.size ?? ""),
        image:    String(it.image ?? it.img ?? ""),
        price:    Number(it.price ?? 0),
        quantity: isFinite(qty) && qty > 0 ? qty : 1,
        url:      String(it.url ?? "")
      };
    }).filter(x => x.item_id && x.quantity > 0);
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(Number(n || 0));
  }

  // --- PUBLIC: render cart page ---
  SB.renderCart = function renderCart({
    mountId = "cart",
    emptyHtml = '<p class="muted">Your cart is empty.</p>'
  } = {}) {
    const mount = document.getElementById(mountId);
    if (!mount) return { items: [], total: 0 };

    const items = normalize(readCart());
    if (!items.length) {
      mount.innerHTML = emptyHtml;
      return { items: [], total: 0 };
    }

    const rows = items.map((it) => {
      const line = it.price * it.quantity;
      const meta = [it.variant].filter(Boolean).join(" · ");
      return `
        <div class="cart-line">
          ${it.image ? `<img src="${it.image}" alt="">` : ``}
          <div style="flex:1">
            <div><strong>${it.name}</strong>${meta ? ` <span class="muted">(${meta})</span>` : ``}</div>
            <div class="muted">${money(it.price)} × ${it.quantity}</div>
          </div>
          <div><strong>${money(line)}</strong></div>
        </div>
      `;
    }).join("");

    const total = items.reduce((n, it) => n + it.price * it.quantity, 0);
    mount.innerHTML = rows + `<p style="text-align:right;margin-top:.5rem"><strong>Total: ${money(total)}</strong></p>`;
    return { items, total };
  };

  // --- PUBLIC: render checkout table ---
  SB.renderCheckoutTable = function renderCheckoutTable({
    tbodyId = "order-items",
    subtotalId = "order-subtotal",
    taxId = "order-tax",
    totalId = "order-total",
    summaryId = "order-summary",
    emptyId = "empty",
    taxRate = 0.0945
  } = {}) {
    const tbody = document.getElementById(tbodyId);
    const subEl = document.getElementById(subtotalId);
    const taxEl = document.getElementById(taxId);
    const totEl = document.getElementById(totalId);
    const summary = document.getElementById(summaryId);
    const empty = document.getElementById(emptyId);

    const items = normalize(readCart());

    if (!items.length) {
      if (empty) empty.style.display = "";
      if (summary) summary.style.display = "none";
      if (tbody) tbody.innerHTML = "";
      return { items: [], subtotal: 0, tax: 0, total: 0 };
    }

    if (empty) empty.style.display = "none";
    if (summary) summary.style.display = "";

    if (tbody) {
      tbody.innerHTML = items.map((it) => {
        const line = it.price * it.quantity;
        return `
          <tr>
            <td>
              ${it.image ? `<img src="${it.image}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:.5rem">` : ``}
              ${it.name}${it.variant ? ` <span class="muted">(${it.variant})</span>` : ``}
            </td>
            <td>${money(it.price)}</td>
            <td>${it.quantity}</td>
            <td>${money(line)}</td>
          </tr>
        `;
      }).join("");
    }

    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    if (subEl) subEl.textContent = money(subtotal);
    if (taxEl) taxEl.textContent = money(tax);
    if (totEl) totEl.textContent = money(total);

    return { items, subtotal, tax, total };
  };
})();
