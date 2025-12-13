/* Square Bidness — site SW (network-first for pages + partial HTML) */
const CACHE = 'sb-site-v20251212b';
const ASSET_CACHE = 'sb-assets-v20251212b';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => {
      // Keep precache SMALL and guaranteed
      return cache.addAll([
        '/styles/style.css',
        '/scripts/ga.js',
        '/scripts/loader.js,
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
const isGET = (req) => req.method === 'GET';

function isHTMLLikeRequest(req) {
  // 1) normal page navigations
  if (req.mode === 'navigate') return true;

  // 2) partial HTML fetched via JS (nav/footer/partials)
  try {
    const url = new URL(req.url);
    const p = url.pathname;

    // treat these as HTML (network-first) so nav/footer never go stale
    if (p.startsWith('/nav/') || p.startsWith('/footer/') || p.startsWith('/partials/')) return true;
    if (p.endsWith('.html')) return true;

    // sometimes accepts header includes html
    const accept = (req.headers.get('accept') || '');
    if (accept.includes('text/html')) return true;
  } catch {}

  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (!isGET(req)) return;

  // 1) HTML + partial HTML => NETWORK FIRST (prevents stale pages + stale nav/footer)
  if (isHTMLLikeRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
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
