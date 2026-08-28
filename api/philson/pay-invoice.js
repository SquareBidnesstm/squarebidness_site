const BASE_URL = process.env.SITE_URL || "https://www.squarebidness.com";
const PHILSON_DESTINATION_ACCOUNT = "acct_1U9TKsPdN2nTzd6F";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  if (!process.env.STRIPE_HOLDINGS_SECRET_KEY) {
    return res.status(500).json({ ok: false, error: "Missing STRIPE_HOLDINGS_SECRET_KEY" });
  }

  const body = req.body || {};
  const invoiceNumber = String(body.invoiceNumber || "").trim();
  const totalCents    = Math.round(parseFloat(body.totalCents || 0));
  const clientName    = String(body.clientName   || "").trim();
  const description   = String(body.description  || "").trim();
  const email         = String(body.email        || "").trim();

  if (!totalCents || totalCents < 50) {
    return res.status(400).json({ ok: false, error: "Invalid amount — minimum $0.50" });
  }

  const cancelParams = new URLSearchParams({
    inv: invoiceNumber,
    amt: totalCents,
    ...(clientName   && { name: clientName }),
    ...(description  && { desc: description }),
  });

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "cashapp", "klarna", "affirm", "afterpay_clearpay", "link", "us_bank_account"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: invoiceNumber ? `Invoice ${invoiceNumber} — Philson Le Fleuriste` : "Philson Le Fleuriste",
            description: description || (clientName ? `Payment for ${clientName}` : "Floral services"),
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      }],
      customer_email: email || undefined,
      metadata: {
        invoiceNumber,
        clientName,
        description,
        source: "philson-invoice-payment",
      },
      payment_intent_data: {
        transfer_data: { destination: PHILSON_DESTINATION_ACCOUNT },
        metadata: { invoiceNumber, clientName, source: "philson-invoice-payment" },
      },
      custom_text: {
        submit: {
          message: invoiceNumber
            ? `Payment for Invoice ${invoiceNumber}. Thank you for choosing Philson Le Fleuriste.`
            : "Thank you for choosing Philson Le Fleuriste.",
        },
      },
      success_url: `${BASE_URL}/philson-le-fleuriste/pay/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/philson-le-fleuriste/pay/?${cancelParams.toString()}`,
    });

    return res.status(200).json({ ok: true, checkout_url: session.url });
  } catch (err) {
    console.error("PHILSON PAY-INVOICE ERROR:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
