// /public/scripts/sb-analytics.js  (Conversion Lab v2)
// Keeps ecommerce events + adds: sb_action clicks, outbound, forms, scroll depth, page context.

(() => {
  // ---- Guard: GA4 must be present (ga.js should load gtag)
  const hasGtag = () => typeof window.gtag === "function";

  // ---- Helpers
  const money = (n) => {
    const x = Number(n);
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : undefined;
  };

  const getCurrency = () => "USD";
  const safeText = (s) => (typeof s === "string" ? s.trim() : "");
  const qs = (k) => new URLSearchParams(location.search).get(k);

  const isExternalUrl = (href) => {
    try {
      const u = new URL(href, location.href);
      return u.origin !== location.origin;
    } catch {
      return false;
    }
  };

  const getPageContext = () => {
    const root = document.documentElement;
    const d = root?.dataset || {};
    return {
      sb_brand: safeText(d.sbBrand || ""),
      sb_tier: safeText(d.sbTier || ""),
      sb_variant: safeText(d.sbVariant || ""),
      page_path: location.pathname,
      page_title: document.title || "",
    };
  };

  // ---- Global event wrapper (buffers until GA is ready)
  window.sbTrack = (eventName, params = {}) => {
    try {
      if (!hasGtag()) {
        window.__sbEventQueue = window.__sbEventQueue || [];
        window.__sbEventQueue.push([eventName, params]);
        return;
      }
      window.gtag("event", eventName, params);
    } catch {
      // silent
    }
  };

  // ---- Flush queued events once gtag is ready
  const flush = () => {
    if (!hasGtag()) return;
    const q = window.__sbEventQueue || [];
    while (q.length) {
      const [name, p] = q.shift();
      try {
        window.gtag("event", name, p);
      } catch {}
    }
  };

  // Try a few times in case ga.js is deferred
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    flush();
    if (hasGtag() || tries > 30) clearInterval(t);
  }, 200);

  // ---- FORCE PAGEVIEW (GA4)
  function forcePageView() {
    try {
      const params = {
        page_location: location.href,
        page_path: location.pathname + location.search,
        page_title: document.title || "",
      };

      const key = `sb_pv_${params.page_path}`;
      try {
        if (sessionStorage.getItem(key) === "1") return;
        sessionStorage.setItem(key, "1");
      } catch {}

      window.sbTrack("page_view", params);
    } catch {}
  }

  function hookHistoryForPageviews() {
    try {
      const origPush = history.pushState;
      const origReplace = history.replaceState;

      history.pushState = function () {
        const r = origPush.apply(this, arguments);
        forcePageView();
        return r;
      };
      history.replaceState = function () {
        const r = origReplace.apply(this, arguments);
        forcePageView();
        return r;
      };

      window.addEventListener("popstate", forcePageView, { passive: true });
      window.addEventListener("hashchange", forcePageView, { passive: true });
    } catch {}
  }

  // =========================
  // CONVERSION LAB LAYER
  // =========================

  // ---- Universal action click tracking (data-sb-action)
  // Works on <a>, <button>, anything clickable:
  // data-sb-action="cx_book_open" data-sb-component="hero" data-sb-label="GlossGenius Services" data-sb-dest="https://..."
  function bindSbActions() {
    document.addEventListener(
      "click",
      (e) => {
        const el = e.target.closest("[data-sb-action]");
        if (!el) return;

        const ctx = getPageContext();
        const action = safeText(el.getAttribute("data-sb-action"));
        const component = safeText(el.getAttribute("data-sb-component") || "");
        const label = safeText(el.getAttribute("data-sb-label") || el.textContent || "");
        const href = safeText(el.getAttribute("href") || "");
        const dest = safeText(el.getAttribute("data-sb-dest") || href);

        const params = {
          ...ctx,
          action,
          component,
          label,
          link_url: dest || href,
        };

        window.sbTrack("sb_action", params);

        // Optional: also emit a shorthand event for key conversions (only if prefixed)
        // Example: cx_book_open -> eventName "cx_book_open"
        if (action.startsWith("cx_")) {
          window.sbTrack(action, params);
        }

        // Outbound flag (helpful for GA exploration)
        if (dest && isExternalUrl(dest)) {
          window.sbTrack("sb_outbound_click", { ...ctx, action, link_url: dest, label });
        }
      },
      { passive: true }
    );
  }

  // ---- Scroll depth (once per threshold)
  function bindScrollDepth() {
    const fired = new Set();
    const thresholds = [25, 50, 75, 90];

    function onScroll() {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const height = Math.max(1, doc.scrollHeight - doc.clientHeight);
      const pct = Math.round((scrollTop / height) * 100);

      thresholds.forEach((t) => {
        if (pct >= t && !fired.has(t)) {
          fired.add(t);
          const ctx = getPageContext();
          window.sbTrack("sb_scroll_depth", { ...ctx, percent: t });
        }
      });

      if (fired.size === thresholds.length) {
        window.removeEventListener("scroll", onScroll, { passive: true });
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---- Form tracking (drop-in)
  // Add on a form:
  // <form data-sb-form="cx_intake" data-sb-form-step="start"> ...
  // We track:
  // - sb_form_start (first interaction)
  // - sb_form_submit (on submit if valid)
  function bindForms() {
    const started = new WeakSet();

    function markStart(form) {
      if (!form || started.has(form)) return;
      started.add(form);
      const ctx = getPageContext();
      const name = safeText(form.getAttribute("data-sb-form") || form.id || "form");
      const step = safeText(form.getAttribute("data-sb-form-step") || "");
      window.sbTrack("sb_form_start", { ...ctx, form_name: name, form_step: step });
    }

    document.addEventListener(
      "input",
      (e) => {
        const form = e.target && e.target.closest ? e.target.closest("form[data-sb-form]") : null;
        if (!form) return;
        markStart(form);
      },
      { passive: true }
    );

    document.addEventListener(
      "change",
      (e) => {
        const form = e.target && e.target.closest ? e.target.closest("form[data-sb-form]") : null;
        if (!form) return;
        markStart(form);
      },
      { passive: true }
    );

    document.addEventListener(
      "submit",
      (e) => {
        const form = e.target && e.target.matches ? (e.target.matches("form[data-sb-form]") ? e.target : null) : null;
        if (!form) return;

        markStart(form);

        const ctx = getPageContext();
        const name = safeText(form.getAttribute("data-sb-form") || form.id || "form");
        const step = safeText(form.getAttribute("data-sb-form-step") || "");
        const valid = typeof form.checkValidity === "function" ? form.checkValidity() : true;

        window.sbTrack("sb_form_submit", { ...ctx, form_name: name, form_step: step, valid: !!valid });

        if (name.startsWith("cx_")) {
          window.sbTrack(`${name}_submit`, { ...ctx, form_name: name, form_step: step, valid: !!valid });
        }
      },
      true
    );
  }

  // =========================
  // YOUR EXISTING ECOMMERCE LAYER (unchanged)
  // =========================

  // ---- Products.json cache
  let PRODUCTS = null;
  async function loadProducts() {
    if (PRODUCTS) return PRODUCTS;
    try {
      const r = await fetch("/products.json", { cache: "no-store" });
      if (!r.ok) return null;
      PRODUCTS = await r.json();
      return PRODUCTS;
    } catch {
      return null;
    }
  }

  function productToItem(id, p) {
    const item = {
      item_id: p?.sku || id,
      item_name: safeText(p?.name || id),
      item_variant: safeText(p?.variant || ""),
      item_category: safeText(p?.category || "Apparel"),
      price: money(p?.price),
      currency: getCurrency(),
      item_brand: "Square Bidness",
    };
    Object.keys(item).forEach((k) => (item[k] === undefined || item[k] === "" ? delete item[k] : null));
    return item;
  }

  async function trackViewItemIfProductPage() {
    const meta = document.querySelector('meta[name="sb:product"]');
    if (!meta) return;
    const id = meta.content;

    const data = await loadProducts();
    const p = data?.[id];
    if (!p) return;

    const item = productToItem(id, p);

    window.sbTrack("view_item", {
      currency: getCurrency(),
      value: money(p.price),
      items: [item],
    });
  }

  function bindAddToCart() {
    document.addEventListener(
      "click",
      async (e) => {
        const btn =
          e.target.closest("[data-add-to-cart]") ||
          e.target.closest('[data-action="add"][data-product-id]');

        if (!btn) return;

        const id = btn.getAttribute("data-add-to-cart") || btn.getAttribute("data-product-id");
        if (!id) return;

        const data = await loadProducts();
        const p = data?.[id];
        if (!p) return;

        const qty = Number(btn.getAttribute("data-qty") || 1) || 1;

        window.sbTrack("add_to_cart", {
          currency: getCurrency(),
          value: money((p.price || 0) * qty),
          items: [{ ...productToItem(id, p), quantity: qty }],
        });
      },
      { passive: true }
    );
  }

  function bindStripeCheckoutClicks() {
    document.addEventListener(
      "click",
      async (e) => {
        const a = e.target.closest("[data-stripe-checkout]");
        if (!a) return;

        const id = a.getAttribute("data-stripe-checkout");
        const data = await loadProducts();
        const p = data?.[id];

        if (!p) {
          window.sbTrack("begin_checkout", { currency: getCurrency() });
          return;
        }

        window.sbTrack("begin_checkout", {
          currency: getCurrency(),
          value: money(p.price),
          items: [productToItem(id, p)],
        });
      },
      { passive: true }
    );
  }

  async function trackPurchaseIfSuccessPage() {
    const isSuccess = location.pathname.replace(/\/+$/, "") === "/success";
    if (!isSuccess) return;

    const pid = qs("pid");
    if (!pid) return;

    const data = await loadProducts();
    const p = data?.[pid];
    if (!p) return;

    const key = `sb_purchase_${pid}_${location.search}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}

    window.sbTrack("purchase", {
      transaction_id: `sb_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      currency: getCurrency(),
      value: money(p.price),
      items: [productToItem(pid, p)],
    });
  }

  // ---- Intent lane tracking (Conversation Hub)
  window.sbIntent = function (lane, el) {
    try {
      const href = el && el.getAttribute ? (el.getAttribute("href") || "") : "";

      if (typeof window.sbTrack !== "function") {
        window.__sbEventQueue = window.__sbEventQueue || [];
        window.__sbEventQueue.push([
          "sb_intent",
          { intent_lane: lane, page_path: location.pathname, link_url: href },
        ]);
        return;
      }

      window.sbTrack("sb_intent", {
        intent_lane: lane,
        page_path: location.pathname,
        link_url: href,
      });
    } catch {}
  };

  // ---- Boot
  document.addEventListener("DOMContentLoaded", () => {
    forcePageView();
    hookHistoryForPageviews();

    // Conversion Lab bindings
    bindSbActions();
    bindForms();
    bindScrollDepth();

    // Ecommerce
    trackViewItemIfProductPage();
    bindAddToCart();
    bindStripeCheckoutClicks();
    trackPurchaseIfSuccessPage();
  });

  window.addEventListener(
    "load",
    () => {
      forcePageView();
    },
    { once: true }
  );
})();
