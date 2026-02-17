import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
  runtime: "nodejs"
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  const buf = await new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "customer.subscription.created") {
    const subscription = event.data.object;

    console.log("Subscription created:", subscription.id);

    // TODO:
    // 1. Create driver account
    // 2. Store tier
    // 3. Send welcome email
  }

  res.status(200).json({ received: true });
}
