// api/steakhouse/event-inquiry.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "https://www.squarebidness.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    name, phone, email,
    event_type, date, time,
    guests, budget, notes
  } = req.body || {};

  // Validate required fields
  if (!name || !phone || !email) {
    return res.status(400).json({ error: "Name, phone, and email are required." });
  }

  const { error } = await supabase.from("steakhouse_events").insert([{
    name:       String(name).trim(),
    phone:      String(phone).trim(),
    email:      String(email).trim().toLowerCase(),
    event_type: event_type ? String(event_type).trim() : null,
    date:       date        ? String(date).trim()       : null,
    time:       time        ? String(time).trim()       : null,
    guests:     guests      ? Number(guests)            : null,
    budget:     budget      ? String(budget).trim()     : null,
    notes:      notes       ? String(notes).trim()      : null,
    status:     "new"
  }]);

  if (error) {
    console.error("Supabase insert error:", error);
    return res.status(500).json({ error: "Could not save inquiry. Please try again." });
  }

  return res.status(200).json({ ok: true, message: "Inquiry received." });
}
