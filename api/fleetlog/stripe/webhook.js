import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
  runtime: "nodejs",
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function nowIso() {
  return new Date().toISOString();
}

async function upstashFetch(path, bodyObj) {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/(^"|"$)/g, "").replace(/\/+$/,"");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  }
  return j;
}

async function upstashGet(key) {
  const j = await upstashFetch(`/get/${encodeURIComponent(key)}`);
  return j?.result ?? null;
}

async function upstashSetJson(key, valueObj) {
  return upstashFetch(`/set/${encodeURIComponent(key)}`, [JSON.stringify(valueObj)]);
}

async function upstashSet(key, value) {
  return upstashFetch(`/set/${encodeURIComponent(key)}`, [String(value)]);
}

async function sendResendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const replyTo = process.env.RESEND_REPLY_TO;

  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!from) throw new Error("Missing RESEND_FROM");

  const payload = {
    from,
    to,
    subject,
    html,
  };
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
  if (!r.ok) {
    throw new Error(`Resend error: ${r.status} ${JSON.stringify(j)}`);
  }
  return j;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function welcomeEmailHtml({ email, tier, subscriptionId }) {
  const safeEmail = escapeHtml(email);
  const safeTier = escapeHtml(tier);
  const safeSub = escapeHtml(subscriptionId);

  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5;color:#111;">
    <h2 style="margin:0 0 12px;">SB FleetLog™ — You're live.</h2>
    <p style="margin:0 0 12px;">
      Your subscription is active. You can start logging immediately and generate printable receipt links for your records.
    </p>

    <div style="margin:18px 0;">
      <a href="https://www.squarebidness.com/lab/fleetlog/"
         style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;">
        Start Logging Now
      </a>
      <a href="https://www.squarebidness.com/fleetlog/"
         style="display:inline-block;margin-left:10px;color:#111;text-decoration:underline;">
        Back to FleetLog
      </a>
    </div>

    <p style="margin:0 0 8px;"><strong>Plan:</strong> ${safeTier}</p>
    <p style="margin:0 0 8px;"><strong>Email:</strong> ${safeEmail}</p>
    <p style="margin:0 0 18px;"><strong>Subscription ID:</strong> ${safeSub}</p>

    <p style="margin:0;color:#555;font-size:13px;">
      If you need help, reply to this email.
    </p>
  </div>
  `;
}

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];

  const buf = await new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // We provision on checkout completion (best moment to email)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email = session.customer_details?.email || "";
      const subscriptionId = session.subscription || "";
      const tierFromMeta = session.metadata?.tier || ""; // if you set it
      const tier = tierFromMeta || "single"; // fallback

      if (!email || !subscriptionId) {
        console.warn("Missing email or subscriptionId on checkout.session.completed");
        return res.status(200).json({ received: true, skipped: true });
      }

      // Idempotency: only send once per subscription
      const emailSentKey = `fleetlog:email_sent:${subscriptionId}`;
      const alreadySent = await upstashGet(emailSentKey);
      if (alreadySent) {
        return res.status(200).json({ received: true, ok: true, deduped: true });
      }

      // Store subscriber records
      const subKey = `fleetlog:sub:${subscriptionId}`;
      const emailKey = `fleetlog:email:${email.toLowerCase()}`;

      const record = {
        subscriptionId,
        email,
        tier,
        createdAt: nowIso(),
        source: "stripe_webhook",
        status: "ACTIVE",
      };

      await upstashSetJson(subKey, record);
      await upstashSetJson(emailKey, record);

      // Send welcome email
      const subject =
        tier === "fleet"
          ? "SB FleetLog™ — Fleet subscription active"
          : "SB FleetLog™ — Subscription active";

      const html = welcomeEmailHtml({ email, tier, subscriptionId });
      await sendResendEmail({ to: email, subject, html });

      // Mark sent (so retries don't double-email)
      await upstashSet(emailSentKey, nowIso());

      console.log("FleetLog welcome email sent:", { email, subscriptionId, tier });
    }

    // Optional: keep subscription status updated (lightweight)
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const subscriptionId = sub.id;
      const subKey = `fleetlog:sub:${subscriptionId}`;

      const existing = await upstashGet(subKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        parsed.status = "CANCELED";
        parsed.canceledAt = nowIso();
        await upstashSetJson(subKey, parsed);

        const emailKey = `fleetlog:email:${String(parsed.email || "").toLowerCase()}`;
        if (parsed.email) await upstashSetJson(emailKey, parsed);
      }
      console.log("FleetLog subscription canceled:", subscriptionId);
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("FleetLog webhook handler error:", e?.message || e);
    // Return 200 to avoid Stripe retry storms if it's a non-critical internal issue.
    // If you want strict retries, change to res.status(500) for internal errors.
    return res.status(200).json({ received: true, ok: false, error: e?.message || "error" });
  }
}
