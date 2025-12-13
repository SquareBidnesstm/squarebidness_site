/* =====================================================
   Square Bidness — Global JS
   Analytics helpers · Year sync · Mailchimp ping · Nav toggle
===================================================== */

(() => {
  // Always define a safe global namespace
  const SB = (window.SB = window.SB || {});
  SB.ga = SB.ga || {};

  // GA helper (safe even if gtag isn't ready yet)
  SB.ga.evt = (name, params = {}) => {
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

  // ---- Helpers that must work AFTER partials inject ----
  function syncYears() {
    const y = String(new Date().getFullYear());
    const a = document.getElementById("sb-year");
    const b = document.getElementById("y");
    const c = document.getElementById("tech-year");
    if (a) a.textContent = y;
    if (b) b.textContent = y;
    if (c) c.textContent = y;
  }

  // Mailchimp submit ping
  document.addEventListener("submit", (e) => {
    const f = e.target && e.target.closest && e.target.closest("#mc-embedded-subscribe-form");
    if (!f) return;
    SB.ga.subscribe("footer");
  });

  // Track “Add to Cart” custom event
  window.addEventListener("sb:add_to_cart", (e) => {
    const d = (e && e.detail) || {};
    SB.ga.add_to_cart({
      currency: "USD",
      value: (d.price || 0) * (d.quantity || 1),
      items: [
        {
          item_id: d.item_id,
          item_name: d.item_name,
          price: d.price,
          quantity: d.quantity,
        },
      ],
    });
  });

  // Track site search (?q=)
  try {
    const u = new URL(location.href);
    const q = u.searchParams.get("q");
    if (q) SB.ga.search(q);
  } catch {}

  // Nav mobile toggle (works for injected nav)
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest && e.target.closest(".nav-menu-toggle");
    if (!btn) return;

    const header = btn.closest(".site-header");
    if (!header) return;

    const open = header.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // Run now…
  syncYears();
  // …and run again when partials inject
  window.addEventListener("sb:partials_loaded", syncYears);
})();
