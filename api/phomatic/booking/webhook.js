// /api/phomatic/booking/webhook.js
// POST /api/phomatic/booking/webhook
// Stripe webhook: confirms payment, updates booking, fires Twilio SMS + admin notification.
//
// Vercel config: { api: { bodyParser: false } } required for Stripe signature verification.

import Stripe from "stripe";
import twilio from "twilio";
import { sbUpdate, sbSelect, formatDate } from "../_config.js";

export const config = { api: { bodyParser: false } };

function getStripe() {
  const key = process.env.PHOMATIC_STRIPE_SECRET_KEY;
  if (!key) throw new Error("PHOMATIC_STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function sendSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.warn("PHOMATIC WEBHOOK: Twilio not configured — skipping SMS");
    return;
  }
  const client = twilio(sid, token);
  await client.messages.create({ body, from, to });
}

async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Pho-Matic Photography <bookings@squarebidness.com>",
      to: [to],
      subject,
      html,
    }),
  }).catch((e) => console.warn("PHOMATIC EMAIL WARN:", e?.message));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.PHOMATIC_STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: "Webhook secret not configured" });

  let event;
  try {
    const rawBody = await getRawBody(req);
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("PHOMATIC WEBHOOK SIGNATURE FAILED:", err.message);
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  // ---- checkout.session.completed ----
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { booking_id, booking_code, cancel_token } = session.metadata || {};

    if (!booking_id) {
      console.error("PHOMATIC WEBHOOK: No booking_id in metadata");
      return res.status(200).json({ received: true }); // ack to Stripe, log internally
    }

    try {
      // Update booking to confirmed
      await sbUpdate("phomatic_bookings", { id: `eq.${booking_id}` }, {
        status: "confirmed",
        stripe_payment_intent_id: session.payment_intent || null,
      });

      // Fetch booking details for notifications
      const { data: rows } = await sbSelect("phomatic_bookings", { id: `eq.${booking_id}` });
      const booking = Array.isArray(rows) ? rows[0] : null;
      if (!booking) throw new Error("Booking not found after confirm");

      const dateFormatted = formatDate(booking.session_date);
      const depositDollars = (booking.deposit_cents / 100).toFixed(2);
      const balanceDollars = (booking.balance_due_cents / 100).toFixed(2);
      const cancelUrl = `https://www.squarebidness.com/phomatic/book/lookup/`;

      // ---- SMS to client ----
      await sendSms(
        booking.client_phone,
        `Your session is confirmed! 📷\n${booking.service_name}\n${dateFormatted} at ${booking.session_time}\nCode: ${booking.booking_code}\nBalance due at session: $${balanceDollars}\nQuestions? DM @datpholife or visit: ${cancelUrl}`
      );

      // ---- SMS to Gieno (admin) ----
      const adminPhone = process.env.PHOMATIC_ADMIN_PHONE;
      if (adminPhone) {
        await sendSms(
          adminPhone,
          `New booking! 📷\n${booking.service_name}\n${dateFormatted} at ${booking.session_time}\nClient: ${booking.client_name} · ${booking.client_phone}\nDeposit: $${depositDollars} paid\nCode: ${booking.booking_code}\nAdmin: squarebidness.com/phomatic/admin/`
        );
      }

      // ---- Email to client ----
      if (booking.client_email) {
        const html = buildConfirmEmail(booking, dateFormatted, depositDollars, balanceDollars, cancelUrl);
        await sendEmail(
          booking.client_email,
          `Confirmed: ${booking.service_name} — ${dateFormatted}`,
          html
        );
      }

      // ---- Fire Meta Pixel purchase event via ledger ----
      try {
        const { writeLedgerEvent } = await import("../../_lib/supabase-ledger.js");
        await writeLedgerEvent({
          brand: "phomatic",
          system: "booking",
          eventType: "booking_confirmed",
          entityId: booking.booking_code,
          payload: {
            service: booking.service_name,
            total_price_cents: booking.total_price_cents,
            deposit_cents: booking.deposit_cents,
            session_date: booking.session_date,
          },
          source: "phomatic_webhook",
        });
      } catch (e) {
        console.warn("PHOMATIC: Ledger write failed (non-fatal):", e?.message);
      }

    } catch (err) {
      console.error("PHOMATIC WEBHOOK CONFIRM ERROR:", err);
      return res.status(500).json({ error: "Failed to process confirmation" });
    }
  }

  // ---- checkout.session.expired ----
  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const { booking_id } = session.metadata || {};
    if (booking_id) {
      await sbUpdate("phomatic_bookings", { id: `eq.${booking_id}` }, { status: "expired" })
        .catch((e) => console.warn("PHOMATIC: Failed to mark expired:", e?.message));
    }
  }

  return res.status(200).json({ received: true });
}

function buildConfirmEmail(booking, dateFormatted, depositDollars, balanceDollars, cancelUrl) {
  const name = booking.client_name;
  const service = booking.service_name;
  const time = booking.session_time;
  const code = booking.booking_code;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#060606;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060606;padding:40px 20px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#0c0c0c;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#c9a227;height:4px;"></td></tr>
        <tr><td style="padding:32px 36px;">
          <div style="font-size:32px;margin-bottom:14px;">📷</div>
          <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 4px;">Session Confirmed!</h1>
          <p style="color:#888;font-size:13px;margin:0 0 24px;">Pho-Matic Photography · Gieno Smith</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;margin-bottom:22px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-weight:800;font-size:16px;">${name}</p>
              <p style="margin:0 0 4px;color:#aaa;font-size:14px;">${service}</p>
              <p style="margin:0 0 4px;color:#c9a227;font-weight:700;font-size:16px;">${dateFormatted} at ${time}</p>
              <p style="margin:0 0 4px;color:#888;font-size:13px;">Deposit paid: <strong style="color:#fff;">$${depositDollars}</strong></p>
              <p style="margin:0;color:#888;font-size:13px;">Balance due at session: <strong style="color:#fff;">$${balanceDollars}</strong></p>
            </td></tr>
          </table>

          <p style="margin:0 0 6px;color:#888;font-size:13px;">Booking code: <strong style="color:#fff;font-family:monospace;letter-spacing:.05em;">${code}</strong></p>
          <p style="margin:0 0 22px;"><a href="${cancelUrl}" style="color:#888;font-size:12px;">Manage your appointment</a></p>

          <p style="color:#555;font-size:11px;margin:0;">Powered by <a href="https://squarebidness.com" style="color:#c9a227;text-decoration:none;">Square Bidness</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
