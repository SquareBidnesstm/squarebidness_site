// /public/scripts/sb-analytics.js
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

  // ---- Global event wrapper
  window.sbTrack = (eventName, params = {}) => {
    try {
      if (!hasGtag()) {
        // keep a small buffer so events aren't lost if ga.js loads a hair late
        window.__sbEventQueue = window.__sbEventQueue || [];
        window.__sbEventQueue.push([eventName, params]);
        return;
      }
      window.gtag("event", eventName, params);
    } catch (e) {
      // silent
    }
  };

  // ---- Flush queued events once gtag is ready
  const flush = () => {
    if (!hasGtag()) return;
    const q = window.__sbEventQueue || [];
    while (q.length) {
      const [name, p] = q.shift();
      try { window.gtag("event", name, p); } catch {}
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
  // Fires a page_view event for reliable page reporting even if some pages are "quiet"
  function forcePageView() {
    try {
      const params = {
        page_location: location.href,
        page_path: location.pathname + location.search,
        page_title: document.title || "",
      };

      // Dedup per page load (prevents double if called more than once)
      const key = `sb_pv_${params.page_path}`;
      try {
        if (sessionStorage.getItem(key) === "1") return;
        sessionStorage.setItem(key, "1");
      } catch {}

      window.sbTrack("page_view", params);
    } catch {}
  }

  // Optional: track SPA-like navigation (safe even for static sites)
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
    // remove undefined fields
    Object.keys(item).forEach(k => item[k] === undefined || item[k] === "" ? delete item[k] : null);
    return item;
  }

  // ---- Detect product page view_item via <meta name="sb:product">
  // Add this meta to product pages (examples below)
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

  // ---- Track add_to_cart buttons (works for:
  // 1) Any element with data-add-to-cart="PRODUCT_ID"
  // 2) Any element with data-product-id="PRODUCT_ID" and data-action="add"
  function bindAddToCart() {
    document.addEventListener("click", async (e) => {
      const btn =
        e.target.closest('[data-add-to-cart]') ||
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
        items: [ { ...productToItem(id, p), quantity: qty } ],
      });
    }, { passive: true });
  }

  // ---- Track begin_checkout for Stripe links
  // Put data-stripe-checkout="PRODUCT_ID" on Stripe checkout links/buttons
  function bindStripeCheckoutClicks() {
    document.addEventListener("click", async (e) => {
      const a = e.target.closest('[data-stripe-checkout]');
      if (!a) return;

      const id = a.getAttribute("data-stripe-checkout");
      const data = await loadProducts();
      const p = data?.[id];

      // If we don’t know product, still track begin_checkout
      if (!p) {
        window.sbTrack("begin_checkout", { currency: getCurrency() });
        return;
      }

      window.sbTrack("begin_checkout", {
        currency: getCurrency(),
        value: money(p.price),
        items: [ productToItem(id, p) ],
      });
    }, { passive: true });
  }

  // ---- Track purchase on /success/
  // Stripe success_url should be: https://www.squarebidness.com/success/?pid=wintergames-hat
  async function trackPurchaseIfSuccessPage() {
    const isSuccess = location.pathname.replace(/\/+$/, "") === "/success";
    if (!isSuccess) return;

    const pid = qs("pid");
    if (!pid) return;

    const data = await loadProducts();
    const p = data?.[pid];
    if (!p) return;

    // Dedup so refresh doesn’t double-count
    const key = `sb_purchase_${pid}_${location.search}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}

    window.sbTrack("purchase", {
      transaction_id: `sb_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      currency: getCurrency(),
      value: money(p.price),
      items: [ productToItem(pid, p) ],
    });
  }

  // ---- Boot
  document.addEventListener("DOMContentLoaded", () => {
    // Force a page_view early (queues if gtag isn’t ready yet)
    forcePageView();
    hookHistoryForPageviews();

    trackViewItemIfProductPage();
    bindAddToCart();
    bindStripeCheckoutClicks();
    trackPurchaseIfSuccessPage();
  });

  // Also fire on full load (helps on some Safari timing cases)
  window.addEventListener("load", () => {
    forcePageView();
  }, { once: true });
})();
