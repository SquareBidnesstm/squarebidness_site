// POST /api/start2finish/lead
// Receives inquiry form submissions from start2finish landing page.
// Texts Deante the lead details and sends a confirmation text to the customer.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const { name, phone, inquiry_type, service, city, description, timeline } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: "Name and phone are required." });
  }

  const accountSid   = process.env.TWILIO_ACCOUNT_SID;
  const authToken    = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber   = process.env.PLATFORM_FROM_NUMBER;
  const DEANTE_PHONE = "+13186122114";
  const DALE_PHONE   = "+13185428050";

  // Commercial inquiries route to Dale (MDW Investments); all others go to Deante
  const { lane, commercial_type } = req.body || {};
  const isCommercial = lane === "commercial" || inquiry_type === "commercial";
  const operatorPhone = isCommercial ? DALE_PHONE : DEANTE_PHONE;
  const operatorName  = isCommercial ? "Dale (MDW)" : "Deante";

  if (!accountSid || !authToken || (!messagingSid && !fromNumber)) {
    console.error("[start2finish/lead] Missing Twilio env vars");
    return res.status(500).json({ ok: false, error: "SMS service unavailable." });
  }

  // Normalize customer phone
  const digits = phone.replace(/\D/g, "");
  const customerPhone =
    digits.length === 10 ? `+1${digits}` :
    digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;

  // Label the inquiry type nicely
  const typeLabel =
    isCommercial              ? "🏢 Commercial Inquiry" :
    inquiry_type === "buy"    ? "🏠 Buy a House" :
    inquiry_type === "sell"   ? "🏡 Sell My House" :
    inquiry_type === "rental" ? "🔑 Rental Inquiry" :
                                "🔧 Estimate Request";

  async function sendSms(to, body) {
    const p = new URLSearchParams({ To: to, Body: body });
    if (messagingSid) p.set("MessagingServiceSid", messagingSid);
    else p.set("From", fromNumber);
    const creds = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${creds}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: p.toString(),
      }
    );
    return r.ok;
  }

  try {
    // ── SMS to Deante ─────────────────────────────────────────────────────────
    const operatorMsg = [
      `📋 New Lead — Start2Finish`,
      ``,
      `Type: ${typeLabel}`,
      `Name: ${name}`,
      `Phone: ${customerPhone ?? phone}`,
      city             ? `City: ${city}`                   : null,
      commercial_type  ? `Commercial Type: ${commercial_type}` : null,
      service          ? `Service: ${service}`             : null,
      timeline         ? `Timeline: ${timeline}`           : null,
      description      ? `Details: ${description}`         : null,
      ``,
      `Reply directly to reach them.`,
    ].filter(Boolean).join("\n");

    await sendSms(operatorPhone, operatorMsg);

    // ── Confirmation SMS to customer ─────────────────────────────────────────
    if (customerPhone) {
      const contactLine = isCommercial
        ? `Questions? Call/Text Dale: (318) 542-8050`
        : `Questions? Call/Text: (318) 612-2114`;
      const isEstimate = !inquiry_type || inquiry_type === "estimate";
      const customerMsg = isEstimate
        ? [
            `Hi ${name}!`,
            ``,
            `Start2Finish received your estimate request.`,
            `Deante will call or text you back shortly.`,
            ``,
            contactLine,
          ].join("\n")
        : [
            `Hi ${name}!`,
            ``,
            `Start2Finish received your inquiry.`,
            `${operatorName} will be in touch with you shortly.`,
            ``,
            contactLine,
          ].join("\n");

      await sendSms(customerPhone, customerMsg).catch(console.error);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[start2finish/lead] Error:", err);
    return res.status(500).json({ ok: false, error: "Failed to send notification." });
  }
}
