// /puffs/sw.js — cache-first for static, network-first for page
const CACHE = 'puffs-v1';
const ASSETS = [
  '/puffs/',
  '/puffs/index.html',
  '/puffs/manifest.webmanifest',
  '/puffs/assets/menu_hero.jpg',
  '/puffs/assets/menu_1200x630.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=> self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(()=> self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle our scope
  if (!url.pathname.startsWith('/puffs/')) return;

  // HTML: network-first, fallback to cache
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Others: cache-first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return r;
    }))
  );
});
