export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const single = process.env.STRIPE_PRICE_SINGLE || "";
  const fleet = process.env.STRIPE_PRICE_FLEET || "";

  res.status(200).json({
    ok: true,
    key_prefix: key.slice(0, 8),        // should show "sk_test_"
    key_len: key.length,                // should be > 30
    single_prefix: single.slice(0, 6),   // should show "price_"
    fleet_prefix: fleet.slice(0, 6)      // should show "price_"
  });
}
