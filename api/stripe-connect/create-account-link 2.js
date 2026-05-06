import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const BASE_URL =
  process.env.SITE_URL || "https://www.squarebidness.com";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      business_profile: {
        product_description:
          "Operator payment system powered by Square Bidness"
      }
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${BASE_URL}/stripe-connect/refresh/?account=${account.id}`,
      return_url: `${BASE_URL}/stripe-connect/return/?account=${account.id}`,
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due"
      }
    });

    return res.redirect(303, accountLink.url);
  } catch (err) {
    console.error("Stripe Connect onboarding error:", err);
    return res.status(500).json({
      error: "Unable to start Stripe Connect onboarding.",
      detail: err.message
    });
  }
}
