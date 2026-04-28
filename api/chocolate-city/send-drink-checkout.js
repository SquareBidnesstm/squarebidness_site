const Stripe = require("stripe");

const OPTIONS = {
  drink_10: { name: "Send a Drink Credit", amount: 10 },
  drink_25: { name: "Send a Premium Drink Credit", amount: 25 },
  drink_50: { name: "Send a Bottle Contribution", amount: 50 }
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const stripe = Stripe(process.env.CHOCOLATE_CITY_STRIPE_SECRET_KEY);
    const body = req.body || {};
    const item = OPTIONS[body.optionId];

    if (!item) {
      return res.status(400).json({ ok: false, error: "Invalid drink option" });
    }

    const recipientName = String(body.recipientName || "").trim();
    const senderName = String(body.senderName || "").trim();
    const message = String(body.message || "").trim();

    if (!recipientName) {
      return res.status(400).json({ ok: false, error: "Recipient name required" });
    }

    const successUrl =
      process.env.CHOCOLATE_CITY_SEND_DRINK_SUCCESS_URL ||
      "https://www.squarebidness.com/chocolate-city/send-drink/success/";

    const cancelUrl =
      process.env.CHOCOLATE_CITY_SEND_DRINK_CANCEL_URL ||
      "https://www.squarebidness.com/chocolate-city/send-drink/";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      phone_number_collection: { enabled: true },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: item.amount * 100,
            product_data: {
              name: `Chocolate City — ${item.name}`,
              description: `Drink credit for ${recipientName}`
            }
          }
        }
      ],
      metadata: {
        type: "send_drink",
        business: "Chocolate City Lounge LLC",
        optionId: body.optionId,
        amount: String(item.amount),
        recipientName,
        senderName,
        message
      }
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
