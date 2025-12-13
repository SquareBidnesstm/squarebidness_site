// /public/scripts/sw-register.js
(async () => {
  if (!('serviceWorker' in navigator)) return;

  // One-time purge controlled by a flag
  const KEY = 'sb_sw_purged_v20251212b';
  const SHOULD_PURGE = false; // set true for one deploy, then set false forever

  try {
    if (SHOULD_PURGE && !sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, '1');

      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));

      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      console.log('[SW] purged registrations + caches (one-time), reloading…');
      location.reload();
      return;
    }
  } catch (e) {
    console.warn('[SW] purge failed', e);
  }

  // normal register
  try {
    const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    console.log('[SW] registered with scope:', reg.scope);
  } catch (err) {
    console.warn('[SW] registration failed:', err);
  }
})();
