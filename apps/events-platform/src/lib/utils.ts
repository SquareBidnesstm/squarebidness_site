// ---------------------------------------------------------------------------
// In-memory rate limiter — limits failed attempts per key.
// Designed for serverless (per-instance), provides best-effort defense.
//
// LIMITATION: This map lives in the Node.js process heap. In a serverless
// environment (Vercel, AWS Lambda) each cold start creates a fresh map, so
// counts reset on every new instance and limits are not enforced across
// concurrent instances. For production scale or stricter enforcement, replace
// this with a shared atomic store such as Upstash Redis (ioredis + @upstash/ratelimit).
// ---------------------------------------------------------------------------
const _failMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(
  key: string,
  maxFails = 10
): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Evict expired entries to prevent unbounded memory growth within a single instance.
  // NOTE: In serverless environments each cold start creates a fresh map, so eviction
  // is a best-effort safeguard rather than a guaranteed bounded-size store. For
  // production-grade enforcement across concurrent instances, replace _failMap with a
  // shared atomic store such as Upstash Redis (@upstash/ratelimit).
  for (const [k, v] of _failMap.entries()) {
    if (now > v.resetAt) _failMap.delete(k);
  }

  const entry = _failMap.get(key);
  if (!entry || now > entry.resetAt) return { limited: false, retryAfterSeconds: 0 };
  if (entry.count >= maxFails) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

export function recordAttempt(key: string): void {
  const now = Date.now();
  const entry = _failMap.get(key);
  if (!entry || now > entry.resetAt) {
    _failMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

export function clearAttempts(key: string): void {
  _failMap.delete(key);
}

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
