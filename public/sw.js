// sw.js – temporary self-destruct

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Wipe all caches
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));

      // Unregister this service worker
      await self.registration.unregister();

      // Take control and force clients to reload without SW on next nav
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach(client => client.navigate(client.url));
    })()
  );
});

// No fetch handler – browser handles everything normally
