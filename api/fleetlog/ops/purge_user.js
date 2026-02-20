// api/fleetlog/ops/purge_user.js
export const config = { runtime: "nodejs" };

function clean(s){ return String(s || "").replace(/(^"|"$)/g,"").trim(); }
function base(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,""); }
function tok(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

async function upstash(method, path, body){
  const b = base(), t = tok();
  if(!b || !t) throw new Error("Missing Upstash env vars");
  const r = await fetch(`${b}${path}`,{
    method,
    headers:{ Authorization:`Bearer ${t}`, "Content-Type":"application/json" },
    body: JSON.stringify(Array.isArray(body) ? body : [])
  });
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function del(key){ return upstash("POST", `/del/${encodeURIComponent(key)}`, []); }

export default async function handler(req,res){
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  const admin = clean(process.env.FLEETLOG_ADMIN_TOKEN);
  const provided = clean(req.headers["x-admin-token"] || req.query.admin);
  if(!admin) return res.status(500).json({ ok:false, error:"Missing FLEETLOG_ADMIN_TOKEN" });
  if(provided !== admin) return res.status(401).json({ ok:false, error:"UNAUTHORIZED" });

  try{
    const body = await new Promise((resolve)=>{
      let data=""; req.on("data",(c)=>data+=c);
      req.on("end",()=>{ try{ resolve(JSON.parse(data||"{}")); } catch { resolve({}); }});
    });

    const email = clean(body.email).toLowerCase();
    if(!email || !email.includes("@")) return res.status(400).json({ ok:false, error:"Missing/invalid email" });

    const keys = [
      `fleetlog:email:${email}`,
      `fleetlog:user:${email}:logs`
    ];

    // optional: allow passing sub ids to purge as well
    const subs = Array.isArray(body.subscriptionIds) ? body.subscriptionIds.map(clean).filter(Boolean) : [];
    for(const sid of subs){
      keys.push(`fleetlog:sub:${sid}`);
      keys.push(`fleetlog:email_sent:${sid}`);
    }

    const results = [];
    for(const k of keys){
      const r = await del(k);
      results.push({ key:k, result:r?.result ?? null });
    }

    return res.status(200).json({ ok:true, email, purged: results });
  }catch(e){
    return res.status(500).json({ ok:false, error:e?.message || "Server error" });
  }
}
