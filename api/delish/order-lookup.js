// FILE: /api/delish/order-lookup.js
import Stripe from "stripe";
import { requireDelishOperatorAuth } from "../_lib/delish-operator-auth.js";

const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function detectQueryType(q) {
  if (/^DL-\d{6}-\d+/i.test(q)) return "order";
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 10) return "phone";
  return "name";
}

function normalizePhone(p) {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+1${digits}`;
}

function formatSession(session) {
  const meta = session.metadata || {};
  const orderNumber = meta.orderNumber || meta.recordId || "";
  const total = meta.total
    ? `$${Number(meta.total).toFixed(2)}`
    : `$${((session.amount_total || 0) / 100).toFixed(2)}`;

  const createdDate = new Date(session.created * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    sessionId: session.id,
    orderNumber,
    customerName: meta.customerName || "",
    customerPhone: meta.customerPhone || "",
    pickupDate: meta.pickupDate || "",
    pickupWindow: meta.pickupWindow || "",
    total,
    createdDate,
    receiptUrl: orderNumber ? `/delish/receipt/${orderNumber}/` : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!requireDelishOperatorAuth(req, res)) return;

  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.status(400).json({
      ok: false,
      error: "Query too short. Enter a name, phone number, or order number.",
    });
  }

  const type = detectQueryType(q);

  try {
    let sessions = [];

    if (type === "order") {
      const result = await stripe.checkout.sessions.search({
        query: `metadata["orderNumber"]:"${q.toUpperCase()}" AND metadata["brand"]:"Delish"`,
        limit: 5,
      });
      sessions = result.data;
    } else if (type === "phone") {
      const phone = normalizePhone(q);
      const result = await stripe.checkout.sessions.search({
        query: `metadata["customerPhone"]:"${phone}" AND metadata["brand"]:"Delish"`,
        limit: 25,
      });
      sessions = result.data;
    } else {
      // Name: exact Stripe search first
      const result = await stripe.checkout.sessions.search({
        query: `metadata["customerName"]:"${q}" AND metadata["brand"]:"Delish"`,
        limit: 25,
      });
      sessions = result.data;

      // Fallback: list recent 100 sessions and filter client-side
      if (sessions.length === 0) {
        const listed = await stripe.checkout.sessions.list({ limit: 100 });
        const lower = q.toLowerCase();
        sessions = listed.data.filter(
          (s) =>
            s.metadata?.brand === "Delish" &&
            (s.metadata?.customerName || "").toLowerCase().includes(lower)
        );
      }
    }

    const results = sessions
      .filter((s) =>
        (s.metadata?.orderNumber || s.metadata?.recordId || "").startsWith("DL-")
      )
      .sort((a, b) => b.created - a.created)
      .slice(0, 20)
      .map(formatSession);

    return res.status(200).json({ ok: true, results, query: q, type });
  } catch (err) {
    console.error("DELISH ORDER LOOKUP ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
