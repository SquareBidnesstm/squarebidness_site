/* Square Bidness — resilient service worker */
const CACHE = 'sb-v1';

/**
 * Only list files that are guaranteed to exist.
 * You can add more later (after they 200 OK in production).
 */
const PRECACHE = [
  '/',                     // home
  '/courageaux/',          // spotlight page
  '/courageaux/assets/courageaux_1200x630.jpg',
  '/courageaux/assets/favicon-32.png',
  '/courageaux/assets/favicon-16.png',
  '/courageaux/assets/favicon.ico',
  '/courageaux/assets/icon_180.png'
  // Add back when uploaded:
  // '/courageaux/assets/courageaux_800.jpg',
  // '/courageaux/assets/courageaux_1200.jpg',
  // '/courageaux/assets/logo_courageaux_white.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of PRECACHE) {
        try {
          await cache.add(url);
        } catch (err) {
          // Skip missing/bad assets; don't break install
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

/**
 * Cache-first for precached assets, network fallback for the rest.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Optionally cache GET requests on the fly
        if (request.method === 'GET' && response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached); // if offline and not cached, returns undefined (normal)
    })
  );
});
