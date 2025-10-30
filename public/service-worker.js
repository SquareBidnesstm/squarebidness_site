// =======================
//  Square Bidness Service Worker
//  Caches pages, assets, and images for offline use.
// =======================

const CACHE_NAME = "squarebidness-cache-v1";
const ASSETS = [
  "/", 
  "/index.html",
  "/styles/style.css",
  "/scripts/global.js",
  "/site.webmanifest",
  "/assets/cleantextlogo.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/maskable-192.png",
  "/assets/icons/maskable-512.png",
  // Add key pages
  "/vsop/",
  "/liberty/",
  "/phomatic/",
  "/blog/",
  "/shop/",
  "/returns/",
  "/shipping/",
];

// Install: pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: respond with cache first, then network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Ignore non-GET requests
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Cache new pages dynamically
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => cached || caches.match("/index.html"));
      return cached || networkFetch;
    })
  );
});
