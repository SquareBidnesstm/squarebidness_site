import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY);

const SITE_URL = process.env.SITE_URL || "https://www.squarebidness.com";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { lookup_key, client = "squarebidness" } = req.body || {};

    if (!lookup_key) {
      return res.status(400).json({ error: "Missing lookup_key" });
    }

    const prices = await stripe.prices.list({
      lookup_keys: [lookup_key],
      expand: ["data.product"],
      limit: 1
    });

    if (!prices.data.length) {
      return res.status(404).json({ error: "No price found for lookup_key" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: prices.data[0].id,
          quantity: 1
        }
      ],
      success_url: `${SITE_URL}/stripe-connect/return/?session_id={CHECKOUT_SESSION_ID}&client=${encodeURIComponent(client)}`,
      cancel_url: `${SITE_URL}/stripe-connect/?canceled=1`,
      metadata: {
        client,
        lane: "square_bidness_subscription"
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Subscription checkout error:", err);
    return res.status(500).json({
      error: "Unable to create subscription checkout session.",
      detail: err.message
    });
  }
}
