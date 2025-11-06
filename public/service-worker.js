/* Square Bidness — Safe Service Worker
   - Minimal precache (no addAll)
   - Network-first for HTML
   - Cache-first for /start2finish/*/assets and /taxslayer/*/assets
   - Cleans old caches
   Bump VERSION when you change logic.
*/
const VERSION = 'sb-v1.0.0';
const CACHE_NAME = `squarebidness-${VERSION}`;

// Keep this list tiny and ONLY include URLs that exist now.
const PRECACHE = [
  '/',                 // root (ok if you have a homepage; skip if 404)
  '/start2finish/',    // folder index
  '/taxslayer/'        // folder index
];

// Helper: same-origin GET requests only
function isCacheableRequest(req) {
  if (req.method !== 'GET') return false;
  const url = new URL(req.url);
  return url.origin === self.location.origin;
}

// INSTALL — precache (skip any failures safely)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of PRECACHE) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res && res.ok) await cache.put(url, res.clone());
        else console.warn('[SW] skip (non-200):', url, res && res.status);
      } catch (err) {
        console.warn('[SW] skip (fetch fail):', url, err);
      }
    }
    self.skipWaiting();
  })());
});

// ACTIVATE — clear old versions
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

// FETCH — smart strategy by type/path
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isCacheableRequest(req)) return;

  const url = new URL(req.url);
  const acceptsHTML = req.headers.get('accept')?.includes('text/html');

  // 1) HTML pages: network-first, fallback to cache
  if (acceptsHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2) Collection assets: cache-first (works offline)
  const isCollectionAsset =
    /^\/start2finish\/assets\//.test(url.pathname) ||
    /^\/taxslayer\/assets\//.test(url.pathname);

  if (isCollectionAsset) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            return res;
          });
      })
    );
    return;
  }

  // 3) Everything else: stale-while-revalidate-ish
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetchPromise = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit || Promise.reject('offline'));
      return hit || fetchPromise;
    })
  );
});

// Optional: allow immediate activation on message
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
