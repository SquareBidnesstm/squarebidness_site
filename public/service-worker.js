/* Square Bidness — site SW (network-first for pages + partial HTML) */
/* v20260117a — media bypass + range-safe + destination-aware + nav preload */

const CACHE = "sb-site-v20260117a";
const ASSET_CACHE = "sb-assets-v20260117a";

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
      // Enable navigation preload for faster HTML
      try {
        if (self.registration && self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      } catch (_) {}

      // Cleanup old caches
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

/* ✅ NEVER cache media / range / partials */
function isMediaOrRange(req) {
  try {
    // request.destination is the cleanest signal
    const d = req.destination;
    if (d === "video" || d === "audio") return true;

    // If browser requests a byte-range, treat as media-like
    const range = req.headers.get("range");
    if (range) return true;

    // Extension fallback (covers odd cases where destination is empty)
    const url = new URL(req.url);
    const p = url.pathname.toLowerCase();
    if (p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov") || p.endsWith(".m4v")) return true;
    if (p.endsWith(".mp3") || p.endsWith(".wav") || p.endsWith(".aac") || p.endsWith(".m4a")) return true;
  } catch {}

  return false;
}

function isSameOrigin(req) {
  try {
    return new URL(req.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function okToCache(res) {
  // Only cache full, successful, non-opaque responses
  return !!(res && res.ok && res.status === 200 && res.type !== "opaque");
}

async function networkFirstHTML(req, event) {
  try {
    // Use navigation preload response if available (faster)
    const preload = event && event.preloadResponse ? await event.preloadResponse : null;
    const fresh = preload || (await fetch(req, { cache: "no-store" }));

    if (okToCache(fresh) && isSameOrigin(req)) {
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

  // ✅ Media + range should bypass SW caching entirely (fixes hero.mp4 / 206 / Cache.put)
  if (isMediaOrRange(req)) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML + nav/footer partial HTML: NETWORK FIRST
  if (isHTMLLikeRequest(req)) {
    event.respondWith(networkFirstHTML(req, event));
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

  // Assets: CACHE FIRST (same-origin only)
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);

        // ✅ Only cache full successful responses AND same-origin
        if (okToCache(fresh) && isSameOrigin(req)) {
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
