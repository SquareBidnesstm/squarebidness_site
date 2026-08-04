// FILE: /api/delish/save-closed-days.js
import { Redis } from "@upstash/redis";
import { requireDelishOperatorAuth } from "../_lib/delish-operator-auth.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!requireDelishOperatorAuth(req, res)) return;

  try {
    const { closedDays } = req.body || {};

    if (!Array.isArray(closedDays)) {
      return res.status(400).json({ ok: false, error: "closedDays must be an array." });
    }

    const clean = [...new Set(
      closedDays
        .map(d => String(d || "").trim())
        .filter(d => ISO_DATE_RE.test(d))
    )].sort();

    await redis.set("delish:closed:days", clean);

    return res.status(200).json({ ok: true, closedDays: clean });
  } catch (error) {
    console.error("DELISH CLOSED DAYS SAVE ERROR:", error);
    return res.status(500).json({ ok: false, error: "Failed to save closed days." });
  }
}
