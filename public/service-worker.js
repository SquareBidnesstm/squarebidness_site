/* Square Bidness — site SW (network-first for pages + partial HTML) */
const CACHE = 'sb-site-v20251215-gm01';
const ASSET_CACHE = 'sb-assets-v20251215-gm01';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => {
      return cache.addAll([
        // Keep precache small to avoid “stuck” styles.
        '/scripts/ga.js',
        '/scripts/sw-register.js',
        '/offline/'
      ]);
    }).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k.startsWith('sb-') && k !== CACHE && k !== ASSET_CACHE) {
        return caches.delete(k);
      }
    }));
    await self.clients.claim();
  })());
});

const isGET = (req) => req.method === 'GET';

function isHTMLLikeRequest(req) {
  if (req.mode === 'navigate') return true;

  try {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p.startsWith('/nav/') || p.startsWith('/footer/') || p.startsWith('/partials/')) return true;
    if (p.endsWith('.html')) return true;

    const accept = (req.headers.get('accept') || '');
    if (accept.includes('text/html')) return true;
  } catch {}

  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isGET(req)) return;

  // HTML / partial HTML: NETWORK FIRST
  if (isHTMLLikeRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });

        // only cache good responses
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }

        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || caches.match('/offline/') || Response.error();
      }
    })());
    return;
  }

  // Always fetch latest for core JS so we never get stuck
  try {
    const url = new URL(req.url);
    if (
      url.pathname === "/scripts/global.js" ||
      url.pathname === "/scripts/sb-cart.js" ||
      url.pathname === "/scripts/ga.js"
    ) {
      event.respondWith((async () => {
        try { return await fetch(req, { cache: "no-store" }); }
        catch { return (await caches.match(req)) || Response.error(); }
      })());
      return;
    }
  } catch {}

  // Assets: CACHE FIRST
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(ASSET_CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
