const BASE = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY  = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const headers = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

export function isConfigured() {
  return Boolean(BASE && KEY);
}

export async function insertBooking(row) {
  const r = await fetch(`${BASE}/rest/v1/taxslayer_bookings`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(row),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Supabase insert failed: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

export async function listBookings({ status, limit = 200 } = {}) {
  const p = new URLSearchParams();
  p.set("select", "id,name,phone,email,preferred_date,service,mode,notes,status,created_at,updated_at");
  p.set("order", "created_at.desc");
  p.set("limit", String(limit));
  if (status && status !== "all") p.set("status", `eq.${status}`);

  const r = await fetch(`${BASE}/rest/v1/taxslayer_bookings?${p}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: "application/json" },
  });
  const j = await r.json().catch(() => []);
  if (!r.ok) throw new Error(`Supabase list failed: ${r.status}`);
  return Array.isArray(j) ? j : [];
}

export async function updateBookingStatus(id, status) {
  const r = await fetch(`${BASE}/rest/v1/taxslayer_bookings?id=eq.${id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Supabase update failed: ${r.status}`);
  return j;
}
