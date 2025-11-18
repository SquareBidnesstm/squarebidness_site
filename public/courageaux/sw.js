// /courageaux/sw.js
// Courageaux Aesthetics — PWA / Offline Shell
// v2 — includes Her Words page + safer caching

const CACHE_NAME = 'courageaux-v2'; // ⬅️ bumped from v1 → v2

const ASSETS = [
  // Core shell
  '/courageaux/',
  '/courageaux/index.html',

  // Her Words page (so it’s treated as a normal HTML route)
  '/courageaux/her-words/',
  '/courageaux/her-words/index.html',

  // PWA / icons
  '/courageaux/manifest.webmanifest',
  '/courageaux/assets/icon-192.png',
  '/courageaux/assets/icon-512.png',
  '/courageaux/assets/icon-512-maskable.png',
  '/courageaux/assets/icon_180.png',

  // Hero + product art
  '/courageaux/assets/amari_800.jpg',
  '/courageaux/assets/amari_1200.jpg',
  '/courageaux/assets/amari_hero_1200x630.jpg',
  '/courageaux/assets/tee_soft-cream_400.jpg',

  // Favicons
  '/courageaux/assets/favicon-32.png',
  '/courageaux/assets/favicon-16.png',
  '/courageaux/assets/favicon.ico'
];

// INSTALL — precache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH — cache-first with network fallback, HTML gets graceful fallback
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET + same-origin
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      // No cache hit → go to network
      return fetch(request)
        .then(response => {
          // Only cache good, basic responses
          const clone = response.clone();
          if (response.ok && response.type === 'basic') {
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // If offline and asking for HTML, fall back to main Courageaux page
          const accept = request.headers.get('accept') || '';
          if (accept.includes('text/html')) {
            return caches.match('/courageaux/index.html');
          }
          // Otherwise, just fail silently
        });
    })
  );
});
