// sw.js — temporary self-destruct to clear bad caches and unregister

self.addEventListener('install', event => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // 1) Wipe all caches this SW knows about
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));

      // 2) Unregister this service worker
      await self.registration.unregister();

      // 3) Ask all open tabs to reload without a SW on next nav
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      for (const client of clients) {
        // This will re-load the same URL but **without** a SW after unregister
        client.navigate(client.url);
      }
    })()
  );
});

// No fetch handler at all → browser handles everything normally
