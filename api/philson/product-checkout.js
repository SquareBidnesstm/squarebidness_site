const BASE_URL = process.env.SITE_URL || "https://www.squarebidness.com";
const PHILSON_DESTINATION_ACCOUNT = "acct_1U9TKsPdN2nTzd6F";

const PRODUCTS = {
  "135-roses": {
    name: "135 Roses — Luxury Bouquet",
    description: "Philson Le Fleuriste signature 135-rose luxury bouquet. Available for pickup or local delivery.",
    price: 40000, // $400.00 in cents
    display: "$400",
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!process.env.STRIPE_HOLDINGS_SECRET_KEY) {
    return res.status(500).json({ ok: false, error: "Missing STRIPE_HOLDINGS_SECRET_KEY" });
  }

  const body = req.body || {};
  const productId = String(body.product || "").trim();
  const email     = String(body.email    || "").trim();
  const phone     = String(body.phone    || "").trim();
  const name      = String(body.name     || "").trim();

  const product = PRODUCTS[productId];
  if (!product) {
    return res.status(400).json({ ok: false, error: `Unknown product: ${productId}` });
  }

  // Alert Philson immediately — fire and forget
  const alertTo   = process.env.PHILSON_ALERT_TO;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom  = process.env.PHILSON_TWILIO_FROM_NUMBER;
  if (alertTo && twilioSid && twilioToken && twilioFrom) {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
    fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        To: alertTo,
        From: twilioFrom,
        Body: `PHILSON SHOP ORDER\n\n${product.name} — ${product.display}${name ? `\n${name}` : ""}${phone ? `\n${phone}` : ""}${email ? `\n${email}` : ""}\n\nStripe checkout initiated.`,
      }),
    }).catch(() => {});
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      automatic_payment_methods: { enabled: true },
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.price,
        },
        quantity: 1,
      }],
      customer_email: email || undefined,
      metadata: {
        product: productId,
        name,
        phone,
        source: "philson-product-checkout",
      },
      payment_intent_data: {
        transfer_data: { destination: PHILSON_DESTINATION_ACCOUNT },
        metadata: { product: productId, name, phone },
      },
      success_url: `${BASE_URL}/philson-le-fleuriste/shop/success/?product=${productId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/philson-le-fleuriste/luxury-floral-design/`,
    });

    return res.status(200).json({ ok: true, checkout_url: session.url });
  } catch (err) {
    console.error("PHILSON PRODUCT CHECKOUT ERROR:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
