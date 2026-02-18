// api/fleetlog/logs/create.js
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

async function upstashSet(key, value) {
  return upstashPost(`/set/${encodeURIComponent(key)}`, [String(value)]);
}

async function upstashLpush(key, value) {
  return upstashPost(`/lpush/${encodeURIComponent(key)}`, [String(value)]);
}

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  // simple unique id (safe for log keys)
  return `log_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
  if (!raw) {
    return { ok: false, status: 403, error: "SUBSCRIPTION_REQUIRED" };
  }

  let rec;
  try { rec = JSON.parse(raw); } catch { rec = null; }
  const status = String(rec?.status || "").toUpperCase();

  if (status !== "ACTIVE") {
    return { ok: false, status: 403, error: "SUBSCRIPTION_REQUIRED" };
  }

  return {
    ok: true,
    email: e,
    tier: rec?.tier || null,
    subscriptionId: rec?.subscriptionId || null,
    customerId: rec?.customerId || null,
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const email = normEmail(body.email);

    // 🔒 HARD GATE
    const gate = await requireActive(email);
    if (!gate.ok) return res.status(gate.status).json({ ok: false, error: gate.error });

    const id = newId();

    const record = {
      id,
      email,
      date: String(body.date || "").trim() || nowIso().slice(0, 10),
      truckId: String(body.truckId || "").trim(),
      route: String(body.route || "").trim(),
      start: String(body.start || "").trim(),
      end: String(body.end || "").trim(),
      miles: String(body.miles || "").trim(),
      notes: String(body.notes || "").trim(),
      createdAt: nowIso(),

      // subscription context (for audits)
      tier: gate.tier,
      subscriptionId: gate.subscriptionId,
      customerId: gate.customerId,
    };

    // Store log
    await upstashSet(`fleetlog:log:${id}`, JSON.stringify(record));

    // Add to user's list (most recent first)
    await upstashLpush(`fleetlog:user:${email}:logs`, id);

    // Receipt link
    const receipt_url = `https://www.squarebidness.com/lab/fleetlog/receipt/?id=${encodeURIComponent(id)}`;

    return res.status(200).json({ ok: true, id, receipt_url, record });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
