import Stripe from "stripe";

export default async function handler(req, res) {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: "Missing session_id" });
    }

    const stripe = new Stripe(process.env.CHOCOLATE_CITY_STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return res.status(200).json({
      ok: true,
      packageName: session.metadata?.packageName || "VIP Section",
      customerName: session.metadata?.customerName || session.customer_details?.name || "",
      deposit: session.metadata?.deposit || "",
      remaining: session.metadata?.remainingBalance || "",
      customerName: session.customer_details?.name || "",
      customerPhone: session.customer_details?.phone || "",
      paymentStatus: session.payment_status || ""
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
