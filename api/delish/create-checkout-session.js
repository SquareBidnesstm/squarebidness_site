import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia"
});

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

    const cleanItems = items
      .map((item) => {
        const qty = Math.max(1, Number(item.qty || 1));
        const price = Number(item.price || 0);
        const name = String(item.name || "").trim();
        if (!name || !price) return null;

        return {
          id: String(item.id || "").trim(),
          name,
          qty,
          price,
          total: qty * price
        };
      })
      .filter(Boolean);

    if (!cleanItems.length) {
      return res.status(400).json({ ok: false, error: "INVALID_ITEMS" });
    }

    const line_items = cleanItems.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.name,
          metadata: {
            brand: "Delish",
            lane: "paid_pickup"
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
      subtotal: Number(subtotal || 0),
      estimatedTax: Number(estimatedTax || 0),
      total: Number(total || 0)
    };

    const intakeRes = await fetch(process.env.DELISH_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: true },
      customer_email: customerEmail || undefined,
      success_url: `${process.env.DELISH_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}&record_id=${encodeURIComponent(recordId)}`,
      cancel_url: `${process.env.DELISH_CANCEL_URL}?record_id=${encodeURIComponent(recordId)}`,
      line_items,
      metadata: {
        brand: "Delish",
        recordId,
        orderType: "paid_pickup",
        customerName,
        customerPhone,
        pickupDate,
        pickupWindow
      },
      payment_intent_data: {
        metadata: {
          brand: "Delish",
          recordId,
          orderType: "paid_pickup",
          customerName,
          customerPhone,
          pickupDate,
          pickupWindow
        }
      },
      automatic_tax: { enabled: false }
    });

    await fetch(process.env.DELISH_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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
