// FILE: /api/delish/create-checkout.js
import Stripe from "stripe";
import { getDelishOrderingState } from "../_lib/delish-ordering-config.js";

const stripe = new Stripe(process.env.DELISH_STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

const MENU_BY_DAY = {
  monday: [
    {
      id: "monday_red_beans_fried_chicken",
      name: "Red Beans or Okra with Fried Chicken",
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



const SUNDAY_ORDERING_OCCURRENCES = new Set([1, 3]);

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

function getAllowedItemsForToday(todayDay) {
  const dayItems = MENU_BY_DAY[todayDay] || [];
  const everydayItems = MENU_BY_DAY.everyday || [];
  return [...dayItems, ...everydayItems];
}

function buildAllowedMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function isItemAllowedForCurrentDay(itemId, todayDay) {
  if (FRIDAY_ONLY_ITEM_IDS.has(itemId)) {
    return todayDay === "friday";
  }
  return true;
}

function buildShortOrderSummary(items = []) {
  return items
    .map((item) => `${item.qty}x ${item.name}`)
    .join(", ")
    .slice(0, 500);
}

function safeMeta(value, max = 500) {
  return String(value || "").slice(0, max);
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

    const successUrl =
      process.env.DELISH_STRIPE_SUCCESS_URL ||
      "https://www.squarebidness.com/delish/order/success/";

    const cancelUrl =
      process.env.DELISH_STRIPE_CANCEL_URL ||
      "https://www.squarebidness.com/delish/order/";

    const body = req.body;

    if (!isValidOrder(body)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid order payload.",
      });
    }

const orderingState = getDelishOrderingState();
const todayIso = orderingState.now.isoDate;
const todayDay = orderingState.today;

if (!orderingState.openNow) {
  let message = "Online ordering is closed right now.";

  if (orderingState.reason === "manual_closed") {
    message = "Online ordering is currently paused.";
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
    message
  });
}
    if (body.pickupDate !== todayIso) {
      return res.status(403).json({
        ok: false,
        error: "PICKUP_DATE_NOT_ALLOWED",
        message: `Pickup date must be ${todayIso} for the active ${todayDay} menu.`,
      });
    }

    const allowedItems = getAllowedItemsForToday(todayDay);
    const allowedMap = buildAllowedMap(allowedItems);

   const cleanItems = body.items
  .map((item) => {
    const id = String(item.id || "").trim();
    const qty = Math.max(1, Number(item.qty || 1));

    if (!id || !allowedMap.has(id)) return null;
    if (!isItemAllowedForCurrentDay(id, todayDay)) return null;

    const allowed = allowedMap.get(id);

    return {
      id: allowed.id,
      name: allowed.name,
      qty,
      price: allowed.price,
      total: qty * allowed.price,

      // 🔥 PRESERVE SIDES
      side1Id: item.side1Id || "",
      side2Id: item.side2Id || "",
      side1Name: item.side1Name || "",
      side2Name: item.side2Name || "",
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

    if (cleanItems.length !== body.items.length) {
      return res.status(403).json({
        ok: false,
        error: "ITEM_NOT_AVAILABLE_TODAY",
        message: `One or more selected items are not available on ${todayDay.charAt(0).toUpperCase() + todayDay.slice(1)}.`,
      });
    }

       const calculatedSubtotal = Number(
      cleanItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)
    );

    const TAX_RATE = 0.0895;

    const calculatedTax = Number((calculatedSubtotal * TAX_RATE).toFixed(2));
    const calculatedTotal = Number((calculatedSubtotal + calculatedTax).toFixed(2));

    const submittedSubtotal = calculatedSubtotal;
    const submittedTax = calculatedTax;
    const submittedTotal = calculatedTotal;

    const line_items = cleanItems.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: "usd",
        product_data: {
  name: item.side1Name && item.side2Name
    ? `${item.name} (${item.side1Name}, ${item.side2Name})`
    : item.name,
          metadata: {
            itemId: item.id,
            activeMenuDay: todayDay,
            brand: "Delish",
          },
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
    }));

    const safeTaxAmountCents = Math.max(
      0,
      Math.round((submittedTotal - submittedSubtotal) * 100)
    );

    if (safeTaxAmountCents > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: {
            name: "Sales Tax",
          },
          unit_amount: safeTaxAmountCents,
        },
      });
    }

     const shortOrderSummary = buildShortOrderSummary(cleanItems);

  let itemsJson = "[]";
  try {
    const rawItemsJson = JSON.stringify(cleanItems);
    itemsJson = rawItemsJson.length <= 500 ? rawItemsJson : "[]";
  } catch {
    itemsJson = "[]";
  }

const session = await stripe.checkout.sessions.create({
  mode: "payment",
  payment_method_types: ["card"],
  line_items,

  // 🔒 HARD LOCK SUCCESS + CANCEL
  success_url: `https://www.squarebidness.com/delish/order/success/?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `https://www.squarebidness.com/delish/order/`,

   metadata: {
    customerName: safeMeta(body.customerName, 100),
    customerPhone: safeMeta(body.customerPhone, 30),
    customerEmail: safeMeta(body.customerEmail || "", 120),
    pickupDate: safeMeta(body.pickupDate, 20),
    pickupWindow: safeMeta(body.pickupWindow, 40),
    notes: safeMeta(body.notes || "", 300),

    smsConsent: "yes",

    orderSummary: shortOrderSummary,
    itemsJson,
    itemCount: String(cleanItems.length),
    subtotal: String(submittedSubtotal),
    tax: String(submittedTax),
    total: String(submittedTotal),

    source: safeMeta(body.source || "delish-order-page", 50),
    activeMenuDay: safeMeta(todayDay, 20),
  },

    payment_intent_data: {
    metadata: {
      customerName: safeMeta(body.customerName, 100),
      customerPhone: safeMeta(body.customerPhone, 30),
      pickupDate: safeMeta(body.pickupDate, 20),
      pickupWindow: safeMeta(body.pickupWindow, 40),
      smsConsent: "yes",
      orderSummary: shortOrderSummary,
      itemsJson,
      itemCount: String(cleanItems.length),
      total: String(submittedTotal),
    },
  },

  customer_email: body.customerEmail || undefined,
});

return res.status(200).json({
  ok: true,
  checkout_url: session.url,
  session_id: session.id,
});

      } catch (error) {
    console.error("DELISH CREATE CHECKOUT ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create checkout session.",
    });
  }
}
