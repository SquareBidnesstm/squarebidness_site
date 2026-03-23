// FILE: /api/delish-finalize-checkout.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.DELISH_STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: "Missing session_id." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({
        ok: false,
        error: "Session not paid.",
      });
    }

    const metadata = session.metadata || {};

    const payload = {
      customerName: metadata.customerName || "",
      customerPhone: metadata.customerPhone || "",
      customerEmail: metadata.customerEmail || "",
      pickupDate: metadata.pickupDate || "",
      pickupWindow: metadata.pickupWindow || "",
      notes: metadata.notes || "",
      items: JSON.parse(metadata.itemsJson || "[]"),
      subtotal: Number(metadata.subtotal || 0),
      tax: Number(metadata.tax || 0),
      total: Number(metadata.total || 0),
      paymentStatus: "paid",
      source: metadata.source || "delish-order-page",
      stripeSessionId: session.id,
    };

    const base =
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://www.squarebidness.com";

    const webhookRes = await fetch(`${base}/api/delish-order-webhook/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const webhookData = await webhookRes.json();

    if (!webhookRes.ok || !webhookData.ok) {
      return res.status(500).json({
        ok: false,
        error: webhookData.error || "Failed to store finalized order.",
      });
    }

    return res.status(200).json({
      ok: true,
      orderNumber: webhookData.orderNumber,
    });
  } catch (error) {
    console.error("DELISH FINALIZE CHECKOUT ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to finalize checkout.",
    });
  }
}
