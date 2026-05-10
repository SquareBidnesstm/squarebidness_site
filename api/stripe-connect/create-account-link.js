const BASE_URL =
  process.env.SITE_URL || "https://www.squarebidness.com";

const CLIENT_LABELS = {
  delish: "Delish",
  puffs: "Puff's Smokehouse",
  restaurant: "Restaurant onboarding",
  foodtruck: "Food truck onboarding"
};

function cleanParam(value, fallback = "") {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || fallback)
    .trim()
    .replace(/[^\w .:-]/g, "")
    .slice(0, 80);
}

function cleanReturnTo(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const path = String(raw || "").trim();

  if (!path.startsWith("/") || path.startsWith("//")) {
    return "";
  }

  return path.replace(/[^\w./?=&%-]/g, "").slice(0, 160);
}

function buildUrl(path, params) {
  const url = new URL(path, BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "Missing STRIPE_SECRET_KEY in Vercel environment variables."
      });
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const leadId = cleanParam(req.query.leadId);
    const client = cleanParam(req.query.client);
    const source = cleanParam(req.query.source, "direct_stripe_connect");
    const returnTo = cleanReturnTo(req.query.returnTo);
    const clientLabel =
      CLIENT_LABELS[client] ||
      (source.includes("restaurant")
        ? CLIENT_LABELS.restaurant
        : source.includes("foodtruck")
          ? CLIENT_LABELS.foodtruck
          : "Square Bidness onboarding");

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      business_profile: {
        product_description:
          `${clientLabel} payment system powered by Square Bidness`
      },
      metadata: {
        square_bidness_client: client || "not_provided",
        square_bidness_source: source,
        square_bidness_lead_id: leadId || "not_provided",
        square_bidness_return_to: returnTo || "not_provided"
      }
    });

    const linkParams = {
      account: account.id,
      client,
      leadId,
      source,
      returnTo
    };

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: buildUrl("/stripe-connect/refresh/", linkParams),
      return_url: buildUrl("/stripe-connect/return/", linkParams),
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
