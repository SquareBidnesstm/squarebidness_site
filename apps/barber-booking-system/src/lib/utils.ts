// Shared utilities — used across multiple API routes

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter for PIN login (per serverless instance).
// Limits: 5 failed attempts per 15 min window per key.
// ---------------------------------------------------------------------------
const _failMap = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(key: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = _failMap.get(key);
  if (!entry || now > entry.resetAt) {
    // Fresh window
    return { limited: false, retryAfterSeconds: 0 };
  }
  if (entry.count >= MAX_FAILS) {
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
