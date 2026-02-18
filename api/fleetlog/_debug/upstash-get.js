// api/fleetlog/_debug/upstash-get.js
export const config = { runtime: "nodejs" };

function base() {
  return (process.env.UPSTASH_REDIS_REST_URL || "")
    .replace(/(^"|"$)/g, "")
    .replace(/\/+$/, "");
}
function token() {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || "").replace(/(^"|"$)/g, "");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // 🔒 ADMIN GATE
    const admin = (process.env.FLEETLOG_ADMIN_TOKEN || "").trim();
    const provided =
      String(req.headers["x-admin-token"] || "").trim() ||
      String(req.query.admin || "").trim();

    if (!admin) return res.status(500).json({ ok: false, error: "Missing FLEETLOG_ADMIN_TOKEN" });
    if (provided !== admin) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const key = String(req.query.key || "").trim();
    if (!key) return res.status(400).json({ ok: false, error: "Missing key" });

    const b = base();
    const t = token();
    if (!b || !t) throw new Error("Missing Upstash env vars");

    const r = await fetch(`${b}/get/${encodeURIComponent(key)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${t}` },
    });

    const j = await r.json().catch(() => null);
    if (!r.ok) return res.status(500).json({ ok: false, error: `Upstash error ${r.status}`, detail: j });

    return res.status(200).json({ ok: true, key, result: j?.result ?? null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
