// FILE: /api/delish/approve-catering.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { requireDelishOperatorAuth } from "../_lib/delish-operator-auth.js";
import { getStripeConnectClient } from "../stripe-connect/client-config.js";

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

const twilioFromNumber =
  process.env.DELISH_TWILIO_FROM_NUMBER ||
  process.env.TWILIO_FROM_NUMBER ||
  "";

const hasTwilio =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  twilioFromNumber;

const twilioClient = hasTwilio
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

function moneyToCents(value) {
  return Math.round(Number(value) * 100);
}

function centsToMoney(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!requireDelishOperatorAuth(req, res)) return;

  try {
    const { id, totalAmount } = req.body || {};

    if (!id || typeof id !== "string") {
      return res.status(400).json({ ok: false, error: "Missing catering request id." });
    }

    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid total catering amount." });
    }

    const totalCents = moneyToCents(total);
    const depositPercent = 25;
    const depositCents = Math.max(1, Math.round(totalCents * (depositPercent / 100)));
    const totalFormatted = centsToMoney(totalCents);
    const depositFormatted = centsToMoney(depositCents);

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
        totalAmount: existing.totalAmount || "",
        depositPercent: existing.depositPercent || depositPercent,
        depositAmount: existing.depositAmount || "",
        depositLink: existing.depositLink,
      });
    }

    const successUrl =
      process.env.DELISH_CATERING_STRIPE_SUCCESS_URL ||
      "https://www.squarebidness.com/delish/catering/success/";

    const cancelUrl =
      process.env.DELISH_CATERING_STRIPE_CANCEL_URL ||
      "https://www.squarebidness.com/delish/catering/";

    const connectClient = getStripeConnectClient("delish");
    const checkoutMetadata = {
      brand: "Delish",

      // Critical for webhook routing.
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

      totalAmount: totalFormatted,
      depositPercent: String(depositPercent),
      depositAmount: depositFormatted,
    };

    const paymentIntentData = {
      metadata: checkoutMetadata,
    };

    if (connectClient?.connectedAccountId?.startsWith("acct_")) {
      paymentIntentData.transfer_data = {
        destination: connectClient.connectedAccountId,
      };

      if (connectClient.feeCents > 0) {
        paymentIntentData.application_fee_amount = Math.min(
          connectClient.feeCents,
          Math.max(0, depositCents - 1)
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancelUrl}?request_id=${encodeURIComponent(id)}`,
      customer_email: existing.email || undefined,

      metadata: checkoutMetadata,
      payment_intent_data: paymentIntentData,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: depositCents,
            product_data: {
              name: `Delish Catering Deposit — ${existing.requestNumber}`,
              description: `25% deposit on $${totalFormatted} catering total • ${existing.eventDate || "Event date TBD"}${
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
      totalAmount: totalFormatted,
      depositPercent,
      depositAmount: depositFormatted,
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
Total Catering Amount: $${updated.totalAmount}
Deposit Due: $${updated.depositAmount} (${updated.depositPercent}%)

Use the link below to pay your deposit and secure your date:
${session.url}

Thank you,
Delish Catering
        `.trim(),
      });
    }

    // 📱 SMS (optional)
    if (twilioClient && existing.phone && existing.smsConsent === "yes") {
      try {
        await twilioClient.messages.create({
          body: `Delish Catering: Your request ${existing.requestNumber} is approved. Pay your 25% deposit of $${updated.depositAmount} here: ${session.url}`,
          from: twilioFromNumber,
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
      totalAmount: updated.totalAmount,
      depositPercent: updated.depositPercent,
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
