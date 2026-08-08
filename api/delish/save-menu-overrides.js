// FILE: /api/delish/save-menu-overrides.js
import { Redis } from "@upstash/redis";
import {
  getCentralDateKey,
  getDelishMenuOverrides,
} from "../_lib/delish-menu-overrides.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

function normalizeItemsOff(itemsOff) {
  if (!Array.isArray(itemsOff)) return [];
  return [...new Set(itemsOff.map((x) => String(x || "").trim()).filter(Boolean))];
}

function normalizeItemsSoldOut(itemsSoldOut) {
  if (!Array.isArray(itemsSoldOut)) return [];
  return [...new Set(itemsSoldOut.map((x) => String(x || "").trim()).filter(Boolean))];
}

function normalizeBasesSoldOut(basesSoldOut) {
  if (!Array.isArray(basesSoldOut)) return [];
  return [...new Set(basesSoldOut.map((x) => String(x || "").trim()).filter(Boolean))];
}

function normalizeSpecialMenu(specialMenu = {}) {
  const active = specialMenu?.active === true;
  const rawItems = Array.isArray(specialMenu?.items) ? specialMenu.items : [];
  const items = rawItems
    .map((item, i) => {
      const p = Number(item?.price);
      return {
        id: `special_${i}`,
        name: String(item?.name || "").trim().slice(0, 80),
        price: Number.isFinite(p) && p >= 0 ? Math.round(p * 100) / 100 : 0,
        baseOptions: [],
        sideSelectionRequired: false,
        desc: "Today's special.",
      };
    })
    .filter(item => item.name && item.price > 0);
  return { active, items };
}

function normalizeDessertItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, i) => {
      const p = Number(item?.price);
      return {
        id: `override_dessert_${i}`,
        name: String(item?.name || "").trim().slice(0, 80),
        price: Number.isFinite(p) && p >= 0 ? Math.round(p * 100) / 100 : 0,
      };
    })
    .filter(item => item.name && item.price > 0);
}

function normalizeFridayMenu(fridayMenu = {}) {
  const active = fridayMenu?.active === true;
  const rawItems = Array.isArray(fridayMenu?.items) ? fridayMenu.items : [];
  const items = rawItems
    .map((item, i) => {
      const p = Number(item?.price);
      return {
        id: `friday_override_${i}`,
        name: String(item?.name || "").trim().slice(0, 80),
        price: Number.isFinite(p) && p >= 0 ? Math.round(p * 100) / 100 : 0,
        desc: "Choose 2 sides.",
        baseOptions: [],
      };
    })
    .filter(item => item.name && item.price > 0);
  return { active, items, updatedAt: new Date().toISOString() };
}

function normalizeLimitedMenu(limitedMenu = {}) {
  const active = limitedMenu?.active === true;
  const price = Number(limitedMenu?.price);

  return {
    active,
    itemId: String(limitedMenu?.itemId || "friday_fried_catfish").trim() || "friday_fried_catfish",
    name: String(limitedMenu?.name || "Catfish").trim().slice(0, 80) || "Catfish",
    price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : 12.99,
    desc: String(limitedMenu?.desc || "Served with Potato Salad, Green Beans, and a roll.").trim().slice(0, 180),
    hideSides: limitedMenu?.hideSides !== false,
    blockExtraSides: limitedMenu?.blockExtraSides !== false,
    blockLagniappe: limitedMenu?.blockLagniappe !== false,
  };
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
    const itemsOff = normalizeItemsOff(body.itemsOff);
    const itemsSoldOut = normalizeItemsSoldOut(body.itemsSoldOut);
    const basesSoldOut = normalizeBasesSoldOut(body.basesSoldOut);
    const limitedMenu = normalizeLimitedMenu(body.limitedMenu);
    const specialMenu = normalizeSpecialMenu(body.specialMenu);
    const dessertItems = normalizeDessertItems(body.dessertItems);
    const fridayMenu = body.fridayMenu !== undefined
      ? normalizeFridayMenu(body.fridayMenu)
      : (current.fridayMenu || { active: false, items: [], updatedAt: "" });

    const next = {
      ...current,
      sections: {
        lagniappe: body?.sections?.lagniappe !== false,
        drinks: body?.sections?.drinks !== false,
        extraSides: body?.sections?.extraSides !== false,
        desserts: body?.sections?.desserts !== false,
      },
      sectionsDate: getCentralDateKey(),
      itemsOff,
      itemsOffDate: getCentralDateKey(),
      itemsSoldOut,
      itemsSoldOutDate: getCentralDateKey(),
      basesSoldOut,
      basesSoldOutDate: getCentralDateKey(),
      limitedMenu,
      limitedMenuDate: getCentralDateKey(),
      specialMenu,
      specialMenuDate: getCentralDateKey(),
      fridayMenu,
      dessertItems,
      dessertItemsDate: getCentralDateKey(),
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
