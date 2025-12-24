// /public/scripts/partials.js
(() => {
  // Prevent double-initialization if script is included twice
  if (window.__SB_PARTIALS_INIT__) return;
  window.__SB_PARTIALS_INIT__ = true;

  const BUILD =
    (window.SB_BUILD ||
      document.querySelector('meta[name="sb:build"]')?.content ||
      "v1");

  const bust = `?v=${encodeURIComponent(BUILD)}`;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  // Support BOTH ID conventions across the repo:
  // - older pages:  nav-placeholder / footer-placeholder
  // - newer pages:  site-header / site-footer
  const NAV_TARGET_IDS = ["site-header", "nav-placeholder"];
  const FOOT_TARGET_IDS = ["site-footer", "footer-placeholder"];

  function findFirstExistingId(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return id;
    }
    return null;
  }

  async function injectPartial(url, targetId) {
    const el = document.getElementById(targetId);
    if (!el) {
      console.warn("[partials] missing target:", targetId);
      return false;
    }

    try {
      const res = await fetch(url + bust, {
        cache: "force-cache",
        credentials: "same-origin",
      });

      if (!res.ok) {
        console.warn("[partials] not ok:", url, res.status);
        return false;
      }

      const html = await res.text();

      // Single batched DOM write to reduce layout thrash
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;

      const frag = document.createDocumentFragment();
      while (wrapper.firstChild) {
        frag.appendChild(wrapper.firstChild);
      }

      // Replace existing children in one shot
      el.replaceChildren(frag);

      // Optional fade-in hook (only matters if your CSS defines it)
      el.classList.add("fade-in");

      // Clear aria-busy if it was set in the HTML
      if (el.hasAttribute("aria-busy")) {
        el.setAttribute("aria-busy", "false");
      }

      return true;
    } catch (err) {
      console.warn("[partials] fetch fail:", url, err);
      return false;
    }
  }

  function markActiveNav() {
    // Support either host ID
    const host =
      document.getElementById("site-header") ||
      document.getElementById("nav-placeholder");

    if (!host) return;

    // Some nav templates wrap with .site-header, support either
    const scope = host.querySelector(".site-header") || host;

    const current = location.pathname.replace(/\/+$/, "") || "/";

    scope.querySelectorAll("a[href]").forEach((a) => {
      const raw = a.getAttribute("href");
      if (!raw) return;
      if (raw.startsWith("#")) return;
      if (/^(mailto:|tel:)/i.test(raw)) return;

      let hrefPath = "";
      try {
        const u = new URL(raw, location.origin);
        if (u.origin !== location.origin) return;
        hrefPath = u.pathname.replace(/\/+$/, "") || "/";
      } catch {
        return;
      }

      const isActive =
        hrefPath === current ||
        (hrefPath !== "/" && current === hrefPath) ||
        (hrefPath !== "/" && current.startsWith(hrefPath + "/"));

      if (isActive) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      } else {
        a.classList.remove("is-active");
        a.removeAttribute("aria-current");
      }
    });
  }

  onReady(() => {
    // Let first paint happen, then inject nav/footer
    window.requestAnimationFrame(async () => {
      const navTargetId = findFirstExistingId(NAV_TARGET_IDS);
      const footTargetId = findFirstExistingId(FOOT_TARGET_IDS);

      // Kick off both fetches in parallel to minimize time on main thread
      const navPromise = navTargetId
        ? injectPartial("/nav/index.html", navTargetId)
        : Promise.resolve(false);

      const footPromise = footTargetId
        ? injectPartial("/footer/index.html", footTargetId)
        : Promise.resolve(false);

      if (!navTargetId) {
        console.warn(
          "[partials] no nav target found (site-header or nav-placeholder)."
        );
      }
      if (!footTargetId) {
        console.warn(
          "[partials] no footer target found (site-footer or footer-placeholder)."
        );
      }

      const [navOk, footOk] = await Promise.all([navPromise, footPromise]);

      if (navOk) {
        // Mark active link AFTER nav HTML is in place
        markActiveNav();
      }

      if (navOk || footOk) {
        window.dispatchEvent(new Event("sb:partials_loaded"));
      }
    });
  });
})();
