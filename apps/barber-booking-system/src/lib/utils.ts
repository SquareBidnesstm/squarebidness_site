// Shared utilities — used across multiple API routes

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per serverless instance / process).
//
// ⚠️  PRODUCTION NOTE: Because Next.js on Vercel runs each serverless function
// in its own isolated process, this Map is NOT shared across concurrent
// instances.  A determined attacker can bypass the limit by hitting different
// cold-started instances in parallel.  For stronger guarantees, back the
// counters with an edge KV store (e.g. Vercel KV / Upstash Redis).  For the
// current traffic volume this in-process guard is a meaningful speed-bump
// against naive automated clients.
// ---------------------------------------------------------------------------

// --- Failed-attempt limiter (used for PIN login) ---------------------------
const _failMap = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Check whether `key` has exceeded its max-fails limit (default 5/15 min). */
export function checkRateLimit(key: string, maxAttempts?: number): { limited: boolean; retryAfterSeconds: number } {
  const limit = maxAttempts ?? MAX_FAILS;
  const now = Date.now();
  const entry = _failMap.get(key);
  if (!entry || now > entry.resetAt) {
    // Fresh window
    return { limited: false, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = _failMap.get(key);
  if (!entry || now > entry.resetAt) {
    _failMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

/**
 * Record every request (not just failures) against a key — used by public
 * endpoints such as availability, deposit, cancel, and reschedule where we
 * want to cap total throughput rather than only failed attempts.
 */
export function recordAttempt(key: string): void {
  recordFailedAttempt(key);
}

export function clearFailedAttempts(key: string): void {
  _failMap.delete(key);
}

// ---------------------------------------------------------------------------
// Idempotency cache — prevents duplicate bookings on network retry.
// Keys expire after 10 minutes. Keyed by client-supplied Idempotency-Key header.
// ---------------------------------------------------------------------------
const _idempotencyMap = new Map<string, { body: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

export function getIdempotentResponse(key: string): unknown | null {
  const now = Date.now();
  const entry = _idempotencyMap.get(key);
  if (!entry || now > entry.expiresAt) { _idempotencyMap.delete(key); return null; }
  return entry.body;
}

export function storeIdempotentResponse(key: string, body: unknown): void {
  _idempotencyMap.set(key, { body, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function convertDisplayTimeTo24Hour(time: string): string | null {
  const [clock, suffix] = time.trim().split(" ");
  if (!clock || !suffix) return null;
  const [rawHour, rawMinute] = clock.split(":");
  let hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (isNaN(hour) || isNaN(minute)) return null;
  const upper = suffix.toUpperCase();
  if (upper === "PM" && hour !== 12) hour += 12;
  if (upper === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// PIN hashing via PBKDF2 (Web Crypto — works in Edge + Node)
async function pbkdf2Hash(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = randomSalt();
  const hash = await pbkdf2Hash(pin, salt);
  return { hash, salt };
}

// Returns true if pin matches stored hash/salt.
// Also handles legacy plaintext PINs for migration (returns true + sets needsRehash).
export async function verifyPin(
  pin: string,
  stored: { pin?: string; pin_hash?: string; pin_salt?: string }
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (stored.pin_hash && stored.pin_salt) {
    // Modern hashed path
    const hash = await pbkdf2Hash(pin, stored.pin_salt);
    return { valid: hash === stored.pin_hash, needsRehash: false };
  }
  // Legacy plaintext — compare directly, flag for re-hash
  if (stored.pin) {
    return { valid: pin === stored.pin, needsRehash: true };
  }
  return { valid: false, needsRehash: false };
}
