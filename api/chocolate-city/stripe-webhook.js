import Stripe from "stripe";
import {
  VIP_BOOKING_LOCK_KEY,
  VIP_LIMIT,
  acquireRedisLock,
  getVipBookings,
  getVipEventLabel,
  getVipHold,
  getVipPackage,
  normalizeVipEventDate,
  releaseRedisLock,
  releaseVipHold,
  redis,
  saveVipBookings
} from "../_lib/chocolate-city-vip.js";

const DRINK_KEY = "chocolate-city:drink:credits";
const SESSION_KEY_PREFIX = "chocolate-city:stripe:session:";
const PROCESSING_KEY_PREFIX = "chocolate-city:stripe:processing:";

export const config = {
  api: {
    bodyParser: false
  }
};

async function buffer(readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

async function markSessionProcessed(sessionLockKey, type, extra = {}) {
  await redis(
    "SET",
    sessionLockKey,
    JSON.stringify({ processed: true, at: new Date().toISOString(), type, ...extra })
  );
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
      return res.status(400).send("Webhook signature failed");
    }

    if (event.type !== "checkout.session.completed") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const session = event.data.object;
    const type = session?.metadata?.type || "";

    if (type !== "vip_deposit" && type !== "send_drink") {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (session.payment_status && session.payment_status !== "paid") {
      return res.status(200).json({ received: true, ignored: true, paymentStatus: session.payment_status });
    }

    const sessionLockKey = `${SESSION_KEY_PREFIX}${session.id}`;
    const existing = await redis("GET", sessionLockKey);
    if (existing?.result) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const processingKey = `${PROCESSING_KEY_PREFIX}${session.id}`;
    const processingValue = JSON.stringify({ at: new Date().toISOString(), type });
    const processing = await acquireRedisLock(
      processingKey,
      processingValue,
      60
    );

    if (!processing) {
      return res.status(200).json({ received: true, duplicate: true, processing: true });
    }

    if (type === "vip_deposit") {
      const lockValue = JSON.stringify({ sessionId: session.id, at: new Date().toISOString() });
      const bookingLock = await acquireRedisLock(VIP_BOOKING_LOCK_KEY, lockValue, 10);

      if (!bookingLock) {
        await releaseRedisLock(processingKey, processingValue);
        return res.status(500).json({ ok: false, error: "VIP booking is busy. Retry webhook." });
      }

      try {
        const eventDate = normalizeVipEventDate(session.metadata?.eventDate);
        const bookings = await getVipBookings(eventDate);
        const existingBooking = bookings.find((booking) => booking.sessionId === session.id);

        if (existingBooking) {
          await markSessionProcessed(sessionLockKey, type, { duplicateBooking: true });
          return res.status(200).json({ received: true, duplicate: true, booking: existingBooking });
        }

        const overCapacity = bookings.length >= VIP_LIMIT;

        const packageId = session.metadata?.packageId || "";
        const selectedPackage = getVipPackage(packageId);

        if (!selectedPackage) {
          await markSessionProcessed(sessionLockKey, type, { skipped: "invalid_package" });
          return res.status(200).json({ received: true, skipped: true, reason: "invalid_package" });
        }

        const holdSlot = Number(session.metadata?.holdSlot || 0);
        const holdId = session.metadata?.holdId || "";
        const hold = await getVipHold(holdSlot, eventDate);
        const holdMatches = !!holdSlot && !!hold && hold.holdId === holdId;
        const holdExpired = !!holdSlot && !holdMatches;

        const booking = {
          sessionId: session.id,
          paidAt: new Date().toISOString(),
          customerName:
            session.metadata?.customerName ||
            session.customer_details?.name ||
            "",
          customerEmail: session.customer_details?.email || "",
          customerPhone: session.customer_details?.phone || "",
          packageId,
          packageName: selectedPackage.name,
          eventDate,
          eventLabel: getVipEventLabel(eventDate),
          fullPrice: selectedPackage.fullPrice,
          deposit: selectedPackage.price,
          remainingBalance: Math.max(0, selectedPackage.fullPrice - selectedPackage.price),
          paymentStatus: session.payment_status || "paid",
          holdId: holdMatches ? holdId : "",
          holdSlot: holdMatches ? holdSlot : "",
          holdExpired,
          overCapacity,
          needsReview: overCapacity,
          used: false,
          usedAt: ""
        };

        bookings.push(booking);

        await saveVipBookings(bookings, eventDate);
        await markSessionProcessed(sessionLockKey, type);

        if (holdMatches) {
          await releaseVipHold({ slot: holdSlot, eventDate });
        }

        return res.status(200).json({ received: true, booking });
      } finally {
        await releaseRedisLock(VIP_BOOKING_LOCK_KEY, lockValue).catch(() => {});
        await releaseRedisLock(processingKey, processingValue).catch(() => {});
      }
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
      await markSessionProcessed(sessionLockKey, type);
      await releaseRedisLock(processingKey, processingValue).catch(() => {});

      return res.status(200).json({ received: true, credit });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to process Chocolate City webhook." });
  }
}
