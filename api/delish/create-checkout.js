// FILE: /api/delish/create-checkout.js
import Stripe from "stripe";

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
  everyday: [
  {
    id: "drink_add_on",
    name: "Drink Add-On",
    price: 3.99,
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
],
};

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
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    isoDate: `${map.year}-${map.month}-${map.day}`,
    weekday: map.weekday.toLowerCase(),
  };
}

function getAllowedItemsForToday() {
  const { weekday } = getCentralDateParts();
  const dayItems = MENU_BY_DAY[weekday] || [];
  const everydayItems = MENU_BY_DAY.everyday || [];

  return {
    today: weekday,
    items: [...dayItems, ...everydayItems],
  };
}

function buildAllowedMap(items) {
  return new Map(items.map((item) => [item.id, item]));
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

    const { isoDate: todayIso, weekday: todayDay } = getCentralDateParts();

    if (body.pickupDate !== todayIso) {
      return res.status(403).json({
        ok: false,
        error: "PICKUP_DATE_NOT_ALLOWED",
        message: `Pickup date must be ${todayIso} for the active ${todayDay} menu.`,
      });
    }

    const { today, items: allowedItems } = getAllowedItemsForToday();
    const allowedMap = buildAllowedMap(allowedItems);

    const cleanItems = body.items
      .map((item) => {
        const id = String(item.id || "").trim();
        const qty = Math.max(1, Number(item.qty || 1));

        if (!id || !allowedMap.has(id)) return null;

        const allowed = allowedMap.get(id);

        return {
          id: allowed.id,
          name: allowed.name,
          qty,
          price: allowed.price,
          total: qty * allowed.price,
        };
      })
      .filter(Boolean);

    if (!cleanItems.length) {
      return res.status(400).json({
        ok: false,
        error: "NO_VALID_ITEMS_FOR_TODAY",
        message: `No valid items are available for ${today}.`,
      });
    }

    if (cleanItems.length !== body.items.length) {
      return res.status(403).json({
        ok: false,
        error: "ITEM_NOT_AVAILABLE_TODAY",
        message: `One or more selected items are not available on ${today.charAt(0).toUpperCase() + today.slice(1)}.`,
      });
    }

    const subtotal = cleanItems.reduce((sum, item) => sum + item.total, 0);

    const line_items = cleanItems.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          metadata: {
            itemId: item.id,
            activeMenuDay: today,
            brand: "Delish",
          },
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
    }));

    const submittedSubtotal = Number(body.subtotal ?? subtotal);
    const submittedTax = Number(body.tax ?? 0);
    const submittedTotal = Number(body.total ?? subtotal + submittedTax);

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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail || "",
        pickupDate: body.pickupDate,
        pickupWindow: body.pickupWindow,
        notes: body.notes || "",
        smsConsent: body.smsConsent === "yes" ? "yes" : "no",
        itemsJson: JSON.stringify(cleanItems),
        subtotal: String(submittedSubtotal),
        tax: String(submittedTax),
        total: String(submittedTotal),
        source: body.source || "delish-order-page",
        activeMenuDay: today,
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
