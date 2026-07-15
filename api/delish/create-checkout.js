// FILE: /api/delish/create-checkout.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";
import { getDelishOrderingState } from "../_lib/delish-ordering-config.js";
import { getDelishMenuOverrides } from "../_lib/delish-menu-overrides.js";
import {
  getDisabledPickupWindows,
  isAllowedPickupWindow,
} from "../_lib/delish-pickup-windows.js";
import { getDelishFlashSale, isFlashSaleActive } from "../_lib/delish-flash-sale.js";

const stripe = new Stripe(process.env.DELISH_STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const PENDING_ORDER_TTL_SECONDS = 60 * 60 * 24;

const MENU_BY_DAY = {
  monday: [
    {
      id: "monday_red_beans_fried_chicken",
      name: "Red Beans with Fried Chicken",
      price: 13.99,
    },
    {
      id: "monday_okra_fried_chicken",
      name: "Okra with Fried Chicken",
      price: 13.99,
    },
    {
      id: "monday_hamburger_steak",
      name: "Hamburger Steak Plate",
      price: 13.99,
    },
  ],
  tuesday: [
    {
      id: "tuesday_beef_tips",
      name: "Beef Tips Plate",
      price: 13.99,
    },
    {
      id: "tuesday_meatloaf",
      name: "Meatloaf Plate",
      price: 13.99,
    },
  ],
  wednesday: [
    {
      id: "wednesday_pork_neckbones",
      name: "Pork Neckbones Plate",
      price: 10.0,
    },
    {
      id: "wednesday_baked_chicken",
      name: "Baked Chicken Plate",
      price: 10.0,
    },
    {
      id: "wednesday_country_fried_steak",
      name: "Country Fried Steak Plate",
      price: 10.0,
    },
  ],
  thursday: [
    {
      id: "thursday_turkey_wings",
      name: "Turkey Wings Plate",
      price: 16.99,
    },
  ],
  friday: [
    {
      id: "friday_crawfish_etouffee",
      name: "Crawfish Étouffée Plate",
      price: 16.99,
    },
    {
      id: "friday_shrimp_pasta",
      name: "Shrimp Pasta Plate",
      price: 16.99,
    },
    {
      id: "friday_fried_catfish",
      name: "Fried Catfish Plate (3 strips)",
      price: 15.99,
    },
    {
      id: "friday_baked_catfish",
      name: "Baked Catfish Plate",
      price: 16.99,
    },
  ],
  sunday: [
    {
      id: "sunday_pork_steak_gravy",
      name: "Pork Steak and Gravy Plate",
      price: 15.99,
    },
    {
      id: "sunday_oxtails",
      name: "Oxtails Plate",
      price: 24.99,
    },
    {
      id: "sunday_baked_chicken",
      name: "Baked Chicken Plate",
      price: 13.99,
    },
  ],
  everyday: [
    {
      id: "drink_tropical_punch_koolaid",
      name: "Tropical Punch Kool-Aid",
      price: 3.99,
    },
    {
      id: "drink_lemonade",
      name: "Lemonade",
      price: 3.99,
    },
    {
      id: "drink_can_soda",
      name: "Can Soda",
      price: 1.5,
    },
    {
      id: "drink_bottle_water",
      name: "Bottle Water",
      price: 1.5,
    },
    {
      id: "lagniappe_grilled_chicken_salad",
      name: "Lagniappe Grilled Chicken Salad",
      price: 12.99,
    },
    {
      id: "lagniappe_grilled_shrimp_salad",
      name: "Lagniappe Grilled Shrimp Salad",
      price: 12.99,
    },
    {
      id: "lagniappe_both_meat_salad",
      name: "Lagniappe Both Meat Salad",
      price: 16.99,
    },
    {
      id: "lagniappe_chicken_tender_basket_fries",
      name: "Lagniappe Chicken Tender Basket with Fries",
      price: 9.99,
    },
    {
      id: "lagniappe_fried_porkchop_sandwich_fries",
      name: "Lagniappe Fried Porkchop Sandwich with Fries",
      price: 9.99,
    },
    {
      id: "lagniappe_cheeseburger_basket",
      name: "Lagniappe Cheeseburger Basket",
      price: 9.99,
    },
    {
      id: "extra_side_mac_and_cheese",
      name: "Extra Side - Mac and Cheese",
      price: 2.5,
    },
    {
      id: "extra_side_yams",
      name: "Extra Side - Yams",
      price: 2.5,
    },
    {
      id: "extra_side_corn",
      name: "Extra Side - Corn",
      price: 2.5,
    },
    {
      id: "extra_side_cabbage",
      name: "Extra Side - Cabbage",
      price: 2.5,
    },
    {
      id: "extra_side_green_salad",
      name: "Extra Side - Green Salad",
      price: 2.5,
    },
    {
      id: "extra_side_black_eyed_peas",
      name: "Extra Side - Black Eyed Peas",
      price: 2.5,
    },
    {
      id: "extra_side_green_beans",
      name: "Extra Side - Green Beans",
      price: 2.5,
    },
    {
      id: "extra_side_potato_salad",
      name: "Extra Side - Potato Salad",
      price: 2.5,
    },
    {
      id: "extra_side_rice_dressing",
      name: "Extra Side - Rice Dressing",
      price: 2.5,
    },
  ],
};

const FRIDAY_ONLY_ITEM_IDS = new Set([
  "extra_side_potato_salad",
  "extra_side_rice_dressing",
]);

function isValidOrder(body) {
  return (
    body &&
    typeof body.customerName === "string" &&
    typeof body.customerPhone === "string" &&
    typeof body.pickupDate === "string" &&
    typeof body.pickupWindow === "string" &&
    Array.isArray(body.items) &&
    body.items.length > 0 &&
    typeof body.total === "number"
  );
}

function getCentralDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const parts = formatter.formatToParts(date);
  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const dayOfMonth = Number(map.day || 0);

  return {
    isoDate: `${map.year}-${map.month}-${map.day}`,
    weekday: String(map.weekday || "").toLowerCase(),
    dayOfMonth,
    sundayOccurrence: dayOfMonth ? Math.ceil(dayOfMonth / 7) : 0,
  };
}

