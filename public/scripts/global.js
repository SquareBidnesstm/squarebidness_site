/* /public/scripts/global.js
   Square Bidness — Global JS (works with SB namespace)
   Analytics · Year sync · Mailchimp submit ping · Nav toggle
*/
(() => {
  try {
    const root = window;

    if (!root.SB || typeof root.SB !== "object") root.SB = {};
    const SB = root.SB;

    // Ensure SB.ga exists
    SB.ga = SB.ga && typeof SB.ga === "object" ? SB.ga : {};
    const ga = SB.ga;

    ga.evt = function (name, params = {}) {
      try {
        if (typeof root.gtag === "function") root.gtag("event", name, params);
      } catch {}
    };

    ga.view_item      = (data) => ga.evt("view_item", data);
    ga.add_to_cart    = (data) => ga.evt("add_to_cart", data);
    ga.begin_checkout = (data) => ga.evt("begin_checkout", data);
    ga.purchase       = (data) => ga.evt("purchase", data);
    ga.subscribe      = (where = "footer") => ga.evt("generate_lead", { method: `mailchimp_${where}` });
    ga.search         = (q) => ga.evt("search", { search_term: q || "" });

    // Year sync (after footer inject)
    function syncYears() {
      const y = String(new Date().getFullYear());
      ["sb-year", "y", "tech-year"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = y;
      });
    }
    syncYears();
    root.addEventListener("sb:partials_loaded", syncYears);

    // Mailchimp submit ping
    document.addEventListener("submit", (e) => {
      const form = e.target && e.target.closest && e.target.closest("#mc-embedded-subscribe-form");
      if (!form) return;
      ga.subscribe("footer");
    });

    // Add to cart tracking event from sb-cart.js
    root.addEventListener("sb:add_to_cart", (e) => {
      const d = (e && e.detail) || {};
      const price = Number(d.price || 0);
      const quantity = Number(d.quantity || 1);

      ga.add_to_cart({
        currency: "USD",
        value: price * quantity,
        items: [{
          item_id: d.item_id || "",
          item_name: d.item_name || "",
          price,
          quantity
        }]
      });
    });

    // Track search (?q=)
    try {
      const u = new URL(root.location.href);
      const q = u.searchParams.get("q");
      if (q) ga.search(q);
    } catch {}

    // Mobile nav toggle (works with injected nav)
    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest && e.target.closest(".nav-menu-toggle");
      if (!btn) return;
      const header = btn.closest(".site-header");
      if (!header) return;
      const open = header.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

  } catch (err) {
    console.warn("[global.js] failed hard:", err);
  }
})();
