// FILE: /api/delish/refund-order.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";
import { requireDelishOperatorAuth } from "../_lib/delish-operator-auth.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const stripe = new Stripe(process.env.DELISH_STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!requireDelishOperatorAuth(req, res)) return;

  try {
    if (!process.env.DELISH_STRIPE_SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing DELISH_STRIPE_SECRET_KEY.",
      });
    }

    const { id, reason = "requested_by_customer" } = req.body || {};

    if (!id || typeof id !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing order id.",
      });
    }

    const key = `delish:order:${id}`;
    const existing = await redis.get(key);

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: "Order not found.",
      });
    }

    if (existing.status === "refunded" || existing.paymentStatus === "refunded") {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        id,
        status: "refunded",
        refundId: existing.refundId || "",
      });
    }

    const stripeSessionId = String(existing.stripeSessionId || "").trim();
    if (!stripeSessionId) {
      return res.status(400).json({
        ok: false,
        error: "This order does not have a Stripe session id saved.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(stripeSessionId, {
      expand: ["payment_intent"],
    });

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || "";

    if (!paymentIntent) {
      return res.status(400).json({
        ok: false,
        error: "Stripe payment intent not found for this order.",
      });
    }

    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent,
        reason,
        metadata: {
          brand: "Delish",
          orderId: id,
          orderNumber: existing.orderNumber || "",
          stripeSessionId,
        },
      },
      {
        idempotencyKey: `delish-refund-${id}`,
      }
    );

    const updated = {
      ...existing,
      status: "refunded",
      orderState: "refunded",
      paymentStatus: "refunded",
      refundedAt: new Date().toISOString(),
      refundId: refund.id,
      refundStatus: refund.status || "",
      refundAmount: Number(((refund.amount || 0) / 100).toFixed(2)),
      refundReason: reason,
      stripePaymentIntentId: paymentIntent,
    };

    await redis.set(key, updated);

    return res.status(200).json({
      ok: true,
      id,
      status: "refunded",
      refundId: refund.id,
      refundStatus: refund.status || "",
      refundAmount: updated.refundAmount,
    });
  } catch (error) {
    console.error("POST /api/delish/refund-order error:", error);

    const stripeMessage = error?.raw?.message || error?.message || "";
    return res.status(500).json({
      ok: false,
      error: stripeMessage || "Failed to refund order.",
    });
  }
}
