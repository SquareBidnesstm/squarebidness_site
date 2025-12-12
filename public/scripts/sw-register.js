// public/scripts/sw-register.js
(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      console.log('[SW] registered with scope:', reg.scope);

      // If a new SW takes control, refresh once to show latest site
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

      // Encourage update checks when page opens
      if (reg && reg.update) reg.update().catch(() => {});
    } catch (err) {
      console.warn('[SW] registration failed:', err);
    }
  });
})();
