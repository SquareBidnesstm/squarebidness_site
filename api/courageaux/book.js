const AMARI_PHONE = "+19853512750";

const PRICES    = { 15: 40,  30: 65,  60: 110 };
const WED_PRICES = { 15: 25,  30: 65,  60: 110 };

function bookingKey(date) { return `courageaux:bookings:${date}`; }

async function redis(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
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
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: to, From: from, Body: body })
  });
  if (!res.ok) throw new Error(`Twilio error ${res.status}`);
  return res.json();
}

function calcPrice(slot, dateStr, flashActive, flashDiscount) {
  const dow = new Date(dateStr + "T12:00:00").getDay();
  const isWed = dow === 3;
  if (flashActive && flashDiscount > 0) {
    return Math.round(PRICES[slot] * (1 - flashDiscount / 100));
  }
  return isWed ? (WED_PRICES[slot] ?? PRICES[slot]) : (PRICES[slot] ?? 0);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.squarebidness.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Admin: GET bookings for a date
  if (req.method === "GET") {
    const token = req.headers["x-admin-token"];
    if (!process.env.COURAGEAUX_ADMIN_TOKEN || token !== process.env.COURAGEAUX_ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const date = req.query?.date || new Date().toISOString().slice(0, 10);
    try {
      const data = await redis("LRANGE", bookingKey(date), "0", "99");
      const bookings = (data?.result || []).map(b => JSON.parse(b)).reverse();
      return res.status(200).json({ ok: true, bookings });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false });

  try {
    const { name, phone, address, date, time, slot } = req.body || {};
    if (!name || !phone || !address || !date || !time || !slot) {
      return res.status(400).json({ ok: false, error: "Missing required fields." });
    }

    // Check booking is open
    let status = { bookingOpen: true, flashSaleActive: false, flashSaleDiscount: 0, flashSaleLabel: "" };
    try {
      const d = await redis("GET", "courageaux:status");
      if (d?.result) status = { ...status, ...JSON.parse(d.result) };
    } catch {}

    if (!status.bookingOpen) {
      return res.status(400).json({ ok: false, error: "Booking is currently closed." });
    }

    const slotNum = parseInt(slot);
    const price = calcPrice(slotNum, date, status.flashSaleActive, status.flashSaleDiscount);
    const bookingId = `CX-${Date.now()}`;

    const booking = {
      id: bookingId,
      name: String(name).slice(0, 80),
      phone: String(phone).slice(0, 20),
      address: String(address).slice(0, 200),
      date,
      time,
      slot: slotNum,
      price,
      flashSale: status.flashSaleActive,
      flashSaleLabel: status.flashSaleLabel,
      createdAt: new Date().toISOString()
    };

    await redis("LPUSH", bookingKey(date), JSON.stringify(booking));
    await redis("EXPIRE", bookingKey(date), 60 * 60 * 24 * 30);

    const saleNote = status.flashSaleActive && status.flashSaleLabel
      ? `\n🔥 ${status.flashSaleLabel}` : "";
    const msg = [
      `📅 NEW BOOKING — Courageaux`,
      `${saleNote}`,
      `Name: ${booking.name}`,
      `Phone: ${booking.phone}`,
      `Date: ${booking.date}  Time: ${booking.time}`,
      `Slot: ${slotNum} min  |  $${price}`,
      `📍 ${booking.address}`,
      `ID: ${bookingId}`
    ].filter(Boolean).join("\n");

    await sms(AMARI_PHONE, msg);

    return res.status(200).json({ ok: true, bookingId, price });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
