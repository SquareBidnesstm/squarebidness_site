// FILE: /api/delish-orders.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    if (
      !process.env.DELISH_UPSTASH_REDIS_REST_URL ||
      !process.env.DELISH_UPSTASH_REDIS_REST_TOKEN
    ) {
      return res.status(500).json({
        ok: false,
        error: "Missing Delish Redis environment variables.",
      });
    }

    const ids = await redis.lrange("delish:orders:list", 0, 49);

    if (!ids || !ids.length) {
      return res.status(200).json({ ok: true, orders: [] });
    }

    const orderKeys = ids.map((id) => `delish:order:${id}`);
    const orders = await redis.mget(...orderKeys);

    const cleanOrders = (orders || [])
      .filter(Boolean)
      .filter((order) => order.status !== "completed");

    return res.status(200).json({
      ok: true,
      orders: cleanOrders,
    });
  } catch (error) {
    console.error("GET /api/delish-orders error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load orders.",
    });
  }
}
