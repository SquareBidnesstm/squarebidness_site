// FILE: /api/delish/complete-order.js
import { Redis } from "@upstash/redis";
import { sendDelishSms } from "../_lib/send-delish-sms.js";

function normalizeUsPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function buildReadySms(order) {
  const customerName = String(order.customerName || "").trim();
  const pickupWindow = String(order.pickupWindow || "").trim();

  return `Delish Order Ready

${customerName || "Customer"}
Your order is ready for pickup${pickupWindow ? ` • ${pickupWindow}` : ""}.

Please come to the counter with your order number:
${order.orderNumber || ""}`;
}

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const { id } = req.body || {};

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

    const updated = {
      ...existing,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

   const smsTo = normalizeUsPhone(updated.customerPhone || "");

if (smsTo && !updated.readySmsSentAt) {
  try {
    const smsResult = await sendDelishSms({
      to: smsTo,
      message: buildReadySms(updated),
    });

    if (smsResult?.ok) {
      updated.readySmsSentAt = new Date().toISOString();
      updated.readySmsSid = smsResult.sid || "";
    }

    console.log("DELISH READY SMS RESULT:", smsResult);
  } catch (smsError) {
    console.error("DELISH READY SMS ERROR:", smsError);
  }
}

    await redis.set(key, updated);

    return res.status(200).json({
      ok: true,
      id,
      status: "completed",
    });
  } catch (error) {
    console.error("POST /api/delish/complete-order error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to complete order.",
    });
  }
}
