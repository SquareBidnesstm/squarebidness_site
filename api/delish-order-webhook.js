// FILE: /api/delish-order-webhook.js
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    if (
      !process.env.DELISH_UPSTASH_REDIS_REST_URL ||
      !process.env.DELISH_UPSTASH_REDIS_REST_TOKEN
    ) {
      return res.status(500).json({
        ok: false,
        error: "Missing Delish Redis environment variables.",
      });
    }

    const body = req.body;

    if (!isValidOrder(body)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid paid order payload.",
      });
    }

    const id = crypto.randomUUID();
    const orderNumber = makeOrderNumber();

    const orderRecord = {
      id,
      orderNumber,
      createdAt: new Date().toISOString(),
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail || "",
      pickupDate: body.pickupDate,
      pickupWindow: body.pickupWindow,
      notes: body.notes || "",
      items: body.items,
      subtotal: body.subtotal ?? 0,
      tax: body.tax ?? 0,
      total: body.total,
      paymentStatus: "paid",
      source: body.source || "delish-online-order",
      stripeSessionId: body.stripeSessionId || "",
    };

    await redis.set(`delish:order:${id}`, orderRecord);
    await redis.lpush("delish:orders:list", id);
    await redis.ltrim("delish:orders:list", 0, 99);

    return res.status(200).json({
      ok: true,
      id,
      orderNumber,
    });
  } catch (error) {
    console.error("POST /api/delish-order-webhook error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to store paid order.",
    });
  }
}
