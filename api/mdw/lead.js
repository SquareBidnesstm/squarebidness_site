// POST /api/mdw/lead
// Commercial inquiry from MDW hub or Madison Square.
// Texts Dale directly and sends a confirmation text to the customer.

const DALE_PHONE = "+13185428050";

function normalizePhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

async function sendSms(accountSid, authToken, messagingSid, fromNumber, to, body) {
  const params = new URLSearchParams({ To: to, Body: body });
  if (messagingSid) params.set("MessagingServiceSid", messagingSid);
  else params.set("From", fromNumber);
  const creds = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );
  return r.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const {
    name,
    phone,
    commercial_type,
    asset_type,
    city,
    budget,
    description,
    details,
    property,
  } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: "Name and phone are required." });
  }

  const accountSid   = process.env.TWILIO_ACCOUNT_SID;
  const authToken    = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber   = process.env.PLATFORM_FROM_NUMBER;

  if (!accountSid || !authToken || (!messagingSid && !fromNumber)) {
    console.error("[mdw/lead] Missing Twilio env vars");
    return res.status(500).json({ ok: false, error: "SMS service unavailable." });
  }

  const customerPhone = normalizePhone(phone);
  const propertyLabel = property === "madison_square" ? "Madison Square" : "MDW Hub";
  const detailsText   = description || details || "";

  // ── SMS to Dale ───────────────────────────────────────────────────────────
  const daleMsg = [
    `🏢 MDW Lead — ${propertyLabel}`,
    ``,
    `Name: ${name}`,
    `Phone: ${customerPhone ?? phone}`,
    commercial_type ? `Inquiry: ${commercial_type}`  : null,
    asset_type      ? `Asset:   ${asset_type}`       : null,
    city            ? `Market:  ${city}`             : null,
    budget          ? `Budget:  ${budget}`           : null,
    detailsText     ? `Details: ${detailsText}`      : null,
    ``,
    `Reply directly to reach them.`,
  ].filter(Boolean).join("\n");

  try {
    await sendSms(accountSid, authToken, messagingSid, fromNumber, DALE_PHONE, daleMsg);

    // ── Confirmation SMS to customer ─────────────────────────────────────────
    if (customerPhone) {
      const confirmMsg = [
        `Hi ${name}!`,
        ``,
        `MDW Investments LLC received your commercial real estate inquiry.`,
        `Dale Williams will be in touch with you shortly.`,
        ``,
        `Questions? Call or text Dale: (318) 542-8050`,
      ].join("\n");

      await sendSms(accountSid, authToken, messagingSid, fromNumber, customerPhone, confirmMsg).catch(console.error);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[mdw/lead] Error:", err);
    return res.status(500).json({ ok: false, error: "Failed to send notification." });
  }
}
