const PRICES     = { 15: 40,  30: 65,  60: 110 };
const WED_PRICES = { 15: 25,  30: 65,  60: 110 };
const STATUS_KEY  = "courageaux:status";
const BASE        = "https://www.squarebidness.com";
const AMARI_PHONE = "+19853512750";

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

async function sms(to, body) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_HEALTH_NUMBER;
  if (!sid || !auth || !from) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
}

function calcPrice(slot, dateStr, status) {
  if (status.flashSaleActive && status.flashSaleDiscount > 0)
    return Math.round((PRICES[slot] || 0) * (1 - status.flashSaleDiscount / 100));
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return dow === 3 ? (WED_PRICES[slot] ?? PRICES[slot]) : (PRICES[slot] ?? 0);
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
    const id    = `CX-${Date.now().toString(36).toUpperCase()}`;

    const pending = {
      id,
      name:        String(name).slice(0, 80),
      phone:       String(phone    || "").slice(0, 20),
      address:     String(address  || "").slice(0, 200),
      slot:        slotNum,
      date,
      time,
      price,
      concern:     String(concern  || "").slice(0, 100),
      skinType:    String(skinType || "").slice(0, 50),
      breakout:    String(breakout || "").slice(0, 10),
      notes:       String(notes    || "").slice(0, 400),
      requestedAt: new Date().toISOString(),
    };

    await redis("SET",    `courageaux:pending:${id}`, JSON.stringify(pending));
    await redis("EXPIRE", `courageaux:pending:${id}`, String(60 * 60 * 24 * 7));

    const adminToken = process.env.COURAGEAUX_ADMIN_TOKEN || "2750";
    const acceptUrl  = `${BASE}/api/courageaux/accept?id=${id}&token=${adminToken}`;
    const d          = new Date(date + "T12:00:00");
    const dateLabel  = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    const msg = [
      `📅 Booking Request — Courageaux`,
      `${slotNum} min · ${dateLabel} at ${time}`,
      ``,
      `${name}`,
      `${phone}`,
      `📍 ${address}`,
      `💰 $${price}`,
      ``,
      `🧴 ${concern} · ${skinType}`,
      `Breakouts: ${breakout}`,
      notes ? `Notes: ${notes}` : null,
      ``,
      `✅ Accept: ${acceptUrl}`,
    ].filter(l => l !== null).join("\n");

    try { await sms(AMARI_PHONE, msg); } catch (err) { console.error("SMS error:", err.message); }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Request error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
