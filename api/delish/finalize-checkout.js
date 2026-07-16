// FILE: /api/delish/finalize-checkout.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

function getItemsJson(metadata = {}) {
  const chunkCount = Math.max(0, Number(metadata.itemsJsonChunkCount || 0));

  if (chunkCount > 0) {
    let combined = "";
    for (let index = 1; index <= chunkCount; index += 1) {
      combined += String(metadata[`itemsJson${index}`] || "");
    }
    return combined || "[]";
  }

  return metadata.itemsJson || "[]";
}

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
    const recordId = metadata.recordId || metadata.orderNumber || "";
    const pendingOrder = recordId
      ? await redis.get(`delish:pending-order:${recordId}`)
      : null;

    let items = [];
    if (pendingOrder && Array.isArray(pendingOrder.items)) {
      items = pendingOrder.items;
    } else {
      try {
        items = JSON.parse(getItemsJson(metadata));
        if (!Array.isArray(items)) items = [];
      } catch {
        items = [];
      }
    }

    return res.status(200).json({
      ok: true,
      order: {
        orderNumber:
          pendingOrder?.orderNumber ||
          metadata.orderNumber ||
          metadata.recordId ||
          session.id,
        customerName: pendingOrder?.customerName || metadata.customerName || "",
        customerPhone: pendingOrder?.customerPhone || metadata.customerPhone || "",
        customerEmail: pendingOrder?.customerEmail || metadata.customerEmail || "",
        pickupDate: pendingOrder?.pickupDate || metadata.pickupDate || "",
        pickupWindow: pendingOrder?.pickupWindow || metadata.pickupWindow || "",
        notes: pendingOrder?.notes || metadata.notes || metadata.orderNotes || "",
        smsConsent:
          pendingOrder?.smsConsent || (metadata.smsConsent === "yes" ? "yes" : "no"),
        items,
        subtotal: Number(pendingOrder?.subtotal ?? metadata.subtotal ?? 0),
        tax: Number(pendingOrder?.tax ?? metadata.tax ?? 0),
        total:
          typeof session.amount_total === "number"
            ? Number((session.amount_total / 100).toFixed(2))
            : Number(pendingOrder?.total ?? metadata.total ?? 0),
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
