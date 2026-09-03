const BASE_URL = process.env.SITE_URL || "https://www.squarebidness.com";
const PHILSON_DESTINATION_ACCOUNT = "acct_1U9TKsPdN2nTzd6F";

const DEPOSIT_AMOUNTS = {
  "$250 - $500":     12500,
  "$500 - $750":     25000,
  "$750 - $1,000":   37500,
  "$1,000 - $2,500": 50000,
  "$2,500+":         75000,
  "Not sure yet":    10000,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!process.env.STRIPE_HOLDINGS_SECRET_KEY) {
    return res.status(500).json({ ok: false, error: "Missing STRIPE_HOLDINGS_SECRET_KEY" });
  }


  const body = req.body || {};
  const fullName    = String(body.fullName    || "").trim();
  const phone       = String(body.phone       || "").trim();
  const email       = String(body.email       || "").trim();
  const projectType = String(body.projectType || "").trim();
  const eventDate   = String(body.eventDate   || "").trim();
  const budget      = String(body.budget      || "").trim();
  const deliveryType= String(body.deliveryType|| "").trim();
  const details     = String(body.details     || "").trim();

  if (!fullName || !phone || !projectType || !eventDate || !budget || !details) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  // Log to Google Sheets — fire and forget, don't block checkout
  const scriptUrl = process.env.PHILSON_DEPOSIT_SCRIPT_URL;
  if (scriptUrl) {
    fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ fullName, phone, email, projectType, eventDate, budget, deliveryType, details, source: "philson-bnpl-checkout" }),
    }).catch(() => {});
  }

  // Alert Philson immediately on new request submission (pre-payment)
  const alertTo = process.env.PHILSON_ALERT_TO;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.PHILSON_TWILIO_FROM_NUMBER;
  if (alertTo && twilioSid && twilioToken && twilioFrom) {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
    fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        To: alertTo,
        From: twilioFrom,
        Body: `NEW PHILSON REQUEST\n\n${fullName}\n${phone}${email ? `\n${email}` : ""}\n\nProject: ${projectType}\nDate: ${eventDate || "TBD"}\nBudget: ${budget}\n\nDetails: ${details.slice(0, 120)}${details.length > 120 ? "..." : ""}`,
      }),
    }).catch(() => {});
  }

  const depositCents = DEPOSIT_AMOUNTS[budget] ?? 10000;

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
            name: `${projectType} Deposit — Philson Le Fleuriste`,
            description: `Deposit for ${projectType} on ${eventDate}. Budget range: ${budget}. Balance due before event date.`,
          },
          unit_amount: depositCents,
        },
        quantity: 1,
      }],
      customer_email: email || undefined,
      metadata: {
        fullName,
        phone,
        projectType,
        eventDate,
        budget,
        deliveryType,
        source: "philson-bnpl-deposit",
      },
      payment_intent_data: {
        transfer_data: { destination: PHILSON_DESTINATION_ACCOUNT },
        metadata: { fullName, phone, projectType, eventDate, budget },
      },
      success_url: `${BASE_URL}/philson-le-fleuriste/deposit/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/philson-le-fleuriste/deposit/`,
      custom_text: {
        submit: { message: `Deposit holds your date with Philson. Balance is due before your event.` },
      },
    });

    return res.status(200).json({ ok: true, checkout_url: session.url });
  } catch (err) {
    console.error("PHILSON CHECKOUT ERROR:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
