// FILE: /api/delish/stripe-webhook.js
import { Redis } from "@upstash/redis";
import Stripe from "stripe";

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

      if (
        metadata.orderType === "catering_deposit" &&
        metadata.cateringRequestId
      ) {
        const key = `delish:catering:${metadata.cateringRequestId}`;
        const existing = await redis.get(key);

        if (existing) {
          const updated = {
            ...existing,
            updatedAt: new Date().toISOString(),
            status: "deposit_paid",
            depositPaidAt: new Date().toISOString(),
            depositSessionId: session.id || existing.depositSessionId || "",
          };

          await redis.set(key, updated);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("DELISH STRIPE WEBHOOK ERROR:", error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
}
