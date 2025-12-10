/* ============================================
   Square Bidness — Service Worker (sb-v2)
   - Precache a few core assets
   - Network-first for HTML pages
   - Cache-first for other GET requests
============================================ */

const CACHE_NAME = 'sb-v2';

// Only list URLs that are guaranteed to exist
const PRECACHE_URLS = [
  '/',                             // home
  '/styles/style.css',             // main CSS
  '/nav/index.html',               // nav partial
  '/footer/index.html',            // footer partial

  // Key Courageaux assets
  '/courageaux/',
  '/courageaux/her-words.html',
  '/courageaux/assets/courageaux_1200x630.jpg',
  '/courageaux/assets/amari_hero_1200x630.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of PRECACHE_URLS) {
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
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/**
 * Strategy:
 * - For HTML (navigation): network-first, cache fallback.
 * - For everything else (images, CSS, JS): cache-first, network fallback.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const accept = request.headers.get('accept') || '';
  const isHTML =
    request.mode === 'navigate' || accept.includes('text/html');

  // HTML pages → network-first
  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh page
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          // If offline, fall back to whatever we have
          caches.match(request)
        )
    );
    return;
  }

  // Assets → cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(request, copy)
          );
        }
        return response;
      });
    })
  );
});
