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

async function redisGetList(key, start = 0, stop = 49) {
  const result = await redisPost(`/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
  return Array.isArray(result.result) ? result.result : [];
}

async function redisGet(key) {
  const result = await redisPost(`/get/${encodeURIComponent(key)}`);
  if (!result || typeof result.result !== "string") return null;
  return safeJsonParse(result.result);
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
    const rawOrders = await redisGetList(ORDERS_KEY, 0, 49);

    const mergedOrders = [];
    for (const entry of rawOrders) {
      const parsed = safeJsonParse(entry);
      const order = normalizeOrder(parsed);
      if (!order || !order.orderNumber) continue;

      const meta = await redisGet(`puffs:order-meta:${order.orderNumber}`);
      if (meta && typeof meta === "object") {
        order.status = String(meta.status || order.status || "new").toLowerCase();
        order.hidden = meta.hidden === true;
        order.updatedAt = meta.updatedAt || "";
      } else {
        order.hidden = false;
        order.updatedAt = "";
      }

      if (order.hidden !== true) {
        mergedOrders.push(order);
      }
    }

    return res.status(200).json({
      ok: true,
      count: mergedOrders.length,
      orders: mergedOrders
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to load orders."
    });
  }
}
