// api/fleetlog/logs/create.js
export const config = { runtime: "nodejs" };

function clean(s){ return String(s || "").replace(/(^"|"$)/g,"").trim(); }
function base(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,""); }
function tok(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

async function upstash(method, path, body){
  const b = base(), t = tok();
  if(!b || !t) throw new Error("Missing Upstash env vars");
  const r = await fetch(`${b}${path}`, {
    method,
    headers: { Authorization:`Bearer ${t}`, "Content-Type":"application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function rateLimit(email){
  const key = `fleetlog:ratelimit:${email}`;
  const now = Date.now();
  const windowMs = 10000; // 10 seconds
  const max = 5;

  const r = await upstash("POST", `/incr/${encodeURIComponent(key)}`, []);
  const count = r?.result || 0;

  if(count === 1){
    await upstash("POST", `/pexpire/${encodeURIComponent(key)}`, [windowMs]);
  }

  return count > max;
}

async function uget(key){ return (await upstash("GET", `/get/${encodeURIComponent(key)}`))?.result ?? null; }
async function uset(key, valStr){ return upstash("POST", `/set/${encodeURIComponent(key)}`, [String(valStr)]); }
async function lpush(key, val){ return upstash("POST", `/lpush/${encodeURIComponent(key)}`, [String(val)]); }
async function llen(key){ return (await upstash("POST", `/llen/${encodeURIComponent(key)}`, []))?.result ?? 0; }
async function expire(key, seconds){ return upstash("POST", `/expire/${encodeURIComponent(key)}`, [seconds]); }

function tryParseRecord(raw){
  if(raw == null) return null;
  if(typeof raw === "object" && !Array.isArray(raw)) return raw;
  if(Array.isArray(raw)){
    const first = raw[0];
    if(typeof first === "object" && first) return first;
    if(typeof first === "string"){ try { return JSON.parse(first); } catch { return null; } }
    return null;
  }
  if(typeof raw === "string"){
    try {
      const p = JSON.parse(raw);
      if(p && typeof p === "object" && !Array.isArray(p)) return p;
      if(Array.isArray(p) && typeof p[0] === "string"){ try { return JSON.parse(p[0]); } catch { return null; } }
      return null;
    } catch { return null; }
  }
  return null;
}

function nowIso(){ return new Date().toISOString(); }
function id(){
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

async function audit(evt){
  const key = "fleetlog:ops:audit";
  const payload = { ...evt, ts: nowIso() };
  await lpush(key, JSON.stringify(payload));
  await expire(key, 60*60*24*30); // 30 days
}

export default async function handler(req,res){
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try{
    const email = clean(req.query.email).toLowerCase();
    if(!email || !email.includes("@")) return res.status(400).json({ ok:false, error:"Missing/invalid email" });

    const subRaw = await uget(`fleetlog:email:${email}`);
    const sub = tryParseRecord(subRaw);
    if(!sub) return res.status(403).json({ ok:false, error:"SUBSCRIPTION_REQUIRED" });

    const status = String(sub.status || "").toUpperCase();
    if(status !== "ACTIVE") return res.status(403).json({ ok:false, error:"SUBSCRIPTION_REQUIRED" });

    const tier = String(sub.tier || "single").toLowerCase() === "fleet" ? "fleet" : "single";

    if(await rateLimit(email)){
    return res.status(429).json({ ok:false, error:"RATE_LIMIT_EXCEEDED" });
    }


    // limits
    const maxSingle = parseInt(process.env.FLEETLOG_MAX_LOGS_SINGLE || "30", 10);
    const maxFleet  = parseInt(process.env.FLEETLOG_MAX_LOGS_FLEET  || "300", 10);
    const max = tier === "fleet" ? maxFleet : maxSingle;

    const listKey = `fleetlog:user:${email}:logs`;
    const currentCount = await llen(listKey);

    if(currentCount >= max){
      await audit({ type:"limit_block", email, tier, currentCount, max });
      return res.status(402).json({
        ok:false,
        error:"LOG_LIMIT_REACHED",
        tier,
        currentCount,
        max,
        hint: tier === "single" ? "Upgrade to Fleet for higher log capacity." : "Contact support for custom capacity."
      });
    }

    const body = await new Promise((resolve)=>{
      let data=""; req.on("data",(c)=>data+=c);
      req.on("end",()=>{ try{ resolve(JSON.parse(data||"{}")); } catch { resolve({}); }});
    });

    const logId = id();
    const record = {
      id: logId,
      email,
      createdAt: nowIso(),
      tier,
      // keep it flexible
      date: clean(body.date) || "",
      truck: clean(body.truck) || "",
      start: clean(body.start) || "",
      end: clean(body.end) || "",
      notes: clean(body.notes) || "",
      raw: body || {}
    };

    await uset(`fleetlog:log:${logId}`, JSON.stringify(record));
    await lpush(listKey, logId);

    await audit({ type:"log_created", email, tier, logId });

    return res.status(200).json({ ok:true, id: logId, tier });
  }catch(e){
    return res.status(500).json({ ok:false, error: e?.message || "Server error" });
  }
}
