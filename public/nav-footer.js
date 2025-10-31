/* ============================================================
   Square Bidness — Global Nav & Footer Injection
   ------------------------------------------------------------
   Loads /public/nav/index.html and /public/footer/index.html
   Highlights current page link automatically.
   Safe for offline mode (fails gracefully).
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // --- NAV ---
  fetch("/public/nav/index.html", { cache: "no-store" })
    .then(r => (r.ok ? r.text() : ""))
    .then(html => {
      const nav = document.getElementById("nav-placeholder");
      if (nav) nav.innerHTML = html;

      // Highlight active page link
      const path = location.pathname.replace(/\/$/, "");
      const links = document.querySelectorAll(".main-nav a");
      links.forEach(a => {
        const href = a.getAttribute("href")?.replace(/\/$/, "");
        if (href && path === href) {
          a.classList.add("active");
          a.setAttribute("aria-current", "page");
        }
      });
    })
    .catch(err => console.warn("⚠️ NAV load failed:", err));

  // --- FOOTER ---
  fetch("/public/footer/index.html", { cache: "no-store" })
    .then(r => (r.ok ? r.text() : ""))
    .then(html => {
      const foot = document.getElementById("footer-placeholder");
      if (foot) foot.innerHTML = html;
    })
    .catch(err => console.warn("⚠️ FOOTER load failed:", err));
});
