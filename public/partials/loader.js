// public/partials/loader.js
(async () => {
  const bust = `?v=${Date.now()}`;

  async function injectPartial(url, targetId) {
    try {
      const res = await fetch(url + bust, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!res.ok) {
        console.warn('[partials] not ok:', url, res.status);
        return null;
      }
      const html = await res.text();
      const el = document.getElementById(targetId);
      if (!el) {
        console.warn('[partials] missing target:', targetId);
        return null;
      }
      el.innerHTML = html;
      el.classList.add('fade-in');
      return el;
    } catch (err) {
      console.warn('[partials] fetch fail:', url, err);
      return null;
    }
  }

  // NAV — served at /nav/index.html
  await injectPartial('/nav/index.html', 'site-header');

  // FOOTER — served at /footer/index.html
  await injectPartial('/footer/index.html', 'site-footer');
})();
