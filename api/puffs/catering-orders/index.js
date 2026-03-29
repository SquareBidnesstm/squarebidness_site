// /api/puffs/catering-orders/index.js
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
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

async function redisGet(key) {
  const result = await redisPost(`/get/${encodeURIComponent(key)}`);
  if (!result || typeof result.result !== "string") return null;
  return safeJsonParse(result.result);
}

async function redisLRange(key, start = 0, stop = 99) {
  const result = await redisPost(`/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
  return Array.isArray(result.result) ? result.result : [];
}

function normalizeOrder(order) {
  if (!order || typeof order !== "object") return null;

  return {
    id: String(order.id || ""),
    requestNumber: String(order.requestNumber || ""),
    customerName: String(order.customerName || ""),
    phone: String(order.phone || ""),
    email: String(order.email || ""),
    eventType: String(order.eventType || ""),
    eventDate: String(order.eventDate || ""),
    eventTime: String(order.eventTime || ""),
    guestCount: String(order.guestCount || ""),
    serviceType: String(order.serviceType || ""),
    budget: String(order.budget || ""),
    servingStyle: String(order.servingStyle || ""),
    eventAddress: String(order.eventAddress || ""),
    requestedItems: String(order.requestedItems || ""),
    notes: String(order.notes || ""),
    status: String(order.status || "new_request"),
    depositAmount: order.depositAmount != null ? String(order.depositAmount) : "",
    depositLink: String(order.depositLink || ""),
    depositSentAt: String(order.depositSentAt || ""),
    depositPaidAt: String(order.depositPaidAt || ""),
    createdAt: String(order.createdAt || ""),
    source: String(order.source || "puffs_catering")
  };
}

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
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
    const idsRaw = await redisLRange("puffs:catering:requests", 0, 99);

    const orders = [];
    for (const raw of idsRaw) {
      const id = String(raw || "").trim();
      if (!id) continue;

      const order = await redisGet(`puffs:catering:request:${id}`);
      const normalized = normalizeOrder(order);
      if (normalized) orders.push(normalized);
    }

    orders.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime() || 0;
      const bTime = new Date(b.createdAt || 0).getTime() || 0;
      return bTime - aTime;
    });

    return res.status(200).json({
      ok: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to load catering orders."
    });
  }
}
