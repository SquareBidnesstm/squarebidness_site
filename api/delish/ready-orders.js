// FILE: /api/delish/ready-orders.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

function getCentralDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    isoDate: `${map.year}-${map.month}-${map.day}`,
  };
}

function normalizeOrder(order) {
  if (!order || typeof order !== "object") return null;

  return {
    id: String(order.id || ""),
    orderNumber: String(order.orderNumber || ""),
    customerName: String(order.customerName || ""),
    pickupDate: String(order.pickupDate || ""),
    pickupWindow: String(order.pickupWindow || ""),
    status: String(order.status || ""),
    createdAt: String(order.createdAt || ""),
    completedAt: String(order.completedAt || ""),
    total: Number(order.total || 0),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const todayIso = getCentralDateParts().isoDate;

    const ids = await redis.lrange("delish:orders:list", 0, 200);
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];

    if (!uniqueIds.length) {
      return res.status(200).json({
        ok: true,
        readyOrders: [],
        date: todayIso,
      });
    }

    const keys = uniqueIds.map((id) => `delish:order:${id}`);
    const rawOrders = await redis.mget(...keys);

    const readyOrders = (rawOrders || [])
      .map(normalizeOrder)
      .filter(Boolean)
      .filter((order) => order.pickupDate === todayIso)
      .filter((order) => order.status === "completed")
      .sort((a, b) => {
        const aTime = new Date(a.completedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.completedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

    return res.status(200).json({
      ok: true,
      readyOrders,
      date: todayIso,
    });
  } catch (error) {
    console.error("DELISH READY ORDERS ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to load ready orders.",
    });
  }
}
