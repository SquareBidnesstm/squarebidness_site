// api/health/sms.js — Twilio inbound SMS webhook for Square Bidness Health
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_HEALTH_URL,
  process.env.SUPABASE_HEALTH_SERVICE_ROLE_KEY
);

const MESSAGING_SERVICE_SID = "MG00fde6c9496ded4f835d99413b5a09c3";
const NOTIFY_EMAIL = "squarebidnessapparel@gmail.com";

const AUTO_REPLY = `Square Bidness Health received your message. We're building our CNA float pool now — first placements in 30-60 days. Apply at health.squarebidness.com/join/ or we'll follow up soon.`;

async function sendSms(to, body) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) return;

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, MessagingServiceSid: MESSAGING_SERVICE_SID, Body: body }),
  });
}

async function emailNotify(from, body) {
  const key  = process.env.RESEND_API_KEY;
  const from_addr = process.env.RESEND_FROM || "Square Bidness <noreply@squarebidness.com>";
  if (!key) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: from_addr,
      to: [NOTIFY_EMAIL],
      subject: `[SBHealth] Inbound SMS from ${from}`,
      text: `New text to (225) 209-9257\n\nFrom: ${from}\nMessage: ${body}\n\nReply from your phone or at health.squarebidness.com/admin/`,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const from = req.body?.From || "";
  const body = req.body?.Body || "";
  const to   = req.body?.To   || "";

  // Log to Supabase
  await supabase.from("health_sms_log").insert([{
    from_number: from,
    to_number:   to,
    body:        body,
    direction:   "inbound",
  }]).then(({ error }) => {
    if (error) console.error("[health/sms] Supabase log error:", error);
  });

  // Auto-reply to sender + notify Marcus via SMS and email
  await Promise.all([
    sendSms(from, AUTO_REPLY),
    sendSms(process.env.HEALTH_OPS_NOTIFY_PHONE, `[SBHealth SMS] ${from}: ${body}`),
    emailNotify(from, body),
  ]);

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
}
