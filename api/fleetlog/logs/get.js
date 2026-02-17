// /api/fleetlog/logs/get.js
export const config = { runtime: "nodejs" };

function upstashBaseUrl() {
  return (process.env.UPSTASH_REDIS_REST_URL || "")
    .replace(/(^"|"$)/g, "")
    .replace(/\/+$/, "");
}
function upstashToken() {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || "").replace(/(^"|"$)/g, "");
}

async function upstashGet(key) {
  const base = upstashBaseUrl();
  const token = upstashToken();
  if (!base || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j?.result ?? null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const raw = await upstashGet(`fleetlog:log:${id}`);
    if (!raw) return res.status(404).json({ ok: false, error: "Not found" });

    return res.status(200).json({ ok: true, log: JSON.parse(raw) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
