// service-worker.js — temporary self-destruct for Square Bidness

self.addEventListener('install', event => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // 1) Clear ALL caches
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));

      // 2) Unregister this service worker
      await self.registration.unregister();

      // 3) Ask all controlled clients (tabs) to reload once
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      for (const client of clients) {
        // Reload same URL; after unregister, it will be SW-free
        client.navigate(client.url);
      }
    })()
  );
});

// No fetch handler → browser handles all network normally
