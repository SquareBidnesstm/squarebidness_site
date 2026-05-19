// POST /api/elite-home-maintenance/lead
// Receives service request form submissions from elite-home-maintenance landing page.
// Texts Jamey the lead details and sends a confirmation text to the customer.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const { name, phone, service, property_type, description, zip } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: "Name and phone are required." });
  }

  const accountSid   = process.env.TWILIO_ACCOUNT_SID;
  const authToken    = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber   = process.env.DAPPER_FROM_NUMBER;
  const JAMEY_PHONE  = "+13182062460";

  if (!accountSid || !authToken || (!messagingSid && !fromNumber)) {
    console.error("[elite-home-maintenance/lead] Missing Twilio env vars");
    return res.status(500).json({ ok: false, error: "SMS service unavailable." });
  }

  // Normalize customer phone
  const digits = phone.replace(/\D/g, "");
  const customerPhone =
    digits.length === 10 ? `+1${digits}` :
    digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;

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
    // ── SMS to Jamey ─────────────────────────────────────────────────────────
    const jameyMsg = [
      `🔧 New Lead — Elite Home Maintenance`,
      ``,
      `Name: ${name}`,
      `Phone: ${customerPhone ?? phone}`,
      service       ? `Service: ${service}`           : null,
      property_type ? `Property: ${property_type}`    : null,
      zip           ? `ZIP: ${zip}`                   : null,
      description   ? `Details: ${description}`       : null,
      ``,
      `Reply directly to reach them.`,
    ].filter(Boolean).join("\n");

    await sendSms(JAMEY_PHONE, jameyMsg);

    // ── Confirmation SMS to customer ─────────────────────────────────────────
    if (customerPhone) {
      const customerMsg = [
        `Hi ${name}!`,
        ``,
        `Elite Home Maintenance received your repair request.`,
        `Jamey will call or text you back shortly.`,
        ``,
        `Questions? Call/Text: (318) 206-2460`,
      ].join("\n");

      await sendSms(customerPhone, customerMsg).catch(console.error);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[elite-home-maintenance/lead] Error:", err);
    return res.status(500).json({ ok: false, error: "Failed to send notification." });
  }
}
