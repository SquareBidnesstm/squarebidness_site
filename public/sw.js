/* =====================================================
   Square Bidness — Service Worker
   PWA Cache for Pho-Matic + Core Pages
   -----------------------------------------------------
   Caches CSS, images, nav/footer, and page shells.
   Auto-updates when version changes.
===================================================== */

const CACHE_NAME = "squarebidness-v3";
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
   ACTIVATE — Clean old caches
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
   FETCH — Serve cache first
------------------------------ */
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          // Cache fresh copy
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});

/* ------------------------------
   MESSAGE — Manual skipWaiting
------------------------------ */
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
