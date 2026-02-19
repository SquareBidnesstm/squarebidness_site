// api/fleetlog/ops/audit/list.js
export const config = { runtime: "nodejs" };

function clean(s){ return String(s || "").replace(/(^"|"$)/g,"").trim(); }
function base(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,""); }
function tok(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

async function upstashPost(path, argsArray){
  const b = base(), t = tok();
  if(!b || !t) throw new Error("Missing Upstash env vars");

  const r = await fetch(`${b}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(Array.isArray(argsArray) ? argsArray : []),
  });

  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

export default async function handler(req,res){
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });

  const admin = clean(process.env.FLEETLOG_ADMIN_TOKEN);
  const provided = clean(req.headers["x-admin-token"] || req.query.admin);
  if(!admin) return res.status(500).json({ ok:false, error:"Missing FLEETLOG_ADMIN_TOKEN" });
  if(provided !== admin) return res.status(401).json({ ok:false, error:"UNAUTHORIZED" });

  try{
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50",10), 1), 200);
    const key = "fleetlog:ops:audit";

    const start = 0;
    const stop = limit - 1;

    // ✅ Upstash expects args in BODY: [start, stop]
    const resp = await upstashPost(`/lrange/${encodeURIComponent(key)}`, [start, stop]);

    const rows = Array.isArray(resp?.result) ? resp.result : [];
    const events = rows.map((s)=>{ try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);

    return res.status(200).json({ ok:true, events });
  }catch(e){
    return res.status(500).json({ ok:false, error:e?.message || "Server error" });
  }
}
