/* /public/scripts/sb-cart.js
   Square Bidness — Cart (namespace-safe)
   Exposes:
     SB.cart.get(), SB.cart.set(), SB.cart.add(), SB.cart.updateQty(), SB.cart.clear()
   Also keeps legacy aliases:
     SB.getCart(), SB.setCart(), SB.addToCart(), SB.updateQty(), SB.clear()
*/
(() => {
  const root = window;

  // Ensure SB is a namespace object (never replace it)
  if (!root.SB || typeof root.SB !== "object") root.SB = {};
  const SB = root.SB;

  // Create cart module container
  SB.cart = SB.cart && typeof SB.cart === "object" ? SB.cart : {};

  const KEY = "sb_cart_v1";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items || [])); } catch {}
    // update any cart count badges
    try {
      const count = (items || []).reduce((n, it) => n + Number(it.quantity || 0), 0);
      document.querySelectorAll("[data-cart-count]").forEach(el => (el.textContent = String(count)));
    } catch {}
    return items || [];
  }

  // --- Public cart API ---
  SB.cart.get = () => read();
  SB.cart.set = (items) => write(items);

  SB.cart.clear = () => write([]);

  SB.cart.add = (item = {}) => {
    const items = read();
    const id = String(item.item_id || item.id || "");
    const qty = Number(item.quantity || 1);

    if (!id) return items;

    const idx = items.findIndex(x => String(x.item_id || x.id || "") === id);
    if (idx >= 0) items[idx].quantity = Number(items[idx].quantity || 0) + qty;
    else items.push({ ...item, item_id: id, quantity: qty });

    const updated = write(items);

    // Fire custom event for analytics (global.js listens)
    try {
      root.dispatchEvent(new CustomEvent("sb:add_to_cart", { detail: {
        item_id: id,
        item_name: item.item_name || item.name || "",
        price: Number(item.price || 0),
        quantity: qty
      }}));
    } catch {}

    return updated;
  };

  SB.cart.updateQty = (id, quantity) => {
    const items = read();
    const key = String(id || "");
    const qty = Math.max(0, Number(quantity || 0));

    const idx = items.findIndex(x => String(x.item_id || x.id || "") === key);
    if (idx < 0) return items;

    if (qty === 0) items.splice(idx, 1);
    else items[idx].quantity = qty;

    return write(items);
  };

  // --- Legacy aliases (if older pages call SB.addToCart etc) ---
  SB.getCart   = SB.getCart   || SB.cart.get;
  SB.setCart   = SB.setCart   || SB.cart.set;
  SB.clear     = SB.clear     || SB.cart.clear;
  SB.addToCart = SB.addToCart || SB.cart.add;
  SB.updateQty = SB.updateQty || SB.cart.updateQty;

  // Initialize count on load
  write(read());
})();
