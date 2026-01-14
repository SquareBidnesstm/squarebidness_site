// /puffs/sw.js — static cache-first, HTML network-first (indexing-safe)
const CACHE = "puffs-v6";

// IMPORTANT: include the entry HTML so navigation fallback works
const ASSETS = [
  "/puffs/",
  "/puffs/index.html",
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
    if (!response || !response.ok) return;
    if (response.type !== "basic") return; // avoid opaque/redirect issues
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch (_) {}
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // don't brick install if one asset 404s
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle same-origin /puffs/
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/puffs/")) return;

  // Only cache GET
  if (req.method !== "GET") return;

  // HTML/doc: network-first (best for SEO + freshness)
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        // ✅ correct usage: pass BOTH args
        e.waitUntil(safePut(new Request("/puffs/index.html"), res.clone()));
        return res;
      } catch (_) {
        return (await caches.match("/puffs/index.html")) || (await caches.match("/puffs/"));
      }
    })());
    return;
  }

  // menu.json: network-first, fallback cache
  if (url.pathname === "/puffs/menu.json") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        e.waitUntil(safePut(req, res.clone()));
        return res;
      } catch (_) {
        return await caches.match(req);
      }
    })());
    return;
  }

  // Everything else under /puffs/: cache-first
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;

    try {
      const res = await fetch(req);
      e.waitUntil(safePut(req, res.clone()));
      return res;
    } catch (_) {
      return (await caches.match("/puffs/index.html")) || (await caches.match("/puffs/"));
    }
  })());
});
