/* ============================================================
   Square Bidness — Global Nav & Footer Injection
   ------------------------------------------------------------
   Loads /public/nav/index.html and /public/footer/index.html
   Adds graceful offline fallback (logo + © line)
   Highlights current nav link automatically.
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // --- NAV ---
  fetch("/public/nav/index.html", { cache: "no-store" })
    .then(r => (r.ok ? r.text() : ""))
    .then(html => {
      const nav = document.getElementById("nav-placeholder");
      if (nav && html) {
        nav.innerHTML = html;
      } else if (nav) {
        // Offline fallback
        nav.innerHTML = `
          <nav class="nav-fallback" style="text-align:center;padding:1rem 0;background:#000;border-bottom:1px solid #222;">
            <a href="/" style="display:inline-block;text-decoration:none;color:#fff;font-weight:800;font-size:1.1rem;">
              <img src="/assets/cleantextlogo.png" alt="Square Bidness Logo" 
                   style="width:120px;height:auto;vertical-align:middle;opacity:.9;" 
                   loading="lazy" decoding="async" />
            </a>
          </nav>`;
      }

      // Highlight active link if nav loaded
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
    .catch(err => {
      console.warn("⚠️ NAV load failed:", err);
      const nav = document.getElementById("nav-placeholder");
      if (nav) {
        nav.innerHTML = `
          <nav class="nav-fallback" style="text-align:center;padding:1rem 0;background:#000;border-bottom:1px solid #222;">
            <a href="/" style="display:inline-block;text-decoration:none;color:#fff;font-weight:800;font-size:1.1rem;">
              <img src="/assets/cleantextlogo.png" alt="Square Bidness Logo"
                   style="width:120px;height:auto;vertical-align:middle;opacity:.9;"
                   loading="lazy" decoding="async" />
            </a>
          </nav>`;
      }
    });

  // --- FOOTER ---
  fetch("/public/footer/index.html", { cache: "no-store" })
    .then(r => (r.ok ? r.text() : ""))
    .then(html => {
      const foot = document.getElementById("footer-placeholder");
      if (foot && html) {
        foot.innerHTML = html;
      } else if (foot) {
        // Offline fallback footer
        const year = new Date().getFullYear();
        foot.innerHTML = `
          <footer class="footer-fallback" style="text-align:center;padding:2rem 1rem;background:#000;border-top:1px solid #222;">
            <p style="margin:0;color:#999;font-size:.8rem;">
              &copy; ${year} Square Bidness Apparel, LLC · All Rights Reserved
            </p>
            <p style="margin:.3rem 0 0;color:#777;font-size:.75rem;opacity:.8;">
              Built by Square Bidness Tech Lab
            </p>
          </footer>`;
      }
    })
    .catch(err => {
      console.warn("⚠️ FOOTER load failed:", err);
      const foot = document.getElementById("footer-placeholder");
      if (foot) {
        const year = new Date().getFullYear();
        foot.innerHTML = `
          <footer class="footer-fallback" style="text-align:center;padding:2rem 1rem;background:#000;border-top:1px solid #222;">
            <p style="margin:0;color:#999;font-size:.8rem;">
              &copy; ${year} Square Bidness Apparel, LLC · All Rights Reserved
            </p>
            <p style="margin:.3rem 0 0;color:#777;font-size:.75rem;opacity:.8;">
              Built by Square Bidness Tech Lab
            </p>
          </footer>`;
      }
    });
});
