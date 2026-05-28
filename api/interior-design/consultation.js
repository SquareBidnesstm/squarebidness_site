// api/interior-design/consultation.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MONICA_PHONE = "+19855514389";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.squarebidness.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    name, phone, email, city,
    project_type, property_type, preferred_timeline,
    estimated_budget, address, project_details,
    referrer, photo_link,
    ready_for_consultation, interested_in_deposit, sms_ok,
  } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: "Name and phone are required." });
  }

  const digits = String(phone).replace(/\D/g, "");
  const clientPhone =
    digits.length === 10 ? `+1${digits}` :
    digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;

  const { error: dbError } = await supabase.from("interior_design_consultations").insert([{
    name:                   String(name).trim(),
    phone:                  clientPhone ?? String(phone).trim(),
    email:                  email            ? String(email).trim().toLowerCase()    : null,
    city:                   city             ? String(city).trim()                   : null,
    project_type:           project_type     ? String(project_type).trim()           : null,
    property_type:          property_type    ? String(property_type).trim()          : null,
    preferred_timeline:     preferred_timeline ? String(preferred_timeline).trim()   : null,
    estimated_budget:       estimated_budget ? String(estimated_budget).trim()       : null,
    address:                address          ? String(address).trim()                : null,
    project_details:        project_details  ? String(project_details).trim()       : null,
    referrer:               referrer         ? String(referrer).trim()               : null,
    photo_link:             photo_link       ? String(photo_link).trim()             : null,
    ready_for_consultation: ready_for_consultation === true || ready_for_consultation === "Yes",
    interested_in_deposit:  interested_in_deposit  === true || interested_in_deposit  === "Yes",
    sms_ok:                 sms_ok           === true || sms_ok === "Yes",
    status: "new",
  }]);

  if (dbError) {
    console.error("[interior-design/consultation] Supabase error:", dbError);
  }

  const accountSid   = process.env.TWILIO_ACCOUNT_SID;
  const authToken    = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber   = process.env.PLATFORM_FROM_NUMBER;

  if (!accountSid || !authToken || (!messagingSid && !fromNumber)) {
    console.error("[interior-design/consultation] Missing Twilio env vars");
    if (dbError) return res.status(500).json({ error: "Could not save inquiry. Please try again." });
    return res.status(200).json({ ok: true, message: "Inquiry received." });
  }

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
    const monicaMsg = [
      `✨ New Consultation Request — Interior Design by Monica`,
      ``,
      `Name: ${name}`,
      `Phone: ${clientPhone ?? phone}`,
      email              ? `Email: ${email}`                       : null,
      city               ? `City: ${city}`                         : null,
      project_type       ? `Project: ${project_type}`              : null,
      property_type      ? `Property: ${property_type}`            : null,
      preferred_timeline ? `Timeline: ${preferred_timeline}`        : null,
      estimated_budget   ? `Budget: ${estimated_budget}`            : null,
      address            ? `Address: ${address}`                   : null,
      referrer           ? `Heard via: ${referrer}`                : null,
      photo_link         ? `Photos: ${photo_link}`                 : null,
      project_details    ? `\nDetails: ${project_details}`         : null,
    ].filter(Boolean).join("\n");

    await sendSms(MONICA_PHONE, monicaMsg);

    if (clientPhone && sms_ok) {
      const clientMsg = [
        `Hi ${name}!`,
        ``,
        `Monica received your consultation request.`,
        `She'll be in touch soon to discuss your project.`,
      ].join("\n");

      await sendSms(clientPhone, clientMsg).catch(console.error);
    }
  } catch (err) {
    console.error("[interior-design/consultation] SMS error:", err);
  }

  return res.status(200).json({ ok: true, message: "Inquiry received." });
}
