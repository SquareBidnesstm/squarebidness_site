// /api/puffs/stripe-webhook.js
import Stripe from "stripe";
import twilio from "twilio";

export const config = {
  api: {
    bodyParser: false
  }
};

const stripe = new Stripe(process.env.PUFFS_STRIPE_SECRET_KEY);

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function redisPost(pathname) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${REDIS_URL}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Redis request failed (${res.status})`);
  }
  return data;
}

async function redisGet(key) {
  const result = await redisPost(`/get/${encodeURIComponent(key)}`);
  if (!result || typeof result.result !== "string") return null;

  try {
    return JSON.parse(result.result);
  } catch {
    return null;
  }
}

async function redisSet(key, value) {
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(JSON.stringify(value));
  return redisPost(`/set/${encodedKey}/${encodedValue}`);
}

async function pushFoodOrder(order) {
  const encoded = encodeURIComponent(JSON.stringify(order));
  await redisPost(`/lpush/${encodeURIComponent("puffs:orders")}/${encoded}`);
  await redisPost(`/ltrim/${encodeURIComponent("puffs:orders")}/0/199`);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatItemsForSms(items) {
  if (!Array.isArray(items) || !items.length) return "Items: See order screen";
  return items
    .map((item) => `${Number(item.qty || 0)}x ${String(item.name || "").trim()}`)
    .filter(Boolean)
    .join(", ");
}

function normalizeUsPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sendSms({ to, body }) {
  if (
    !twilioClient ||
    !process.env.PUFFS_TWILIO_MESSAGING_SERVICE_SID ||
    !to ||
    !body
  ) {
    return {
      ok: false,
      skipped: true,
      hasTwilioClient: !!twilioClient,
      hasMessagingServiceSid: !!process.env.PUFFS_TWILIO_MESSAGING_SERVICE_SID,
      hasTo: !!to,
      hasBody: !!body
    };
  }

  const message = await twilioClient.messages.create({
    body,
    messagingServiceSid: process.env.PUFFS_TWILIO_MESSAGING_SERVICE_SID,
    to
  });

  return {
    ok: true,
    sid: message.sid,
    status: message.status,
    to
  };
}

async function sendInternalAlert(body) {
  if (!process.env.PUFFS_ALERT_NUMBER) {
    return { ok: false, skipped: true, reason: "missing_alert_number" };
  }

  return sendSms({
    to: process.env.PUFFS_ALERT_NUMBER,
    body
  });
}

function buildCustomerOrderSms(order) {
  const customerName = String(order.customerName || "").trim();
  const pickupTime = String(order.pickupTime || "").trim() || "ASAP";
  const greeting = customerName
    ? `Puff's: ${customerName}, your order is confirmed.`
    : `Puff's: Your order is confirmed.`;

  let itemLine = "Items unavailable";
  if (Array.isArray(order.items) && order.items.length) {
    itemLine = order.items
      .map((item) => `${String(item.name || "").trim()} (x${Number(item.qty || 0)})`)
      .filter(Boolean)
      .join(", ");
  }

  return `${greeting}

Pickup: ${pickupTime}
Item: ${itemLine}
Total: $${formatMoney(order.total)}

See you soon.`;
}

async function sendFoodOrderAlert(order) {
  const body = [
    "🔥 NEW PUFF'S ORDER",
    order.orderNumber || "",
    `Name: ${order.customerName || "Customer"}`,
    `Phone: ${order.customerPhone || "N/A"}`,
    `Pickup: ${order.pickupTime || "ASAP"}`,
    `Total: $${formatMoney(order.total)}`,
    formatItemsForSms(order.items)
  ]
    .filter(Boolean)
    .join("\n");

  return sendInternalAlert(body);
}

async function sendCustomerOrderSms(order) {
  const smsConsent = order.smsConsent === true || order.smsConsent === "yes";
  const customerPhone = normalizeUsPhone(order.customerPhone || "");

  if (!smsConsent || !customerPhone) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_consent_or_phone",
      smsConsent,
      customerPhone: order.customerPhone || "",
      normalizedPhone: customerPhone
    };
  }

  return sendSms({
    to: customerPhone,
    body: buildCustomerOrderSms(order)
  });
}

