export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_HOLDINGS_SECRET_KEY) {
    return res.status(500).json({ error: "Missing STRIPE_HOLDINGS_SECRET_KEY" });
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY);

    const body = req.body || {};
    let accountId =
      typeof body.account === "string" && body.account.startsWith("acct_")
        ? body.account
        : null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        metadata: { platform: "squarebidness_holdings" }
      });
      accountId = account.id;
    }

    const session = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true }
      }
    });

    return res.status(200).json({
      client_secret: session.client_secret,
      account: accountId,
      publishable_key: process.env.STRIPE_HOLDINGS_PUBLISHABLE_KEY || ""
    });
  } catch (err) {
    console.error("create-account-session:", err.message);
    return res.status(500).json({ error: "Session creation failed", detail: err.message });
  }
}
