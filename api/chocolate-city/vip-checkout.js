import {
  acquireVipHold,
  getVipEventLabel,
  getVipPackage,
  normalizeVipEventDate,
  refreshVipHold,
  releaseVipHold,
  sanitizeMetadataValue
} from "../_lib/chocolate-city-vip.js";

export default async function handler(req, res) {
  let hold = null;

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const stripeKey = process.env.CHOCOLATE_CITY_STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return res.status(500).json({ ok: false, error: "Stripe key missing" });
    }

    const body = req.body || {};
    const packageId = String(body.packageId || "");
    const eventDate = normalizeVipEventDate(body.eventDate);
    const selectedPackage = getVipPackage(packageId);
    const customerName = sanitizeMetadataValue(body.customerName, 80);

    if (!customerName) {
      return res.status(400).json({
        ok: false,
        error: "Section owner name required"
      });
    }

    if (!selectedPackage) {
      return res.status(400).json({
        ok: false,
        error: "Invalid VIP package"
      });
    }

    hold = await acquireVipHold({ packageId, customerName, eventDate });

    if (!hold) {
      return res.status(409).json({
        ok: false,
        error: "VIP sections are sold out or currently being checked out."
      });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const successUrl =
      process.env.CHOCOLATE_CITY_VIP_SUCCESS_URL ||
      "https://www.squarebidness.com/chocolate-city/vip-success/";

    const cancelUrl =
      process.env.CHOCOLATE_CITY_VIP_CANCEL_URL ||
      "https://www.squarebidness.com/chocolate-city/";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + (31 * 60),
      phone_number_collection: { enabled: true },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: selectedPackage.price * 100,
            product_data: {
              name: `Chocolate City VIP Section - ${selectedPackage.name}`,
              description: selectedPackage.description
            }
          }
        }
      ],
      metadata: {
        type: "vip_deposit",
        v: "1",
        packageId,
        eventDate,
        eventLabel: getVipEventLabel(eventDate),
        holdId: hold.holdId,
        holdSlot: String(hold.slot),
        customerName
      }
    });

    await refreshVipHold(hold, session.id);
    hold = null;

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err) {
    if (hold) {
      await releaseVipHold(hold).catch(() => {});
    }

    return res.status(500).json({ ok: false, error: "Unable to start VIP checkout." });
  }
}
