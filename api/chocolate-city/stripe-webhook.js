import Stripe from "stripe";

const BOOKING_KEY = "chocolate-city:vip:bookings";
const DRINK_KEY = "chocolate-city:drink:credits";
const SESSION_KEY_PREFIX = "chocolate-city:stripe:session:";

export const config = {
  api: {
    bodyParser: false
  }
};

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

async function buffer(readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const stripeKey = process.env.CHOCOLATE_CITY_STRIPE_SECRET_KEY;
    const webhookSecret = process.env.CHOCOLATE_CITY_STRIPE_WEBHOOK_SECRET;

    if (!stripeKey) {
      return res.status(500).json({ ok: false, error: "Stripe key missing" });
    }

    if (!webhookSecret) {
      return res.status(500).json({ ok: false, error: "Webhook secret missing" });
    }

    const stripe = new Stripe(stripeKey);
    const sig = req.headers["stripe-signature"];
    const rawBody = await buffer(req);

    let event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook signature failed: ${err.message}`);
    }

    if (event.type !== "checkout.session.completed") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const session = event.data.object;
    const type = session?.metadata?.type || "";

    if (type !== "vip_deposit" && type !== "send_drink") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const sessionLockKey = `${SESSION_KEY_PREFIX}${session.id}`;
    const existing = await redis("GET", sessionLockKey);

    if (existing?.result) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    if (type === "vip_deposit") {
      const data = await redis("GET", BOOKING_KEY);
      const bookings = data?.result ? JSON.parse(data.result) : [];

      const booking = {
        sessionId: session.id,
        paidAt: new Date().toISOString(),
        customerName:
          session.metadata?.customerName ||
          session.customer_details?.name ||
          "",
        customerEmail: session.customer_details?.email || "",
        customerPhone: session.customer_details?.phone || "",
        packageId: session.metadata?.packageId || "",
        packageName: session.metadata?.packageName || "",
        fullPrice: Number(session.metadata?.fullPrice || 0),
        deposit: Number(session.metadata?.deposit || 0),
        remainingBalance: Number(session.metadata?.remainingBalance || 0),
        paymentStatus: session.payment_status || "paid",
        used: false,
        usedAt: ""
      };

      bookings.push(booking);

      await redis("SET", BOOKING_KEY, JSON.stringify(bookings));
      await redis(
        "SET",
        sessionLockKey,
        JSON.stringify({ processed: true, at: new Date().toISOString(), type })
      );

      return res.status(200).json({ received: true, booking });
    }

    if (type === "send_drink") {
      const data = await redis("GET", DRINK_KEY);
      const credits = data?.result ? JSON.parse(data.result) : [];

      const credit = {
        sessionId: session.id,
        paidAt: new Date().toISOString(),
        recipientName: session.metadata?.recipientName || "Guest",
        recipientPhone: session.metadata?.recipientPhone || "",
        senderName: session.metadata?.senderName || "Anonymous",
        message: session.metadata?.message || "",
        optionId: session.metadata?.optionId || "",
        label: session.metadata?.label || "Drink Credit",
        amount: Number(session.metadata?.amount || 0),
        customerEmail: session.customer_details?.email || "",
        customerPhone: session.customer_details?.phone || "",
        paymentStatus: session.payment_status || "paid",
        redeemed: false,
        redeemedAt: ""
      };

      credits.push(credit);

      await redis("SET", DRINK_KEY, JSON.stringify(credits));
      await redis(
        "SET",
        sessionLockKey,
        JSON.stringify({ processed: true, at: new Date().toISOString(), type })
      );

      return res.status(200).json({ received: true, credit });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
