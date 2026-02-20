// /api/fleetlog/stripe/webhook.js
import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
  runtime: "nodejs",
};

function nowIso(){ return new Date().toISOString(); }
function clean(s){ return String(s || "").replace(/(^"|"$)/g, "").trim(); }

function upstashBase(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/, ""); }
function upstashToken(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

// -----------------------------
// Upstash REST helpers
// - GET for /get/<key>  (NO body)
// - POST w/ JSON array for commands like set/lpush/lrange/expire
// -----------------------------
async function upstashGet(path){
  const base = upstashBase();
  const token = upstashToken();
  if(!base || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${base}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function upstashPost(path, argsArray){
  const base = upstashBase();
  const token = upstashToken();
  if(!base || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(Array.isArray(argsArray) ? argsArray : []),
  });

  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function uget(key){
  const j = await upstashGet(`/get/${encodeURIComponent(key)}`);
  return j?.result ?? null;
}
async function uset(key, valueStr){
  return upstashPost(`/set/${encodeURIComponent(key)}`, [String(valueStr)]);
}
async function usetJson(key, obj){
  return upstashPost(`/set/${encodeURIComponent(key)}`, [JSON.stringify(obj)]);
}
async function lpush(key, valueStr){
  return upstashPost(`/lpush/${encodeURIComponent(key)}`, [String(valueStr)]);
}
async function expire(key, seconds){
  // Upstash EXPIRE needs an integer number of seconds
  const n = Number(seconds);
  const s = Number.isFinite(n) ? Math.floor(n) : 0;

  // If something weird comes through, don't break the webhook
  if(s <= 0) return { ok:false, skipped:true };

  try{
    return await upstashPost(`/expire/${encodeURIComponent(key)}`, [s]);
  }catch(e){
    // TTL is non-critical; never fail webhook on TTL
    console.warn("Upstash expire failed:", e?.message || e);
    return { ok:false, error: e?.message || String(e) };
  }
}
  // handle weird nesting like [["{...}"]]
  if(Array.isArray(raw)){
    const first = raw[0];
    if(Array.isArray(first)) return tryParseRecord(first[0]);
    if(typeof first === "object" && first) return first;
    if(typeof first === "string"){ try { return JSON.parse(first); } catch { return null; } }
    return null;
  }

  if(typeof raw === "string"){
    try{
      const p = JSON.parse(raw);
      if(p && typeof p === "object" && !Array.isArray(p)) return p;
      if(Array.isArray(p)) return tryParseRecord(p[0]);
      return null;
    }catch{ return null; }
  }

  return null;
}

async function audit(evt){
  const key = "fleetlog:ops:audit";
  const payload = { ...evt, ts: nowIso() };

  // lpush is important; expire is best-effort
  await lpush(key, JSON.stringify(payload));
  await expire(key, 60 * 60 * 24 * 30); // 30 days
}

async function webhookLog(evt){
  const key = "fleetlog:ops:webhooks";
  const payload = { ...evt, ts: nowIso() };

  await lpush(key, JSON.stringify(payload));
  await expire(key, 60 * 60 * 24 * 30); // 30 days
}

async function sendResendEmail({ to, subject, html }){
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const replyTo = process.env.RESEND_REPLY_TO;

  if(!apiKey) throw new Error("Missing RESEND_API_KEY");
  if(!from) throw new Error("Missing RESEND_FROM");

  const payload = { from, to, subject, html };
  if(replyTo) payload.reply_to = replyTo;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Resend error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, (c)=>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
  );
}

function welcomeEmailHtml({ email, tier, subscriptionId }){
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

    <p style="margin:0;color:#555;font-size:13px;">If you need help, reply to this email.</p>
  </div>`;
}

async function readRawBody(req){
  const buf = await new Promise((resolve)=>{
    const chunks=[];
    req.on("data",(c)=>chunks.push(c));
    req.on("end",()=>resolve(Buffer.concat(chunks)));
  });
  return buf;
}

function normalizeTier(val){
  return String(val || "").toLowerCase() === "fleet" ? "fleet" : "single";
}

function normalizeStatus(stripeStatus){
  const s = String(stripeStatus || "").toLowerCase();
  if(s === "active" || s === "trialing") return "ACTIVE";
  if(s === "past_due") return "PAST_DUE";
  if(s === "unpaid") return "UNPAID";
  if(s === "canceled") return "CANCELED";
  if(s === "incomplete") return "INCOMPLETE";
  if(s === "incomplete_expired") return "INCOMPLETE_EXPIRED";
  if(s === "paused") return "PAUSED";
  return s ? s.toUpperCase() : "";
}

export default async function handler(req, res){
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;

  if(!stripeKey) return res.status(500).json({ ok:false, error:"Missing STRIPE_SECRET_KEY" });
  if(!whsec) return res.status(500).json({ ok:false, error:"Missing STRIPE_WEBHOOK_SECRET" });

  const stripe = new Stripe(stripeKey);
  const sig = req.headers["stripe-signature"];
  if(!sig) return res.status(400).send("Webhook Error: missing stripe-signature");

  const buf = await readRawBody(req);

  let event;
  try{
    event = stripe.webhooks.constructEvent(buf, sig, whsec);
  }catch(err){
    console.error("Webhook signature verification failed:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || "invalid signature"}`);
  }

  const obj = event?.data?.object || {};
  const eventId = event?.id || "";
  const livemode = !!event?.livemode;
  const subscriptionIdHint = obj?.subscription || (String(obj?.id||"").startsWith("sub_") ? obj.id : null) || null;

  // Always log (non-fatal)
  try{ await audit({ type:"stripe_event", event:event.type, eventId, livemode, subscriptionId:subscriptionIdHint, customerId: obj?.customer || null }); }catch(e){}
  try{ await webhookLog({ type:event.type, id:eventId, livemode, subscriptionId:subscriptionIdHint, customerId: obj?.customer || null }); }catch(e){}

  try{
    // Provision on checkout completion
    if(event.type === "checkout.session.completed"){
      const session = event.data.object;

      const email = String(session.customer_details?.email || "").trim().toLowerCase();
      const subscriptionId = String(session.subscription || "").trim();
      const customerId = String(session.customer || "").trim();

      const tierFromMeta =
        String(session.metadata?.tier || "") ||
        String(session.subscription_data?.metadata?.tier || "");

      const tier = normalizeTier(tierFromMeta || "single");

      if(!email || !subscriptionId){
        await audit({ type:"webhook_skip_missing", reason:"missing_email_or_sub", email, tier, subscriptionId, livemode, eventId });
        return res.status(200).json({ received:true, skipped:true });
      }

      // Idempotency: welcome email once per subscription
      const emailSentKey = `fleetlog:email_sent:${subscriptionId}`;
      const alreadySent = await uget(emailSentKey);
      if(alreadySent){
        return res.status(200).json({ received:true, ok:true, deduped:true });
      }

      const record = {
        subscriptionId,
        customerId,
        email,
        tier,
        createdAt: nowIso(),
        source: "checkout.session.completed",
        status: "ACTIVE",
        livemode,
        eventId,
      };

      await usetJson(`fleetlog:sub:${subscriptionId}`, record);
      await usetJson(`fleetlog:email:${email}`, record);

      const subject = tier === "fleet"
        ? "SB FleetLog™ — Fleet subscription active"
        : "SB FleetLog™ — Subscription active";

      await sendResendEmail({
        to: email,
        subject,
        html: welcomeEmailHtml({ email, tier, subscriptionId })
      });

      await uset(emailSentKey, nowIso());
      await audit({ type:"sub_provisioned", email, tier, subscriptionId, customerId, livemode, eventId });

      return res.status(200).json({ received:true, ok:true });
    }

    // Keep status updated
    if(event.type === "customer.subscription.updated"){
      const sub = event.data.object;

      const subscriptionId = String(sub.id || "").trim();
      const customerId = String(sub.customer || "").trim();
      const status = normalizeStatus(sub.status);

      const recordKey = `fleetlog:sub:${subscriptionId}`;
      const existingRaw = await uget(recordKey);
      const existing = tryParseRecord(existingRaw) || {};
      const tier = normalizeTier(existing.tier || "single");

      const updated = {
        ...existing,
        subscriptionId,
        customerId: existing.customerId || customerId || null,
        tier,
        status: status || existing.status || "",
        updatedAt: nowIso(),
        source: "customer.subscription.updated",
        livemode,
        eventId,
      };

      await usetJson(recordKey, updated);

      const email = String(updated.email || "").trim().toLowerCase();
      if(email && email.includes("@")){
        await usetJson(`fleetlog:email:${email}`, updated);
      }

      await audit({ type:"sub_status_updated", subscriptionId, status: updated.status, tier, livemode, eventId });
      return res.status(200).json({ received:true, ok:true });
    }

    // Canceled
    if(event.type === "customer.subscription.deleted"){
      const sub = event.data.object;
      const subscriptionId = String(sub.id || "").trim();

      if(subscriptionId){
        const subKey = `fleetlog:sub:${subscriptionId}`;
        const existingRaw = await uget(subKey);
        const existing = tryParseRecord(existingRaw);

        if(existing){
          const canceled = {
            ...existing,
            status: "CANCELED",
            canceledAt: nowIso(),
            source: "customer.subscription.deleted",
            livemode,
            eventId,
          };
          await usetJson(subKey, canceled);

          const email = String(canceled.email || "").trim().toLowerCase();
          if(email) await usetJson(`fleetlog:email:${email}`, canceled);
        }

        await audit({ type:"sub_canceled", subscriptionId, livemode, eventId });
      }

      return res.status(200).json({ received:true, ok:true });
    }

    return res.status(200).json({ received:true, ok:true });
  }catch(e){
    console.error("FleetLog webhook handler error:", e?.message || e);
    try{ await audit({ type:"webhook_error", error:e?.message || String(e), event:event?.type || "", eventId, livemode }); }catch{}
    return res.status(200).json({ received:true, ok:false, error:e?.message || "error" });
  }
}
