import Stripe from "stripe";

const OPTIONS = {
  drink_10: {
    name: "$10 Drink Credit",
    amount: 10,
    description: "Drink credit redeemed in person at Chocolate City Lounge."
  },
  drink_25: {
    name: "$25 Premium Drink Credit",
    amount: 25,
    description: "Premium drink credit redeemed in person at Chocolate City Lounge."
  },
  drink_50: {
    name: "$50 Bottle / VIP Contribution",
    amount: 50,
    description: "Bottle or VIP contribution redeemed in person at Chocolate City Lounge."
  }
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const stripeKey = process.env.CHOCOLATE_CITY_STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return res.status(500).json({ ok: false, error: "Stripe key missing" });
    }

    const stripe = new Stripe(stripeKey);
    const body = req.body || {};

    const optionId = String(body.optionId || "").trim();
    const selectedOption = OPTIONS[optionId];

    if (!selectedOption) {
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
            unit_amount: selectedOption.amount * 100,
            product_data: {
              name: `Chocolate City — ${selectedOption.name}`,
              description: selectedOption.description
            }
          }
        }
      ],
      metadata: {
        type: "send_drink",
        business: "Chocolate City Lounge LLC",
        optionId,
        amount: String(selectedOption.amount),
        label: selectedOption.name,
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
