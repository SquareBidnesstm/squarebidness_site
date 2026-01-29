/* /public/steakhouse/scripts/menu.js
   The SteaKhouse — Mobile Drawer + Sticky Header Scroll State
   (no deps, safe to include on every page)
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

    // lock scroll (your CSS already supports .no-scroll)
    document.documentElement.classList.toggle("no-scroll", isOpen);
    document.body.classList.toggle("no-scroll", isOpen);

    if (isOpen) {
      lastFocus = document.activeElement;
      // focus first link/button inside the panel
      const first = panel?.querySelector(focusableSelector);
      if (first) first.focus();
    } else {
      // restore focus
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      else openBtn.focus();
    }
  };

  // Open / Close handlers
  openBtn.addEventListener("click", () => setOpen(true));
  closeBtns.forEach((btn) => btn.addEventListener("click", () => setOpen(false)));

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) setOpen(false);
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

  // Close drawer when clicking any internal anchor (optional safety)
  drawer.querySelectorAll(".sh-drawer__nav a, .sh-drawer__cta a[data-menu-close]").forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });
})();
