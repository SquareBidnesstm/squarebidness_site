import { sendInstallSms } from "../_lib/send-install-sms.js";
import { insertBooking, isConfigured } from "../_lib/supabase-taxslayer.js";

const JESSICA_PHONE = process.env.TAXSLAYER_NOTIFY_PHONE || "+13186236792";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { name, phone, email, date, service, mode, notes } = req.body || {};

  if (!name || !phone || !service) {
    return res.status(400).json({ ok: false, error: "Name, phone, and service are required." });
  }

  // Save to Supabase
  if (isConfigured()) {
    try {
      await insertBooking({
        name: String(name).trim().slice(0, 120),
        phone: String(phone).trim().slice(0, 30),
        email: email ? String(email).trim().slice(0, 200) : null,
        preferred_date: date || null,
        service: String(service).trim().slice(0, 120),
        mode: String(mode || "In-Office").trim().slice(0, 60),
        notes: notes ? String(notes).trim().slice(0, 1000) : null,
        status: "pending",
      });
    } catch (e) {
      console.error("taxslayer booking DB write failed:", e?.message || e);
    }
  }

  // Send SMS to Jessica
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
