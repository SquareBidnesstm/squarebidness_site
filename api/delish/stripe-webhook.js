// FILE: /api/delish/stripe-webhook.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";
import { sendDelishSms } from "../_lib/send-delish-sms.js";
import crypto from "node:crypto";

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

function formatPickup(date, window) {
  if (!date || !window) return "";
  return `${date} • ${window}`;
}

function formatItems(items = []) {
  return items.map(item => {
    const qty = item.qty || 0;
    const name = item.name || "";

    let extras = [];

    if (item.baseName) extras.push(item.baseName);
    if (item.side1Name) extras.push(item.side1Name);
    if (item.side2Name) extras.push(item.side2Name);

    const extraText = extras.length ? ` (${extras.join(", ")})` : "";

    return `${qty}× ${name}${extraText}`;
  }).join("\n");
}


function buildPickupSms(metadata) {
  const customerName = String(metadata.customerName || "").trim();
  const pickupDate = String(metadata.pickupDate || "").trim();
  const pickupWindow = String(metadata.pickupWindow || "").trim();
  const total = metadata.total || metadata.amountTotal || metadata.subtotal || "";
  const orderNumber = String(metadata.orderNumber || metadata.recordId || "").trim();

  let itemLines = [];
  try {
    const items = JSON.parse(metadata.itemsJson || "[]");
    if (Array.isArray(items) && items.length) {
      itemLines = items.map((i) => {
        const qty = Number(i.qty || 0);
        const extras = [];

        if (i.baseName) extras.push(i.baseName);
        if (i.side1Name) extras.push(i.side1Name);
        if (i.side2Name) extras.push(i.side2Name);

        const detail = extras.length ? ` (${extras.join(", ")})` : "";
        return `${qty}× ${i.name}${detail}`;
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
  const nameLine = customerName || "Customer";

  return `Delish

Order Confirmed

${nameLine}
Pickup: ${pickupLabel}${pickupWindow ? ` • ${pickupWindow}` : ""}${orderNumber ? `

Order #: ${orderNumber}` : ""}

Total: $${Number(total || 0).toFixed(2)}

We’re preparing your order now.

Reply STOP to opt out.`;
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

function buildOwnerNewOrderSms(metadata) {
  const customerName = String(metadata.customerName || "").trim();
  const pickupDate = String(metadata.pickupDate || "").trim();
  const pickupWindow = String(metadata.pickupWindow || "").trim();
  const total = metadata.total || metadata.amountTotal || metadata.subtotal || "";

  return `🚨 Delish New Order

${customerName || "Customer"}
Pickup: ${pickupDate}${pickupWindow ? ` • ${pickupWindow}` : ""}
Total: $${Number(total || 0).toFixed(2)}`;
}
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  let failureContext = {
    sessionId: "",
    customerName: "",
    customerPhone: "",
    pickupWindow: "",
    total: "",
  };

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
  const sessionId = session.id;

     failureContext = {
  sessionId: session.id || "",
  customerName: metadata.customerName || "",
  customerPhone: metadata.customerPhone || "",
  pickupWindow: metadata.pickupWindow || "",
  total:
    typeof session.amount_total === "number"
      ? `$${(session.amount_total / 100).toFixed(2)}`
      : `$${Number(metadata.total || 0).toFixed(2)}`,
};

  console.log("DELISH LIVE METADATA:", metadata);

  // idempotency first
  const alreadyProcessed = await redis.get(`delish:stripe:session:${sessionId}`);
  if (alreadyProcessed) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // determine type first
  const isCateringDeposit =
    metadata.cateringRequestId &&
    (
      metadata.orderType === "catering_deposit" ||
      (metadata.lane === "catering" && metadata.type === "deposit")
    );

  // catering deposits should NOT enter pickup order pipeline
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

    await redis.set(`delish:stripe:session:${sessionId}`, {
      processedAt: new Date().toISOString(),
      eventType: event.type,
      cateringDeposit: true,
      cateringRequestId: metadata.cateringRequestId || "",
    });

    return res.status(200).json({ received: true, catering: true });
  }

  // safe items parse for pickup orders
  let items = [];
  try {
    items = JSON.parse(metadata.itemsJson || "[]");
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }

  const existingOrderId = await redis.get(`delish:order:by-session:${sessionId}`);
  if (existingOrderId) {
    await redis.set(`delish:stripe:session:${sessionId}`, {
      processedAt: new Date().toISOString(),
      eventType: event.type,
      duplicateOrder: true,
      orderId: existingOrderId,
    });

    return res.status(200).json({
      received: true,
      duplicate: true,
      orderId: existingOrderId,
    });
  }

  const order = {
    id: crypto.randomUUID(),
    orderNumber: metadata.orderNumber || metadata.recordId || `DL-${Date.now()}`,
    createdAt: new Date().toISOString(),
    completedAt: "",
    status: "active",
    smsConsent: metadata.smsConsent === "yes" ? "yes" : "no",
    customerName: metadata.customerName || "",
    customerPhone: metadata.customerPhone || "",
    customerEmail: metadata.customerEmail || "",
    pickupDate: metadata.pickupDate || "",
    pickupWindow: metadata.pickupWindow || "",
    notes: metadata.notes || "",
    items,
    subtotal: Number(metadata.subtotal || 0),
    tax: Number(metadata.tax || 0),
    total:
      typeof session.amount_total === "number"
        ? Number((session.amount_total / 100).toFixed(2))
        : Number(metadata.total || 0),
    paymentStatus: "paid",
    source: metadata.source || "stripe-webhook",
    stripeSessionId: sessionId,
  };

  // create order first
  await redis.set(`delish:order:${order.id}`, order);
  await redis.lpush("delish:orders:list", order.id);
  await redis.set(`delish:order:by-session:${sessionId}`, order.id);

  // pickup SMS + owner alert
  try {
    const smsConsent = metadata.smsConsent === "yes";
    const smsTo = normalizeUsPhone(metadata.customerPhone || "");

    if (smsConsent && smsTo) {
      console.log("DELISH ABOUT TO CALL SMS HELPER:", {
        sessionId: session.id,
        smsTo,
        smsConsent,
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

      const ownerSmsTo = normalizeUsPhone(process.env.DELISH_ORDER_ALERT_TO || "");

      if (ownerSmsTo) {
        await sendDelishSms({
          to: ownerSmsTo,
          message: buildOwnerNewOrderSms({
            ...metadata,
            amountTotal:
              typeof session.amount_total === "number"
                ? (session.amount_total / 100).toFixed(2)
                : "",
          }),
        });
      }

      console.log("DELISH SMS HELPER RESULT:", smsResult);
      console.log("DELISH PICKUP SMS SENT:", session.id);
    } else {
      console.log("DELISH PICKUP SMS SKIPPED:", {
        smsConsent,
        rawPhone: metadata.customerPhone || "",
        normalizedPhone: smsTo,
      });
    }
  } catch (smsError) {
    console.error("DELISH PICKUP SMS ERROR:", smsError);
  }

  // mark processed LAST
  await redis.set(`delish:stripe:session:${sessionId}`, {
    processedAt: new Date().toISOString(),
    eventType: event.type,
    orderId: order.id,
    orderNumber: order.orderNumber,
  });

  return res.status(200).json({ received: true });
} catch (error) {
  console.error("DELISH STRIPE WEBHOOK ERROR:", error);

  try {
    const alertTo = normalizeUsPhone(process.env.DELISH_FAILURE_ALERT_TO || "");

    if (alertTo) {
      await sendDelishSms({
        to: alertTo,
        message: `🚨 DELISH WEBHOOK FAILURE

Customer: ${failureContext.customerName || "Unknown"}
Phone: ${failureContext.customerPhone || "N/A"}
Pickup: ${failureContext.pickupWindow || "N/A"}
Total: ${failureContext.total || "N/A"}
Session: ${failureContext.sessionId || "N/A"}

Error: ${String(error?.message || "Unknown error").slice(0, 160)}

Check system immediately.`,
      });
    }
  } catch (alertError) {
    console.error("DELISH FAILURE ALERT SMS ERROR:", alertError);
  }

  return res.status(400).send(`Webhook Error: ${error.message}`);
}
}
