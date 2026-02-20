// api/fleetlog/stripe/portal.js
import Stripe from "stripe";
export const config = { runtime: "nodejs" };

function clean(s){ return String(s || "").replace(/(^"|"$)/g,"").trim(); }
function nowIso(){ return new Date().toISOString(); }

function upstashBase(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,""); }
function upstashToken(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

async function upstashPost(path, argsArray){
  const base = upstashBase();
  const token = upstashToken();
  if(!base || !token) throw new Error("Missing Upstash env vars");
  const r = await fetch(`${base}${path}`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
    body: JSON.stringify(Array.isArray(argsArray) ? argsArray : [])
  });
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function uget(key){ return (await upstashPost(`/get/${encodeURIComponent(key)}`, []))?.result ?? null; }
async function usetJson(key,obj){ return upstashPost(`/set/${encodeURIComponent(key)}`, [JSON.stringify(obj)]); }

function tryParse(raw){
  if(raw == null) return null;
  if(typeof raw === "object" && !Array.isArray(raw)) return raw;
  if(Array.isArray(raw) && typeof raw[0] === "string"){ try { return JSON.parse(raw[0]); } catch { return null; } }
  if(typeof raw === "string"){ try { return JSON.parse(raw); } catch { return null; } }
  return null;
}

export default async function handler(req,res){
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try{
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if(!stripeKey) return res.status(500).json({ ok:false, error:"Missing STRIPE_SECRET_KEY" });

    const email = clean(req.query.email).toLowerCase();
    if(!email || !email.includes("@")) return res.status(400).json({ ok:false, error:"Missing/invalid email" });

    const stripe = new Stripe(stripeKey);

    // read our record
    const recKey = `fleetlog:email:${email}`;
    const raw = await uget(recKey);
    let rec = tryParse(raw) || {};

    let customerId = clean(rec.customerId);

    // 1) If we have a customerId, verify it exists in THIS mode
    if(customerId){
      try{
        await stripe.customers.retrieve(customerId);
      }catch(e){
        // Wrong mode or deleted; clear and self-heal
        customerId = "";
      }
    }

    // 2) Self-heal: find customer by email in current Stripe mode
    if(!customerId){
      const list = await stripe.customers.list({ email, limit: 1 });
      customerId = list?.data?.[0]?.id || "";
      if(!customerId){
        return res.status(403).json({
          ok:false,
          error:"NO_CUSTOMER_IN_THIS_MODE",
          hint:"Run checkout in the current mode (live/test) for this email."
        });
      }

      // Update record in Upstash so next time is clean
      rec = { ...rec, email, customerId, healedAt: nowIso() };
      await usetJson(recKey, rec);
    }

    // 3) Create portal session
    const return_url = "https://www.squarebidness.com/lab/fleetlog/";
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url });

    return res.status(200).json({ ok:true, url: portal.url });
  }catch(e){
    return res.status(500).json({ ok:false, error: e?.message || "Server error" });
  }
}
