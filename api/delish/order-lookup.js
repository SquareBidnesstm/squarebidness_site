// FILE: /api/delish/order-lookup.js
import { Redis } from "@upstash/redis";
import { requireDelishRefundAuth } from "../_lib/delish-operator-auth.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const ORDER_LIST_KEY = "delish:orders:list";
const RECENT_ORDERS_TO_SCAN = 300;

function detectQueryType(q) {
  if (/^DL-\d{6}-\d+/i.test(q)) return "order";
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 10) return "phone";
  return "name";
}

function lastTenDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.slice(-10);
}

function matchesQuery(order, q, type) {
  if (type === "order") {
    return String(order.orderNumber || "").toUpperCase() === q.toUpperCase();
  }
  if (type === "phone") {
    return lastTenDigits(order.customerPhone) === lastTenDigits(q);
  }
  return String(order.customerName || "")
    .toLowerCase()
    .includes(q.toLowerCase());
}

function formatOrder(order) {
  const orderNumber = order.orderNumber || "";
  const total = `$${Number(order.total || 0).toFixed(2)}`;

  const createdDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return {
    orderId: order.id,
    sessionId: order.stripeSessionId || "",
    orderNumber,
    customerName: order.customerName || "",
    customerPhone: order.customerPhone || "",
    pickupDate: order.pickupDate || "",
    pickupWindow: order.pickupWindow || "",
    total,
    createdDate,
    status: order.status || order.orderState || "",
    refunded: order.status === "refunded" || order.paymentStatus === "refunded",
    receiptUrl: orderNumber ? `/delish/receipt/${orderNumber}/` : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!requireDelishRefundAuth(req, res)) return;

  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.status(400).json({
      ok: false,
      error: "Query too short. Enter a name, phone number, or order number.",
    });
  }

  const type = detectQueryType(q);

  try {
    const ids = await redis.lrange(ORDER_LIST_KEY, 0, RECENT_ORDERS_TO_SCAN - 1);

    if (!ids.length) {
      return res.status(200).json({ ok: true, results: [], query: q, type });
    }

    const keys = ids.map((id) => `delish:order:${id}`);
    const orders = await redis.mget(...keys);

    const results = orders
      .filter(Boolean)
      .filter((order) => matchesQuery(order, q, type))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 20)
      .map(formatOrder);

    return res.status(200).json({ ok: true, results, query: q, type });
  } catch (err) {
    console.error("DELISH ORDER LOOKUP ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