async function sendCateringDepositAlert(order) {
  const body = [
    "✅ PUFF'S CATERING DEPOSIT PAID",
    order.requestNumber || order.id || "",
    `Name: ${order.customerName || "Customer"}`,
    `Event Date: ${order.eventDate || "N/A"}`,
    `Deposit: $${formatMoney(order.depositAmount)}`
  ]
    .filter(Boolean)
    .join("\n");

  return sendInternalAlert(body);
}

async function handleFoodOrderCompleted(session) {
  const pendingKey = `puffs:checkout:${session.id}`;
  const pending = await redisGet(pendingKey);

  console.log("PUFFS FOOD ORDER COMPLETED:", {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    customerPhone: pending?.customerPhone || "",
    smsConsent: pending?.smsConsent
  });

  const paidOrder = {
    ...(pending || {}),
    stripeSessionId: session.id,
    stripePaymentIntent: session.payment_intent || "",
    stripeCustomerDetails: session.customer_details || null,
    paidAt: new Date().toISOString(),
    paymentStatus: session.payment_status || "paid",
    status: "new"
  };

  await pushFoodOrder(paidOrder);
  await redisSet(`puffs:paid:${session.id}`, paidOrder);
  await redisSet(`puffs:checkout:${session.id}`, paidOrder);

  console.log("PUFFS INTERNAL ALERT INPUT:", {
    to: process.env.PUFFS_ALERT_NUMBER || "",
    messagingServiceSid: process.env.PUFFS_TWILIO_MESSAGING_SERVICE_SID || ""
  });

  const alertResult = await sendFoodOrderAlert(paidOrder);
  console.log("PUFFS INTERNAL ALERT RESULT:", alertResult);

  console.log("PUFFS CUSTOMER SMS INPUT:", {
    rawPhone: paidOrder.customerPhone || "",
    smsConsent: paidOrder.smsConsent,
    normalizedPhone: normalizeUsPhone(paidOrder.customerPhone || "")
  });

  const customerSmsResult = await sendCustomerOrderSms(paidOrder);
  console.log("PUFFS CUSTOMER SMS RESULT:", customerSmsResult);
}

async function handleCateringDepositCompleted(session) {
  const requestId = String(session?.metadata?.requestId || "").trim();
  if (!requestId) return;

  const requestKey = `puffs:catering:request:${requestId}`;
  const request = await redisGet(requestKey);
  if (!request) return;

  const updated = {
    ...request,
    status: "deposit_paid",
    depositPaidAt: new Date().toISOString(),
    depositPaymentStatus: session.payment_status || "paid",
    depositStripeSessionId: session.id,
    depositStripePaymentIntent: session.payment_intent || "",
    depositCustomerDetails: session.customer_details || null
  };

  await redisSet(requestKey, updated);
  await redisSet(`puffs:catering:paid:${requestId}`, updated);

  const cateringAlertResult = await sendCateringDepositAlert(updated);
  console.log("PUFFS CATERING ALERT RESULT:", cateringAlertResult);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  if (
    !process.env.PUFFS_STRIPE_SECRET_KEY ||
    !process.env.PUFFS_STRIPE_WEBHOOK_SECRET ||
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return res.status(500).send("Missing env vars");
  }

  console.log("PUFFS WEBHOOK HIT:", req.method, new Date().toISOString());

  let event;

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.PUFFS_STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("PUFFS WEBHOOK EVENT TYPE:", event.type);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const flowType = String(session?.metadata?.type || "").trim();

      if (flowType === "catering_deposit") {
        await handleCateringDepositCompleted(session);
      } else {
        await handleFoodOrderCompleted(session);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("PUFFS WEBHOOK PROCESSING ERROR:", err);
    return res.status(500).send(err.message || "Webhook processing failed");
  }
}
