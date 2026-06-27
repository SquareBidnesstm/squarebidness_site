// api/health/facility-inquiry.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_HEALTH_URL,
  process.env.SUPABASE_HEALTH_SERVICE_ROLE_KEY
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
    facility_name, contact_name, title,
    phone, email, facility_type,
    parish, shifts_needed, urgency, notes,
    npi, npi_verified,
  } = req.body || {};

  if (!facility_name || !contact_name || !phone) {
    return res.status(400).json({ error: "Facility name, contact name, and phone are required." });
  }

  const { error } = await supabase.from("health_facility_inquiries").insert([{
    facility_name: String(facility_name).trim(),
    contact_name:  String(contact_name).trim(),
    title:         title         ? String(title).trim()         : null,
    phone:         String(phone).trim(),
    email:         email         ? String(email).trim().toLowerCase() : null,
    facility_type: facility_type ? String(facility_type).trim() : null,
    parish:        parish        ? String(parish).trim()         : null,
    shifts_needed: shifts_needed ? String(shifts_needed).trim() : null,
    urgency:       urgency       ? String(urgency).trim()        : null,
    notes:         notes         ? String(notes).trim()          : null,
    npi:           npi           ? String(npi).trim()            : null,
    npi_verified:  npi_verified  ? Boolean(npi_verified)         : false,
    status:        "new",
  }]);

  if (error) {
    console.error("[health/facility-inquiry] Supabase error:", error);
    return res.status(500).json({ error: "Could not save inquiry. Please try again." });
  }

  // TODO: wire Twilio SMS notification when health ops phone number is confirmed

  return res.status(200).json({ ok: true, message: "Inquiry received." });
}
