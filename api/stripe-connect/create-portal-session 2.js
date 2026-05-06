import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SITE_URL = process.env.SITE_URL || "https://www.squarebidness.com";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { session_id } = req.body || {};

    if (!session_id) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

    if (!checkoutSession.customer) {
      return res.status(400).json({ error: "No customer found on session" });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: checkoutSession.customer,
      return_url: `${SITE_URL}/stripe-connect/`
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error("Billing portal error:", err);
    return res.status(500).json({
      error: "Unable to create billing portal session.",
      detail: err.message
    });
  }
}
