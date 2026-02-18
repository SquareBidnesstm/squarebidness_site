// api/fleetlog/logs/get.js
export const config = { runtime: "nodejs" };

function base() {
  return (process.env.UPSTASH_REDIS_REST_URL || "")
    .replace(/(^"|"$)/g, "")
    .replace(/\/+$/, "");
}
function token() {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || "")
    .replace(/(^"|"$)/g, "");
}

async function upstashPost(path, body) {
  const b = base();
  const t = token();
  if (!b || !t) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${b}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function upstashGet(key) {
  const j = await upstashPost(`/get/${encodeURIComponent(key)}`, []);
  return j?.result ?? null;
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function requireActive(email) {
  const e = normEmail(email);
  if (!e || !e.includes("@")) {
    return { ok: false, status: 400, error: "Missing/invalid email" };
  }

  const raw = await upstashGet(`fleetlog:email:${e}`);
  if (!raw) return { ok: false, status: 403, error: "SUBSCRIPTION_REQUIRED" };

  let rec;
  try { rec = JSON.parse(raw); } catch { rec = null; }
  const status = String(rec?.status || "").toUpperCase();
  if (status !== "ACTIVE") return { ok: false, status: 403, error: "SUBSCRIPTION_REQUIRED" };

  return { ok: true, email: e };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const email = normEmail(req.query.email || "");
    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    // 🔒 HARD GATE
    const gate = await requireActive(email);
    if (!gate.ok) return res.status(gate.status).json({ ok: false, error: gate.error });

    const raw = await upstashGet(`fleetlog:log:${id}`);
    if (!raw) return res.status(404).json({ ok: false, error: "Not found" });

    const log = JSON.parse(raw);

    // Extra safety: only allow owner email
    if (normEmail(log.email) !== email) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    return res.status(200).json({ ok: true, log });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