function getLimitedMenuOverride(overrides = {}) {
  const limitedMenu = overrides?.limitedMenu;
  return limitedMenu?.active === true ? limitedMenu : null;
}

function buildLimitedMenuItem(limitedMenu = {}) {
  return {
    id: String(limitedMenu.itemId || "friday_fried_catfish").trim() || "friday_fried_catfish",
    name: String(limitedMenu.name || "Catfish").trim() || "Catfish",
    price: Number.isFinite(Number(limitedMenu.price)) ? Number(limitedMenu.price) : 12.99,
  };
}

function getAllowedItemsForToday(todayDay, overrides = {}) {
  const limitedMenu = getLimitedMenuOverride(overrides);
  if (limitedMenu) {
    const drinkItems = (MENU_BY_DAY.everyday || []).filter((item) =>
      String(item.id || "").startsWith("drink_")
    );
    return [buildLimitedMenuItem(limitedMenu), ...drinkItems];
  }

  const dayItems = MENU_BY_DAY[todayDay] || [];
  const everydayItems = MENU_BY_DAY.everyday || [];
  return [...dayItems, ...everydayItems];
}

function buildAllowedMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function buildFlashSaleMap(flashSale) {
  if (!isFlashSaleActive(flashSale)) return new Map();

  return new Map(
    (flashSale.items || []).map((item) => [
      item.flashId,
      {
        id: item.flashId,
        sourceId: item.sourceId,
        name: `SPECIAL - ${item.name}`,
        price: item.price,
        limit: item.limit,
        flashSale: true,
      },
    ])
  );
}

function isItemAllowedForCurrentDay(itemId, todayDay) {
  if (FRIDAY_ONLY_ITEM_IDS.has(itemId)) {
    return todayDay === "friday";
  }
  return true;
}

