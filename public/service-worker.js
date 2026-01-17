/* Square Bidness — site SW (network-first for pages + partial HTML) */

const CACHE = "sb-site-v20251223a";
const ASSET_CACHE = "sb-assets-v20251223a";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(ASSET_CACHE);
        await cache.addAll([
          // Keep precache small & stable
          "/offline/",
          "/styles/style.css",
          "/scripts/ga.js",
          "/scripts/partials.js",
          "/scripts/sb-analytics.js",
          "/scripts/sw-register.js"
        ]);
      } catch (_) {}
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k.startsWith("sb-") && k !== CACHE && k !== ASSET_CACHE) {
            return caches.delete(k);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

const isGET = (req) => req.method === "GET";

function isHTMLLikeRequest(req) {
  if (req.mode === "navigate") return true;

  try {
    const url = new URL(req.url);
    const p = url.pathname;

    // Treat NAV/FOOTER HTML partial endpoints as HTML-like
    if (p.startsWith("/nav/") || p.startsWith("/footer/")) return true;

    // Any explicit html file
    if (p.endsWith(".html")) return true;

    // Accept header based
    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) return true;
  } catch {}

  return false;
}

/* ✅ NEW: never cache media / range requests (fixes 206 + Cache.put errors) */
function isMediaRequest(req) {
  try {
    const url = new URL(req.url);
    const p = url.pathname.toLowerCase();

    // Skip any video/audio extensions
    if (p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov") || p.endsWith(".m4v")) return true;
    if (p.endsWith(".mp3") || p.endsWith(".wav") || p.endsWith(".aac") || p.endsWith(".m4a")) return true;

    // If browser is requesting a byte-range, treat as media-like
    const range = req.headers.get("range");
    if (range) return true;
  } catch {}
  return false;
}

async function networkFirstHTML(req) {
  try {
    const fresh = await fetch(req, { cache: "no-store" });

    // ✅ Only cache full successful responses (avoid 206/range)
    if (fresh && fresh.ok && fresh.status === 200) {
      const cache = await caches.open(CACHE);
      await cache.put(req, fresh.clone());
    }

    return fresh;
  } catch (_) {
    const cached = await caches.match(req);
    return cached || (await caches.match("/offline/")) || Response.error();
  }
}

async function noStoreFirst(req) {
  try {
    return await fetch(req, { cache: "no-store" });
  } catch (_) {
    return (await caches.match(req)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!isGET(req)) return;

  // ✅ Media should bypass SW caching entirely (fixes your hero.mp4 issues)
  if (isMediaRequest(req)) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML + nav/footer partial HTML: NETWORK FIRST
  if (isHTMLLikeRequest(req)) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  // Never-stuck core JS (always try network no-store)
  try {
    const url = new URL(req.url);
    if (
      url.pathname === "/scripts/global.js" ||
      url.pathname === "/scripts/sb-cart.js" ||
      url.pathname === "/scripts/ga.js" ||
      url.pathname === "/scripts/partials.js" ||
      url.pathname === "/scripts/sb-analytics.js"
    ) {
      event.respondWith(noStoreFirst(req));
      return;
    }
  } catch {}

  // Assets: CACHE FIRST
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);

        // ✅ Only cache full successful responses (avoid partial 206)
        if (fresh && fresh.ok && fresh.status === 200) {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(req, fresh.clone());
        }

        return fresh;
      } catch (_) {
        return cached || Response.error();
      }
    })()
  );
});
