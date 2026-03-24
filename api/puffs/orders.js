// /api/puffs/orders.js
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const ORDERS_KEY = "puffs:orders";

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Missing Upstash Redis env vars."
    });
  }

  async function redisGet(path) {
    const r = await fetch(`${REDIS_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      }
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Redis request failed (${r.status})`);
    return data;
  }

  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    const data = await redisGet(`/lrange/${encodeURIComponent(ORDERS_KEY)}/0/${limit - 1}`);
    const raw = Array.isArray(data.result) ? data.result : [];

    const orders = raw
      .map((entry) => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return res.status(200).json({
      ok: true,
      orders
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to load orders."
    });
  }
}
