// FILE: /api/delish/save-menu-overrides.js
import { Redis } from "@upstash/redis";
import { getDelishMenuOverrides } from "../_lib/delish-menu-overrides.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

function normalizeItemsOff(itemsOff) {
  if (!Array.isArray(itemsOff)) return [];
  return [...new Set(itemsOff.map((x) => String(x || "").trim()).filter(Boolean))];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const token = String(req.headers["x-operator-token"] || "").trim();
    const expected = String(process.env.DELISH_OPERATOR_TOKEN || "").trim();

    if (!expected) {
      return res.status(503).json({
        ok: false,
        error: "DELISH_OPERATOR_TOKEN is not configured.",
      });
    }

    if (!token || token !== expected) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized.",
      });
    }

    const body = req.body || {};
    const current = await getDelishMenuOverrides();

    const next = {
      ...current,
      sections: {
        lagniappe: body?.sections?.lagniappe !== false,
        drinks: body?.sections?.drinks !== false,
        extraSides: body?.sections?.extraSides !== false,
      },
      itemsOff: normalizeItemsOff(body.itemsOff),
      customerMessage: String(body.customerMessage || "").trim().slice(0, 180),
      updatedAt: new Date().toISOString(),
      updatedBy: "operator",
    };

    await redis.set("delish:menu:overrides", next);

    return res.status(200).json({
      ok: true,
      overrides: next,
    });
  } catch (error) {
    console.error("DELISH MENU OVERRIDES SAVE ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to save menu overrides.",
    });
  }
}
