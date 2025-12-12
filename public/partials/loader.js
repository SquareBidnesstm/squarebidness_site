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
        return false;
      }

      const html = await res.text();
      const el = document.getElementById(targetId);

      if (!el) {
        console.warn('[partials] missing target:', targetId);
        return false;
      }

      el.innerHTML = html;
      el.classList.add('fade-in');
      return true;
    } catch (err) {
      console.warn('[partials] fetch fail:', url, err);
      return false;
    }
  }

  const navOk = await injectPartial('/nav/index.html', 'site-header');
  const footOk = await injectPartial('/footer/index.html', 'site-footer');

  // Tell global.js “partials are here now”
  if (navOk || footOk) {
    window.dispatchEvent(new Event('sb:partials_loaded'));
  }
})();
