// POST /api/richardson/lead
// Receives appointment request form submissions from Richardson Fashion landing page.
// Texts Derek the lead details and sends a confirmation text to the customer.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const {
    name, phone, email,
    event_date, service_type, party_size,
    referrer, contact_method, best_time, message,
  } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: "Name and phone are required." });
  }

  const accountSid   = process.env.TWILIO_ACCOUNT_SID;
  const authToken    = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber   = process.env.PLATFORM_FROM_NUMBER;

  const DEREK_PHONE = "+19855071718";

  if (!accountSid || !authToken || (!messagingSid && !fromNumber)) {
    console.error("[richardson/lead] Missing Twilio env vars");
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
    // ── SMS to Derek ─────────────────────────────────────────────────────────
    const derekMsg = [
      `👔 New Appointment Request — Richardson Fashion`,
      ``,
      `Name: ${name}`,
      `Phone: ${customerPhone ?? phone}`,
      email         ? `Email: ${email}`                   : null,
      service_type  ? `Service: ${service_type}`          : null,
      event_date    ? `Event Date: ${event_date}`         : null,
      party_size    ? `Party Size: ${party_size}`         : null,
      contact_method ? `Prefers: ${contact_method}`       : null,
      best_time     ? `Best Time: ${best_time}`           : null,
      referrer      ? `Heard via: ${referrer}`            : null,
      message       ? `Details: ${message}`               : null,
      ``,
      `Reply directly to reach them.`,
    ].filter(Boolean).join("\n");

    await sendSms(DEREK_PHONE, derekMsg);

    // ── Confirmation SMS to customer ─────────────────────────────────────────
    if (customerPhone) {
      const customerMsg = [
        `Hi ${name}!`,
        ``,
        `Richardson Fashion received your appointment request.`,
        `Derek will reach out shortly to confirm your details.`,
      ].join("\n");

      await sendSms(customerPhone, customerMsg).catch(console.error);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[richardson/lead] Error:", err);
    return res.status(500).json({ ok: false, error: "Failed to send notification." });
  }
}
