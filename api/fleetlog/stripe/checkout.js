// api/fleetlog/stripe/checkout.js
import Stripe from "stripe";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });

    const tier = String(req.query?.tier || "single");
    const price =
      tier === "fleet" ? process.env.STRIPE_PRICE_FLEET : process.env.STRIPE_PRICE_SINGLE;

    if (!price) return res.status(500).json({ ok: false, error: `Missing Stripe price env for tier: ${tier}` });

    const success = process.env.STRIPE_SUCCESS_URL || "https://www.squarebidness.com/fleetlog/success/";
    const cancel = process.env.STRIPE_CANCEL_URL || "https://www.squarebidness.com/fleetlog/";

    const stripe = new Stripe(key);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      subscription_data: { metadata: { product: "sb-fleetlog", tier } },
      metadata: { product: "sb-fleetlog", tier }
    });

    return res.writeHead(302, { Location: session.url }).end();
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Stripe error",
      hint: "Check STRIPE_SECRET_KEY + STRIPE_PRICE_* match test/live mode, and that stripe is installed."
    });
  }
}
