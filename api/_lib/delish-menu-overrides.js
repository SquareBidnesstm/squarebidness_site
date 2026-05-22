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
  sectionsDate: "",
  itemsOff: [],
  itemsOffDate: "",
  itemsSoldOut: [],
  itemsSoldOutDate: "",
  basesSoldOut: [],
  basesSoldOutDate: "",
  limitedMenu: {
    active: false,
    itemId: "friday_fried_catfish",
    name: "Catfish",
    price: 12.99,
    desc: "Served with Potato Salad, Green Beans, and a roll.",
    hideSides: true,
    blockExtraSides: true,
    blockLagniappe: true,
  },
  limitedMenuDate: "",
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
  const sectionsDate = String(saved.sectionsDate || "");
  const savedSections =
    sectionsDate === todayKey && saved.sections && typeof saved.sections === "object"
      ? saved.sections
      : {};
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
  const basesSoldOutDate = String(saved.basesSoldOutDate || "");
  const basesSoldOut =
    basesSoldOutDate === todayKey && Array.isArray(saved.basesSoldOut)
      ? saved.basesSoldOut
      : [];
  const limitedMenuDate = String(saved.limitedMenuDate || "");
  const savedLimitedMenu =
    limitedMenuDate === todayKey && saved.limitedMenu && typeof saved.limitedMenu === "object"
      ? saved.limitedMenu
      : {};

  return {
    ...DEFAULT_DELISH_MENU_OVERRIDES,
    ...saved,
    sections: {
      ...DEFAULT_DELISH_MENU_OVERRIDES.sections,
      ...savedSections,
    },
    sectionsDate: Object.keys(savedSections).length ? sectionsDate : todayKey,
    itemsOff,
    itemsOffDate: itemsOff.length ? offDate : todayKey,
    itemsSoldOut,
    itemsSoldOutDate: itemsSoldOut.length ? soldOutDate : todayKey,
    basesSoldOut,
    basesSoldOutDate: basesSoldOut.length ? basesSoldOutDate : todayKey,
    limitedMenu: {
      ...DEFAULT_DELISH_MENU_OVERRIDES.limitedMenu,
      ...savedLimitedMenu,
      active: savedLimitedMenu.active === true,
    },
    limitedMenuDate: Object.keys(savedLimitedMenu).length ? limitedMenuDate : todayKey,
  };
}
