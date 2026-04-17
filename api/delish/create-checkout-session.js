// FILE: /api/delish/create-checkout-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia"
});

const MENU_BY_DAY = {
  monday: [
    { id: "monday_red_beans_fried_chicken", name: "Red Beans or Okra with Fried Chicken", price: 13.99 },
    { id: "monday_hamburger_steak", name: "Hamburger Steak Plate", price: 13.99 }
  ],
  tuesday: [
    { id: "tuesday_beef_tips", name: "Beef Tips Plate", price: 13.99 },
    { id: "tuesday_meatloaf", name: "Meatloaf Plate", price: 13.99 }
  ],
  wednesday: [
    { id: "wednesday_pork_neckbones", name: "Pork Neckbones Plate", price: 10.0 },
    { id: "wednesday_baked_chicken", name: "Baked Chicken Plate", price: 10.0 },
    { id: "wednesday_country_fried_steak", name: "Country Fried Steak Plate", price: 10.0 }
  ],
  thursday: [
    { id: "thursday_turkey_wings", name: "Turkey Wings Plate", price: 16.99 }
  ],
  friday: [
    { id: "friday_crawfish_etouffee", name: "Crawfish Étouffée Plate", price: 16.99 },
    { id: "friday_shrimp_pasta", name: "Shrimp Pasta Plate", price: 16.99 },
    { id: "friday_fried_catfish", name: "Fried Catfish Plate (3 strips)", price: 15.99 },
    { id: "friday_baked_catfish", name: "Baked Catfish Plate (2)", price: 16.99 }
  ],
  everyday_addons: [
    { id: "drink_add_on", name: "Drink Add-On", price: 3.99 }
  ]
};

function getCentralDayName(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long"
  }).format(date).toLowerCase();
}

function getAllowedCatalogForToday() {
  const today = getCentralDayName();
  const dayItems = MENU_BY_DAY[today] || [];
  const addonItems = MENU_BY_DAY.everyday_addons || [];
  return {
    today,
    allowedItems: [...dayItems, ...addonItems]
  };
}

function buildAllowedMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const {
      customerName,
      customerPhone,
      customerEmail,
      orderNotes,
      serviceNote,
      pickupDate,
      pickupWindow,
      items,
      subtotal,
      estimatedTax,
      total
    } = data;

    if (!customerName || !customerPhone || !pickupDate || !pickupWindow) {
      return res.status(400).json({ ok: false, error: "MISSING_REQUIRED_FIELDS" });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: "NO_ITEMS_SELECTED" });
    }

    const { today, allowedItems } = getAllowedCatalogForToday();
    const allowedMap = buildAllowedMap(allowedItems);

    const cleanItems = items
      .map((item) => {
        const id = String(item.id || "").trim();
        const qty = Math.max(1, Number(item.qty || 1));

        if (!id || !allowedMap.has(id)) return null;

        const catalogItem = allowedMap.get(id);

        return {
          id: catalogItem.id,
          name: catalogItem.name,
          qty,
          price: catalogItem.price,
          total: qty * catalogItem.price
        };
      })
      .filter(Boolean);

    if (!cleanItems.length) {
      return res.status(400).json({
        ok: false,
        error: "NO_VALID_ITEMS_FOR_TODAY",
        message: `No valid items are available for ${today}.`
      });
    }

    if (cleanItems.length !== items.length) {
      return res.status(403).json({
        ok: false,
        error: "ITEM_NOT_AVAILABLE_TODAY",
        message: `One or more selected items are not available on ${today.charAt(0).toUpperCase() + today.slice(1)}.`
      });
    }

    const numericSubtotal = Number(subtotal || 0);
    const numericEstimatedTax = Number(estimatedTax || 0);
    const numericTotal = Number(total || 0);

    const line_items = cleanItems.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.name,
          metadata: {
            brand: "Delish",
            lane: "paid_pickup",
            itemId: item.id,
            availableDay: today
          }
        }
      }
    }));

    const orderPayload = {
      _brand: "Delish",
      _form: "paid_pickup_order",
      _source: "delish-order-page",
      _paymentPhase: "checkout_created",
      _submittedAt: new Date().toISOString(),
      customerName,
      customerPhone,
      customerEmail: customerEmail || "",
      orderNotes: orderNotes || "",
      serviceNote: serviceNote || "",
      pickupDate,
      pickupWindow,
      items: cleanItems,
      subtotal: numericSubtotal,
      estimatedTax: numericEstimatedTax,
      total: numericTotal,
      activeMenuDay: today
    };

    const intakeRes = await fetch(process.env.DELISH_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload)
    });

    const intakeJson = await intakeRes.json().catch(() => ({}));

    if (!intakeRes.ok || !intakeJson.ok || !intakeJson.id) {
      return res.status(500).json({
        ok: false,
        error: "INTAKE_WRITE_FAILED",
        details: intakeJson
      });
    }

    const recordId = intakeJson.id;

    const sharedMetadata = {
  brand: "Delish",
  recordId,
  orderNumber: recordId,
  orderType: "paid_pickup",
  customerName,
  customerPhone,
  customerEmail: customerEmail || "",
  pickupDate,
  pickupWindow,
  activeMenuDay: today,
  smsConsent: "yes",
  itemsJson: JSON.stringify(cleanItems),
  subtotal: String(numericSubtotal),
  tax: String(numericEstimatedTax),
  total: String(numericTotal)
};

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: true },
      customer_email: customerEmail || undefined,
      success_url: `https://www.squarebidness.com/delish/order/success/?session_id={CHECKOUT_SESSION_ID}&record_id=${encodeURIComponent(recordId)}`,
      cancel_url: `https://www.squarebidness.com/delish/order/?record_id=${encodeURIComponent(recordId)}`,
      line_items,
      metadata: sharedMetadata,
      payment_intent_data: {
        metadata: sharedMetadata
      },
      automatic_tax: { enabled: false }
    });

    await fetch(process.env.DELISH_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _brand: "Delish",
        _form: "order_checkout_created",
        recordId,
        stripeCheckoutSessionId: session.id,
        stripeCheckoutUrl: session.url,
        checkoutStatus: "CREATED",
        _submittedAt: new Date().toISOString()
      })
    }).catch(() => null);

    return res.status(200).json({
      ok: true,
      checkout_url: session.url,
      recordId
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
      message: err.message
    });
  }
}
