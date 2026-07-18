import Stripe from "stripe";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.STRIPE_ONBOARDING_SECRET_KEY) {
      return res.status(500).json({
        error: "Missing STRIPE_ONBOARDING_SECRET_KEY in Vercel environment variables."
      });
    }

    const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY);

    const accountId = req.query.account;

    if (!accountId || !String(accountId).startsWith("acct_")) {
      return res.status(400).json({ error: "Missing or invalid account ID" });
    }

    const account = await stripe.accounts.retrieve(accountId);

    const isReady =
      account.details_submitted &&
      account.charges_enabled &&
      account.payouts_enabled;

    // Provision a Treasury financial account the first time this account is confirmed ready
    let financialAccountId = null;
    if (isReady) {
      try {
        const existingFAs = await stripe.treasury.financialAccounts.list(
          { limit: 1 },
          { stripeAccount: accountId }
        );
        if (existingFAs.data.length > 0) {
          financialAccountId = existingFAs.data[0].id;
        } else {
          const fa = await stripe.treasury.financialAccounts.create(
            {
              supported_currencies: ["usd"],
              features: {
                inbound_transfers: { ach: { requested: true } },
                outbound_payments: { ach: { requested: true } },
                outbound_transfers: { ach: { requested: true } },
              },
            },
            { stripeAccount: accountId }
          );
          financialAccountId = fa.id;
        }
      } catch (faErr) {
        // Treasury not yet enabled — non-fatal
        console.warn("[account-status] Treasury FA skipped:", faErr.message);
      }
    }

    return res.status(200).json({
      accountId: account.id,
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      disabledReason: account.requirements?.disabled_reason || null,
      currentlyDue: account.requirements?.currently_due || [],
      eventuallyDue: account.requirements?.eventually_due || [],
      pastDue: account.requirements?.past_due || [],
      ...(financialAccountId ? { financialAccountId } : {}),
    });
  } catch (err) {
    console.error("Stripe account status error:", err);

    return res.status(500).json({
      error: "Unable to check Stripe account status.",
      detail: err.message || String(err)
    });
  }
}
