// FILE: /api/delish/create-checkout.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.DELISH_STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

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

    const line_items = body.items.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
    }));

    const taxAmountCents =
      Math.round((Number(body.total) - Number(body.subtotal)) * 100);

    if (taxAmountCents > 0) {
      line_items.push({
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
        itemsJson: JSON.stringify(body.items),
        subtotal: String(body.subtotal ?? 0),
        tax: String(body.tax ?? 0),
        total: String(body.total),
        source: body.source || "delish-order-page",
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
