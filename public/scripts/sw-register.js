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

  // Use build stamp to help update SW file fetch
  const BUILD =
    (window.SB_BUILD ||
      document.querySelector('meta[name="sb:build"]')?.content ||
      "v1");

  try {
    const reg = await navigator.serviceWorker.register(`/service-worker.js?v=${encodeURIComponent(BUILD)}`, {
      scope: "/",
    });
    console.log("[SW] registered with scope:", reg.scope);
  } catch (err) {
    console.warn("[SW] registration failed:", err);
  }
})();
