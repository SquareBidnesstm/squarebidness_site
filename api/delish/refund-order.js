// FILE: /api/delish/refund-order.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";
import { requireDelishOperatorAuth } from "../_lib/delish-operator-auth.js";
import { sendDelishSms } from "../_lib/send-delish-sms.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

function normalizeUsPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function buildRefundSms(order, refundAmount) {
  const orderNumber = String(order.orderNumber || "").trim();
  const amountText = Number(refundAmount || 0).toFixed(2);

  return `Delish update: your order${orderNumber ? ` ${orderNumber}` : ""} has been refunded for $${amountText}. The refund was sent back to your original payment method. Your bank may take a few business days to show it.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!requireDelishOperatorAuth(req, res)) return;

  try {
    if (!process.env.STRIPE_ONBOARDING_SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing STRIPE_ONBOARDING_SECRET_KEY.",
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

    const smsTo = normalizeUsPhone(updated.customerPhone || "");
    if (updated.smsConsent === "yes" && smsTo && !updated.refundSmsSentAt) {
      try {
        const smsResult = await sendDelishSms({
          to: smsTo,
          message: buildRefundSms(updated, updated.refundAmount),
        });

        if (smsResult?.ok) {
          updated.refundSmsSentAt = new Date().toISOString();
          updated.refundSmsSid = smsResult.sid || "";
        } else {
          updated.refundSmsSkippedAt = new Date().toISOString();
          updated.refundSmsSkipReason =
            smsResult?.reason || smsResult?.error?.message || "sms_not_sent";
        }
      } catch (smsError) {
        console.error("DELISH REFUND SMS ERROR:", smsError);
        updated.refundSmsErrorAt = new Date().toISOString();
        updated.refundSmsError = smsError?.message || "Refund SMS failed.";
      }
    }

    await redis.set(key, updated);

    return res.status(200).json({
      ok: true,
      id,
      status: "refunded",
      refundId: refund.id,
      refundStatus: refund.status || "",
      refundAmount: updated.refundAmount,
      refundSmsSent: Boolean(updated.refundSmsSentAt),
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
