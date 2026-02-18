// api/fleetlog/logs/create.js
import fetch from "node-fetch";

export const config = { runtime: "nodejs" };

function clean(s){ return String(s || "").replace(/(^"|"$)/g,"").trim(); }
function base(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,""); }
function tok(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

async function upstash(method, path, body){
  const b = base(), t = tok();
  if(!b || !t) throw new Error("Missing Upstash env vars");
  const r = await fetch(`${b}${path}`, {
    method,
    headers:{ Authorization:`Bearer ${t}`, "Content-Type":"application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function uget(key){ return (await upstash("GET", `/get/${encodeURIComponent(key)}`))?.result ?? null; }
async function uset(key,val){ return upstash("POST", `/set/${encodeURIComponent(key)}`, [String(val)]); }
async function lpush(key,val){ return upstash("POST", `/lpush/${encodeURIComponent(key)}`, [String(val)]); }
async function llen(key){ return (await upstash("POST", `/llen/${encodeURIComponent(key)}`, []))?.result ?? 0; }
async function expire(key,sec){ return upstash("POST", `/expire/${encodeURIComponent(key)}`, [sec]); }

function tryParseRecord(raw){
  if(!raw) return null;
  try{
    if(typeof raw === "string") return JSON.parse(raw);
    if(Array.isArray(raw) && typeof raw[0] === "string") return JSON.parse(raw[0]);
    return raw;
  }catch{ return null; }
}

function nowIso(){ return new Date().toISOString(); }
function id(){ return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }

async function audit(evt){
  const key = "fleetlog:ops:audit";
  await lpush(key, JSON.stringify({ ...evt, ts: nowIso() }));
  await expire(key, 60*60*24*30);
}

async function rateLimit(email){
  const key = `fleetlog:ratelimit:${email}`;
  const windowMs = 10000;
  const max = 5;

  const r = await upstash("POST", `/incr/${encodeURIComponent(key)}`, []);
  const count = r?.result || 0;

  if(count === 1){
    await upstash("POST", `/pexpire/${encodeURIComponent(key)}`, [windowMs]);
  }

  return count > max;
}

async function sendResendEmail({to,subject,html}){
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if(!apiKey || !from) return;

  await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{
      Authorization:`Bearer ${apiKey}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({ from, to, subject, html })
  });
}

async function maybeSendUsageWarning({email,tier,used}){
  const tierRaw = String(tier || "").toLowerCase();
  const maxSingle = parseInt(process.env.FLEETLOG_MAX_LOGS_SINGLE || "30",10);
  const maxFleet  = parseInt(process.env.FLEETLOG_MAX_LOGS_FLEET  || "300",10);
  const max = tierRaw === "fleet" ? maxFleet : maxSingle;

  const threshold = Math.floor(max * 0.8);
  if(used < threshold) return;

  const warnKey = `fleetlog:warned:${email}`;
  const existing = await uget(warnKey);
  if(existing) return;

  const percent = Math.round((used/max)*100);

  const subject = "SB FleetLog™ — Approaching Usage Limit";

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto">
      <h2>FleetLog Usage Alert</h2>
      <p>You’ve used <strong>${used} of ${max}</strong> logs (${percent}%).</p>
      ${
        tierRaw === "single"
        ? `<p>Upgrade to Fleet for 300 logs per cycle.</p>`
        : `<p>You are approaching your fleet capacity.</p>`
      }
      <div style="margin-top:16px">
        <a href="https://www.squarebidness.com/lab/fleetlog/"
           style="background:#111;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:700;">
           Open FleetLog
        </a>
      </div>
    </div>
  `;

  await sendResendEmail({to:email,subject,html});
  await upstash("POST", `/set/${encodeURIComponent(warnKey)}`, ["1","EX",60*60*24*30]);
}

export default async function handler(req,res){
  if(req.method !== "POST") return res.status(405).json({ok:false});

  try{
    const email = clean(req.query.email).toLowerCase();
    if(!email.includes("@")) return res.status(400).json({ok:false,error:"Missing email"});

    const subRaw = await uget(`fleetlog:email:${email}`);
    const sub = tryParseRecord(subRaw);
    if(!sub || String(sub.status).toUpperCase() !== "ACTIVE"){
      return res.status(403).json({ok:false,error:"SUBSCRIPTION_REQUIRED"});
    }

    if(await rateLimit(email)){
      return res.status(429).json({ok:false,error:"RATE_LIMIT_EXCEEDED"});
    }

    const tier = String(sub.tier||"single").toLowerCase()==="fleet"?"fleet":"single";

    const maxSingle = parseInt(process.env.FLEETLOG_MAX_LOGS_SINGLE || "30",10);
    const maxFleet  = parseInt(process.env.FLEETLOG_MAX_LOGS_FLEET  || "300",10);
    const max = tier==="fleet"?maxFleet:maxSingle;

    const listKey = `fleetlog:user:${email}:logs`;
    const currentCount = await llen(listKey);

    if(currentCount >= max){
      await audit({type:"limit_block",email,tier,currentCount,max});
      return res.status(402).json({
        ok:false,
        error:"LOG_LIMIT_REACHED",
        tier,
        currentCount,
        max
      });
    }

    const body = await new Promise(resolve=>{
      let data="";
      req.on("data",c=>data+=c);
      req.on("end",()=>{ try{ resolve(JSON.parse(data||"{}")); }catch{ resolve({}); }});
    });

    const logId = id();

    const record = {
      id:logId,
      email,
      tier,
      createdAt:nowIso(),
      raw:body
    };

    await uset(`fleetlog:log:${logId}`, JSON.stringify(record));
    await lpush(listKey, logId);

    const newCount = currentCount + 1;

    await maybeSendUsageWarning({email,tier,used:newCount});
    await audit({type:"log_created",email,tier,logId});

    return res.status(200).json({ok:true,id:logId,tier});

  }catch(e){
    return res.status(500).json({ok:false,error:e?.message||"Server error"});
  }
}
