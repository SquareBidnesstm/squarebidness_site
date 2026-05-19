// Shared utilities — used across multiple API routes

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Upstash Redis-backed rate limiter — cross-instance safe on Vercel serverless.
//
// Uses a fixed 15-minute sliding window. Each unique key gets its own counter
// stored in Redis. The INCR + EXPIRE pattern is atomic: no race conditions.
//
// Falls back to an in-process Map when UPSTASH_REDIS_REST_URL / TOKEN are not
// set (local dev, CI). The fallback is per-instance only — sufficient for dev.
// ---------------------------------------------------------------------------

const WINDOW_SECONDS = 15 * 60; // 15 minutes
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

// In-process fallback for local dev (no Redis configured)
const _failMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Atomically record one attempt AND check whether the key is over-limit.
 * Backed by Upstash Redis for true cross-instance enforcement on Vercel.
 * Falls back to in-process Map when Redis env vars are absent (local dev).
 */
export async function checkRateLimit(
  key: string,
  maxAttempts = 5
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const redis = getRedis();

  if (redis) {
    const rKey = `rl:${key}`;
    const count = await redis.incr(rKey);
    if (count === 1) await redis.expire(rKey, WINDOW_SECONDS);
    if (count > maxAttempts) {
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
  if (entry.count > maxAttempts) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

/** No-op — checkRateLimit now records atomically. Kept for call-site compat. */
export function recordFailedAttempt(_key: string): void {}
export function recordAttempt(_key: string): void {}
export function clearFailedAttempts(_key: string): void {}

// ---------------------------------------------------------------------------
// Idempotency cache — prevents duplicate bookings on network retry.
// Keys expire after 10 minutes. Keyed by client-supplied Idempotency-Key header.
// Backed by Upstash Redis so it works correctly across Vercel serverless cold starts.
// Falls back to in-process Map for local dev when Redis env vars are absent.
// ---------------------------------------------------------------------------
const IDEMPOTENCY_TTL_SECONDS = 10 * 60; // 10 minutes
const _idempotencyMap = new Map<string, { body: unknown; expiresAt: number }>();

export async function getIdempotentResponse(key: string): Promise<unknown | null> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>(`idem:${key}`).catch(() => null);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }
  // In-memory fallback
  const now = Date.now();
  const entry = _idempotencyMap.get(key);
  if (!entry || now > entry.expiresAt) { _idempotencyMap.delete(key); return null; }
  return entry.body;
}

export async function storeIdempotentResponse(key: string, body: unknown): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`idem:${key}`, JSON.stringify(body), { ex: IDEMPOTENCY_TTL_SECONDS }).catch(console.error);
    return;
  }
  // In-memory fallback
  _idempotencyMap.set(key, { body, expiresAt: Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000 });
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
