// public/scripts/sw-register.js
(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      // IMPORTANT: service-worker.js must live at /public/service-worker.js in repo,
      // and will be served as /service-worker.js in production.
      const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      console.log('[SW] registered with scope:', reg.scope);
    } catch (err) {
      console.warn('[SW] registration failed:', err);
    }
  });
})();
