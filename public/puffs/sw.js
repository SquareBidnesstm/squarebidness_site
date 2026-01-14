// /puffs/sw.js
const CACHE = "puffs-v6";

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

async function safePut(request, response) {
  try {
    if (!response || !response.ok) return;
    if (response.type !== "basic") return;
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch (_) {}
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
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

  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/puffs/")) return;
  if (req.method !== "GET") return;

  // HTML: network-first
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        // keep offline shell updated
        e.waitUntil(safePut(new Request("/puffs/index.html"), res.clone()));
        return res;
      } catch (_) {
        return (await caches.match("/puffs/index.html")) || (await caches.match("/puffs/"));
      }
    })());
    return;
  }

  // menu.json: network-first
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

  // assets: cache-first
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
