// ==============================
// Square Bidness partial loader
// ==============================
(async () => {
  try {
    // Ensure placeholders exist
    if (!document.getElementById('site-header')) {
      const h = document.createElement('div');
      h.id = 'site-header';
      document.body.prepend(h);
    }
    if (!document.getElementById('site-footer')) {
      const f = document.createElement('div');
      f.id = 'site-footer';
      document.body.appendChild(f);
    }

    // Inject shared HEAD defaults once
    if (!document.documentElement.dataset.sbHeadInjected) {
      try {
        const headHTML = await fetch('/partials/head.html', { cache: 'no-cache' }).then(r => r.text());
        document.head.insertAdjacentHTML('afterbegin', headHTML);
        document.documentElement.dataset.sbHeadInjected = '1';
      } catch (e) {
        console.warn('head include failed', e);
      }
    }

    // Inject header/footer
    const [headerHTML, footerHTML] = await Promise.all([
      fetch('/partials/header.html', { cache: 'no-cache' }).then(r => r.text()),
      fetch('/partials/footer.html', { cache: 'no-cache' }).then(r => r.text())
    ]);

    const headerEl = document.getElementById('site-header');
    const footerEl = document.getElementById('site-footer');

    if (headerEl) headerEl.outerHTML = headerHTML;
    if (footerEl) footerEl.outerHTML = footerHTML;
  } catch (e) {
    console.warn('partials loader failed', e);
  }
})();

// ==============================
// Service worker registration
// ==============================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(err => {
        console.warn('SW registration failed:', err);
      });
  });
}
