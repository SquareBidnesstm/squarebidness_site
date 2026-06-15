// api/health/cna-application.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const allowed = ["https://www.squarebidness.com", "https://health.squarebidness.com"];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    full_name, phone, email, city,
    cert_number, cert_expiry, experience,
    availability, travel_range, preferred_shift,
    facility_types, notes, sms_ok,
  } = req.body || {};

  if (!full_name || !phone) {
    return res.status(400).json({ error: "Name and phone are required." });
  }

  const { error } = await supabase.from("health_cna_applications").insert([{
    full_name:       String(full_name).trim(),
    phone:           String(phone).trim(),
    email:           email          ? String(email).trim().toLowerCase()   : null,
    city:            city           ? String(city).trim()                   : null,
    cert_number:     cert_number    ? String(cert_number).trim()            : null,
    cert_expiry:     cert_expiry    ? String(cert_expiry).trim()            : null,
    experience:      experience     ? String(experience).trim()             : null,
    availability:    availability   ? String(availability).trim()           : null,
    travel_range:    travel_range   ? String(travel_range).trim()           : null,
    preferred_shift: preferred_shift ? String(preferred_shift).trim()       : null,
    facility_types:  facility_types ? String(facility_types).trim()         : null,
    notes:           notes          ? String(notes).trim()                  : null,
    sms_ok:          sms_ok === true || sms_ok === "Yes",
    status:          "new",
  }]);

  if (error) {
    console.error("[health/cna-application] Supabase error:", error);
    return res.status(500).json({ error: "Could not save application. Please try again." });
  }

  // TODO: wire Twilio SMS notification when health ops phone number is confirmed

  return res.status(200).json({ ok: true, message: "Application received." });
}
