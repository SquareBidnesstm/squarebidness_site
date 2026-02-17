// /api/fleetlog/stripe/webhook.js
// SB FleetLog — Stripe Webhook (Upstash + Resend + Dedupe)

import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
  runtime: "nodejs",
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function nowIso() {
  return new Date().toISOString();
}

function stripQuotes(s) {
  return String(s || "").replace(/(^"|"$)/g, "");
}

function upstashBaseUrl() {
  // remove quotes + trailing slashes
  return stripQuotes(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/, "");
}

function upstashToken() {
  return stripQuotes(process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashPost(path, bodyJson) {
  const base = upstashBaseUrl();
  const token = upstashToken();
  if (!base || !token) throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");

  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyJson),
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function upstashGet(key) {
  const j = await upstashPost(`/get/${encodeURIComponent(key)}`, null);
  return j?.result ?? null;
}

async function upstashSet(key, value) {
  return upstashPost(`/set/${encodeURIComponent(key)}`, [String(value)]);
}

async function upstashSetJson(key, obj) {
  return upstashPost(`/set/${encodeURIComponent(key)}`, [JSON.stringify(obj)]);
}

async function sendResendEmail({ to, subject, html }) {
  const apiKey = stripQuotes(process.env.RESEND_API_KEY);
  const from = stripQuotes(process.env.RESEND_FROM);
  const replyTo = stripQuotes(process.env.RESEND_REPLY_TO);

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
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
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

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];

  // Read raw body
  const buf = await new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // ✅ Provision + Email on checkout completion (best moment)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email = session.customer_details?.email || "";
      const subscriptionId = session.subscription || "";
      const customerId = session.customer || ""; // IMPORTANT for Billing Portal
      const tier = session.metadata?.tier || "single";

      if (!email || !subscriptionId) {
        console.warn("Missing email or subscriptionId on checkout.session.completed");
        return res.status(200).json({ received: true, skipped: true });
      }

      // Dedupe: Stripe retries webhooks — only send once per subscription
      const emailSentKey = `fleetlog:email_sent:${subscriptionId}`;
      const alreadySent = await upstashGet(emailSentKey);
      if (alreadySent) {
        return res.status(200).json({ received: true, ok: true, deduped: true });
      }

      // Store subscriber record
      const record = {
        subscriptionId,
        customerId,
        email,
        tier,
        createdAt: nowIso(),
        source: "stripe_webhook",
        status: "ACTIVE",
      };

      await upstashSetJson(`fleetlog:sub:${subscriptionId}`, record);
      await upstashSetJson(`fleetlog:email:${email.toLowerCase()}`, record);

      // Send welcome email
      const subject = tier === "fleet"
        ? "SB FleetLog™ — Fleet subscription active"
        : "SB FleetLog™ — Subscription active";

      await sendResendEmail({
        to: email,
        subject,
        html: welcomeEmailHtml({ email, tier, subscriptionId }),
      });

      // Mark sent (prevents double-send)
      await upstashSet(emailSentKey, nowIso());

      console.log("FleetLog welcome email sent:", { email, subscriptionId, tier });
    }

    // ✅ Keep status updated if subscription cancels
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const subscriptionId = sub.id;

      const subKey = `fleetlog:sub:${subscriptionId}`;
      const raw = await upstashGet(subKey);

      if (raw) {
        const rec = JSON.parse(raw);
        rec.status = "CANCELED";
        rec.canceledAt = nowIso();

        await upstashSetJson(subKey, rec);
        if (rec.email) await upstashSetJson(`fleetlog:email:${String(rec.email).toLowerCase()}`, rec);
      }

      console.log("FleetLog subscription canceled:", subscriptionId);
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("FleetLog webhook handler error:", e?.message || e);
    // Return 200 to avoid retry storms; logs will show the failure.
    return res.status(200).json({ received: true, ok: false, error: e?.message || "error" });
  }
}
