// /api/fleetlog/stripe/portal.js
import Stripe from "stripe";

export const config = { runtime: "nodejs" };

function clean(s){
  return String(s || "").replace(/(^"|"$)/g,"").trim();
}

function upstashBase(){
  return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,"");
}

function upstashToken(){
  return clean(process.env.UPSTASH_REDIS_REST_TOKEN);
}

// ✅ Correct GET for Upstash
async function upstashGet(path){
  const base = upstashBase();
  const token = upstashToken();

  if(!base || !token) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${base}${path}`,{
    method: "GET",
    headers:{ Authorization:`Bearer ${token}` }
  });

  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);

  return j;
}

async function uget(key){
  const j = await upstashGet(`/get/${encodeURIComponent(key)}`);
  return j?.result ?? null;
}

function tryParse(raw){
  if(raw == null) return null;

  if(typeof raw === "object" && !Array.isArray(raw)) return raw;

  if(Array.isArray(raw)){
    const first = raw[0];
    if(typeof first === "string"){
      try { return JSON.parse(first); } catch { return null; }
    }
  }

  if(typeof raw === "string"){
    try { return JSON.parse(raw); } catch { return null; }
  }

  return null;
}

export default async function handler(req,res){
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try{
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if(!stripeKey) return res.status(500).json({ ok:false, error:"Missing STRIPE_SECRET_KEY" });

    const email = clean(req.query.email).toLowerCase();
    if(!email || !email.includes("@"))
      return res.status(400).json({ ok:false, error:"Missing/invalid email" });

    const stripe = new Stripe(stripeKey);

    // ✅ Read subscriber record
    const raw = await uget(`fleetlog:email:${email}`);
    const rec = tryParse(raw);

    if(!rec || !rec.customerId){
      return res.status(403).json({
        ok:false,
        error:"NO_ACTIVE_RECORD",
        hint:"Subscription not found in Upstash."
      });
    }

    // ✅ Create billing portal session
    const portal = await stripe.billingPortal.sessions.create({
      customer: rec.customerId,
      return_url: "https://www.squarebidness.com/lab/fleetlog/"
    });

    return res.status(200).json({
      ok:true,
      url: portal.url
    });

  }catch(e){
    return res.status(500).json({
      ok:false,
      error: e?.message || "Server error"
    });
  }
}
