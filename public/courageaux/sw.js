// /courageaux/sw.js
// Courageaux Aesthetics — PWA / Offline Shell
// v2.1 — resilient precache + safer offline behavior

const CACHE_NAME = 'courageaux-v2.1';

const ASSETS = [
  // Core shell
  '/courageaux/',
  '/courageaux/index.html',

  // Her Words page
  '/courageaux/her-words/',
  '/courageaux/her-words/index.html',

  // PWA / icons
  '/courageaux/manifest.webmanifest',
  '/courageaux/assets/icon-192.png',
  '/courageaux/assets/icon-512.png',
  '/courageaux/assets/icon-512-maskable.png',
  '/courageaux/assets/icon_180.png',

  // Hero + art
  '/courageaux/assets/amari_800.jpg',
  '/courageaux/assets/amari_1200.jpg',
  '/courageaux/assets/amari_hero_1200x630.jpg',
  '/courageaux/assets/tee_soft-cream_400.jpg',

  // Favicons
  '/courageaux/assets/favicon-32.png',
  '/courageaux/assets/favicon-16.png',
  '/courageaux/assets/favicon.ico'
];

// INSTALL — precache core assets (resilient: one missing file won't fail install)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Add assets one-by-one so a single 404 doesn't kill the whole install.
    await Promise.allSettled(
      ASSETS.map(async (path) => {
        try {
          await cache.add(path);
        } catch (_) {
          // silent fail: asset missing or blocked; SW still installs
        }
      })
    );

    await self.skipWaiting();
  })());
});

// ACTIVATE — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
    await self.clients.claim();
  })());
});

// FETCH — cache-first with network fallback, HTML gets graceful fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET + same-origin
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);

      // Cache good basic responses
      if (res && res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone()).catch(() => {});
      }

      return res;
    } catch (_) {
      // Offline fallback for navigations / HTML
      const accept = req.headers.get('accept') || '';
      if (accept.includes('text/html')) {
        return (await caches.match('/courageaux/index.html')) || Response.error();
      }

      // Non-HTML: return a real error response instead of undefined
      return Response.error();
    }
  })());
});
