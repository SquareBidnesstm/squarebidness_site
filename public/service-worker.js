/* Square Bidness — site SW (network-first for pages) */
const CACHE = 'sb-site-v20251212a';
const ASSET_CACHE = 'sb-assets-v20251212a';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => {
      // Keep precache SMALL and guaranteed
      return cache.addAll([
        '/styles/style.css',
        '/scripts/ga.js',
        '/scripts/sb-cart.js',
        '/scripts/global.js',
        '/scripts/sw-register.js'
      ]);
    }).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // wipe old caches
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== CACHE && k !== ASSET_CACHE) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

// Helpers
const isHTML = (req) => req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
const isGET = (req) => req.method === 'GET';

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (!isGET(req)) return;

  // 1) NAVIGATION / HTML => NETWORK FIRST (prevents stale pages)
  if (isHTML(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        // optional: cache the page response lightly
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || caches.match('/') || Response.error();
      }
    })());
    return;
  }

  // 2) ASSETS => CACHE FIRST, UPDATE IN BACKGROUND
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(ASSET_CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
