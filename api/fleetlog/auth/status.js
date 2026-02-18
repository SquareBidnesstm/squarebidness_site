// api/fleetlog/auth/status.js
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

async function upstashGetRaw(key) {
  const b = base();
  const t = tok();
  if (!b || !t) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${b}/get/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${t}` },
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j?.result ?? null;
}

function tryJsonParse(x) {
  if (typeof x !== "string") return null;
  try { return JSON.parse(x); } catch { return null; }
}

// Normalizes all known stored shapes into a record object:
// - "{...}"
// - ["{...}"]
// - "[\"{...}\"]"  (stringified JSON array, your current case)
function parseStoredRecord(result) {
  if (result == null) return null;

  // Case A: already an object
  if (typeof result === "object" && !Array.isArray(result)) return result;

  // Case B: array
  if (Array.isArray(result)) {
    const first = result[0];

    if (typeof first === "object" && first) return first;

    if (typeof first === "string") {
      const obj = tryJsonParse(first);
      if (obj && typeof obj === "object") return obj;
    }
    return null;
  }

  // Case C: string
  if (typeof result === "string") {
    // First parse attempt
    const parsed = tryJsonParse(result);

    // If parsed is an object, done
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;

    // If parsed is an array, try parse first element as JSON
    if (Array.isArray(parsed)) {
      const first = parsed[0];
      if (typeof first === "object" && first) return first;
      if (typeof first === "string") {
        const obj = tryJsonParse(first);
        if (obj && typeof obj === "object") return obj;
      }
      return null;
    }

    // If string isn't JSON, nothing we can do
    return null;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const email = clean(req.query.email).toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Missing/invalid email" });
    }

    const raw = await upstashGetRaw(`fleetlog:email:${email}`);
    if (!raw) return res.status(200).json({ ok: true, active: false });

    const rec = parseStoredRecord(raw);
    if (!rec) return res.status(200).json({ ok: true, active: false });

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
      source: rec.source || null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
