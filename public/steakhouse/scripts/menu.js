/* /public/steakhouse/scripts/menu.js
   The SteaKhouse — Mobile Drawer + Sticky Header Scroll State (v1.2)
   - Fixes iOS/Safari "drawer stays open after nav"
   - Safe to include on every page (QR page exits clean)
*/
(function () {
  const topbar = document.querySelector(".sh-topbar");

  // ----------------------------
  // Sticky header "is-scrolled"
  // ----------------------------
  if (topbar) {
    const onScroll = () => {
      if (window.scrollY > 8) topbar.classList.add("is-scrolled");
      else topbar.classList.remove("is-scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ----------------------------
  // Mobile drawer menu
  // ----------------------------
  const drawer = document.getElementById("shMobileMenu");
  const openBtn = document.querySelector("[data-menu-open]");

  // If a page doesn't have the drawer markup (like QR minimal), exit clean.
  if (!drawer || !openBtn) return;

  const closeBtns = drawer.querySelectorAll("[data-menu-close]");
  const panel = drawer.querySelector(".sh-drawer__panel");

  const focusableSelector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let lastFocus = null;

  const setOpen = (isOpen) => {
    drawer.classList.toggle("is-open", isOpen);
    drawer.setAttribute("aria-hidden", String(!isOpen));
    openBtn.setAttribute("aria-expanded", String(isOpen));

    // lock scroll (your CSS supports .no-scroll)
    document.documentElement.classList.toggle("no-scroll", isOpen);
    document.body.classList.toggle("no-scroll", isOpen);

    if (isOpen) {
      lastFocus = document.activeElement;
      const first = panel?.querySelector(focusableSelector);
      if (first) first.focus();
    } else {
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      else openBtn.focus();
    }
  };

  // Hard reset on load (prevents any weird cached open state)
  setOpen(false);

  // Open / Close handlers
  openBtn.addEventListener("click", () => setOpen(true));
  closeBtns.forEach((btn) => btn.addEventListener("click", () => setOpen(false)));

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) setOpen(false);
  });

  // Click outside panel closes (backdrop behavior)
  drawer.addEventListener("click", () => {
    if (drawer.classList.contains("is-open")) setOpen(false);
  });

  // Clicks inside the panel shouldn't close via backdrop
  if (panel) panel.addEventListener("click", (e) => e.stopPropagation());

  // Trap focus inside drawer while open (accessibility)
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    if (!drawer.classList.contains("is-open")) return;
    if (!panel) return;

    const focusables = Array.from(panel.querySelectorAll(focusableSelector)).filter(
      (el) => el.offsetParent !== null
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // ✅ Critical iOS/Safari fix:
  // Close drawer on ANY tap/click of a link inside it (CAPTURE PHASE)
  // This runs before navigation starts.
  drawer.addEventListener(
    "click",
    (e) => {
      const a = e.target && e.target.closest && e.target.closest("a");
      if (!a) return;
      if (!drawer.classList.contains("is-open")) return;
      setOpen(false);
    },
    true
  );

  // ✅ Safari back/forward cache can restore an open drawer — force closed
  window.addEventListener("pageshow", () => setOpen(false));
})();
