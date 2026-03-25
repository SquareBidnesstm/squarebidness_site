// FILE: /api/delish/catering-orders.js
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

    // Get latest 50 catering request IDs
    const ids = await redis.lrange("delish:catering:list", 0, 49);

    if (!ids || !ids.length) {
      return res.status(200).json({ ok: true, orders: [] });
    }

    const keys = ids.map((id) => `delish:catering:${id}`);
    const records = await redis.mget(...keys);

    // Filter out anything "completed" (future use)
    const active = (records || [])
      .filter(Boolean)
      .filter((r) => r.status !== "completed");

    return res.status(200).json({
      ok: true,
      orders: active,
    });
  } catch (error) {
    console.error("GET /api/delish/catering-orders error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load catering orders.",
    });
  }
}
