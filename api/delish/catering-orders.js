// FILE: /api/delish/catering-orders.js
import { Redis } from "@upstash/redis";
import { requireDelishOperatorAuth } from "../_lib/delish-operator-auth.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const ACTIVE_STATUSES = new Set([
  "new_request",
  "awaiting_sms_confirmation",
  "verified",
  "deposit_sent",
  "deposit_paid",
]);

const ARCHIVE_STATUSES = new Set(["cleared", "completed"]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!requireDelishOperatorAuth(req, res)) return;

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

    const view = String(req.query?.view || "active").toLowerCase();
    const orders = (records || []).filter(Boolean);
    const filtered =
      view === "cleared"
        ? orders.filter((r) => ARCHIVE_STATUSES.has(r.status))
        : orders.filter((r) => ACTIVE_STATUSES.has(r.status));

    return res.status(200).json({
      ok: true,
      view,
      orders: filtered,
    });
  } catch (error) {
    console.error("GET /api/delish/catering-orders error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load catering orders.",
    });
  }
}
