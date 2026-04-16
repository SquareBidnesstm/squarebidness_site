// FILE: /api/delish/save-menu-overrides.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const OPERATOR_TOKEN = String(process.env.DELISH_OPERATOR_TOKEN || "").trim();

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    if (!OPERATOR_TOKEN) {
      return res.status(503).json({
        ok: false,
        error: "DELISH_OPERATOR_TOKEN is not configured.",
      });
    }

    const token = String(req.headers["x-operator-token"] || "").trim();

    if (!token || token !== OPERATOR_TOKEN) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized.",
      });
    }

    const body = req.body || {};

    const payload = {
      sections: {
        lagniappe: normalizeBoolean(body?.sections?.lagniappe, true),
        drinks: normalizeBoolean(body?.sections?.drinks, true),
        extraSides: normalizeBoolean(body?.sections?.extraSides, true),
      },
      itemsOff: normalizeStringArray(body.itemsOff),
      customerMessage: String(body.customerMessage || "").trim().slice(0, 200),
      updatedAt: new Date().toISOString(),
      updatedBy: "operator",
    };

    await redis.set("delish:menu:overrides", payload);

    return res.status(200).json({
      ok: true,
      overrides: payload,
    });
  } catch (error) {
    console.error("DELISH MENU OVERRIDES SAVE ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to save menu overrides.",
    });
  }
}
