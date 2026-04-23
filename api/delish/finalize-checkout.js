// FILE: /api/delish/finalize-checkout.js
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

    let items = [];
    try {
      items = JSON.parse(metadata.itemsJson || "[]");
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    return res.status(200).json({
      ok: true,
      order: {
        orderNumber: metadata.orderNumber || metadata.recordId || session.id,
        customerName: metadata.customerName || "",
        customerPhone: metadata.customerPhone || "",
        customerEmail: metadata.customerEmail || "",
        pickupDate: metadata.pickupDate || "",
        pickupWindow: metadata.pickupWindow || "",
        notes: metadata.notes || metadata.orderNotes || "",
        smsConsent: metadata.smsConsent === "yes" ? "yes" : "no",
        items,
        subtotal: Number(metadata.subtotal || 0),
        tax: Number(metadata.tax || 0),
        total:
          typeof session.amount_total === "number"
            ? Number((session.amount_total / 100).toFixed(2))
            : Number(metadata.total || 0),
        paymentStatus: "paid",
        stripeSessionId: session.id,
      },
    });
  } catch (error) {
    console.error("DELISH FINALIZE CHECKOUT ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to finalize checkout.",
    });
  }
}
