import Stripe from "stripe";
import {
  buildVipCode,
  findVipBooking,
  getVipBookings,
  getVipPackage
} from "../_lib/chocolate-city-vip.js";

export default async function handler(req, res) {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: "Missing session_id" });
    }

    if (!process.env.CHOCOLATE_CITY_STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "Stripe key missing" });
    }

    const stripe = new Stripe(process.env.CHOCOLATE_CITY_STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const bookings = await getVipBookings();
    const booking = findVipBooking(bookings, { sessionId });
    const selectedPackage = getVipPackage(session.metadata?.packageId);

    return res.status(200).json({
      ok: true,
      confirmed: !!booking,
      packageName: booking?.packageName || selectedPackage?.name || "VIP Section",
      eventDate: booking?.eventDate || session.metadata?.eventDate || "",
      eventLabel: booking?.eventLabel || session.metadata?.eventLabel || "",
      customerName:
        booking?.customerName ||
        session.metadata?.customerName ||
        session.customer_details?.name ||
        "",
      deposit: String(booking?.deposit ?? selectedPackage?.price ?? ""),
      remaining: String(booking?.remainingBalance ?? 0),
      customerPhone: booking?.customerPhone || session.customer_details?.phone || "",
      paymentStatus: booking?.paymentStatus || session.payment_status || "",
      vipCode: buildVipCode(sessionId)
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to finalize VIP reservation" });
  }
}
