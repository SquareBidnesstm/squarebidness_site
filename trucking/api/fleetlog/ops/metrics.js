// api/fleetlog/ops/metrics.js
export const config = { runtime: "nodejs" };

function clean(s){ return String(s || "").replace(/(^"|"$)/g,"").trim(); }
function base(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,""); }
function tok(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

async function upstashPost(path, body){
  const b = base(), t = tok();
  if(!b || !t) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${b}${path}`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${t}`, "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });

  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

export default async function handler(req,res){
  if(req.method !== "GET") return res.status(405).json({ ok:false });

  const admin = clean(process.env.FLEETLOG_ADMIN_TOKEN);
  const provided = clean(req.headers["x-admin-token"] || req.query.admin);
  if(provided !== admin) return res.status(401).json({ ok:false, error:"UNAUTHORIZED" });

  try{
    // count subscriber keys
    const scan = await upstashPost("/scan", ["0", "MATCH", "fleetlog:email:*", "COUNT", "1000"]);
    const keys = scan?.result?.[1] || [];

    let active = 0;
    let single = 0;
    let fleet = 0;

    for(const k of keys){
      const r = await upstashPost(`/get/${encodeURIComponent(k)}`, []);
      const raw = r?.result;
      if(!raw) continue;

      let parsed;
      try{
        parsed = Array.isArray(raw) ? JSON.parse(raw[0]) : JSON.parse(raw);
      }catch{ continue; }

      if(parsed?.status === "ACTIVE"){
        active++;
        if(parsed.tier === "fleet") fleet++;
        else single++;
      }
    }

    return res.json({
      ok:true,
      totals:{
        subscribers: keys.length,
        active,
        single,
        fleet
      }
    });

  }catch(e){
    return res.status(500).json({ ok:false, error:e.message });
  }
}
