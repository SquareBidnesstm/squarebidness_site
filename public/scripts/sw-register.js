// /public/scripts/sw-register.js
(async () => {
  if (!("serviceWorker" in navigator)) return;

  // ✅ Set TRUE once if you need to kill old SW + caches, then set back FALSE.
  const PURGE = true;

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

  const BUILD =
    (window.SB_BUILD ||
      document.querySelector('meta[name="sb:build"]')?.content ||
      "v20260117c");

  try {
    const reg = await navigator.serviceWorker.register(
      `/service-worker.js?v=${encodeURIComponent(BUILD)}`,
      { scope: "/" }
    );

    // If there is a waiting SW, activate it now
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

    console.log("[SW] registered with scope:", reg.scope);
  } catch (err) {
    console.warn("[SW] registration failed:", err);
  }
})();
