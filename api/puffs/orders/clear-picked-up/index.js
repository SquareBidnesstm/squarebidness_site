// /api/puffs/orders/clear-picked-up/index.js
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function redisPost(pathname) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${REDIS_URL}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Redis request failed (${res.status})`);
  }
  return data;
}

async function redisLRange(key, start = 0, stop = 199) {
  const result = await redisPost(`/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
  return Array.isArray(result.result) ? result.result : [];
}

async function redisGet(key) {
  const result = await redisPost(`/get/${encodeURIComponent(key)}`);
  if (!result || typeof result.result !== "string") return null;
  return safeJsonParse(result.result);
}

async function redisSet(key, value) {
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(JSON.stringify(value));
  return redisPost(`/set/${encodedKey}/${encodedValue}`);
}

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed."
    });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Missing Upstash Redis env vars."
    });
  }

  try {
    const rawOrders = await redisLRange("puffs:orders", 0, 199);
    let cleared = 0;

    for (const raw of rawOrders) {
      const order = safeJsonParse(raw);
      if (!order || !order.orderNumber) continue;

      const metaKey = `puffs:order-meta:${order.orderNumber}`;
      const existingMeta = await redisGet(metaKey);
      const status = String(existingMeta?.status || order.status || "new").toLowerCase();

      if (status === "picked_up") {
        await redisSet(metaKey, {
          orderNumber: order.orderNumber,
          status: "picked_up",
          hidden: true,
          updatedAt: new Date().toISOString()
        });
        cleared += 1;
      }
    }

    return res.status(200).json({
      ok: true,
      cleared
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to clear picked up orders."
    });
  }
}
