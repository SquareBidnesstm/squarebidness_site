// FILE: /api/delish/pickup-windows.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const PICKUP_WINDOWS_KEY = "delish:pickup:disabled_windows";

const DEFAULT_PICKUP_WINDOWS = [
  "11:00 AM - 11:30 AM",
  "11:30 AM - 12:00 PM",
  "12:00 PM - 12:30 PM",
  "12:30 PM - 1:00 PM",
  "1:00 PM - 1:30 PM",
  "1:30 PM - 2:00 PM",
  "2:00 PM - 2:30 PM",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const disabled = await redis.get(PICKUP_WINDOWS_KEY);

    return res.status(200).json({
      ok: true,
      windows: DEFAULT_PICKUP_WINDOWS,
      disabledWindows: Array.isArray(disabled) ? disabled : [],
    });
  } catch (error) {
    console.error("GET /api/delish/pickup-windows error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load pickup windows.",
    });
  }
}
