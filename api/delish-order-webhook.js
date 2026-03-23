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

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
    .map(i => `${i.qty} x ${i.name} ($${i.price})`)
    .join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  try {
    const body = req.body;

    if (!isValidOrder(body)) {
      return res.status(400).json({ ok: false, error: "Invalid payload" });
    }

    const id = crypto.randomUUID();
    const orderNumber = makeOrderNumber();

    const order = {
      id,
      orderNumber,
      createdAt: new Date().toISOString(),
      ...body,
    };

    await redis.set(`delish:order:${id}`, order);
    await redis.lpush("delish:orders:list", id);

    // 📧 EMAIL
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
      `,
    });

    // 📲 SMS
    await twilioClient.messages.create({
      body: `New Delish order ${orderNumber} - Pickup ${body.pickupWindow}`,
      from: process.env.TWILIO_FROM_NUMBER,
      to: process.env.TWILIO_TO_NUMBER,
    });

    return res.status(200).json({ ok: true, orderNumber });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
}
