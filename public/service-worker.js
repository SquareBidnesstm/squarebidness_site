// /service-worker.js
/* Square Bidness — resilient service worker */
const CACHE = 'sb-v1';

const PRECACHE = [
  '/',                    // home
  '/courageaux/',         // Courageaux spotlight
  '/courageaux/assets/courageaux_1200x630.jpg'
  // You can add more later after confirming they 200 OK in production
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of PRECACHE) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] precache skip:', url, err && err.message);
        }
      }
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache-first for precached assets, network-first for others
self.addEventListener('fetch', (event) => {
  const { request } = event;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (request.method === 'GET' && response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
