// /puffs/sw.js — static cache-first, HTML network-first (indexing-safe)
const CACHE = "puffs-v5";

// IMPORTANT: include the entry HTML so navigation fallback works
const ASSETS = [
  "/puffs/",                 // ✅ allows caches.match("/puffs/") to work
  "/puffs/index.html",       // ✅ also safe if your host serves it
  "/puffs/manifest.webmanifest",
  "/puffs/menu.json",

  "/puffs/assets/puffs_hero_1200x630.jpg",
  "/puffs/assets/puffs_512.png",
  "/puffs/assets/puffs_512.webp",
  "/puffs/assets/puffs_140.png",
  "/puffs/assets/puffs_140.webp",

  "/puffs/icons/icon-180.png",
  "/puffs/icons/icon-192.png",
  "/puffs/icons/icon-512.png",
  "/puffs/icons/maskable-512.png"
];

// Safe cache write helper (prevents Promise.then spam)
async function safePut(request, response) {
  try {
    // Only cache successful basic responses
    if (!response || !response.ok) return;
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch (err) {
    // swallow cache errors (quota, opaque, etc.)
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // don’t brick install if one asset 404s
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle same-origin /puffs/
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/puffs/")) return;

  // Only handle GET (prevents caching POST / weird requests)
  if (req.method !== "GET") return;

  // HTML/doc: network-first (best for SEO + freshness)
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        // Optionally update cached shell for offline:
        e.waitUntil(safePut("/puffs/", res.clone()));
        return res;
      } catch (err) {
        // ✅ real fallback
        return (await caches.match("/puffs/")) || (await caches.match("/puffs/index.html"));
      }
    })());
    return;
  }

  // menu.json: network-first (keep menu fresh), fallback cache
  if (url.pathname === "/puffs/menu.json") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        e.waitUntil(safePut(req, res.clone()));
        return res;
      } catch (err) {
        return await caches.match(req);
      }
    })());
    return;
  }

  // Everything else under /puffs/: cache-first with network fallback + safe cache update
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;

    try {
      const res = await fetch(req);
      e.waitUntil(safePut(req, res.clone()));
      return res;
    } catch (err) {
      // last resort: return a cached shell if they’re offline
      return (await caches.match("/puffs/")) || (await caches.match("/puffs/index.html"));
    }
  })());
});
