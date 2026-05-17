// /api/phomatic/_config.js
// Shared config + helpers for Pho-Matic Photography booking system.
// Imported by all /api/phomatic/* serverless functions.

// ---------------------------------------------------------------------------
// Services catalog
// ---------------------------------------------------------------------------
export const SERVICES = {
  consultation: {
    id: "consultation",
    name: "Consultation",
    durationMinutes: 30,
    price: 45,
    deposit: 45, // paid in full upfront
    description: "30 min — align on goals, location, styling, and deliverables.",
  },
  headshots: {
    id: "headshots",
    name: "Head Shots",
    durationMinutes: 45,
    price: 100,
    deposit: 50,
    description: "45 min — clean professional headshots for work, brand, and press.",
  },
  graduation: {
    id: "graduation",
    name: "Graduation Photography",
    durationMinutes: 60,
    price: 150,
    deposit: 75,
    description: "1 hour — cap & gown, campus, creative portraits.",
  },
  prom: {
    id: "prom",
    name: "Prom Photography",
    durationMinutes: 60,
    price: 150,
    deposit: 75,
    description: "1 hour — crisp portraits + details. Perfect for couples or solo shots.",
  },
  family: {
    id: "family",
    name: "Family Photographs",
    durationMinutes: 60,
    price: 175,
    deposit: 88,
    description: "1 hour — families, groups, and clean lifestyle images.",
  },
  video: {
    id: "video",
    name: "Video Service",
    durationMinutes: 60,
    price: 125,
    deposit: 63,
    description: "1 hour — quick capture for content needs.",
  },
  event: {
    id: "event",
    name: "Event Service",
    durationMinutes: null,
    price: null,
    deposit: null,
    description: "2–4 hours — full event coverage.",
    tiers: [
      { hours: 2, price: 225, deposit: 113 },
      { hours: 3, price: 325, deposit: 163 },
      { hours: 4, price: 425, deposit: 213 },
    ],
  },
  wedding: {
    id: "wedding",
    name: "Wedding Service",
    durationMinutes: null,
    price: null,
    deposit: null,
    description: "2–6 hours — wedding and ceremony coverage.",
    tiers: [
      { hours: 2, price: 350, deposit: 175 },
      { hours: 3, price: 400, deposit: 200 },
      { hours: 4, price: 550, deposit: 275 },
      { hours: 6, price: 900, deposit: 450 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Availability config
// ---------------------------------------------------------------------------
// Day-of-week indices: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
export const AVAILABLE_DAYS = [2, 3, 4, 5, 6]; // Tue–Sat

// Time slots (display format, CST)
export const TIME_SLOTS = [
  "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
];

export const TIMEZONE = "America/Chicago"; // Hammond, LA

// How many months ahead clients can book
export const BOOKING_WINDOW_MONTHS = 4;

// ---------------------------------------------------------------------------
// Supabase helpers (raw REST — matches monorepo pattern)
// ---------------------------------------------------------------------------
const SB_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
).trim();

function sbHeaders(extra = {}) {
  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extra,
  };
}

export async function sbInsert(table, data) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify(data),
  });
  const json = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data: json };
}

export async function sbSelect(table, filters = {}, opts = {}) {
  const p = new URLSearchParams();
  p.set("select", opts.select || "*");
  if (opts.order) p.set("order", opts.order);
  if (opts.limit) p.set("limit", String(opts.limit));
  for (const [k, v] of Object.entries(filters)) p.set(k, v);
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${p}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: "application/json" },
  });
  const json = await r.json().catch(() => []);
  return { ok: r.ok, status: r.status, data: json };
}

export async function sbUpdate(table, filters, data) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) p.set(k, v);
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${p}`, {
    method: "PATCH",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
  return { ok: r.ok, status: r.status };
}

export async function sbDelete(table, filters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) p.set(k, v);
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${p}`, {
    method: "DELETE",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return { ok: r.ok, status: r.status };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

// Booking code: PM-XXXXXXX (7 unambiguous chars)
export function generateBookingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PM-";
  for (let i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function generateCancelToken() {
  return crypto.randomUUID();
}

// Normalize phone → +1XXXXXXXXXX
export function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// "Tuesday, June 3, 2026"
export function formatDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

export function isAvailableDay(dateStr) {
  return AVAILABLE_DAYS.includes(new Date(`${dateStr}T12:00:00`).getDay());
}

// Simple HTML escape for SMS-safe strings
export function esc(s) {
  return String(s || "").trim();
}

// ---------------------------------------------------------------------------
// Verify admin token (HMAC-based, matches auth.ts pattern in barber system)
// ---------------------------------------------------------------------------
export async function verifyAdminToken(token) {
  const secret = process.env.PHOMATIC_ADMIN_SECRET;
  if (!secret || !token) return false;
  const [issuedAt, mac] = token.split(".");
  if (!issuedAt || !mac) return false;
  const ts = Number(issuedAt);
  if (!ts || Date.now() - ts > 12 * 60 * 60 * 1000) return false; // 12h expiry
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`phomatic-admin:${issuedAt}`));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time compare
  const a = enc.encode(mac);
  const b = enc.encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function computeAdminToken() {
  const secret = process.env.PHOMATIC_ADMIN_SECRET;
  if (!secret) throw new Error("PHOMATIC_ADMIN_SECRET not set");
  const issuedAt = Date.now();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`phomatic-admin:${issuedAt}`));
  const mac = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${issuedAt}.${mac}`;
}
