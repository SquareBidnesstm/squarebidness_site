/* Square Bidness — site SW (network-first HTML, cache-first assets)
   v20260117b — FIX: never cache 206/partial/range, never cache video/audio
*/

const CACHE = "sb-site-v20260117b";
const ASSET_CACHE = "sb-assets-v20260117b";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(ASSET_CACHE);
        await cache.addAll([
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
      try {
        if (self.registration && self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      } catch (_) {}

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

    if (p.startsWith("/nav/") || p.startsWith("/footer/")) return true;
    if (p.endsWith(".html")) return true;

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) return true;
  } catch {}

  return false;
}

// ✅ Hard stop: never SW-cache range/media. Always stream from network.
function shouldBypassCache(req) {
  try {
    const url = new URL(req.url);
    const p = url.pathname.toLowerCase();

    // Any byte-range request means the response may be 206
    if (req.headers.get("range")) return true;

    // Destination-based bypass
    if (req.destination === "video" || req.destination === "audio") return true;

    // Extension fallback
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
  // ✅ only cache full success; this blocks 206 forever
  return !!(res && res.ok && res.status === 200 && res.type !== "opaque");
}

async function networkFirstHTML(req, event) {
  try {
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

  // ✅ Bypass cache completely for media/range (solves your error)
  if (shouldBypassCache(req)) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML + partial HTML: network-first
  if (isHTMLLikeRequest(req)) {
    event.respondWith(networkFirstHTML(req, event));
    return;
  }

  // Always try network for core JS (prevents stuck scripts)
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

  // Assets: cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);

        // ✅ never cache anything except 200 OK
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
