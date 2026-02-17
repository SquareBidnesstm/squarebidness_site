// /api/fleetlog/logs/create.js
// SB FleetLog — Create Log (Upstash REST)

export const config = { runtime: "nodejs" };

const clean = (s, n = 4000) =>
  String(s ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

function upstashBaseUrl() {
  // harden against quotes/trailing slashes
  return (process.env.UPSTASH_REDIS_REST_URL || "")
    .replace(/(^"|"$)/g, "")
    .replace(/\/+$/, "");
}

async function upstashPost(path, bodyArr) {
  const base = upstashBaseUrl();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").replace(/(^"|"$)/g, "");
  if (!base || !token) throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");

  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyArr),
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

function makeId() {
  // Node 18+ has crypto.randomUUID
  try {
    return crypto.randomUUID();
  } catch {
    return `fl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = req.body || {};
    const email = clean(body.email, 160).toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Missing or invalid email" });
    }

    const log = {
      id: makeId(),
      type: "daily_log",
      email,
      date: clean(body.date, 20),
      truckId: clean(body.truckId, 80),
      route: clean(body.route, 40),
      start: clean(body.start, 120),
      end: clean(body.end, 120),
      miles: clean(body.miles, 20),
      notes: clean(body.notes, 4000),
      createdAt: new Date().toISOString(),
      status: "SAVED",
    };

    // store log
    await upstashPost(`/set/${encodeURIComponent(`fleetlog:log:${log.id}`)}`, [
      JSON.stringify(log),
    ]);

    // index for user history (latest first)
    await upstashPost(`/lpush/${encodeURIComponent(`fleetlog:user:${email}:logs`)}`, [
      log.id,
    ]);

    // optional: keep only latest 200 ids
    await upstashPost(`/ltrim/${encodeURIComponent(`fleetlog:user:${email}:logs`)}`, [0, 199]);

    return res.status(200).json({
      ok: true,
      id: log.id,
      receipt_url: `/lab/fleetlog/receipt/?id=${encodeURIComponent(log.id)}`,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
