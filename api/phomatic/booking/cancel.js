// /api/phomatic/booking/cancel.js
// POST /api/phomatic/booking/cancel
// Body: { cancel_token }
// Cancels a confirmed/pending booking and issues a Stripe refund on the deposit.

import Stripe from "stripe";
import twilio from "twilio";
import { sbSelect, sbUpdate, formatDate } from "../_config.js";

function getStripe() {
  const key = process.env.PHOMATIC_STRIPE_SECRET_KEY;
  if (!key) throw new Error("PHOMATIC_STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { cancel_token } = req.body || {};
  if (!cancel_token || typeof cancel_token !== "string" || cancel_token.length < 10) {
    return res.status(400).json({ ok: false, error: "Invalid cancel token" });
  }

  try {
    // Fetch booking by cancel token
    const { data: rows } = await sbSelect("phomatic_bookings",
      { cancel_token: `eq.${cancel_token.trim()}` },
      { limit: 1 }
    );
    const booking = Array.isArray(rows) ? rows[0] : null;

    if (!booking) return res.status(404).json({ ok: false, error: "Booking not found" });
    if (booking.status === "cancelled") return res.status(409).json({ ok: false, error: "Already cancelled" });
    if (booking.status === "completed") return res.status(409).json({ ok: false, error: "Completed sessions cannot be cancelled" });

    // Check 48-hour cancellation window
    const sessionDate = new Date(`${booking.session_date}T12:00:00`);
    const hoursUntilSession = (sessionDate - Date.now()) / (1000 * 60 * 60);
    const isRefundable = hoursUntilSession >= 48;

    let refundAmount = 0;

    // Attempt Stripe refund if deposit was paid and within window
    if (isRefundable && booking.stripe_payment_intent_id && booking.deposit_cents > 0) {
      try {
        const stripe = getStripe();
        const refund = await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: booking.deposit_cents,
          reason: "requested_by_customer",
          metadata: { booking_code: booking.booking_code, tenant: "phomatic" },
        });
        refundAmount = refund.amount;
      } catch (stripeErr) {
        console.warn("PHOMATIC CANCEL: Stripe refund failed:", stripeErr.message);
        // Continue with cancellation even if refund fails — flag for manual review
      }
    }

    // Update booking status
    await sbUpdate("phomatic_bookings", { id: `eq.${booking.id}` }, {
      status: "cancelled",
      refund_amount_cents: refundAmount,
      cancelled_at: new Date().toISOString(),
    });

    // SMS to client
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (sid && token && from) {
      const dateFormatted = formatDate(booking.session_date);
      const refundMsg = isRefundable && refundAmount > 0
        ? `Your $${(refundAmount / 100).toFixed(2)} deposit refund is on its way (3–5 business days).`
        : `Note: cancellations within 48 hours of the session are non-refundable.`;
      const client = twilio(sid, token);
      await client.messages.create({
        body: `Your Pho-Matic session has been cancelled.\n${booking.service_name} — ${dateFormatted} at ${booking.session_time}\n${refundMsg}\nCode: ${booking.booking_code}`,
        from,
        to: booking.client_phone,
      }).catch((e) => console.warn("PHOMATIC CANCEL SMS:", e?.message));

      // Notify Gieno
      const adminPhone = process.env.PHOMATIC_ADMIN_PHONE;
      if (adminPhone) {
        await client.messages.create({
          body: `Booking cancelled: ${booking.booking_code}\n${booking.service_name} — ${formatDate(booking.session_date)} at ${booking.session_time}\nClient: ${booking.client_name}\nRefund: $${(refundAmount / 100).toFixed(2)}`,
          from,
          to: adminPhone,
        }).catch((e) => console.warn("PHOMATIC ADMIN CANCEL SMS:", e?.message));
      }
    }

    return res.status(200).json({
      ok: true,
      cancelled: true,
      refunded: refundAmount > 0,
      refund_amount_dollars: (refundAmount / 100).toFixed(2),
      refundable: isRefundable,
    });

  } catch (err) {
    console.error("PHOMATIC CANCEL ERROR:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Unexpected error" });
  }
}
