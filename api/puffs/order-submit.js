// /api/puffs/order-submit.js
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

function makeOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PUFF-${y}${m}${d}-${rand}`;
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

  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const ORDERS_KEY = "puffs:orders";

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Missing Upstash Redis env vars."
    });
  }

  async function redisPost(path) {
    const r = await fetch(`${REDIS_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      }
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Redis request failed (${r.status})`);
    return data;
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const customerName = cleanString(body.customerName, 120);
    const customerPhone = cleanString(body.customerPhone, 40);
    const pickupTime = cleanString(body.pickupTime, 80) || "ASAP";
    const notes = cleanString(body.notes, 500);
    const status = cleanString(body.status, 30) || "new";

    const items = Array.isArray(body.items)
      ? body.items
          .map((item) => ({
            qty: Math.max(0, Number(item.qty || 0)),
            name: cleanString(item.name, 160),
            price: toMoneyNumber(item.price)
          }))
          .filter((item) => item.qty > 0 && item.name)
      : [];

    if (!customerName) {
      return res.status(400).json({ ok: false, error: "Customer name is required." });
    }

    if (!items.length) {
      return res.status(400).json({ ok: false, error: "At least one item is required." });
    }

    const subtotal = toMoneyNumber(body.subtotal);
    const tax = toMoneyNumber(body.tax);
    const total = toMoneyNumber(body.total);

    const order = {
      orderNumber: makeOrderNumber(),
      createdAt: new Date().toISOString(),
      pickupTime,
      customerName,
      customerPhone,
      notes,
      status,
      items,
      subtotal,
      tax,
      total
    };

    const encoded = encodeURIComponent(JSON.stringify(order));

    await redisPost(`/lpush/${encodeURIComponent(ORDERS_KEY)}/${encoded}`);
    await redisPost(`/ltrim/${encodeURIComponent(ORDERS_KEY)}/0/199`);

    return res.status(200).json({
      ok: true,
      order
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to save order."
    });
  }
}
