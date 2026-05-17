import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Upstash Redis-backed rate limiter — cross-instance safe on Vercel serverless.
//
// Uses a fixed 15-minute sliding window. INCR + EXPIRE is atomic in Redis —
// no race conditions across concurrent serverless instances.
//
// Falls back to an in-process Map when UPSTASH_REDIS_REST_URL / TOKEN are not
// set (local dev, CI). The fallback is per-instance only — sufficient for dev.
// ---------------------------------------------------------------------------

const WINDOW_SECONDS = 15 * 60;
const WINDOW_MS = WINDOW_SECONDS * 1000;

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

const _failMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Atomically record one attempt AND check whether the key is over-limit.
 * Backed by Upstash Redis for true cross-instance enforcement on Vercel.
 * Falls back to in-process Map when Redis env vars are absent (local dev).
 */
export async function checkRateLimit(
  key: string,
  maxFails = 10
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const redis = getRedis();

  if (redis) {
    const rKey = `rl:${key}`;
    const count = await redis.incr(rKey);
    if (count === 1) await redis.expire(rKey, WINDOW_SECONDS);
    if (count > maxFails) {
      const ttl = await redis.ttl(rKey);
      return { limited: true, retryAfterSeconds: Math.max(ttl, 0) };
    }
    return { limited: false, retryAfterSeconds: 0 };
  }

  // In-memory fallback
  const now = Date.now();
  for (const [k, v] of _failMap.entries()) {
    if (now > v.resetAt) _failMap.delete(k);
  }
  const entry = _failMap.get(key);
  if (!entry || now > entry.resetAt) {
    _failMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }
  entry.count++;
  if (entry.count > maxFails) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

/** No-op — checkRateLimit now records atomically. Kept for call-site compat. */
export function recordAttempt(_key: string): void {}
export function clearAttempts(_key: string): void {}

// ---------------------------------------------------------------------------
// CSRF origin check — validates that a form POST comes from our own domain.
// Call on any state-changing form endpoint.
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  "https://events.squarebidness.com",
  // Allow local dev
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
]);

export function isSafeOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Check Origin header first (present on all modern browsers for cross-origin)
  if (origin) return ALLOWED_ORIGINS.has(origin);

  // Fallback: check Referer for same-origin form POSTs that omit Origin
  if (referer) {
    try {
      const ref = new URL(referer);
      return ALLOWED_ORIGINS.has(ref.origin);
    } catch {
      return false;
    }
  }

  // No origin or referer — fail closed to prevent CSRF from clients that strip headers.
  // Exception: allow in local development so curl/Postman testing works without friction.
  if (process.env.NODE_ENV === "development") return true;

  // Also allow requests bearing a valid CRON_SECRET bearer token (server-to-server).
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}
