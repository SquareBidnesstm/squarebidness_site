// /api/puffs/orders/status/index.js
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanString(value, max = 160) {
  return String(value || "").trim().slice(0, max);
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
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const orderNumber = cleanString(body.orderNumber, 80);
    const status = cleanString(body.status, 40).toLowerCase();
    const hidden = body.hidden === true;

    if (!orderNumber) {
      return res.status(400).json({
        ok: false,
        error: "orderNumber is required."
      });
    }

    const allowed = new Set(["new", "ready", "picked_up"]);
    if (!allowed.has(status)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid status."
      });
    }

    const payload = {
      orderNumber,
      status,
      hidden,
      updatedAt: new Date().toISOString()
    };

    await redisSet(`puffs:order-meta:${orderNumber}`, payload);

    return res.status(200).json({
      ok: true,
      meta: payload
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to update order status."
    });
  }
}
