// /api/fleetlog/stripe/webhook.js
import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
  runtime: "nodejs",
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function nowIso() {
  return new Date().toISOString();
}

function clean(s) {
  return String(s || "").replace(/(^"|"$)/g, "").trim();
}

function upstashBase() {
  return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/, "");
}
function upstashToken() {
  return clean(process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Upstash REST calls:
 * - Always POST
 * - Body is an array of args (even for GET: [])
 */
async function upstashPost(path, argsArray) {
  const base = upstashBase();
  const token = upstashToken();
  if (!base || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(Array.isArray(argsArray) ? argsArray : []),
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function uget(key) {
  const j = await upstashPost(`/get/${encodeURIComponent(key)}`, []);
  return j?.result ?? null;
}
async function uset(key, valueStr) {
  return upstashPost(`/set/${encodeURIComponent(key)}`, [String(valueStr)]);
}
async function usetJson(key, obj) {
  return upstashPost(`/set/${encodeURIComponent(key)}`, [JSON.stringify(obj)]);
}
async function lpush(key, valueStr) {
  return upstashPost(`/lpush/${encodeURIComponent(key)}`, [String(valueStr)]);
}
async function expire(key, seconds) {
  return upstashPost(`/expire/${encodeURIComponent(key)}`, [Number(seconds)]);
}

function tryParseRecord(raw) {
  if (raw == null) return null;

  // Upstash may return a string, object, or array-wrapped string
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;

  if (Array.isArray(raw)) {
    const first = raw[0];
    if (typeof first === "object" && first) return first;
    if (typeof first === "string") {
      try {
        return JSON.parse(first);
      } catch {
        return null;
      }
    }
    return null;
  }

  if (typeof raw === "string") {
    // Sometimes it's JSON; sometimes it's ["{...}"]
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && !Array.isArray(p)) return p;
      if (Array.isArray(p) && typeof p[0] === "string") {
        try {
          return JSON.parse(p[0]);
        } catch {
          return null;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  return null;
}

async function audit(evt) {
  const key = "fleetlog:ops:audit";
  const payload = { ...evt, ts: nowIso() };
  await lpush(key, JSON.stringify(payload));
  await expire(key, 60 * 60 * 24 * 30); // 30 days
}

async function sendResendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const replyTo = process.env.RESEND_REPLY_TO;

  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!from) throw new Error("Missing RESEND_FROM");

  const payload = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Resend error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c])
  );
}

function welcomeEmailHtml({ email, tier, subscriptionId }) {
  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5;color:#111;">
    <h2 style="margin:0 0 12px;">SB FleetLog™ — You're live.</h2>
    <p style="margin:0 0 12px;">
      Your subscription is active. Start logging immediately and generate printable receipt links for your records.
    </p>

    <div style="margin:18px 0;">
      <a href="https://www.squarebidness.com/lab/fleetlog/"
         style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:800;">
        Start Logging Now
      </a>
      <a href="https://www.squarebidness.com/fleetlog/"
         style="display:inline-block;margin-left:10px;color:#111;text-decoration:underline;">
        Back to FleetLog
      </a>
    </div>

    <p style="margin:0 0 8px;"><strong>Plan:</strong> ${esc(tier)}</p>
    <p style="margin:0 0 8px;"><strong>Email:</strong> ${esc(email)}</p>
    <p style="margin:0 0 18px;"><strong>Subscription ID:</strong> ${esc(subscriptionId)}</p>

    <p style="margin:0;color:#555;font-size:13px;">
      If you need help, reply to this email.
    </p>
  </div>`;
}

async function readRawBody(req) {
  const buf = await new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
  return buf;
}

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  const buf = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || "invalid signature"}`);
  }
  // after: event = stripe.webhooks.constructEvent(...)

try {
  await audit({
    type: "stripe_event",
    event: event.type,
    subscriptionId:
      (event?.data?.object?.subscription) ||
      (event?.data?.object?.id) ||
      null,
    customerId:
      (event?.data?.object?.customer) ||
      null,
  });
} catch (e) {
  // don't break webhook if audit logging fails
  console.warn("FleetLog audit log failed:", e?.message || e);
}


  try {
    // Provision on checkout completion
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email = String(session.customer_details?.email || "").trim();
      const subscriptionId = String(session.subscription || "").trim();
      const customerId = String(session.customer || "").trim(); // ✅ requested
      const tierFromMeta =
        String(session.metadata?.tier || "") ||
        String(session.subscription_data?.metadata?.tier || "");
      const tier = (tierFromMeta || "single").toLowerCase() === "fleet" ? "fleet" : "single";

      if (!email || !subscriptionId) {
        console.warn("FleetLog webhook: missing email/subscriptionId");
        await audit({ type: "webhook_skip_missing", reason: "missing_email_or_sub", tier });
        return res.status(200).json({ received: true, skipped: true });
      }

      // Idempotency: only send once per subscription
      const emailSentKey = `fleetlog:email_sent:${subscriptionId}`;
      const alreadySent = await uget(emailSentKey);
      if (alreadySent) {
        return res.status(200).json({ received: true, ok: true, deduped: true });
      }

      // Store subscriber record
      const record = {
        subscriptionId,
        customerId, // ✅ requested
        email,
        tier,
        createdAt: nowIso(),
        source: "checkout.session.completed",
        status: "ACTIVE",
      };

      await usetJson(`fleetlog:sub:${subscriptionId}`, record);
      await usetJson(`fleetlog:email:${email.toLowerCase()}`, record);

      // Send welcome email (once)
      const subject =
        tier === "fleet"
          ? "SB FleetLog™ — Fleet subscription active"
          : "SB FleetLog™ — Subscription active";

      const html = welcomeEmailHtml({ email, tier, subscriptionId });
      await sendResendEmail({ to: email, subject, html });

      await uset(emailSentKey, nowIso());

      await audit({
        type: "sub_provisioned",
        email,
        tier,
        subscriptionId,
        customerId,
      });

      console.log("New subscription:", { email, subscriptionId, customerId, tier });
    }

    // Keep subscription status updated
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const subscriptionId = String(sub.id || "").trim();
      if (subscriptionId) {
        const subKey = `fleetlog:sub:${subscriptionId}`;
        const existingRaw = await uget(subKey);
        const existing = tryParseRecord(existingRaw);

        if (existing) {
          existing.status = "CANCELED";
          existing.canceledAt = nowIso();
          await usetJson(subKey, existing);

          const email = String(existing.email || "").toLowerCase();
          if (email) await usetJson(`fleetlog:email:${email}`, existing);
        }

        await audit({ type: "sub_canceled", subscriptionId });
        console.log("FleetLog subscription canceled:", subscriptionId);
      }
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("FleetLog webhook handler error:", e?.message || e);
    await audit({ type: "webhook_error", error: e?.message || String(e) });

    // 200 avoids Stripe retry storms for internal non-critical failures
    return res.status(200).json({
      received: true,
      ok: false,
      error: e?.message || "error",
    });
  }
}
