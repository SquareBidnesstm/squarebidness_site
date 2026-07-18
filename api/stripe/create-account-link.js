const BASE_URL = process.env.SITE_URL || "https://www.squarebidness.com";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_HOLDINGS_SECRET_KEY) {
    return res.status(500).json({ error: "Missing STRIPE_HOLDINGS_SECRET_KEY" });
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY);

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
      metadata: { platform: "squarebidness_holdings" },
    });

    const returnUrl  = new URL("/stripe/return/",  BASE_URL);
    const refreshUrl = new URL("/api/stripe/create-account-link/", BASE_URL);
    returnUrl.searchParams.set("account", account.id);

    const link = await stripe.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      return_url:  returnUrl.toString(),
      refresh_url: refreshUrl.toString(),
      collection_options: { fields: "eventually_due" },
    });

    return res.redirect(303, link.url);
  } catch (err) {
    console.error("stripe/create-account-link:", err.message);
    return res.status(500).json({ error: "Could not start onboarding.", detail: err.message });
  }
}
