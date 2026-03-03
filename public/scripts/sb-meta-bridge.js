// FILE: /public/scripts/sb-meta-bridge.js
(function () {
  // prevent double init
  if (window.__SB_META_BRIDGE_INIT__) return;
  window.__SB_META_BRIDGE_INIT__ = true;

  function hasFbq() {
    return typeof window.fbq === "function";
  }

  function clean(obj) {
    if (!obj || typeof obj !== "object") return {};
    const out = {};
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined || v === null || v === "") continue;
      out[k] = v;
    }
    return out;
  }

  // Build a Meta-friendly payload from SB payload
  function buildParams(d) {
    d = d || {};
    return clean({
      brand: d.brand || "squarebidness",
      page: d.page || location.pathname,
      component: d.component,
      action: d.action,
      label: d.label,
      href: d.href,
      id: d.id,
      value: typeof d.value === "number" ? d.value : undefined,
      currency: d.currency || (typeof d.value === "number" ? "USD" : undefined)
    });
  }

  // Map SB events -> Meta events
  function handleSb(detail) {
    if (!hasFbq()) return;

    const d = detail || {};
    const name = d.event || d.name || d.type || d.event_name || "";

    // Common param pack
    const params = buildParams(d);

    // 1) Lead: any SB form submit
    if (name === "sb_form_submit") {
      // Standard event (best for optimization + audiences)
      window.fbq("track", "Lead", params);
      return;
    }

    // 2) Contact: tel/mailto clicks (if sb_analytics sends href)
    if (name === "sb_click") {
      const href = (d.href || "").toString();
      if (/^(tel:|mailto:)/i.test(href)) {
        window.fbq("track", "Contact", params);
        return;
      }
      window.fbq("trackCustom", "SBClick", params);
      return;
    }

    // 3) Outbound clicks
    if (name === "sb_outbound") {
      window.fbq("trackCustom", "OutboundClick", params);
      return;
    }

    // 4) ViewContent: if your product pages send sb_view_content (optional)
    if (name === "sb_view_content") {
      window.fbq("track", "ViewContent", params);
      return;
    }

    // Fallback: log any SB event as custom (optional but useful)
    if (name) {
      window.fbq("trackCustom", "SBEvent", clean({ event_name: name, ...params }));
    }
  }

  // Listen for either naming convention
  window.addEventListener("sb_event", function (e) {
    handleSb(e && e.detail);
  });

  window.addEventListener("sb:track", function (e) {
    handleSb(e && e.detail);
  });

  // Optional: if your pages dispatch a simple Event when partials load
  window.addEventListener("sb:partials_loaded", function () {
    if (!hasFbq()) return;
    window.fbq("trackCustom", "SBPartialsLoaded", { brand: "squarebidness", page: location.pathname });
  });
})();
