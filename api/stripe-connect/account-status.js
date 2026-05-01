import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const accountId = req.query.account;

    if (!accountId || !accountId.startsWith("acct_")) {
      return res.status(400).json({ error: "Missing or invalid account ID" });
    }

    const account = await stripe.accounts.retrieve(accountId);

    return res.status(200).json({
      accountId: account.id,
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      disabledReason: account.requirements?.disabled_reason || null,
      currentlyDue: account.requirements?.currently_due || [],
      eventuallyDue: account.requirements?.eventually_due || [],
      pastDue: account.requirements?.past_due || []
    });
  } catch (err) {
    console.error("Stripe account status error:", err);
    return res.status(500).json({
      error: "Unable to check Stripe account status.",
      detail: err.message
    });
  }
}
