import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const AMARI_PHONE = "+19853512750";

async function rawBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

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


export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig    = req.headers["stripe-signature"];
  const secret = process.env.COURAGEAUX_STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return res.status(400).json({ error: "Missing config" });

  const rawBody = await rawBuffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("COURAGEAUX webhook signature error:", err.message);
    return res.status(400).json({ error: "Signature mismatch" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { name, phone, address, slot, date, time, price, concern, skinType, breakout, notes } = session.metadata || {};

    if (name && date && time && slot) {
      const bookingId = `CX-${Date.now().toString(36).toUpperCase()}`;
      const booking   = JSON.stringify({
        id: bookingId,
        name:     String(name).slice(0, 80),
        phone:    String(phone    || "").slice(0, 20),
        address:  String(address  || "").slice(0, 200),
        slot:     parseInt(slot),
        date,
        time,
        price:    parseInt(price || 0),
        concern:  concern  || "",
        skinType: skinType || "",
        breakout: breakout || "",
        notes:    notes    || "",
        paidAt:   new Date().toISOString(),
        stripeSession: session.id,
      });

      try {
        await redis("LPUSH",  `courageaux:bookings:${date}`, booking);
        await redis("EXPIRE", `courageaux:bookings:${date}`, String(60 * 60 * 24 * 30));
      } catch (err) {
        console.error("Redis error:", err.message);
      }

      try {
        const d  = new Date(date + "T12:00:00");
        const dl = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        const lines = [
          `💳 PAID — Courageaux Booking`,
          `${slot} min · ${dl} at ${time}`,
          `Name: ${name}`,
          `Phone: ${phone}`,
          `📍 ${address}`,
          `💰 $${price} paid`,
          ``,
          `🧴 Concern: ${concern || "—"}`,
          `Skin type: ${skinType || "—"}`,
          `Breakouts: ${breakout || "—"}`,
        ];
        if (notes) lines.push(`Notes: ${notes}`);
        lines.push(`ID: ${bookingId}`);
        await sms(AMARI_PHONE, lines.join("\n"));
      } catch (err) {
        console.error("SMS error:", err.message);
      }
    }
  }

  return res.status(200).json({ ok: true });
}
