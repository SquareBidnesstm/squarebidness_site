// api/fleetlog/debug/get.js
export const config = { runtime: "nodejs" };

function clean(s) {
  return String(s || "").replace(/(^"|"$)/g, "").trim();
}
function base() {
  return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/, "");
}
function tok() {
  return clean(process.env.UPSTASH_REDIS_REST_TOKEN);
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

    // 🔒 ADMIN GATE
    const admin = clean(process.env.FLEETLOG_ADMIN_TOKEN);
    const provided = clean(req.headers["x-admin-token"] || req.query.admin);
    if (!admin) return res.status(500).json({ ok: false, error: "Missing FLEETLOG_ADMIN_TOKEN" });
    if (provided !== admin) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const key = clean(req.query.key);
    if (!key) return res.status(400).json({ ok: false, error: "Missing key" });

    const b = base();
    const t = tok();
    if (!b || !t) {
      return res.status(500).json({ ok: false, error: "Missing Upstash env vars", hasUrl: !!b, hasToken: !!t });
    }

    const url = `${b}/get/${encodeURIComponent(key)}`;
    const r = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${t}` } });

    const rawText = await r.text();

    let j = null;
    try { j = JSON.parse(rawText); } catch { j = null; }

    if (!r.ok) {
      return res.status(500).json({ ok: false, error: `Upstash error ${r.status}`, rawText, parsed: j });
    }

    // Upstash shape: { result: <value> }
    return res.status(200).json({
      ok: true,
      key,
      rawText,
      parsed: j,
      result: j?.result ?? null,
      resultType: Array.isArray(j?.result) ? "array" : typeof (j?.result),
    });
  } catch (e) {
    console.error("FleetLog debug/get crash:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