function isSectionEnabledBackend(itemId, overrides = {}) {
  const sections = overrides?.sections || {};

  if (String(itemId).startsWith("drink_")) return sections.drinks !== false;
  if (String(itemId).startsWith("lagniappe_")) return sections.lagniappe !== false;
  if (String(itemId).startsWith("extra_side_")) return sections.extraSides !== false;

  return true;
}

function isItemEnabledBackend(itemId, overrides = {}) {
  const itemsOff = Array.isArray(overrides?.itemsOff) ? overrides.itemsOff : [];
  return !itemsOff.includes(itemId);
}

function isItemSoldOutBackend(itemId, overrides = {}) {
  const itemsSoldOut = Array.isArray(overrides?.itemsSoldOut)
    ? overrides.itemsSoldOut
    : [];
  return itemsSoldOut.includes(itemId);
}

function isBaseSoldOutBackend(baseId, overrides = {}) {
  const basesSoldOut = Array.isArray(overrides?.basesSoldOut)
    ? overrides.basesSoldOut
    : [];
  return basesSoldOut.includes(baseId);
}

function buildShortOrderSummary(items = []) {
  return items
    .map((item) => `${item.qty}x ${item.name}`)
    .join(", ")
    .slice(0, 500);
}

function duplicateItemKey(item = {}) {
  return [
    item.id,
    item.baseId,
    item.baseName,
    item.side1Id,
    item.side1Name,
    item.side2Id,
    item.side2Name,
  ]
    .map((value) => String(value || "").trim())
    .join("|");
}

function aggregateDuplicateItems(items = []) {
  const itemMap = new Map();

  for (const item of items) {
    const key = duplicateItemKey(item);
    const qty = Math.max(1, Number(item?.qty || 1));
    const existing = itemMap.get(key);

    if (existing) {
      existing.qty += qty;
    } else {
      itemMap.set(key, {
        ...item,
        qty,
      });
    }
  }

  return Array.from(itemMap.values());
}

function safeMeta(value, max = 500) {
  return String(value || "").slice(0, max);
}

function normalizeOrderingMode(value) {
  const mode = String(value || "").toLowerCase().trim();
  if (["auto", "open", "paused", "closed"].includes(mode)) return mode;
  return "";
}

async function redisGet(redisUrl, redisToken, key) {
  const url = `${redisUrl.replace(/\/$/, "")}/get/${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${redisToken}`,
    },
  });

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  return data?.result ?? null;
}

async function getEffectiveOrderingState() {
  const fallbackState = getDelishOrderingState();
  if (fallbackState.reason === "temporary_closure") {
    return fallbackState;
  }

  const redisUrl = process.env.DELISH_UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return fallbackState;
  }

  const [modeRes, resumeRes, messageRes, closedDateRes] = await Promise.all([
    redisGet(redisUrl, redisToken, "delish:ordering:mode"),
    redisGet(redisUrl, redisToken, "delish:ordering:resume_at"),
    redisGet(redisUrl, redisToken, "delish:ordering:message"),
    redisGet(redisUrl, redisToken, "delish:ordering:closed_date"),
  ]);

  const redisMode = normalizeOrderingMode(modeRes);
  const resumeAt = typeof resumeRes === "string" ? resumeRes : "";
  const message = typeof messageRes === "string" ? messageRes : "";
  const closedDate = typeof closedDateRes === "string" ? closedDateRes : "";

  if (!redisMode || redisMode === "auto") {
    return fallbackState;
  }

  if (redisMode === "open") {
    return {
      ...fallbackState,
      mode: "open",
      orderingMode: "open",
      openNow: true,
      reason: "manual_open",
      message: "",
    };
  }

  if (redisMode === "closed") {
    if (closedDate !== fallbackState.now?.isoDate) {
      return fallbackState;
    }

    return {
      ...fallbackState,
      mode: "closed",
      orderingMode: "closed",
      openNow: false,
      reason: "manual_closed",
      closedDate,
      message: message || "Online ordering is closed for today.",
    };
  }

  if (redisMode === "paused") {
    const resumeDate = resumeAt ? new Date(resumeAt) : null;
    const resumeValid = resumeDate && !Number.isNaN(resumeDate.getTime());

    if (resumeValid && Date.now() >= resumeDate.getTime()) {
      return fallbackState;
    }

    return {
      ...fallbackState,
      mode: "paused",
      orderingMode: "paused",
      openNow: false,
      reason: "manual_closed",
      resumeAt,
      message:
        message ||
        "We’re serving current orders now. Online ordering will reopen shortly.",
    };
  }

  return fallbackState;
}

