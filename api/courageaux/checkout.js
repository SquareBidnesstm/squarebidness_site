const PRICES     = { 15: 40,  30: 65,  60: 110 };
const WED_PRICES = { 15: 25,  30: 65,  60: 110 };
const STATUS_KEY = "courageaux:status";
const BASE       = "https://www.squarebidness.com";

async function redis(command, ...args) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Upstash env vars");
  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

function calcPrice(slot, dateStr, status) {
  if (status.flashSaleActive && status.flashSaleDiscount > 0)
    return Math.round(PRICES[slot] * (1 - status.flashSaleDiscount / 100));
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return dow === 3 ? (WED_PRICES[slot] ?? PRICES[slot]) : (PRICES[slot] ?? 0);
}

async function stripePost(path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe error");
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.squarebidness.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { name, phone, address, slot, date, time, concern, skinType, breakout, notes } = req.body || {};
    const slotNum = parseInt(slot);

    if (!name || !phone || !address || !date || !time || ![15, 30, 60].includes(slotNum) || !concern || !skinType || !breakout) {
      return res.status(400).json({ ok: false, error: "Missing required fields." });
    }

    let status = { bookingOpen: false, flashSaleActive: false, flashSaleDiscount: 0 };
    try {
      const d = await redis("GET", STATUS_KEY);
      if (d?.result) status = { ...status, ...JSON.parse(d.result) };
    } catch {}

    if (!status.bookingOpen) {
      return res.status(409).json({ ok: false, error: "Booking is currently closed." });
    }

    const price = calcPrice(slotNum, date, status);
    const d = new Date(date + "T12:00:00");
    const dateLabel = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    const session = await stripePost("/checkout/sessions", {
      "mode": "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": `Courageaux Aesthetics — ${slotNum} min`,
      "line_items[0][price_data][product_data][description]": `${dateLabel} at ${time} · Mobile skincare`,
      "line_items[0][price_data][unit_amount]": String(price * 100),
      "line_items[0][quantity]": "1",
      "metadata[name]": name,
      "metadata[phone]": phone,
      "metadata[address]": address,
      "metadata[slot]": String(slotNum),
      "metadata[date]": date,
      "metadata[time]": time,
      "metadata[price]": String(price),
      "metadata[concern]": String(concern).slice(0, 100),
      "metadata[skinType]": String(skinType).slice(0, 50),
      "metadata[breakout]": String(breakout).slice(0, 10),
      "metadata[notes]": String(notes || "").slice(0, 400),
      "success_url": `${BASE}/courageaux/book/success/?session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url": `${BASE}/courageaux/book/`,
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err) {
    console.error("Checkout error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
