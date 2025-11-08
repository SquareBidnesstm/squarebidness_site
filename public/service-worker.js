/* Square Bidness SW (v1) */
const CACHE = "sb-v1";
const CORE = ["/", "/offline.html"];

// Install: cache core files (skip failures)
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const url of CORE) {
      try {
        const r = await fetch(url, { cache: "no-cache" });
        if (r.ok) await c.put(url, r.clone());
      } catch {}
    }
  })());
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))))
  ));
  self.clients.claim();
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const wantsHTML = req.headers.get("accept")?.includes("text/html");
  if (wantsHTML) {
    e.respondWith(
      fetch(req).then(r => {
        caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match("/offline.html")))
    );
    return;
  }

  // assets (incl. /assets/, /scripts/, any /<section>/assets/)
  const p = new URL(req.url).pathname;
  const isAsset = p.startsWith("/assets/") || p.startsWith("/scripts/") || /^\/[a-z0-9_-]+\/assets\//i.test(p);

  if (isAsset) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(r => {
        caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => caches.match("/offline.html")))
    );
    return;
  }

  // default: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(r => { caches.open(CACHE).then(c => c.put(req, r.clone())); return r; })
        .catch(() => cached || caches.match("/offline.html"));
      return cached || net;
    })
  );
});
