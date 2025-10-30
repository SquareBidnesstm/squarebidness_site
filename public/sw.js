/* =====================================================
   Square Bidness — PWA Service Worker (Dynamic Edition)
   -----------------------------------------------------
   Static pre-cache + dynamic runtime caching
   for Pho-Matic, VSOP, nav/footer, and global CSS.
===================================================== */

const CACHE_NAME = "squarebidness-v4";
const CORE_ASSETS = [
  "/", 
  "/index.html",
  "/styles/style.css",
  "/styles/phomatic.min.css",
  "/public/nav/index.html",
  "/public/footer/index.html",
  "/phomatic/",
  "/phomatic/assets/hero-1200x630.jpg",
  "/phomatic/assets/gieno-1_800.jpg",
  "/phomatic/assets/gieno-1_1200.jpg",
  "/phomatic/assets/gieno-2_800.jpg",
  "/phomatic/assets/gieno-2_1200.jpg",
  "/assets/vsop-jacket.jpg",
  "/assets/vsop-shorts.jpg"
];

/* ------------------------------
   INSTALL — Precache core assets
------------------------------ */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/* ------------------------------
   ACTIVATE — Remove old caches
------------------------------ */
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

/* ------------------------------
   FETCH — Hybrid cache strategy
------------------------------ */
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Strategy: Cache First for core assets, Network First for pages
  if (CORE_ASSETS.some((asset) => url.pathname.startsWith(asset))) {
    e.respondWith(cacheFirst(request));
  } else if (
    url.pathname.startsWith("/phomatic/") ||
    url.pathname.startsWith("/assets/")
  ) {
    e.respondWith(dynamicCache(request));
  } else {
    e.respondWith(networkFirst(request));
  }
});

/* ------------------------------
   STRATEGIES
------------------------------ */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request) || caches.match("/index.html");
  }
}

/* ------------------------------
   DYNAMIC CACHE — Images & Assets
------------------------------ */
async function dynamicCache(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // fallback: placeholder or offline shell
    return caches.match("/index.html");
  }
}

/* ------------------------------
   MESSAGE — Manual skipWaiting
------------------------------ */
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
