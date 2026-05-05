// /public/scripts/partials.js
(() => {
  if (window.__SB_PARTIALS_INIT__) return;
  window.__SB_PARTIALS_INIT__ = true;

  const BUILD =
    window.SB_BUILD ||
    document.querySelector('meta[name="sb:build"]')?.content ||
    "v1";

  const bust = `?v=${encodeURIComponent(BUILD)}`;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  const NAV_TARGET_IDS = ["site-header", "nav-placeholder"];
  const FOOT_TARGET_IDS = ["site-footer", "footer-placeholder"];

  function findFirstExistingId(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return id;
    }
    return null;
  }

  async function fetchPartial(url) {
    const res = await fetch(url + bust, {
      cache: "no-cache",
      credentials: "same-origin",
    });

    if (!res.ok) {
      throw new Error(`[partials] not ok: ${url} ${res.status}`);
    }

    return res.text();
  }

  function applyPartial(el, html) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    const frag = document.createDocumentFragment();
    while (wrapper.firstChild) {
      frag.appendChild(wrapper.firstChild);
    }

    el.replaceChildren(frag);
    el.classList.add("fade-in");

    if (el.hasAttribute("aria-busy")) {
      el.setAttribute("aria-busy", "false");
    }

    const yearEl = el.querySelector("#sb-year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  }

  async function injectPartial(url, targetId) {
    const el = document.getElementById(targetId);
    if (!el) {
      console.warn("[partials] missing target:", targetId);
      return false;
    }

    try {
      const html = await fetchPartial(url);
      applyPartial(el, html);
      return true;
    } catch (err) {
      console.warn("[partials] fetch fail:", url, err);
      return false;
    }
  }

  function markActiveNav() {
    const host =
      document.getElementById("site-header") ||
      document.getElementById("nav-placeholder");

    if (!host) return;

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
    window.requestAnimationFrame(async () => {
      const navTargetId = findFirstExistingId(NAV_TARGET_IDS);
      const footTargetId = findFirstExistingId(FOOT_TARGET_IDS);

      if (!navTargetId) {
        console.warn("[partials] no nav target found.");
      }
      if (!footTargetId) {
        console.warn("[partials] no footer target found.");
      }

      const navPromise = navTargetId
        ? injectPartial("/nav/index.html", navTargetId)
        : Promise.resolve(false);

      const footPromise = footTargetId
        ? injectPartial("/footer/index.html", footTargetId)
        : Promise.resolve(false);

      const [navOk, footOk] = await Promise.all([navPromise, footPromise]);

      if (navOk) {
        markActiveNav();
      }

      if (navOk || footOk) {
        window.dispatchEvent(new Event("sb:partials_loaded"));
      }
    });
  });
})();
