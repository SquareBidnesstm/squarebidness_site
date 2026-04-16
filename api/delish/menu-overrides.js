// FILE: /api/delish/menu-overrides.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const DEFAULT_OVERRIDES = {
  sections: {
    lagniappe: true,
    drinks: true,
    extraSides: true,
  },
  itemsOff: [],
  customerMessage: "",
  updatedAt: "",
  updatedBy: "system",
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const saved = await redis.get("delish:menu:overrides");
    const overrides = saved && typeof saved === "object"
      ? {
          ...DEFAULT_OVERRIDES,
          ...saved,
          sections: {
            ...DEFAULT_OVERRIDES.sections,
            ...(saved.sections || {}),
          },
          itemsOff: Array.isArray(saved.itemsOff) ? saved.itemsOff : [],
        }
      : DEFAULT_OVERRIDES;

    return res.status(200).json({
      ok: true,
      overrides,
    });
  } catch (error) {
    console.error("DELISH MENU OVERRIDES GET ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to load menu overrides.",
    });
  }
}
