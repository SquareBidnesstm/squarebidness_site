/* =====================================================
   Square Bidness — PWA Service Worker
   -----------------------------------
   Static pre-cache + dynamic runtime caching
   for core shell, Pho-Matic, VSOP, Courageaux,
   collections, nav/footer, and global CSS.
===================================================== */

const CACHE_NAME = "squarebidness-v5";

/**
 * NOTE:
 * Paths here are URL paths as the BROWSER sees them,
 * not repo paths. So no "/public/..." prefix.
 */
const CORE_ASSETS = [
  "/",
  "/index.html",

  // Global styles (adjust if your main CSS lives elsewhere)
  "/styles/style.css",
  "/styles/phomatic.min.css",

  // Shared partials
  "/nav/index.html",
  "/footer/index.html",

  // Pho-Matic lane
  "/phomatic/",
  "/phomatic/assets/hero-1200x630.jpg",
  "/phomatic/assets/gieno-1_800.jpg",
  "/phomatic/assets/gieno-1_1200.jpg",
  "/phomatic/assets/gieno-2_800.jpg",
  "/phomatic/assets/gieno-2_1200.jpg",

  // VSOP hero assets (adjust file names if needed)
  "/assets/vsop-jacket.jpg",
  "/assets/vsop-shorts.jpg",

  // Courageaux main feature
  "/courageaux/",
  "/courageaux/assets/amari_800.jpg",
  "/courageaux/assets/amari_1200.jpg",
  "/courageaux/assets/amari_hero_1200x630.jpg",
  "/courageaux/assets/courageaux_1200x630.jpg",

  // Collections shell
  "/collections/",
  "/collections/vsop/",
  "/collections/wintergames/",
  "/collections/essentials/",
  "/collections/alumni/",
  "/collections/future/",

  // Spotlight hub
  "/spotlight/"
];

/* ------------------------------
   INSTALL — Precache core assets
------------------------------ */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/* ------------------------------
   ACTIVATE — Remove old caches
------------------------------ */
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

/* ------------------------------
   FETCH — Hybrid cache strategy
------------------------------ */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache-first for known core assets
  if (CORE_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Dynamic cache for images / assets
  if (
    url.pathname.startsWith("/phomatic/") ||
    url.pathname.startsWith("/courageaux/") ||
    url.pathname.startsWith("/collections/") ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(dynamicCache(request));
    return;
  }

  // Default: network-first for normal pages
  event.respondWith(networkFirst(request));
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
  } catch (err) {
    // If offline, fallback to cache or home
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("/index.html");
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
    // Only cache basic, successful responses
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Fallback: offline shell
    return caches.match("/index.html");
  }
}

/* ------------------------------
   MESSAGE — Manual skipWaiting
------------------------------ */
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
