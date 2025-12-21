// public/partials/loader.js
(() => {
  // ✅ Set this to your deploy version when you push updates.
  // Example: window.SB_BUILD = "v20251221a" (you can set it in <head>), or leave default below.
  const BUILD = (window.SB_BUILD || document.querySelector('meta[name="sb:build"]')?.content || "v1");

  // ✅ Cache-friendly: only changes when BUILD changes.
  const bust = `?v=${encodeURIComponent(BUILD)}`;

  function onReady(fn) {
    if (document.readyState === "loading") { 
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  async function injectPartial(url, targetId) {
    const el = document.getElementById(targetId);
    if (!el) {
      console.warn("[partials] missing target:", targetId);
      return false;
    }

    try {
      // ✅ Prefer cache so Cloudflare/browser can actually cache nav/footer
      // If you need to force fresh during debugging, temporarily switch to { cache: "no-store" }.
      const res = await fetch(url + bust, { cache: "force-cache", credentials: "same-origin" });
      if (!res.ok) {
        console.warn("[partials] not ok:", url, res.status);
        return false;
      }

      const html = await res.text();
      el.innerHTML = html;

      // Optional reveal class
      el.classList.add("fade-in");
      return true;
    } catch (err) {
      console.warn("[partials] fetch fail:", url, err);
      return false;
    }
  }

  function markActiveNav() {
    const host = document.getElementById("site-header");
    if (!host) return;

    // nav partial contains the real header inside this container
    const scope = host.querySelector(".site-header") || host;

    const current = (location.pathname.replace(/\/+$/, "") || "/");

    scope.querySelectorAll("a[href]").forEach((a) => {
      const raw = a.getAttribute("href");
      if (!raw) return;

      // ignore anchors + external links + mailto/tel
      if (raw.startsWith("#")) return;
      if (/^(mailto:|tel:)/i.test(raw)) return;

      let hrefPath = "";
      try {
        const u = new URL(raw, location.origin);
        if (u.origin !== location.origin) return; // external
        hrefPath = (u.pathname.replace(/\/+$/, "") || "/");
      } catch {
        return;
      }

      // exact match OR section match (but don't let "/" match everything)
      const isActive =
        hrefPath === current ||
        (hrefPath !== "/" && current.startsWith(hrefPath + "/")) ||
        (hrefPath !== "/" && current === hrefPath);

      if (isActive) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      } else {
        a.classList.remove("is-active");
        a.removeAttribute("aria-current");
      }
    });
  }

  onReady(async () => {
    // ✅ Inject both (ONLY real files, not /nav/ directory)
    const navOk = await injectPartial("/nav/index.html", "site-header");
    if (navOk) markActiveNav();

    const footOk = await injectPartial("/footer/index.html", "site-footer");

    // Let any listeners (global.js, etc.) know chrome is in
    if (navOk || footOk) window.dispatchEvent(new Event("sb:partials_loaded"));
  });
})();
