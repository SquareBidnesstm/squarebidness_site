// FILE: /api/delish/stripe-webhook.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";
import { sendDelishSms } from "../_lib/send-delish-sms.js";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const stripe = new Stripe(process.env.DELISH_STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function normalizeUsPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function money(n) {
  return Number(n || 0).toFixed(2);
}


  function buildPickupSms(metadata) {
  const customerName = String(metadata.customerName || "").trim();
  const pickupDate = String(metadata.pickupDate || "").trim();
  const pickupWindow = String(metadata.pickupWindow || "").trim();
  const total = metadata.total || metadata.amountTotal || metadata.subtotal || "";

  let itemLines = ["Items unavailable"];
  try {
    const items = JSON.parse(metadata.itemsJson || "[]");
    if (Array.isArray(items) && items.length) {
      itemLines = items.map((i) => {
        const qty = Number(i.qty || 0);
        const parts = [];

        if (i.side1Name) parts.push(i.side1Name);
        if (i.side2Name) parts.push(i.side2Name);

        const detail = parts.length ? ` — ${parts.join(", ")}` : "";
        return `- ${qty} x ${i.name}${detail}`;
      });
    }
  } catch (err) {
    console.warn("Unable to parse itemsJson for pickup SMS.");
  }

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const pickupLabel = pickupDate === todayIso ? "Today" : pickupDate;
  const nameLine = customerName ? `${customerName}, your order is confirmed.` : `Your order is confirmed.`;

  return `Delish

${nameLine}

Pickup: ${pickupLabel}${pickupWindow ? ` • ${pickupWindow}` : ""}
Items:
${itemLines.join("\n")}

Total: $${Number(total || 0).toFixed(2)}

Thank you.`;
}

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const pickupLabel = pickupDate === todayIso ? "Today" : pickupDate;
  const greeting = customerName
    ? `Delish: ${customerName}, your order is confirmed.`
    : `Delish: Order confirmed.`;

  return `${greeting}

Pickup: ${pickupLabel}${pickupWindow ? ` at ${pickupWindow}` : ""}
Item: ${itemLine}
Total: $${Number(total || 0).toFixed(2)}

See you soon.`;
}

function buildCateringDepositSms(metadata, existing) {
  const requestNumber =
    metadata.requestNumber ||
    (existing && existing.requestNumber) ||
    metadata.cateringRequestId ||
    "DELISH";

  const eventDate =
    metadata.eventDate ||
    (existing && existing.eventDate) ||
    "";

  const eventTime =
    metadata.eventTime ||
    (existing && existing.eventTime) ||
    "";

  return `Delish Catering: Deposit received for request ${requestNumber}.${eventDate ? ` Event date ${eventDate}.` : ""}${eventTime ? ` Event time ${eventTime}.` : ""}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  try {
    const sig = req.headers["stripe-signature"];
    const rawBody = await readRawBody(req);

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.DELISH_STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const metadata = session.metadata || {};
      console.log("DELISH LIVE METADATA:", metadata);
      const sessionId = session.id;

      const alreadyProcessed = await redis.get(`delish:stripe:session:${sessionId}`);
      if (alreadyProcessed) {
        return res.status(200).json({ received: true, duplicate: true });
      }

      await redis.set(`delish:stripe:session:${sessionId}`, {
        processedAt: new Date().toISOString(),
        eventType: event.type,
      });

      const isCateringDeposit =
        metadata.cateringRequestId &&
        (
          metadata.orderType === "catering_deposit" ||
          (metadata.lane === "catering" && metadata.type === "deposit")
        );

      if (isCateringDeposit) {
        const key = `delish:catering:${metadata.cateringRequestId}`;
        const existing = await redis.get(key);

        if (existing) {
          const updated = {
            ...existing,
            updatedAt: new Date().toISOString(),
            status: "deposit_paid",
            depositPaidAt: new Date().toISOString(),
            depositSessionId: session.id || existing.depositSessionId || "",
            depositPaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : existing.depositPaymentIntentId || "",
            depositAmountPaid:
              typeof session.amount_total === "number"
                ? (session.amount_total / 100).toFixed(2)
                : existing.depositAmountPaid || existing.depositAmount || "",
          };

          await redis.set(key, updated);

          try {
            const smsTo = normalizeUsPhone(
              updated.customerPhone || metadata.customerPhone || ""
            );

            if (smsTo) {
              await sendDelishSms({
                to: smsTo,
                message: buildCateringDepositSms(metadata, updated),
              });
            }
          } catch (smsError) {
            console.error("DELISH CATERING SMS ERROR:", smsError);
          }
        }
      } else {
        try {
          const smsConsent = metadata.smsConsent === "yes";
          const smsTo = normalizeUsPhone(metadata.customerPhone || "");

          if (smsConsent && smsTo) {
  console.log("DELISH ABOUT TO CALL SMS HELPER:", {
    sessionId: session.id,
    smsTo,
    smsConsent
  });

  const smsResult = await sendDelishSms({
    to: smsTo,
    message: buildPickupSms({
      ...metadata,
      amountTotal:
        typeof session.amount_total === "number"
          ? (session.amount_total / 100).toFixed(2)
          : "",
    }),
  });

  console.log("DELISH SMS HELPER RESULT:", smsResult);
  console.log("DELISH PICKUP SMS SENT:", session.id);
} else {
  console.log("DELISH PICKUP SMS SKIPPED:", {
    smsConsent,
    rawPhone: metadata.customerPhone || "",
    normalizedPhone: smsTo
  });
}
        } catch (smsError) {
          console.error("DELISH PICKUP SMS ERROR:", smsError);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("DELISH STRIPE WEBHOOK ERROR:", error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
}
