// /api/checkout.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
    const { line_items, mode, success_url, cancel_url } = req.body;

    // Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: mode || "payment",
      line_items,
      success_url,
      cancel_url,
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["US"] },
      allow_promotion_codes: true
      // automatic_tax: { enabled: true }, // enable later if you want Stripe to handle tax
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
