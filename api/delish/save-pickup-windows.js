// FILE: /api/delish/save-pickup-windows.js
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

function getToken(req) {
  return (
    req.headers["x-operator-token"] ||
    req.headers["x-delish-operator-token"] ||
    ""
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const expectedToken = process.env.DELISH_OPERATOR_TOKEN || "";
    const token = String(getToken(req) || "").trim();

    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const disabledWindows = Array.isArray(body.disabledWindows)
      ? body.disabledWindows
      : [];

    const cleanDisabled = disabledWindows
      .map(value => String(value || "").trim())
      .filter(value => DEFAULT_PICKUP_WINDOWS.includes(value));

    await redis.set(PICKUP_WINDOWS_KEY, cleanDisabled);

    return res.status(200).json({
      ok: true,
      disabledWindows: cleanDisabled,
    });
  } catch (error) {
    console.error("POST /api/delish/save-pickup-windows error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to save pickup windows.",
    });
  }
}
