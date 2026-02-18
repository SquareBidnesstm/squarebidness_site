import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
  runtime: "nodejs",
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

async function upstashGetRaw(key) {
  const base = upstashBase();
  const token = upstashToken();
  if (!base || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j?.result ?? null;
}

async function upstashPost(path, body) {
  const base = upstashBase();
  const token = upstashToken();
  if (!base || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function upstashSetJson(key, valueObj) {
  return upstashPost(`/set/${encodeURIComponent(key)}`, [JSON.stringify(valueObj)]);
}

async function upstashSet(key, value) {
  return upstashPost(`/set/${encodeURIComponent(key)}`, [String(value)]);
}

async function sendResendEmail({ to, subject, html }) {
  const apiKey = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.RESEND_FROM);
  const replyTo = clean(process.env.RESEND_REPLY_TO);

  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!from) throw new Error("Missing RESEND_FROM");

  const payload = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { j = { raw: text }; }
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
  const planLabel = String(tier || "").toLowerCase() === "fleet" ? "Small Fleet (2–10)" : "Single Truck";
  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;line-height:1.55;color:#111;background:#fff;">
    <div style="max-width:640px;margin:0 auto;padding:22px 18px;">
      <div style="font-weight:900;font-size:14px;opacity:.9;">SB FleetLog™</div>
      <h2 style="margin:10px 0 10px;font-size:22px;line-height:1.2;">You're live. Subscription active.</h2>
      <p style="margin:0 0 14px;color:#222;">Start logging immediately and generate printable receipt links for your records.</p>

      <div style="margin:18px 0 16px;">
        <a href="https://www.squarebidness.com/lab/fleetlog/new/"
           style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:900;">
          Create Your First Log
        </a>
        <a href="https://www.squarebidness.com/lab/fleetlog/"
           style="display:inline-block;margin-left:10px;color:#111;text-decoration:underline;font-weight:800;">
          Open FleetLog App
        </a>
      </div>

      <div style="border-top:1px solid #e8e8e8;margin:18px 0;padding-top:14px;">
        <p style="margin:0 0 6px;"><strong>Plan:</strong> ${esc(planLabel)}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> ${esc(email)}</p>
        <p style="margin:0 0 6px;"><strong>Subscription ID:</strong> ${esc(subscriptionId || "")}</p>
      </div>

      <p style="margin:14px 0 0;color:#555;font-size:13px;">Need help? Reply to this email.</p>
    </div>
  </div>`;
}

async function provisionActive({ email, tier, subscriptionId, customerId, source }) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !e.includes("@")) throw new Error("Missing email for provisioning");

  const record = {
    subscriptionId: subscriptionId || null,
    customerId: customerId || null,
    email: e,
    tier: tier || "single",
    createdAt: nowIso(),
    source: source || "stripe_event",
    status: "ACTIVE",
  };

  // Write both indexes
  if (subscriptionId) await upstashSetJson(`fleetlog:sub:${subscriptionId}`, record);
  await upstashSetJson(`fleetlog:email:${e}`, record);

  // Idempotent email send: prefer subscription id, otherwise customer id
  const dedupeId = subscriptionId || customerId || e;
  const emailSentKey = `fleetlog:email_sent:${dedupeId}`;
  const alreadySent = await upstashGetRaw(emailSentKey);
  if (!alreadySent) {
    const subject =
      String(record.tier).toLowerCase() === "fleet"
        ? "SB FleetLog™ — Fleet subscription active"
        : "SB FleetLog™ — Subscription active";

    await sendResendEmail({
      to: e,
      subject,
      html: welcomeEmailHtml({ email: e, tier: record.tier, subscriptionId }),
    });

    await upstashSet(emailSentKey, nowIso());
    console.log("FleetLog welcome email sent:", { email: e, subscriptionId, customerId });
  }

  return record;
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
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // 1) Provision on checkout completion (re-retrieve + expand to avoid subscription:null)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Re-fetch with expands (this is the key fix)
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["subscription", "customer", "customer_details"],
      });

      const customerId = String(full.customer?.id || full.customer || "");
      const subscriptionId =
        typeof full.subscription === "string"
          ? full.subscription
          : String(full.subscription?.id || "");

      let email =
        String(full.customer_details?.email || full.customer_email || "").trim().toLowerCase();

      // If still missing, try customer object
      if (!email && customerId) {
        const cust = await stripe.customers.retrieve(customerId);
        email = String(cust?.email || "").trim().toLowerCase();
      }

      const tier =
        String(full.metadata?.tier || full.subscription?.metadata?.tier || "").trim().toLowerCase() ||
        "single";

      // If still no subscription id, DON'T provision yet — subscription events will handle it
      if (!subscriptionId) {
        console.log("FleetLog: checkout completed but subscriptionId missing (will wait for subscription events)", {
          sessionId: full.id,
          mode: full.mode,
          customerId,
          email,
        });
        return res.status(200).json({ received: true, ok: true, pending: true });
      }

      await provisionActive({
        email,
        tier,
        subscriptionId,
        customerId,
        source: "checkout.session.completed",
      });
    }

    // 2) Provision on subscription create/update (covers subscription:null cases)
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = event.data.object;

      const subscriptionId = String(sub.id || "");
      const customerId = String(sub.customer || "");
      const status = String(sub.status || "").toLowerCase();

      // only treat active/trialing as allowed
      const isActive = status === "active" || status === "trialing";
      if (!isActive) {
        return res.status(200).json({ received: true, ok: true, skipped: true });
      }

      // email must be pulled from customer
      let email = "";
      if (customerId) {
        const cust = await stripe.customers.retrieve(customerId);
        email = String(cust?.email || "").trim().toLowerCase();
      }

      const tier = String(sub.metadata?.tier || "").trim().toLowerCase() || "single";

      if (email) {
        await provisionActive({
          email,
          tier,
          subscriptionId,
          customerId,
          source: event.type,
        });
      } else {
        console.log("FleetLog: subscription active but missing email on customer", { subscriptionId, customerId });
      }
    }

    // 3) Cancel handling
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const subscriptionId = String(sub.id || "");
      const subKey = `fleetlog:sub:${subscriptionId}`;

      const existing = await upstashGetRaw(subKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        parsed.status = "CANCELED";
        parsed.canceledAt = nowIso();
        await upstashSetJson(subKey, parsed);

        const email = String(parsed.email || "").toLowerCase();
        if (email) await upstashSetJson(`fleetlog:email:${email}`, parsed);
      }

      console.log("FleetLog subscription canceled:", subscriptionId);
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("FleetLog webhook handler error:", e?.message || e);
    return res.status(200).json({ received: true, ok: false, error: e?.message || "error" });
  }
}
