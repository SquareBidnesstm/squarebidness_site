/* =====================================================
   Square Bidness — PWA Service Worker (Safe Precache)
   -----------------------------------------------------
   - Precache core shell (skip any 404s safely)
   - Runtime cache for assets & collections
   - Offline fallback (offline.html)
===================================================== */

const CACHE_NAME = "squarebidness-v8"; // bump when you change lists
const CORE_ASSETS = [
  "/", 
  "/index.html",
  "/offline.html",
  "/styles/style.css",
  "/styles/phomatic.css",
  "/styles/liberty.css",
  "/assets/vsop-jacket.jpg",
  "/assets/vsop-shorts.jpg",
  // NOTE: on Vercel, files in /public are served from "/" (no /public prefix)
  "/nav/index.html",
  "/footer/index.html"
];

// --------------------------------------
// INSTALL: Precache the core app shell (skip failures)
// --------------------------------------
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try {
          const resp = await fetch(url, { cache: "no-cache" });
          if (resp && resp.ok) {
            await cache.put(url, resp.clone());
          } else {
            console.warn("[SW] skip (non-200):", url, resp && resp.status);
          }
        } catch (err) {
          console.warn("[SW] skip (fetch fail):", url, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// --------------------------------------
// ACTIVATE: Clean older cache versions
// --------------------------------------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// --------------------------------------
// FETCH: Smart caching strategy
// --------------------------------------
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const acceptsHTML = request.headers.get("accept")?.includes("text/html");

  // HTML pages — network first, fallback to cache, then offline.html
  if (acceptsHTML) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match("/offline.html"))
        )
    );
    return;
  }

  // Assets & collection folders — cache-first, fill on miss
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/phomatic/") ||
    url.pathname.startsWith("/liberty/") ||
    url.pathname.match(/^\/[a-z0-9_-]+\/assets\//)
  ) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
          .catch(() => caches.match("/offline.html"));
      })
    );
    return;
  }

  // Default: cache-first with network fallback
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match("/offline.html"));
    })
  );
});

// --------------------------------------
// MESSAGE: Skip waiting on demand
// --------------------------------------
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
