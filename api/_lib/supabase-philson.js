const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
).trim();

const TABLE = "philson_orders";

function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export async function createOrder(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(JSON.stringify(json));
  return Array.isArray(json) ? json[0] : json;
}

export async function getOrderByToken(token) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?eddie_token=eq.${token}&select=*&limit=1`,
    { headers: headers() }
  );
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json[0] || null : null;
}

export async function getOrderById(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=*&limit=1`,
    { headers: headers() }
  );
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json[0] || null : null;
}

export async function updateOrder(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

export async function getOrders({ status, limit = 100 } = {}) {
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(limit),
  });
  if (status) params.set("status", `eq.${status}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?${params}`, {
    headers: headers(),
  });
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json : [];
}

export async function getExpiredPaymentOrders() {
  const now = new Date().toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?status=eq.payment_sent&stripe_session_expires_at=lt.${now}&select=*`,
    { headers: headers() }
  );
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json : [];
}

// Parse "$550" → 55000 (cents)
export function parsePriceCents(priceStr) {
  const num = parseFloat(String(priceStr || "0").replace(/[^0-9.]/g, ""));
  return isNaN(num) || num <= 0 ? 0 : Math.round(num * 100);
}

export function depositCents(priceCents) {
  return Math.round(priceCents * 0.25);
}

export function formatDollars(cents) {
  return "$" + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
