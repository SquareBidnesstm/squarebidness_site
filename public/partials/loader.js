(async () => {
  try {
    // Ensure placeholders exist (safe if you forgot)
    if (!document.getElementById('site-header')) {
      const h = document.createElement('div'); h.id = 'site-header';
      document.body.prepend(h);
    }
    if (!document.getElementById('site-footer')) {
      const f = document.createElement('div'); f.id = 'site-footer';
      document.body.appendChild(f);
    }

    // Optional: inject shared HEAD defaults if not already injected
    // Comment out if you prefer to keep it manual.
    if (!document.documentElement.dataset.sbHeadInjected) {
      try {
        const headHTML = await fetch('/partials/head.html', { cache: 'no-cache' }).then(r => r.text());
        document.head.insertAdjacentHTML('afterbegin', headHTML);
        document.documentElement.dataset.sbHeadInjected = '1';
      } catch (e) { console.warn('head include failed', e); }
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
