// api/fleetlog/logs/list.js
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

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function requireActive(email) {
  const e = normEmail(email);
  if (!e || !e.includes("@")) return { ok: false, status: 400, error: "Missing/invalid email" };

  const raw = await upstashGetRaw(`fleetlog:email:${e}`);
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
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 50);

    // 🔒 HARD GATE
    const gate = await requireActive(email);
    if (!gate.ok) return res.status(gate.status).json({ ok: false, error: gate.error });

    const listKey = `fleetlog:user:${email}:logs`;
    const idsResp = await upstashPost(`/lrange/${encodeURIComponent(listKey)}`, [0, limit - 1]);
    const ids = Array.isArray(idsResp?.result) ? idsResp.result : [];

    if (!ids.length) return res.status(200).json({ ok: true, logs: [] });

    const commands = ids.map((id) => ["GET", `fleetlog:log:${id}`]);
    const pipe = await upstashPost(`/pipeline`, commands);

    const logs = (pipe || [])
      .map((item) => {
        try {
          const raw = item?.result;
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return res.status(200).json({ ok: true, logs });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
