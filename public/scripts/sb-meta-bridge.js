// FILE: /public/scripts/sb-meta-bridge.js  (PASTE READY — hooks window.sbTrack)
(function () {
  if (window.__SB_META_BRIDGE_V1__) return;
  window.__SB_META_BRIDGE_V1__ = true;

  // Wait for Meta Pixel (fbq) to exist (pixel script loads async)
  function whenFbqReady(fn, tries = 0) {
    if (typeof window.fbq === "function") return fn();
    if (tries > 60) return; // ~6s max
    setTimeout(() => whenFbqReady(fn, tries + 1), 100);
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

  function mapCtx(params) {
    params = params || {};
    return clean({
      brand: params.sb_brand || "squarebidness",
      tier: params.sb_tier,
      variant: params.sb_variant,
      page_path: params.page_path || location.pathname,
      page_title: params.page_title || document.title || "",
      action: params.action,
      component: params.component,
      label: params.label,
      link_url: params.link_url,
      form_name: params.form_name,
      form_step: params.form_step,
      event_source_url: location.href
    });
  }

  // Convert GA4 ecommerce "items" to Meta "contents"
  function itemsToContents(items) {
    if (!Array.isArray(items)) return undefined;
    const contents = items
      .map((it) => ({
        id: it.item_id || it.id || it.sku,
        quantity: it.quantity || 1,
        item_price: typeof it.price === "number" ? it.price : undefined
      }))
      .filter((c) => c.id);
    return contents.length ? contents : undefined;
  }

  function trackMeta(eventName, params) {
    whenFbqReady(() => {
      try {
        // Standard events
        if (eventName === "Lead") return window.fbq("track", "Lead", params);
        if (eventName === "ViewContent") return window.fbq("track", "ViewContent", params);
        if (eventName === "AddToCart") return window.fbq("track", "AddToCart", params);
        if (eventName === "InitiateCheckout") return window.fbq("track", "InitiateCheckout", params);
        if (eventName === "Purchase") return window.fbq("track", "Purchase", params);

        // Custom events
        window.fbq("trackCustom", eventName, params);
      } catch {
        // silent
      }
    });
  }

  // Hook sbTrack (works even if sbTrack is defined later)
  function hook() {
    if (typeof window.sbTrack !== "function") {
      setTimeout(hook, 50);
      return;
    }

    const orig = window.sbTrack;
    if (orig.__SB_META_WRAPPED__) return;

    function wrapped(eventName, params) {
      // Always forward to GA layer
      try { orig(eventName, params); } catch {}

      // Mirror selected events into Meta
      try {
        const p = params || {};
        const ctx = mapCtx(p);

        // 1) Forms → Lead (only when valid)
        if (eventName === "sb_form_submit") {
          const valid = p.valid === undefined ? true : !!p.valid;
          if (valid) trackMeta("Lead", ctx);
          return;
        }

        // 2) Outbound click (custom)
        if (eventName === "sb_outbound_click") {
          trackMeta("SBOutboundClick", ctx);
          return;
        }

        // 3) Ecommerce mapping
        if (eventName === "view_item") {
          const contents = itemsToContents(p.items);
          trackMeta("ViewContent", clean({
            ...ctx,
            currency: p.currency || "USD",
            value: typeof p.value === "number" ? p.value : undefined,
            contents,
            content_type: contents ? "product" : undefined
          }));
          return;
        }

        if (eventName === "add_to_cart") {
          const contents = itemsToContents(p.items);
          trackMeta("AddToCart", clean({
            ...ctx,
            currency: p.currency || "USD",
            value: typeof p.value === "number" ? p.value : undefined,
            contents,
            content_type: contents ? "product" : undefined
          }));
          return;
        }

        if (eventName === "begin_checkout") {
          const contents = itemsToContents(p.items);
          trackMeta("InitiateCheckout", clean({
            ...ctx,
            currency: p.currency || "USD",
            value: typeof p.value === "number" ? p.value : undefined,
            contents,
            content_type: contents ? "product" : undefined
          }));
          return;
        }

        if (eventName === "purchase") {
          const contents = itemsToContents(p.items);
          trackMeta("Purchase", clean({
            ...ctx,
            currency: p.currency || "USD",
            value: typeof p.value === "number" ? p.value : undefined,
            contents,
            content_type: contents ? "product" : undefined
          }));
          return;
        }

        // 4) Action clicks → only mirror cx_ actions (conversion actions)
        if (eventName === "sb_action" && p.action) {
          if (String(p.action).startsWith("cx_")) {
            trackMeta("SBAction", ctx);
          }
          return;
        }
      } catch {
        // silent
      }
    }

    wrapped.__SB_META_WRAPPED__ = true;
    window.sbTrack = wrapped;
  }

  hook();
})();
