import { sendInstallSms } from "../_lib/send-install-sms.js";

const JESSICA_PHONE = process.env.TAXSLAYER_NOTIFY_PHONE || "+13184277990";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { name, phone, email, date, service, mode, notes } = req.body || {};

  if (!name || !phone || !service) {
    return res.status(400).json({ ok: false, error: "Name, phone, and service are required." });
  }

  const lines = [
    `📋 NEW BOOKING REQUEST — Tax Slayer`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    email ? `Email: ${email}` : null,
    `Service: ${service}`,
    `Mode: ${mode || "In-Office"}`,
    date ? `Preferred date: ${date}` : null,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean).join("\n");

  await sendInstallSms({ to: JESSICA_PHONE, body: lines });

  return res.status(200).json({ ok: true });
}
