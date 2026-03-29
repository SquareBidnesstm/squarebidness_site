// /api/puffs/approve-catering/index.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.PUFFS_STRIPE_SECRET_KEY);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanString(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function toMoneyNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
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

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed."
    });
  }

  if (
    !process.env.PUFFS_STRIPE_SECRET_KEY ||
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return res.status(500).json({
      ok: false,
      error: "Missing required env vars."
    });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const id = cleanString(body.id, 120);
    const depositAmount = toMoneyNumber(body.depositAmount);

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Request id is required."
      });
    }

    if (depositAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Valid deposit amount is required."
      });
    }

    const key = `puffs:catering:request:${id}`;
    const order = await redisGet(key);

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: "Catering request not found."
      });
    }

    const successUrl =
      process.env.PUFFS_CATERING_SUCCESS_URL ||
      "https://www.squarebidness.com/puffs/catering/";

    const cancelUrl =
      process.env.PUFFS_CATERING_CANCEL_URL ||
      "https://www.squarebidness.com/puffs/catering/orders/";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: `Puff’s Catering Deposit — ${order.customerName || "Customer"}`,
              description: order.eventDate
                ? `Event date: ${order.eventDate}`
                : "Catering deposit"
            },
            unit_amount: Math.round(depositAmount * 100)
          }
        }
      ],
      metadata: {
        brand: "puffs",
        requestId: id,
        requestNumber: cleanString(order.requestNumber, 80),
        customerName: cleanString(order.customerName, 120),
        type: "catering_deposit"
      }
    });

    const updated = {
      ...order,
      status: "deposit_sent",
      depositAmount: depositAmount.toFixed(2),
      depositLink: session.url || "",
      depositSentAt: new Date().toISOString()
    };

    await redisSet(key, updated);

    return res.status(200).json({
      ok: true,
      id,
      depositAmount: updated.depositAmount,
      depositLink: updated.depositLink
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to approve catering request."
    });
  }
}
