export const config = {
  runtime: "nodejs"
};

const REDIS_URL = process.env.DELISH_UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;
const TZ = "America/Chicago";

/*
  IMPORTANT:
  Replace ORDER_LIST_KEY with the Redis list/key your Delish order flow actually uses.

  Common pattern examples:
  - "delish:orders"
  - "delish:orders:all"
  - "delish:pickup_orders"
  - whatever your kitchen/orders screen is reading from

  Start with your real orders key here:
*/
const ORDER_LIST_KEY = "delish:orders";

function send(res, status, data) {
  res.status(status).json(data);
}

async function redis(command, ...args) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Missing Delish Upstash Redis env vars.");
  }

  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      command: [command, ...args]
    })
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || `Redis ${command} failed.`);
  }

  return data.result;
}

function getCentralDateParts(iso) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(iso));

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day
  };
}

function getCentralDateKey(iso) {
  const p = getCentralDateParts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeOrder(raw) {
  if (!raw) return null;

  let order = raw;

  if (typeof raw === "string") {
    try {
      order = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!order || typeof order !== "object") return null;

  return order;
}

/*
  This function is the only part you may need to tweak slightly
  depending on your live Delish order object shape.

  It tries several common fields:
  - totalPaid
  - total
  - amount_total (Stripe cents)
  - orderTotal
*/
function extractOrderTotal(order) {
  if (typeof order.totalPaid !== "undefined") return toNumber(order.totalPaid);
  if (typeof order.total !== "undefined") return toNumber(order.total);
  if (typeof order.orderTotal !== "undefined") return toNumber(order.orderTotal);

  if (typeof order.amount_total !== "undefined") {
    const cents = toNumber(order.amount_total);
    return cents > 999 ? cents / 100 : cents;
  }

  if (order.stripe && typeof order.stripe.amount_total !== "undefined") {
    const cents = toNumber(order.stripe.amount_total);
    return cents > 999 ? cents / 100 : cents;
  }

  return 0;
}

/*
  We try several likely date fields used in Delish orders.
*/
function extractOrderDate(order) {
  return (
    order.pickupDate ||
    order.date ||
    order.createdAt ||
    order.timestamp ||
    order.receivedAt ||
    order.orderDate ||
    null
  );
}

function isPaidOrder(order) {
  if (order.paymentStatus) {
    return String(order.paymentStatus).toLowerCase() === "paid";
  }

  if (typeof order.paid !== "undefined") {
    return Boolean(order.paid);
  }

  if (order.status) {
    const s = String(order.status).toLowerCase();
    if (s === "paid" || s === "complete" || s === "completed") return true;
  }

  return true;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return send(res, 405, {
        ok: false,
        error: "Method not allowed."
      });
    }

    const date = String(req.query.date || "").trim();

    if (!date) {
      return send(res, 400, {
        ok: false,
        error: "date is required. Use YYYY-MM-DD."
      });
    }

    const rawOrders = await redis("LRANGE", ORDER_LIST_KEY, 0, 999);
    const orders = Array.isArray(rawOrders)
      ? rawOrders.map(normalizeOrder).filter(Boolean)
      : [];

    const filtered = orders.filter(order => {
      if (!isPaidOrder(order)) return false;

      const orderDate = extractOrderDate(order);
      if (!orderDate) return false;

      try {
        return getCentralDateKey(orderDate) === date;
      } catch {
        return false;
      }
    });

    const grossSales = filtered.reduce((sum, order) => {
      return sum + extractOrderTotal(order);
    }, 0);

    return send(res, 200, {
      ok: true,
      date,
      orderCount: filtered.length,
      grossSales: Math.round((grossSales + Number.EPSILON) * 100) / 100
    });
  } catch (err) {
    return send(res, 500, {
      ok: false,
      error: err.message || "Unable to load sales summary."
    });
  }
}
