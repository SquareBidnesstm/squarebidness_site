// api/fleetlog/stripe/checkout.js
import Stripe from "stripe";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const tier = String(req.query?.tier || "single");
    const price =
      tier === "fleet" ? process.env.STRIPE_PRICE_FLEET : process.env.STRIPE_PRICE_SINGLE;

    if (!price) return res.status(500).json({ ok: false, error: "Stripe price not set" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL || "https://www.squarebidness.com/fleetlog/success/",
      cancel_url: process.env.STRIPE_CANCEL_URL || "https://www.squarebidness.com/fleetlog/",
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          product: "sb-fleetlog",
          tier,
        },
      },
      metadata: {
        product: "sb-fleetlog",
        tier,
      },
    });

    // redirect user to Stripe hosted checkout
    res.writeHead(302, { Location: session.url });
    res.end();
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "Stripe error" });
  }
}
