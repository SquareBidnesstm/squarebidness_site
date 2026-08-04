// FILE: /api/delish/closed-days.js
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
    const raw = await redis.get("delish:closed:days");
    const days = Array.isArray(raw) ? raw.filter(d => typeof d === "string") : [];
    return res.status(200).json({ ok: true, closedDays: days });
  } catch (error) {
    console.error("DELISH CLOSED DAYS GET ERROR:", error);
    return res.status(500).json({ ok: false, error: "Failed to load closed days." });
  }
}
