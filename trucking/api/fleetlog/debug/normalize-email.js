// api/fleetlog/debug/normalize-email.js
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

async function upstashSetRaw(key, valueString) {
  const b = base();
  const t = tok();
  if (!b || !t) throw new Error("Missing Upstash env vars");

  // /set expects args array
  const r = await fetch(`${b}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify([String(valueString)]),
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

function tryParseJson(s) {
  if (typeof s !== "string") return null;
  try { return JSON.parse(s); } catch { return null; }
}

function normalizeToObject(result) {
  if (result == null) return null;

  // Already an object
  if (typeof result === "object" && !Array.isArray(result)) return result;

  // Array -> maybe ["{...}"] or [{...}]
  if (Array.isArray(result)) {
    const first = result[0];
    if (typeof first === "object" && first) return first;
    if (typeof first === "string") {
      const obj = tryParseJson(first);
      if (obj && typeof obj === "object") return obj;
    }
    return null;
  }

  // String -> could be "{...}" OR "[\"{...}\"]"
  if (typeof result === "string") {
    const parsed = tryParseJson(result);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;

    if (Array.isArray(parsed)) {
      const first = parsed[0];
      if (typeof first === "object" && first) return first;
      if (typeof first === "string") {
        const obj = tryParseJson(first);
        if (obj && typeof obj === "object") return obj;
      }
    }

    // If it wasn't JSON, no normalize
    return null;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // 🔒 ADMIN GATE
    const admin = clean(process.env.FLEETLOG_ADMIN_TOKEN);
    const provided = clean(req.headers["x-admin-token"] || req.query.admin);
    if (!admin) return res.status(500).json({ ok: false, error: "Missing FLEETLOG_ADMIN_TOKEN" });
    if (provided !== admin) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const email = clean(req.query.email).toLowerCase();
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "Missing/invalid email" });

    const key = `fleetlog:email:${email}`;

    const raw = await upstashGetRaw(key);
    if (!raw) return res.status(404).json({ ok: false, error: "Key not found", key });

    const obj = normalizeToObject(raw);
    if (!obj) {
      return res.status(200).json({
        ok: true,
        changed: false,
        key,
        note: "Value exists but could not be normalized (unexpected shape).",
        rawType: Array.isArray(raw) ? "array" : typeof raw,
      });
    }

    const normalized = JSON.stringify(obj);
    await upstashSetRaw(key, normalized);

    return res.status(200).json({
      ok: true,
      changed: true,
      key,
      normalized,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
