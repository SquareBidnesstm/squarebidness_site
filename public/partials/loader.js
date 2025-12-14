// public/partials/loader.js
(async () => {
  const bust = `?v=${Date.now()}`;

  async function injectPartial(url, targetId) {
    try {
      const res = await fetch(url + bust, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) {
        console.warn("[partials] not ok:", url, res.status);
        return false;
      }

      const html = await res.text();
      const el = document.getElementById(targetId);
      if (!el) {
        console.warn("[partials] missing target:", targetId);
        return false;
      }

      el.innerHTML = html;

      // Optional nice reveal if you keep .fade-in in CSS
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

    scope.querySelectorAll('a[href]').forEach((a) => {
      const raw = a.getAttribute("href");
      if (!raw) return;

      // ignore anchors + external links + mailto/tel
      if (raw.startsWith("#")) return;
      if (/^(mailto:|tel:)/i.test(raw)) return;

      let hrefPath = "";
      try {
        const u = new URL(raw, location.origin);
        // if external domain, skip
        if (u.origin !== location.origin) return;
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

  // Inject both
  const navOk = await injectPartial("/nav/index.html", "site-header");
  if (navOk) markActiveNav();

  const footOk = await injectPartial("/footer/index.html", "site-footer");

  // Let global.js sync years, etc.
  if (navOk || footOk) window.dispatchEvent(new Event("sb:partials_loaded"));
})();
