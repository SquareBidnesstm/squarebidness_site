// /puffs/sw.js — cache-first for static, network-first for pages
const CACHE = 'puffs-v3';

const ASSETS = [
  '/puffs/',
  '/puffs/index.html',
  '/puffs/manifest.webmanifest',
  '/puffs/menu.json',

  // ✅ hero background sizes that actually exist
  '/puffs/assets/menu_hero_420.jpg',
  '/puffs/assets/menu_hero_640.jpg',
  '/puffs/assets/menu_hero_780.jpg',

  // ✅ social meta image
  '/puffs/assets/puffs_hero_1200x630.jpg',

  // ✅ on-page logo hero
  '/puffs/assets/puffs_512.png',
  '/puffs/assets/puffs_512.webp',

  // ✅ smaller icons (optional but fine)
  '/puffs/assets/puffs_140.png',
  '/puffs/assets/puffs_140.webp',

  // ✅ PWA icons
  '/puffs/icons/icon-180.png',
  '/puffs/icons/icon-192.png',
  '/puffs/icons/icon-512.png',
  '/puffs/icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (!url.pathname.startsWith('/puffs/')) return;

  // HTML: network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static: cache-first
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return r;
      })
    )
  );
});