function isBeforeServiceOpen(state) {
  if (!state || state.reason !== "outside_service_window") return false;

  const now = state.now || {};
  const currentMinutes = (Number(now.hour || 0) * 60) + Number(now.minute || 0);
  const openMinutes = parsePickupTimeToMinutes(state.openTime);

  return Number.isFinite(openMinutes) && currentMinutes < openMinutes;
}

function parsePickupTimeToMinutes(value) {
  const raw = String(value || "").trim().toUpperCase();

  let match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3];

    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;

    return (hour * 60) + minute;
  }

  match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return (Number(match[1]) * 60) + Number(match[2]);
  }

  return NaN;
}

// ------------------------------------------------------------
// FIX 6 — makeRecordId: use Central Time, not server local time
// Replace the entire makeRecordId function
// ------------------------------------------------------------
 
function makeRecordId() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
 
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
 
  const y = String(map.year || "").slice(-2);
  const m = map.month || "00";
  const d = map.day || "00";
  const rand = Math.floor(1000 + Math.random() * 9000);
 
  return `DL-${y}${m}${d}-${rand}`;
}


export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    if (!process.env.DELISH_STRIPE_SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing DELISH_STRIPE_SECRET_KEY.",
      });
    }

    if (
      !process.env.DELISH_UPSTASH_REDIS_REST_URL ||
      !process.env.DELISH_UPSTASH_REDIS_REST_TOKEN
    ) {
      return res.status(500).json({
        ok: false,
        error: "Missing Delish Redis configuration.",
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    if (!isValidOrder(body)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid order payload.",
      });
    }

    const orderingState = await getEffectiveOrderingState();
    const todayIso = orderingState.now.isoDate;
    const todayDay = orderingState.today;
    const menuOverrides = await getDelishMenuOverrides();
    const flashSale = await getDelishFlashSale();
    const flashSaleMap = buildFlashSaleMap(flashSale);
    const requestedItems = aggregateDuplicateItems(body.items);
    const requestedItemIds = requestedItems.map((item) => String(item.id || "").trim());
    const isFlashSaleOrder =
      flashSaleMap.size > 0 &&
      requestedItemIds.length > 0 &&
      requestedItemIds.every((id) => flashSaleMap.has(id));

    if (!orderingState.openNow && !isFlashSaleOrder) {
      let message = orderingState.message || "Online ordering is closed right now.";

      if (orderingState.reason === "manual_closed") {
        message = orderingState.orderingMode === "closed"
          ? "Online ordering is closed today."
          : "Online ordering is currently paused.";
      } else if (orderingState.reason === "outside_service_window") {
        message = `Ordering is available from ${orderingState.openTime} to ${orderingState.closeTime}.`;
      } else if (orderingState.reason === "sunday_not_scheduled") {
        message = "Sunday ordering is only available on 1st and 3rd Sundays.";
      } else if (orderingState.reason === "not_a_service_day") {
        message = "Online ordering is closed today.";
      }

      return res.status(403).json({
        ok: false,
        error: "ORDERING_CLOSED_NOW",
        message,
      });
    }

    if (body.pickupDate !== todayIso) {
      return res.status(403).json({
        ok: false,
        error: "PICKUP_DATE_NOT_ALLOWED",
        message: `Pickup date must be ${todayIso} for the active ${todayDay} menu.`,
      });
    }

    const requestedPickupWindow = String(body.pickupWindow || "").trim();
    const disabledPickupWindows = await getDisabledPickupWindows();

    const flashPickupWindows = Array.isArray(flashSale.pickupWindows)
      ? flashSale.pickupWindows
      : [];

    if (!isAllowedPickupWindow(requestedPickupWindow) && !(isFlashSaleOrder && flashPickupWindows.includes(requestedPickupWindow))) {
      return res.status(400).json({
        ok: false,
        error: "PICKUP_WINDOW_NOT_ALLOWED",
        message: "Please choose a valid pickup window.",
      });
    }

    if (!isFlashSaleOrder && disabledPickupWindows.includes(requestedPickupWindow)) {
      return res.status(403).json({
        ok: false,
        error: "PICKUP_WINDOW_DISABLED",
        message: "That pickup window is no longer available. Please choose another time.",
      });
    }

    const limitedMenu = getLimitedMenuOverride(menuOverrides);
    const limitedMenuItemId = limitedMenu ? buildLimitedMenuItem(limitedMenu).id : "";
    const allowedItems = getAllowedItemsForToday(todayDay, menuOverrides);
    const allowedMap = buildAllowedMap(allowedItems);

    // ------------------------------------------------------------
// FIX 5 — Add baseId and baseName to cleanItems
// Replace the return block inside the .map() in cleanItems
// ------------------------------------------------------------
 
    const cleanItems = requestedItems
      .map((item) => {
        const id = String(item.id || "").trim();
        const rawQty = Math.max(1, Number(item.qty || 1));
 
        const isFlashItem = flashSaleMap.has(id);
        if (!id || (!allowedMap.has(id) && !isFlashItem)) return null;
        if (!isFlashItem && !isItemAllowedForCurrentDay(id, todayDay)) return null;
        if (!isFlashItem && !isSectionEnabledBackend(id, menuOverrides)) return null;

        const allowed = isFlashItem ? flashSaleMap.get(id) : allowedMap.get(id);
        const isLimitedMenuItem = !isFlashItem && limitedMenu && id === limitedMenuItemId;
        if (!isFlashItem && !isLimitedMenuItem && !isItemEnabledBackend(id, menuOverrides)) return null;
        if (!isFlashItem && !isLimitedMenuItem && isItemSoldOutBackend(id, menuOverrides)) return null;
        const maxQty = isFlashItem
          ? Math.max(1, Number(allowed.limit || 20))
          : 3;
        const qty = Math.min(maxQty, rawQty);
        const baseId = isLimitedMenuItem ? "" : String(item.baseId || "").trim();
        if (!isFlashItem && baseId && isBaseSoldOutBackend(baseId, menuOverrides)) return null;
 
        return {
          id: allowed.id,
          sourceId: allowed.sourceId || "",
          name: allowed.name,
          qty,
          price: allowed.price,
          total: qty * allowed.price,
          flashSale: allowed.flashSale === true,
          baseId,       // FIX: was missing
          baseName: isLimitedMenuItem ? "" : item.baseName || "",   // FIX: was missing
          side1Id: isLimitedMenuItem ? "" : item.side1Id || "",
          side2Id: isLimitedMenuItem ? "" : item.side2Id || "",
          side1Name: isLimitedMenuItem ? "" : item.side1Name || "",
          side2Name: isLimitedMenuItem ? "" : item.side2Name || "",
        };
      })
      .filter(Boolean);

    if (!cleanItems.length) {
      return res.status(400).json({
        ok: false,
        error: "NO_VALID_ITEMS_FOR_TODAY",
        message: `No valid items are available for ${todayDay}.`,
      });
    }

    if (cleanItems.length !== requestedItems.length) {
      return res.status(403).json({
        ok: false,
        error: "ITEM_NOT_AVAILABLE",
        message: "One or more selected items are unavailable right now.",
      });
    }

    const calculatedSubtotal = Number(
      cleanItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)
    );

    const TAX_RATE = 0.105;
    const calculatedTax = Number((calculatedSubtotal * TAX_RATE).toFixed(2));
    const calculatedTotal = Number((calculatedSubtotal + calculatedTax).toFixed(2));

    const recordId = makeRecordId();
    const shortOrderSummary = buildShortOrderSummary(cleanItems);

    const lineItems = cleanItems.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: "usd",
        product_data: {
          name: (() => {
            const parts = [item.baseName, item.side1Name, item.side2Name].filter(Boolean);
            return parts.length ? `${item.name} (${parts.join(", ")})` : item.name;
          })(),
          metadata: {
            itemId: item.id,
            activeMenuDay: todayDay,
            brand: "Delish",
            flashSale: item.flashSale ? "yes" : "no",
          },
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
    }));
         

    const taxAmountCents = Math.max(
      0,
      Math.round((calculatedTotal - calculatedSubtotal) * 100)
    );

    if (taxAmountCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: {
            name: "Sales Tax",
          },
          unit_amount: taxAmountCents,
        },
      });
    }

    const pendingOrder = {
      orderNumber: recordId,
      recordId,
      createdAt: new Date().toISOString(),
      status: "pending_payment",
      orderState: "pending_payment",
      orderType: "paid_pickup",
      smsConsent: "yes",
      customerName: safeMeta(body.customerName, 100),
      customerPhone: safeMeta(body.customerPhone, 30),
      customerEmail: safeMeta(body.customerEmail || "", 120),
      pickupDate: safeMeta(body.pickupDate, 20),
      pickupWindow: safeMeta(body.pickupWindow, 40),
      notes: safeMeta(body.notes || body.orderNotes || "", 300),
      items: cleanItems,
      itemCount: cleanItems.length,
      subtotal: calculatedSubtotal,
      tax: calculatedTax,
      total: calculatedTotal,
      source: safeMeta(body.source || "delish-order-page", 50),
      activeMenuDay: safeMeta(todayDay, 20),
      flashSale: isFlashSaleOrder ? "yes" : "no",
    };

    await redis.set(`delish:pending-order:${recordId}`, pendingOrder, {
      ex: PENDING_ORDER_TTL_SECONDS,
    });

    const sharedMetadata = {
      brand: "Delish",
      recordId,
      orderNumber: recordId,
      orderType: "paid_pickup",
      customerName: safeMeta(body.customerName, 100),
      customerPhone: safeMeta(body.customerPhone, 30),
      customerEmail: safeMeta(body.customerEmail || "", 120),
      pickupDate: safeMeta(body.pickupDate, 20),
      pickupWindow: safeMeta(body.pickupWindow, 40),
      notes: safeMeta(body.notes || body.orderNotes || "", 300),
      smsConsent: "yes",
      orderSummary: shortOrderSummary,
      pendingOrderKey: `delish:pending-order:${recordId}`,
      itemCount: String(cleanItems.length),
      subtotal: String(calculatedSubtotal),
      tax: String(calculatedTax),
      total: String(calculatedTotal),
      source: safeMeta(body.source || "delish-order-page", 50),
      activeMenuDay: safeMeta(todayDay, 20),
      flashSale: isFlashSaleOrder ? "yes" : "no",
    };


    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: "https://www.squarebidness.com/delish/order/success/?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://www.squarebidness.com/delish/",
      metadata: sharedMetadata,
      payment_intent_data: {
        metadata: sharedMetadata,
      },
      customer_email: body.customerEmail || undefined,
    });

    await redis.set(
      `delish:pending-order:${recordId}`,
      {
        ...pendingOrder,
        stripeSessionId: session.id,
        stripeCheckoutUrl: session.url || "",
      },
      { ex: PENDING_ORDER_TTL_SECONDS }
    );

    return res.status(200).json({
      ok: true,
      checkout_url: session.url,
      session_id: session.id,
      recordId,
    });
  } catch (error) {
    console.error("DELISH CREATE CHECKOUT ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create checkout session.",
    });
  }
}
