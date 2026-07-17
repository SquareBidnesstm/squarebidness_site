import Stripe from "stripe";

const DELISH_ACCOUNT = "acct_1TspkpAcqVPZn6LU";
const ADMIN_TOKEN = process.env.COURAGEAUX_ADMIN_TOKEN;

export default async function handler(req, res) {
  if (req.query.token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });

  const account = await stripe.accounts.update(DELISH_ACCOUNT, {
    business_profile: { name: "Delish" },
  });

  return res.status(200).json({
    ok: true,
    name: account.business_profile.name,
  });
}
