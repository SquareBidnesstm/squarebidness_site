// api/fleetlog/stripe/checkout.js (PASTE READY — LIVE-safe, tier-normalized, no test/live mismatch surprises)
import Stripe from "stripe";
export const config = { runtime: "nodejs" };

function clean(s) {
  return String(s || "").replace(/(^"|"$)/g, "").trim();
}
function tierNorm(t) {
  return String(t || "").toLowerCase() === "fleet" ? "fleet" : "single";
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const key = clean(process.env.STRIPE_SECRET_KEY);
    if (!key)
      return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });

    const tier = tierNorm(req.query?.tier);
    const price =
      tier === "fleet"
        ? clean(process.env.STRIPE_PRICE_FLEET)
        : clean(process.env.STRIPE_PRICE_SINGLE);

    if (!price) {
      return res.status(500).json({
        ok: false,
        error: `Missing Stripe price env for tier: ${tier}`,
        hint:
          tier === "fleet"
            ? "Set STRIPE_PRICE_FLEET (price_live_...) in Vercel Production env."
            : "Set STRIPE_PRICE_SINGLE (price_live_...) in Vercel Production env.",
      });
    }

    // Keep these stable in LIVE. You can override via env if you want.
    const success =
      clean(process.env.STRIPE_SUCCESS_URL) ||
      "https://www.squarebidness.com/fleetlog/success/";
    const cancel =
      clean(process.env.STRIPE_CANCEL_URL) ||
      "https://www.squarebidness.com/fleetlog/";

    const stripe = new Stripe(key);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,

      // Put tier in BOTH places for reliability
      subscription_data: {
        metadata: { product: "sb-fleetlog", tier },
      },
      metadata: { product: "sb-fleetlog", tier },
    });

    // Redirect to Stripe Checkout
    return res.writeHead(302, { Location: session.url }).end();
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Stripe error",
      hint:
        "If you see 'similar object exists in live/test mode' then STRIPE_SECRET_KEY and STRIPE_PRICE_* are mismatched (test vs live).",
    });
  }
}
