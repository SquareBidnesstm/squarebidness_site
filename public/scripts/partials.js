// /public/scripts/partials.js
(() => {
  const BUILD = (window.SB_BUILD || document.querySelector('meta[name="sb:build"]')?.content || "v1");
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
      const res = await fetch(url + bust, { cache: "force-cache", credentials: "same-origin" });
      if (!res.ok) {
        console.warn("[partials] not ok:", url, res.status);
        return false;
      }

      const html = await res.text();
      el.innerHTML = html;
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

    const scope = host.querySelector(".site-header") || host;
    const current = (location.pathname.replace(/\/+$/, "") || "/");

    scope.querySelectorAll("a[href]").forEach((a) => {
      const raw = a.getAttribute("href");
      if (!raw) return;
      if (raw.startsWith("#")) return;
      if (/^(mailto:|tel:)/i.test(raw)) return;

      let hrefPath = "";
      try {
        const u = new URL(raw, location.origin);
        if (u.origin !== location.origin) return;
        hrefPath = (u.pathname.replace(/\/+$/, "") || "/");
      } catch {
        return;
      }

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
    const navOk = await injectPartial("/nav/index.html", "site-header");
    if (navOk) markActiveNav();

    const footOk = await injectPartial("/footer/index.html", "site-footer");

    if (navOk || footOk) window.dispatchEvent(new Event("sb:partials_loaded"));
  });
})();
