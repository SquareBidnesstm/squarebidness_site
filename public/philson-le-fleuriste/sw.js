const CACHE_NAME = "philson-pwa-v1";
const URLS_TO_CACHE = [
  "/philson-le-fleuriste/",
  "/philson-le-fleuriste/funeral-floral-tributes/",
  "/philson-le-fleuriste/tributes/",
  "/philson-le-fleuriste/assets/favicon_ico/android-chrome-192x192.png",
  "/philson-le-fleuriste/assets/favicon_ico/android-chrome-512x512.png",
  "/philson-le-fleuriste/assets/favicon_ico/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return response;
        })
        .catch(() => caches.match("/philson-le-fleuriste/"));
    })
  );
});
