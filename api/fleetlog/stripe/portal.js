// api/fleetlog/stripe/portal.js
import Stripe from "stripe";
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

// Handles "{...}" OR "[\"{...}\"]" OR ["{...}"]
function normalizeRecord(result) {
  if (result == null) return null;

  if (Array.isArray(result)) {
    const first = result[0];
    if (typeof first === "object" && first) return first;
    if (typeof first === "string") {
      try { return JSON.parse(first); } catch { return null; }
    }
    return null;
  }

  if (typeof result === "string") {
    // might be JSON object
    try {
      const p = JSON.parse(result);
      if (p && typeof p === "object" && !Array.isArray(p)) return p;

      // might be stringified array
      if (Array.isArray(p)) {
        const first = p[0];
        if (typeof first === "object" && first) return first;
        if (typeof first === "string") {
          try { return JSON.parse(first); } catch { return null; }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof result === "object") return result;
  return null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });

    const email = clean(req.query.email).toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Missing/invalid email" });
    }

    // 🔒 Gate: must be ACTIVE
    const raw = await upstashGetRaw(`fleetlog:email:${email}`);
    const rec = normalizeRecord(raw);
    if (!rec) return res.status(403).json({ ok: false, error: "SUBSCRIPTION_REQUIRED" });

    const status = String(rec.status || "").toUpperCase();
    if (status !== "ACTIVE") return res.status(403).json({ ok: false, error: "SUBSCRIPTION_REQUIRED" });

    const customerId = String(rec.customerId || "");
    if (!customerId) return res.status(500).json({ ok: false, error: "Missing customerId on subscriber record" });

    const stripe = new Stripe(key);

    const returnUrl =
      clean(process.env.FLEETLOG_PORTAL_RETURN_URL) ||
      "https://www.squarebidness.com/lab/fleetlog/";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.writeHead(302, { Location: session.url }).end();
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Stripe portal error" });
  }
}
