// /public/scripts/sw-register.js
(async () => {
  if (!("serviceWorker" in navigator)) return;

  // ✅ NORMAL MODE
  const PURGE = false;

  if (PURGE) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      console.log("[SW] purged registrations + caches");
    } catch (e) {
      console.warn("[SW] purge failed", e);
    }
    return;
  }

  // Normal registration
  try {
    const reg = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
    });
    console.log("[SW] registered with scope:", reg.scope);
  } catch (err) {
    console.warn("[SW] registration failed:", err);
  }
})();
