// TEMPORARY — remove after use
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const provided = (req.headers["x-reset-token"] || "").trim();
  if (provided !== "sb-reset-2026-0805") {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const redisUrl = process.env.DELISH_UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return res.status(503).json({ ok: false, error: "Redis not configured" });
  }

  await Promise.all([
    redisDel(redisUrl, redisToken, "delish:ordering:mode"),
    redisDel(redisUrl, redisToken, "delish:ordering:closed_date"),
    redisDel(redisUrl, redisToken, "delish:ordering:message"),
    redisDel(redisUrl, redisToken, "delish:ordering:resume_at"),
  ]);

  return res.status(200).json({ ok: true, message: "Ordering mode reset to auto schedule." });
}

async function redisDel(url, token, key) {
  const r = await fetch(`${url.replace(/\/$/, "")}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.json();
}
