// api/fleetlog/ops/_test_write.js
export const config = { runtime: "nodejs" };

function clean(s){ return String(s || "").replace(/(^"|"$)/g,"").trim(); }
function base(){ return clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/,""); }
function tok(){ return clean(process.env.UPSTASH_REDIS_REST_TOKEN); }

async function upstashPipeline(commands){
  const b = base(), t = tok();
  if(!b || !t) throw new Error("Missing Upstash env vars");
  const r = await fetch(`${b}/pipeline`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${t}`, "Content-Type":"application/json" },
    body: JSON.stringify(commands),
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
    const ts = new Date().toISOString();
    const auditKey = "fleetlog:ops:audit";
    const whKey = "fleetlog:ops:webhooks";

    await upstashPipeline([
      ["LPUSH", auditKey, JSON.stringify({ ts, type:"_test_audit_write", note:"manual probe" })],
      ["LPUSH", whKey, JSON.stringify({ ts, type:"_test_webhook_write", id:"evt_test_probe", livemode:false })],
      ["EXPIRE", auditKey, "2592000"],
      ["EXPIRE", whKey, "2592000"],
      ["LLEN", auditKey],
      ["LLEN", whKey]
    ]);

    const lens = await upstashPipeline([
      ["LLEN", auditKey],
      ["LLEN", whKey]
    ]);

    return res.status(200).json({
      ok:true,
      auditLen: lens?.[0]?.result ?? null,
      webhooksLen: lens?.[1]?.result ?? null
    });
  }catch(e){
    return res.status(500).json({ ok:false, error: e?.message || "Server error" });
  }
}
