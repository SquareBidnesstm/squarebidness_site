// api/fleetlog/auth/status.js
export const config = { runtime: "nodejs" };

function base() {
  return (process.env.UPSTASH_REDIS_REST_URL || "")
    .replace(/(^"|"$)/g, "")
    .replace(/\/+$/, "");
}
function token() {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || "").replace(/(^"|"$)/g, "");
}

async function upstashGetRaw(key) {
  const b = base();
  const t = token();
  if (!b || !t) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${b}/get/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${t}` },
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j?.result ?? null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Missing/invalid email" });
    }

    const raw = await upstashGetRaw(`fleetlog:email:${email}`);
    if (!raw) return res.status(200).json({ ok: true, active: false });

    const rec = JSON.parse(raw);
    const status = String(rec.status || "").toUpperCase();
    const active = status === "ACTIVE";

    return res.status(200).json({
      ok: true,
      active,
      status,
      tier: rec.tier || null,
      subscriptionId: rec.subscriptionId || null,
      customerId: rec.customerId || null,
      email: rec.email || email,
      createdAt: rec.createdAt || null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
