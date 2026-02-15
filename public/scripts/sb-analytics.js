// /public/scripts/sb-analytics.js
(() => {
  // =========================
  // GA + Queue (keep your pattern)
  // =========================
  const hasGtag = () => typeof window.gtag === "function";

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

  let tries = 0;
  const t = setInterval(() => {
    tries++;
    flush();
    if (hasGtag() || tries > 30) clearInterval(t);
  }, 200);

  // =========================
  // Helpers
  // =========================
  const money = (n) => {
    const x = Number(n);
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : undefined;
  };
  const getCurrency = () => "USD";
  const safeText = (s) => (typeof s === "string" ? s.trim() : "");
  const qs = (k) => new URLSearchParams(location.search).get(k);

  const escOrigin = () => {
    try { return location.origin; } catch { return ""; }
  };

  const getBrand = () =>
    document.documentElement.getAttribute("data-sb-brand") ||
    document.body?.getAttribute("data-sb-brand") ||
    "squarebidness";

  const getTier = () => document.documentElement.getAttribute("data-sb-tier") || "";
  const getVariant = () => document.documentElement.getAttribute("data-sb-variant") || "";

  const pushDataLayer = (event, payload) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...payload });
  };

  // Unified emitter (adds your consistent fields)
  const emit = (event, payload = {}) => {
    const base = {
      sb_v: "v3",
      brand: getBrand(),
      tier: getTier(),
      variant: getVariant(),
      page_path: location.pathname + location.search,
      page: location.pathname,
      page_title: document.title || "",
      page_location: location.href,
      referrer: document.referrer || "",
    };
    const data = { ...base, ...payload };

    // always push to dataLayer
    pushDataLayer(event, data);

    // send to GA4 (queued if needed)
    window.sbTrack(event, data);

    return data;
  };

  // =========================
  // Force page_view (keep yours)
  // =========================
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
      pushDataLayer("page_view", params);
    } catch {}
  }

  function hookHistoryForPageviews() {
    try {
      const origPush = history.pushState;
      const origReplace = history.replaceState;

      history.pushState = function () {
        const r = origPush.apply(this, arguments);
        forcePageView();
        emit("sb_page_ready", { reason: "pushState" });
        return r;
      };
      history.replaceState = function () {
        const r = origReplace.apply(this, arguments);
        forcePageView();
        emit("sb_page_ready", { reason: "replaceState" });
        return r;
      };

      window.addEventListener("popstate", () => {
        forcePageView();
        emit("sb_page_ready", { reason: "popstate" });
      }, { passive: true });

      window.addEventListener("hashchange", () => {
        forcePageView();
        emit("sb_page_ready", { reason: "hashchange" });
      }, { passive: true });
    } catch {}
  }

  // =========================
  // Products.json cache (keep yours)
  // =========================
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
    Object.keys(item).forEach((k) =>
      item[k] === undefined || item[k] === "" ? delete item[k] : null
    );
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
    pushDataLayer("view_item", { currency: getCurrency(), value: money(p.price), items: [item] });
  }

  function bindAddToCart() {
    document.addEventListener("click", async (e) => {
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

      const payload = {
        currency: getCurrency(),
        value: money((p.price || 0) * qty),
        items: [{ ...productToItem(id, p), quantity: qty }],
      };

      window.sbTrack("add_to_cart", payload);
      pushDataLayer("add_to_cart", payload);
    });
  }

  function bindStripeCheckoutClicks() {
    document.addEventListener("click", async (e) => {
      const a = e.target.closest("[data-stripe-checkout]");
      if (!a) return;

      const id = a.getAttribute("data-stripe-checkout");
      const data = await loadProducts();
      const p = data?.[id];

      if (!p) {
        const payload = { currency: getCurrency() };
        window.sbTrack("begin_checkout", payload);
        pushDataLayer("begin_checkout", payload);
        return;
      }

      const payload = {
        currency: getCurrency(),
        value: money(p.price),
        items: [productToItem(id, p)],
      };

      window.sbTrack("begin_checkout", payload);
      pushDataLayer("begin_checkout", payload);
    });
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

    const payload = {
      transaction_id: `sb_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      currency: getCurrency(),
      value: money(p.price),
      items: [productToItem(pid, p)],
    };

    window.sbTrack("purchase", payload);
    pushDataLayer("purchase", payload);
  }

  // =========================
  // Intent lane (keep yours)
  // =========================
  window.sbIntent = function (lane, el) {
    try {
      const href = el && el.getAttribute ? el.getAttribute("href") || "" : "";
      emit("sb_intent", {
        intent_lane: lane,
        link_url: href,
      });
    } catch {}
  };

  // =========================
  // Universal attribute-driven tracking
  // =========================
  const isOutbound = (href) => {
    try {
      const u = new URL(href, escOrigin());
      return u.origin !== escOrigin();
    } catch {
      return false;
    }
  };

  const closestTracked = (el) => {
    if (!el) return null;
    return el.closest("[data-sb-event], [data-sb-action], a, button, input[type='submit']");
  };

  // Click + outbound
  function bindUniversalClicks() {
    document.addEventListener("click", (e) => {
      const el = closestTracked(e.target);
      if (!el) return;

      // Avoid double-counting: let your ecommerce click handlers own these
      if (el.closest("[data-add-to-cart], [data-product-id][data-action='add'], [data-stripe-checkout]")) return;

      // Opt-out if needed
      if (el.getAttribute("data-sb-skip") === "1") return;

      const tag = (el.tagName || "").toLowerCase();
      const href = tag === "a" ? (el.href || "") : "";
      const outbound = href ? isOutbound(href) : false;

      const eventName = el.getAttribute("data-sb-event") || (outbound ? "sb_outbound" : "sb_click");
      const action = el.getAttribute("data-sb-action") || el.getAttribute("data-action") || "";
      const component = el.getAttribute("data-sb-component") || "";
      const label =
        el.getAttribute("data-sb-label") ||
        safeText(el.textContent || "").slice(0, 90);

      emit(eventName, {
        action,
        component,
        label,
        href: href || "",
        id: el.id || "",
      });

      // Soft-hold outbound same-tab so GA has a moment
      if (outbound && tag === "a") {
        const target = (el.getAttribute("target") || "").toLowerCase();
        const isNewTab = target === "_blank";
        if (!isNewTab && el.getAttribute("data-sb-noblock") !== "1") {
          e.preventDefault();
          setTimeout(() => { location.href = href; }, 140);
        }
      }
    }, true);
  }

  // Forms
  function bindForms() {
    document.addEventListener("submit", (e) => {
      const form = e.target;
      if (!form || form.tagName !== "FORM") return;

      const formName =
        form.getAttribute("data-sb-form") ||
        form.getAttribute("name") ||
        form.getAttribute("id") ||
        "form";

      const ok = form.checkValidity ? form.checkValidity() : true;

      if (!ok) {
        emit("sb_form_error", {
          form: formName,
          component: form.getAttribute("data-sb-component") || "",
          action: form.getAttribute("data-sb-action") || "submit",
        });
        return;
      }

      emit("sb_form_submit", {
        form: formName,
        component: form.getAttribute("data-sb-component") || "",
        action: form.getAttribute("data-sb-action") || "submit",
      });
    }, true);
  }

  // Scroll depth 25/50/75/90
  function bindScrollDepth() {
    const marks = [25, 50, 75, 90];
    const fired = new Set();

    const getPct = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const height = (doc.scrollHeight || 1) - window.innerHeight;
      if (height <= 0) return 100;
      return Math.max(0, Math.min(100, (scrollTop / height) * 100));
    };

    let timer = null;
    window.addEventListener("scroll", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const pct = getPct();
        for (const m of marks) {
          if (pct >= m && !fired.has(m)) {
            fired.add(m);
            emit("sb_scroll_depth", { value: m });
          }
        }
      }, 120);
    }, { passive: true });
  }

  // Time engaged 10/30/60 (resets when tab returns)
  function bindTimeEngaged() {
    const marks = [10, 30, 60];
    const fired = new Set();
    let start = Date.now();
    let visible = !document.hidden;

    const tick = () => {
      if (!visible) return;
      const secs = Math.floor((Date.now() - start) / 1000);
      for (const m of marks) {
        if (secs >= m && !fired.has(m)) {
          fired.add(m);
          emit("sb_time_engaged", { value: m });
        }
      }
    };

    document.addEventListener("visibilitychange", () => {
      visible = !document.hidden;
      if (visible) start = Date.now();
    });

    setInterval(tick, 1000);
  }

  // =========================
  // Boot
  // =========================
  document.addEventListener("DOMContentLoaded", () => {
    // Your pageview reliability
    forcePageView();
    hookHistoryForPageviews();

    // New universal layer
    emit("sb_page_ready", { reason: "DOMContentLoaded" });
    bindUniversalClicks();
    bindForms();
    bindScrollDepth();
    bindTimeEngaged();

    // Your ecom layer
    trackViewItemIfProductPage();
    bindAddToCart();
    bindStripeCheckoutClicks();
    trackPurchaseIfSuccessPage();
  });

  window.addEventListener("load", () => {
    forcePageView();
    emit("sb_page_ready", { reason: "load" });
  }, { once: true });
})();
