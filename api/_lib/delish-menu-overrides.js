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
  itemsOffDate: "",
  itemsSoldOut: [],
  itemsSoldOutDate: "",
  customerMessage: "",
  updatedAt: "",
  updatedBy: "system",
};

export function getCentralDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return `${map.year}-${map.month}-${map.day}`;
}

export async function getDelishMenuOverrides() {
  const saved = await redis.get("delish:menu:overrides");
  if (!saved || typeof saved !== "object") {
    return DEFAULT_DELISH_MENU_OVERRIDES;
  }

  const todayKey = getCentralDateKey();
  const offDate = String(saved.itemsOffDate || "");
  const itemsOff =
    offDate === todayKey && Array.isArray(saved.itemsOff)
      ? saved.itemsOff
      : [];
  const soldOutDate = String(saved.itemsSoldOutDate || "");
  const itemsSoldOut =
    soldOutDate === todayKey && Array.isArray(saved.itemsSoldOut)
      ? saved.itemsSoldOut
      : [];

  return {
    ...DEFAULT_DELISH_MENU_OVERRIDES,
    ...saved,
    sections: {
      ...DEFAULT_DELISH_MENU_OVERRIDES.sections,
      ...(saved.sections || {}),
    },
    itemsOff,
    itemsOffDate: itemsOff.length ? offDate : todayKey,
    itemsSoldOut,
    itemsSoldOutDate: itemsSoldOut.length ? soldOutDate : todayKey,
  };
}
