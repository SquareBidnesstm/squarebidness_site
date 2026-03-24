// FILE: /api/delish/complete-order.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const { id } = req.body || {};

    if (!id || typeof id !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing order id.",
      });
    }

    const key = `delish:order:${id}`;
    const existing = await redis.get(key);

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: "Order not found.",
      });
    }

    const updated = {
      ...existing,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    await redis.set(key, updated);

    return res.status(200).json({
      ok: true,
      id,
      status: "completed",
    });
  } catch (error) {
    console.error("POST /api/delish/complete-order error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to complete order.",
    });
  }
}
