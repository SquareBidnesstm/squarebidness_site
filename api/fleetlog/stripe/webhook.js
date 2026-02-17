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
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🔥 MAIN LOGIC
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const customerEmail = session.customer_details?.email;
    const subscriptionId = session.subscription;

    console.log("New subscription:", {
      email: customerEmail,
      subscriptionId
    });

    // TODO (next step):
    // Save to Redis or DB
    // Create driver account
    // Send welcome email
  }

  res.status(200).json({ received: true });
}
