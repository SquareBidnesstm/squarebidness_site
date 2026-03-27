// /api/puffs/orders/index.js
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

function normalizeOrder(order) {
  if (!order || typeof order !== "object") return null;

  return {
    orderNumber: String(order.orderNumber || ""),
    createdAt: order.createdAt || "",
    paidAt: order.paidAt || "",
    pickupTime: String(order.pickupTime || "ASAP"),
    customerName: String(order.customerName || ""),
    customerPhone: String(order.customerPhone || ""),
    notes: String(order.notes || ""),
    status: String(order.status || "new").toLowerCase(),
    paymentStatus: String(order.paymentStatus || ""),
    menuDay: String(order.menuDay || ""),
    subtotal: Number(order.subtotal || 0),
    tax: Number(order.tax || 0),
    total: Number(order.total || 0),
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          id: String(item.id || ""),
          name: String(item.name || ""),
          qty: Math.max(0, Number(item.qty || 0)),
          price: Number(item.price || 0),
          section: String(item.section || ""),
          day: String(item.day || "")
        }))
      : []
  };
}

async function redisGetList(redisUrl, redisToken, key, start = 0, stop = 49) {
  const url = `${redisUrl}/lrange/${encodeURIComponent(key)}/${start}/${stop}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Redis request failed (${res.status})`);
  }

  return Array.isArray(data.result) ? data.result : [];
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

  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const ORDERS_KEY = "puffs:orders";

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Missing Upstash Redis env vars."
    });
  }

  try {
    const rawOrders = await redisGetList(REDIS_URL, REDIS_TOKEN, ORDERS_KEY, 0, 49);

    const orders = rawOrders
      .map((entry) => safeJsonParse(entry))
      .map((order) => normalizeOrder(order))
      .filter(Boolean);

    return res.status(200).json({
      ok: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to load orders."
    });
  }
}
