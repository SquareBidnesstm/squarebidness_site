import crypto from "crypto";

export const config = { api: { bodyParser: false } };

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

function verifyStripe(rawBody, sig, secret) {
  const parts = sig.split(",");
  const ts    = parts.find(p => p.startsWith("t="))?.slice(2);
  const v1    = parts.find(p => p.startsWith("v1="))?.slice(3);
  if (!ts || !v1) return false;

  const signedPayload = Buffer.concat([Buffer.from(`${ts}.`), rawBody]);
  const expected      = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig    = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return res.status(400).json({ error: "Missing config" });

  const rawBody = await rawBuffer(req);

  if (!verifyStripe(rawBody, sig, secret)) {
    return res.status(400).json({ error: "Signature mismatch" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { name, phone, address, slot, date, time, price } = session.metadata || {};

    if (name && date && time && slot) {
      const bookingId = `CX-${Date.now().toString(36).toUpperCase()}`;
      const booking   = JSON.stringify({
        id: bookingId,
        name:    String(name).slice(0, 80),
        phone:   String(phone  || "").slice(0, 20),
        address: String(address || "").slice(0, 200),
        slot:    parseInt(slot),
        date,
        time,
        price:   parseInt(price || 0),
        paidAt:  new Date().toISOString(),
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
        await sms(AMARI_PHONE, [
          `💳 PAID — Courageaux Booking`,
          `${slot} min · ${dl} at ${time}`,
          `Name: ${name}`,
          `Phone: ${phone}`,
          `📍 ${address}`,
          `💰 $${price} paid`,
          `ID: ${bookingId}`,
        ].join("\n"));
      } catch (err) {
        console.error("SMS error:", err.message);
      }
    }
  }

  return res.status(200).json({ ok: true });
}
