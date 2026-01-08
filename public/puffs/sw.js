// /puffs/sw.js — cache-first for static, network-first for pages
const CACHE = 'puffs-v2';

const ASSETS = [
  '/puffs/',
  '/puffs/index.html',
  '/puffs/manifest.webmanifest',
  '/puffs/menu.json',

  // Background + social/meta
  '/puffs/assets/menu_hero.jpg',
  '/puffs/assets/puffs_hero_1200x630.jpg',

  // On-page icon hero (make sure this exists)
  '/puffs/assets/puffs_512.png',

  // Small icon variants (you confirmed these exist)
  '/puffs/assets/puffs_140.png',
  '/puffs/assets/puffs_140.webp',

  // PWA icons (you confirmed these exist)
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

  // Only handle our scope
  if (!url.pathname.startsWith('/puffs/')) return;

  // HTML/doc navigation: network-first (keeps updates fresh), fallback to cache
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req) || caches.match('/puffs/'))
    );
    return;
  }

  // Static: cache-first, then network
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return r;
      });
    })
  );
});
