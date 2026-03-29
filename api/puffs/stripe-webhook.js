// /api/puffs/stripe-webhook.js
import Stripe from "stripe";

export const config = {
  api: {
    bodyParser: false
  }
};

const stripe = new Stripe(process.env.PUFFS_STRIPE_SECRET_KEY);

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

async function handleFoodOrderCompleted(session) {
  const pendingKey = `puffs:checkout:${session.id}`;
  const pending = await redisGet(pendingKey);

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
    return res.status(500).send(err.message || "Webhook processing failed");
  }
}
