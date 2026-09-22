import { Redis } from "@upstash/redis";
import { getDelishMenuOverrides } from "../_lib/delish-menu-overrides.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const VALID_DAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "sunday"]);
const VALID_BASES = new Set(["rice_mashed", "rice_dressing", "dressing_mashed", null]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const token = String(req.headers["x-operator-token"] || "").trim();
    const expected = String(process.env.DELISH_OPERATOR_TOKEN || "").trim();

    if (!expected) return res.status(503).json({ ok: false, error: "DELISH_OPERATOR_TOKEN not configured." });
    if (!token || token !== expected) return res.status(401).json({ ok: false, error: "Unauthorized." });

    const body = req.body || {};
    const day = String(body.day || "").toLowerCase().trim();
    const base = body.base === null ? null : String(body.base || "").trim();

    if (!VALID_DAYS.has(day)) return res.status(400).json({ ok: false, error: "Invalid day." });
    if (!VALID_BASES.has(base)) return res.status(400).json({ ok: false, error: "Invalid base value." });

    const current = await getDelishMenuOverrides();
    const dayBase = { ...(current.dayBase || {}), [day]: base };

    await redis.set("delish:menu:overrides", {
      ...current,
      dayBase,
      updatedAt: new Date().toISOString(),
      updatedBy: "operator",
    });

    return res.status(200).json({ ok: true, day, base });
  } catch (error) {
    console.error("DELISH SAVE-DAY-BASE ERROR:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Failed to save." });
  }
}
