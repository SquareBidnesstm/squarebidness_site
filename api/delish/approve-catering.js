// FILE: /api/delish/approve-catering.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import twilio from "twilio";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const stripe = new Stripe(process.env.DELISH_STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.DELISH_SMTP_USER,
    pass: process.env.DELISH_SMTP_PASS,
  },
});

const hasTwilio =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_FROM_NUMBER;

const twilioClient = hasTwilio
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

function moneyToCents(value) {
  return Math.round(Number(value) * 100);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const { id, depositAmount } = req.body || {};

    if (!id || typeof id !== "string") {
      return res.status(400).json({ ok: false, error: "Missing catering request id." });
    }

    const deposit = Number(depositAmount);
    if (!Number.isFinite(deposit) || deposit <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid deposit amount." });
    }

    const key = `delish:catering:${id}`;
    const existing = await redis.get(key);

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Catering request not found." });
    }

    // Prevent duplicate deposit session creation
    if (existing.depositSessionId && existing.status === "deposit_sent") {
      return res.status(200).json({
        ok: true,
        alreadyExists: true,
        depositLink: existing.depositLink,
      });
    }

    const successUrl =
      process.env.DELISH_CATERING_STRIPE_SUCCESS_URL ||
      "https://www.squarebidness.com/delish/catering/success/";

    const cancelUrl =
      process.env.DELISH_CATERING_STRIPE_CANCEL_URL ||
      "https://www.squarebidness.com/delish/catering/";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancelUrl}?request_id=${encodeURIComponent(id)}`,
      customer_email: existing.email || undefined,

      metadata: {
        brand: "Delish",

        // 🔑 CRITICAL FOR WEBHOOK
        lane: "catering",
        type: "deposit",
        orderType: "catering_deposit",

        cateringRequestId: existing.id,
        requestNumber: existing.requestNumber,

        customerName: existing.customerName || "",
        customerPhone: existing.phone || "",
        customerEmail: existing.email || "",

        eventDate: existing.eventDate || "",
        eventTime: existing.eventTime || "",
        serviceType: existing.serviceType || "",

        depositAmount: String(deposit),
      },

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: moneyToCents(deposit),
            product_data: {
              name: `Delish Catering Deposit — ${existing.requestNumber}`,
              description: `${existing.eventDate || "Event date TBD"}${
                existing.eventTime ? ` • ${existing.eventTime}` : ""
              }`,
            },
          },
        },
      ],
    });

    const updated = {
      ...existing,
      updatedAt: new Date().toISOString(),
      status: "deposit_sent",
      depositAmount: deposit.toFixed(2),
      depositLink: session.url,
      depositSessionId: session.id,
      depositSentAt: new Date().toISOString(),
    };

    await redis.set(key, updated);

    // 📧 EMAIL
    if (existing.email) {
      await transporter.sendMail({
        from: `"Delish Catering" <${process.env.DELISH_SMTP_USER}>`,
        to: existing.email,
        subject: `Delish Catering Deposit — ${existing.requestNumber}`,
        text: `
Hello ${existing.customerName || ""},

Your Delish catering request has been approved.

Request #: ${existing.requestNumber}
Event Date: ${existing.eventDate || "Not provided"}
Event Time: ${existing.eventTime || "Not provided"}
Deposit Amount: $${updated.depositAmount}

Use the link below to pay your deposit and secure your date:
${session.url}

Thank you,
Delish Catering
        `.trim(),
      });
    }

    // 📱 SMS (optional)
    if (twilioClient && existing.phone) {
      try {
        await twilioClient.messages.create({
          body: `Delish Catering: Your request ${existing.requestNumber} is approved. Pay your $${updated.depositAmount} deposit here: ${session.url}`,
          from: process.env.TWILIO_FROM_NUMBER,
          to: existing.phone,
        });
      } catch (smsError) {
        console.error("DELISH APPROVE CATERING SMS ERROR:", smsError);
      }
    }

    return res.status(200).json({
      ok: true,
      id: existing.id,
      requestNumber: existing.requestNumber,
      status: updated.status,
      depositAmount: updated.depositAmount,
      depositLink: updated.depositLink,
    });

  } catch (error) {
    console.error("POST /api/delish/approve-catering error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to approve catering request.",
    });
  }
}
