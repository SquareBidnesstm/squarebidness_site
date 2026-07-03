// /api/fleetlog/stripe/portal.js
import Stripe from "stripe";

export const config = { runtime: "nodejs" };

function clean(s){ return String(s || "").replace(/(^"|"$)/g,"").trim(); }
function nowIso(){ return new Date().toISOString(); }

// -------- Upstash (safe command style) --------
function upstashBase(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,""); }
function upstashToken(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

async function upstashCmd(command, argsArray){
  const base = upstashBase();
  const token = upstashToken();
  if(!base || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${base}/${command}`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
    body: JSON.stringify(Array.isArray(argsArray) ? argsArray : [])
  });

  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function uget(key){
  const j = await upstashCmd("get", [String(key)]);
  return j?.result ?? null;
}
async function usetJson(key, obj){
  return upstashCmd("set", [String(key), JSON.stringify(obj)]);
}

function tryParse(raw){
  if(raw == null) return null;
  if(typeof raw === "object" && !Array.isArray(raw)) return raw;

  if(Array.isArray(raw)){
    const first = raw[0];
    if(typeof first === "string"){ try { return JSON.parse(first); } catch { return null; } }
    if(typeof first === "object" && first) return first;
    return null;
  }

  if(typeof raw === "string"){
    try {
      const p = JSON.parse(raw);
      if(p && typeof p === "object") return p;
      return null;
    } catch { return null; }
  }

  return null;
}

function normalizeTierFromPrice(priceId){
  const pSingle = clean(process.env.STRIPE_PRICE_SINGLE);
  const pFleet  = clean(process.env.STRIPE_PRICE_FLEET);
  if(priceId && pFleet && priceId === pFleet) return "fleet";
  if(priceId && pSingle && priceId === pSingle) return "single";
  return "single";
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

export default async function handler(req,res){
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try{
    const stripeKey = clean(process.env.STRIPE_SECRET_KEY);
    if(!stripeKey) return res.status(500).json({ ok:false, error:"Missing STRIPE_SECRET_KEY" });

    const email = clean(req.query.email).toLowerCase();
    if(!email || !email.includes("@")){
      return res.status(400).json({ ok:false, error:"Missing/invalid email" });
    }

    const stripe = new Stripe(stripeKey);

    // 1) Normal path: Upstash record by email
    const upKey = `fleetlog:email:${email}`;
    const raw = await uget(upKey);
    let rec = tryParse(raw);

    let customerId = rec?.customerId ? String(rec.customerId).trim() : "";
    let subscriptionId = rec?.subscriptionId ? String(rec.subscriptionId).trim() : "";
    let tier = rec?.tier ? String(rec.tier).toLowerCase() : "";
    let status = rec?.status ? String(rec.status) : "";

    // 2) Self-heal if missing (LIVE)
    if(!customerId){
      const customers = await stripe.customers.list({ email, limit: 1 });
      const cust = customers?.data?.[0] || null;
      if(!cust?.id){
        return res.status(403).json({ ok:false, error:"NO_CUSTOMER", hint:"No Stripe customer found for this email (live mode)." });
      }
      customerId = cust.id;

      const subs = await stripe.subscriptions.list({ customer: customerId, status:"all", limit:10 });
      const best =
        subs.data.find(s => ["active","trialing","past_due","unpaid","paused"].includes(s.status)) ||
        subs.data[0] ||
        null;

      if(best?.id){
        subscriptionId = best.id;
        status = normalizeStatus(best.status);
        const priceId = best.items?.data?.[0]?.price?.id || "";
        tier = normalizeTierFromPrice(priceId);
      }else{
        status = status || "UNKNOWN";
        tier = tier || "single";
      }

      const backfilled = {
        subscriptionId: subscriptionId || null,
        customerId,
        email,
        tier: tier || "single",
        status: status || "ACTIVE",
        updatedAt: nowIso(),
        source: "portal_self_heal",
      };

      // backfill Upstash (don’t block portal if it fails)
      try{
        await usetJson(upKey, backfilled);
        if(subscriptionId) await usetJson(`fleetlog:sub:${subscriptionId}`, backfilled);
      }catch{}
      rec = backfilled;
    }

    // 3) Create portal
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://www.squarebidness.com/lab/fleetlog/",
    });

    return res.status(200).json({
      ok:true,
      url: portal.url,
      meta:{
        email,
        customerId,
        subscriptionId: subscriptionId || null,
        tier: tier || rec?.tier || "single",
        status: status || rec?.status || "",
      }
    });

  }catch(e){
    return res.status(500).json({ ok:false, error: e?.message || "Server error" });
  }
}
