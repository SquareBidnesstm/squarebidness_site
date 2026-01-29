/* Steakhouse tap tracking (no backend required) */
(function () {
  const fire = (name, params = {}) => {
    // If GA4 is present
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
      return;
    }
    // Fallback (still useful while testing)
    console.log("[track]", name, params);
  };

  const onClick = (e) => {
    const a = e.target.closest("a,button");
    if (!a) return;

    const href = a.getAttribute("href") || "";
    const text = (a.textContent || "").trim().slice(0, 80);
    const id = a.id || "";
    const cls = (a.className || "").toString().slice(0, 120);

    // Reserve signals
    if (href.includes("#reserve") || cls.includes("sh-reserve")) {
      fire("reserve_click", { page: location.pathname, href, text, id });
      return;
    }

    // Menu signals
    if (href.includes("/steakhouse/menu/")) {
      fire("menu_click", { page: location.pathname, href, text, id });
      return;
    }

    // Directions
    if (href.includes("maps.google.com") || href.includes("google.com/maps")) {
      fire("directions_click", { page: location.pathname, href, text, id });
      return;
    }

    // Call
    if (href.startsWith("tel:")) {
      fire("call_click", { page: location.pathname, href, text, id });
      return;
    }
  };

  document.addEventListener("click", onClick, { passive: true });
})();
