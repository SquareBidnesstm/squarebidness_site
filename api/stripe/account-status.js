export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_HOLDINGS_SECRET_KEY) {
    return res.status(500).json({ error: "Missing STRIPE_HOLDINGS_SECRET_KEY" });
  }

  const accountId = req.query.account;
  if (!accountId || !String(accountId).startsWith("acct_")) {
    return res.status(400).json({ error: "Missing or invalid account ID" });
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY);
    const account = await stripe.accounts.retrieve(accountId);

    return res.status(200).json({
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      currentlyDue: account.requirements?.currently_due || [],
      pastDue: account.requirements?.past_due || []
    });
  } catch (err) {
    console.error("stripe/account-status:", err.message);
    return res.status(500).json({ error: "Unable to check account status" });
  }
}
