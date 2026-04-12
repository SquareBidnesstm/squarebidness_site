import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.SUPIMA_CHECKOUT_ENABLED !== "true") {
    return res.status(503).json({ error: "Supima checkout is temporarily disabled." });
  }

  try {
    const {
      product,
      name,
      color,
      size,
      unitAmount,
      quantity
    } = req.body || {};

    if (!product || !name || !size || !unitAmount) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const allowedSizes = ["XS", "S", "M", "L", "XL"];
    if (!allowedSizes.includes(size)) {
      return res.status(400).json({ error: "Invalid size selected." });
    }

    const siteUrl = process.env.SITE_URL || "https://www.squarebidness.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      billing_address_collection: "auto",
      shipping_address_collection: {
        allowed_countries: ["US"]
      },
      line_items: [
        {
          quantity: Number(quantity) || 1,
          price_data: {
            currency: "usd",
            unit_amount: Number(unitAmount),
            product_data: {
              name,
              metadata: {
                product,
                color: color || "",
                size
              }
            }
          }
        }
      ],
      metadata: {
        product,
        color: color || "",
        size
      },
      success_url: `${siteUrl}/supima/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/supima/?canceled=1`
    });

    return res.status(200).json({
      url: session.url,
      id: session.id
    });
  } catch (error) {
    console.error("SUPIMA CREATE CHECKOUT ERROR:", error);
    return res.status(500).json({
      error: "Unable to create checkout session."
    });
  }
}
