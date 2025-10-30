/* =====================================================
   Square Bidness — PWA Service Worker (Auto Prefetch)
   -----------------------------------------------------
   - Precache core shell
   - Auto-cache new collection folders dynamically
   - Offline fallback (offline.html)
===================================================== */

const CACHE_NAME = "squarebidness-v7";
const CORE_ASSETS = [
  "/", 
  "/index.html",
  "/offline.html",
  "/styles/style.css",
  "/public/nav/index.html",
  "/public/footer/index.html",
  "/styles/phomatic.css",
  "/styles/liberty.css",
  "/assets/vsop-jacket.jpg",
  "/assets/vsop-shorts.jpg",
  "/phomatic/",
  "/liberty/"
];

// --------------------------------------
// INSTALL: Precache the core app shell
// --------------------------------------
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// --------------------------------------
// ACTIVATE: Clean older cache versions
// --------------------------------------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
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

  // HTML pages — network first, fallback to cache, then offline.html
  if (request.headers.get("accept")?.includes("text/html")) {
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

  // IMAGE / ASSET caching — auto-prefetch new folders like /heritage/, /galleria/
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

  // Default cache-first for other requests
  e.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
          .catch(() => caches.match("/offline.html"))
      );
    })
  );
});

// --------------------------------------
// MESSAGE: Skip waiting when prompted
// --------------------------------------
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
