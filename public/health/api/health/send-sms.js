// api/health/send-sms.js — Outbound SMS from Square Bidness Health admin panel

const MESSAGING_SERVICE_SID = "MG00fde6c9496ded4f835d99413b5a09c3";

async function sendSms(to, body) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) throw new Error("Twilio credentials not configured");

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, MessagingServiceSid: MESSAGING_SERVICE_SID, Body: body }),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Twilio ${r.status}: ${text}`);
  }
  return await r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== process.env.HEALTH_ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: "Missing to or message" });

  const digits = String(to).replace(/\D/g, "");
  if (digits.length < 10) return res.status(400).json({ error: "Invalid phone number" });

  const e164 = digits.length === 10 ? "+1" + digits : "+" + digits;

  try {
    await sendSms(e164, String(message).slice(0, 1600).trim());
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("[send-sms]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
