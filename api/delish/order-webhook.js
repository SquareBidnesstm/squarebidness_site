// FILE: /api/delish/order-webhook.js
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import twilio from "twilio";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
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

function makeOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DL-${y}${m}${d}-${rand}`;
}

function isValidOrder(body) {
  return (
    body &&
    typeof body.customerName === "string" &&
    typeof body.customerPhone === "string" &&
    typeof body.pickupDate === "string" &&
    typeof body.pickupWindow === "string" &&
    Array.isArray(body.items) &&
    body.items.length > 0 &&
    typeof body.total === "number" &&
    body.paymentStatus === "paid"
  );
}

function formatItems(items) {
  return items
    .map((i) => `${i.qty} x ${i.name} ($${i.price})`)
    .join("\n");
}

function formatPickupDate(dateStr) {
  if (!dateStr) return "";

  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (String(phone || "").trim().startsWith("+")) {
    return String(phone).trim();
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  try {
    const body = req.body;

    // Prevent catering deposits from entering order pipeline
    if (body?.lane === "catering") {
      return res.status(200).json({ ok: true, ignored: "catering flow" });
    }

    if (!isValidOrder(body)) {
      return res.status(400).json({ ok: false, error: "Invalid payload" });
    }

    const id = crypto.randomUUID();
    const orderNumber = makeOrderNumber();

    const order = {
      id,
      orderNumber,
      createdAt: new Date().toISOString(),
      completedAt: "",
      status: "active",
      smsConsent: body.smsConsent === "yes" ? "yes" : "no",
      ...body,
    };

    await redis.set(`delish:order:${id}`, order);
    await redis.lpush("delish:orders:list", id);

    await transporter.sendMail({
      from: `"Delish Orders" <${process.env.DELISH_SMTP_USER}>`,
      to: process.env.DELISH_NOTIFY_EMAIL,
      subject: `New Order ${orderNumber}`,
      text: `
New Paid Order

Order #: ${orderNumber}
Customer: ${body.customerName}
Phone: ${body.customerPhone}
Pickup: ${body.pickupDate} ${body.pickupWindow}

Items:
${formatItems(body.items)}

Total: $${body.total}

Notes:
${body.notes || "None"}

SMS Consent:
${body.smsConsent === "yes" ? "Yes" : "No"}
      `,
    });

    if (twilioClient) {
      const customerPhone = normalizePhone(body.customerPhone);
      const operatorPhone = process.env.TWILIO_TO_NUMBER
        ? normalizePhone(process.env.TWILIO_TO_NUMBER)
        : null;

      const pickupDateText = formatPickupDate(body.pickupDate);
      const pickupLine = [pickupDateText, body.pickupWindow].filter(Boolean).join(" • ");

      if (customerPhone && body.smsConsent === "yes") {
        try {
          await twilioClient.messages.create({
            body: `Delish: Your order is confirmed${pickupLine ? ` for ${pickupLine}` : ""}. Order ${orderNumber}. Reply STOP to opt out.`,
            from: process.env.TWILIO_FROM_NUMBER,
            to: customerPhone,
          });
        } catch (smsError) {
          console.error("DELISH CUSTOMER SMS ERROR:", smsError);
        }
      }

      if (operatorPhone) {
        try {
          await twilioClient.messages.create({
            body: `New Delish order ${orderNumber} - Pickup ${pickupLine || body.pickupWindow || "scheduled"}`,
            from: process.env.TWILIO_FROM_NUMBER,
            to: operatorPhone,
          });
        } catch (smsError) {
          console.error("DELISH OPERATOR SMS ERROR:", smsError);
        }
      }
    }

    return res.status(200).json({ ok: true, orderNumber });
  } catch (err) {
    console.error("DELISH WEBHOOK ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown error",
      more: err?.code || null,
    });
  }
}
