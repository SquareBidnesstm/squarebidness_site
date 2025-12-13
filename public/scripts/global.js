/* /public/scripts/global.js
   Square Bidness — Global JS
   Analytics · Year sync · Mailchimp submit ping · Nav toggle (works with injected nav)
*/
(() => {
  // HARD guarantee: SB + SB.ga exist (no matter what)
  const SB = (window.SB = window.SB || {});
  SB.ga = SB.ga || {};

  // Never crashes if GA not loaded yet
  SB.ga.evt = function (name, params = {}) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, params);
    } catch {}
  };

  SB.ga.view_item = (data) => SB.ga.evt("view_item", data);
  SB.ga.add_to_cart = (data) => SB.ga.evt("add_to_cart", data);
  SB.ga.begin_checkout = (data) => SB.ga.evt("begin_checkout", data);
  SB.ga.purchase = (data) => SB.ga.evt("purchase", data);
  SB.ga.subscribe = (where = "footer") =>
    SB.ga.evt("generate_lead", { method: `mailchimp_${where}` });
  SB.ga.search = (q) => SB.ga.evt("search", { search_term: q || "" });

  // ---- Year sync (works after footer inject) ----
  function syncYears() {
    const y = String(new Date().getFullYear());
    const ids = ["sb-year", "y", "tech-year"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = y;
    });
  }

  // Run now and again after partials inject
  syncYears();
  window.addEventListener("sb:partials_loaded", syncYears);

  // ---- Mailchimp submit ping ----
  document.addEventListener("submit", (e) => {
    const form = e.target && e.target.closest && e.target.closest("#mc-embedded-subscribe-form");
    if (!form) return;
    SB.ga.subscribe("footer");
  });

  // ---- Track “Add to Cart” custom event ----
  window.addEventListener("sb:add_to_cart", (e) => {
    const d = (e && e.detail) || {};
    const price = Number(d.price || 0);
    const quantity = Number(d.quantity || 1);

    SB.ga.add_to_cart({
      currency: "USD",
      value: price * quantity,
      items: [
        {
          item_id: d.item_id || "",
          item_name: d.item_name || "",
          price,
          quantity
        }
      ]
    });
  });

  // ---- Track site search (?q=) ----
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("q");
    if (q) SB.ga.search(q);
  } catch {}

  // ---- Nav mobile toggle (works for injected nav) ----
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest && e.target.closest(".nav-menu-toggle");
    if (!btn) return;

    // the injected nav contains its own .site-header
    const header = btn.closest(".site-header");
    if (!header) return;

    const open = header.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
