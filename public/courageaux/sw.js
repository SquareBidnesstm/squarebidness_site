// /courageaux/sw.js
const CACHE_NAME = 'courageaux-v1';

const ASSETS = [
  '/courageaux/',
  '/courageaux/index.html',
  '/courageaux/manifest.webmanifest',
  '/courageaux/assets/icon-192.png',
  '/courageaux/assets/icon-512.png',
  '/courageaux/assets/icon-512-maskable.png',
  '/courageaux/assets/icon_180.png',
  '/courageaux/assets/amari_800.jpg',
  '/courageaux/assets/amari_1200.jpg',
  '/courageaux/assets/tee_soft-cream_400.jpg',
  '/courageaux/assets/favicon-32.png',
  '/courageaux/assets/favicon-16.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          // clone & store in cache for next time
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => {
          // If offline and asking for HTML, fall back to main page
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/courageaux/index.html');
          }
        });
    })
  );
});
