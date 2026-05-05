import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product", "payment_intent"]
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    const isPaid =
      session.payment_status === "paid" ||
      session.status === "complete";

    const firstItem = session.line_items?.data?.[0];
    const metadata = session.metadata || {};

    return res.status(200).json({
      ok: true,
      paid: Boolean(isPaid),
      sessionId: session.id,
      paymentStatus: session.payment_status || null,
      customerEmail: session.customer_details?.email || session.customer_email || null,
      customerName: session.customer_details?.name || null,
      amountTotal: session.amount_total || 0,
      currency: session.currency || "usd",
      productName: firstItem?.description || "Supima order",
      quantity: firstItem?.quantity || 1,
      size: metadata.size || null,
      color: metadata.color || null,
      product: metadata.product || null,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null
    });
  } catch (error) {
    console.error("SUPIMA FINALIZE CHECKOUT ERROR:", error);
    return res.status(500).json({
      error: "Unable to finalize checkout."
    });
  }
}
