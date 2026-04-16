import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

export const DEFAULT_DELISH_MENU_OVERRIDES = {
  sections: {
    lagniappe: true,
    drinks: true,
    extraSides: true,
  },
  itemsOff: [],
  itemsSoldOut: [],
  customerMessage: "",
  updatedAt: "",
  updatedBy: "system",
};

export async function getDelishMenuOverrides() {
  const saved = await redis.get("delish:menu:overrides");

  if (!saved || typeof saved !== "object") {
    return DEFAULT_DELISH_MENU_OVERRIDES;
  }

  return {
    ...DEFAULT_DELISH_MENU_OVERRIDES,
    ...saved,
    sections: {
      ...DEFAULT_DELISH_MENU_OVERRIDES.sections,
      ...(saved.sections || {}),
    },
    itemsOff: Array.isArray(saved.itemsOff) ? saved.itemsOff : [],
  };

    return {
    ...DEFAULT_DELISH_MENU_OVERRIDES,
    ...saved,
    sections: {
      ...DEFAULT_DELISH_MENU_OVERRIDES.sections,
      ...(saved.sections || {}),
    },
    itemsOff: Array.isArray(saved.itemsOff) ? saved.itemsOff : [],
    itemsSoldOut: Array.isArray(saved.itemsSoldOut) ? saved.itemsSoldOut : [],
  };
}
