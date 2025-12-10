// /service-worker.js
// Square Bidness — resilient service worker (safe + quiet)

const CACHE = 'sb-v1';

/**
 * Only list files that are guaranteed to exist.
 * You can add more later (after you confirm they 200 OK in production).
 */
const PRECACHE = [
  '/',                               // home
  '/assets/sb-social-card_1200.jpg', // main social card
  '/assets/cleantextlogo.png'        // logo
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of PRECACHE) {
        try {
          await cache.add(url);
        } catch (err) {
          // Stay quiet on missing assets so console doesn't get noisy
          // console.warn('[SW] precache skip:', url, err && err.message);
        }
      }
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Cache-first for precached assets, network fallback for the rest.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Optionally cache successful GETs on the fly
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // If offline and not cached, just let it fail normally
          return cached || Promise.reject('offline');
        });
    })
  );
});
