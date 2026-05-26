// /api/phomatic/booking/lookup.js
// GET /api/phomatic/booking/lookup?phone=+15045551234 OR ?email=client@email.com
// Returns upcoming and recent bookings for a client.

import { sbSelect, normalizePhone } from "../_config.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { phone, email, code } = req.query;

  // Lookup by booking code
  if (code) {
    const { data } = await sbSelect("phomatic_bookings",
      { booking_code: `eq.${String(code).trim().toUpperCase()}` },
      { select: "booking_code,service_name,session_date,session_time,client_name,client_phone,status,total_price_cents,deposit_cents,balance_due_cents,cancel_token,created_at", limit: 1 }
    );
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return res.status(404).json({ ok: false, error: "Booking not found" });
    return res.status(200).json({ ok: true, bookings: [sanitize(row)] });
  }

  // Lookup by phone
  if (phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return res.status(400).json({ ok: false, error: "Invalid phone number" });
    const { data } = await sbSelect("phomatic_bookings",
      { client_phone: `eq.${normalized}` },
      { select: "booking_code,service_name,session_date,session_time,client_name,status,total_price_cents,deposit_cents,balance_due_cents,cancel_token,created_at", order: "session_date.desc", limit: 10 }
    );
    return res.status(200).json({ ok: true, bookings: (Array.isArray(data) ? data : []).map(sanitize) });
  }

  // Lookup by email
  if (email) {
    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes("@")) return res.status(400).json({ ok: false, error: "Invalid email" });
    const { data } = await sbSelect("phomatic_bookings",
      { client_email: `eq.${cleanEmail}` },
      { select: "booking_code,service_name,session_date,session_time,client_name,status,total_price_cents,deposit_cents,balance_due_cents,cancel_token,created_at", order: "session_date.desc", limit: 10 }
    );
    return res.status(200).json({ ok: true, bookings: (Array.isArray(data) ? data : []).map(sanitize) });
  }

  return res.status(400).json({ ok: false, error: "Provide phone, email, or code param" });
}

// Strip sensitive fields before returning to client
function sanitize(b) {
  return {
    booking_code: b.booking_code,
    service_name: b.service_name,
    session_date: b.session_date,
    session_time: b.session_time,
    client_name: b.client_name,
    status: b.status,
    total_price_cents: b.total_price_cents,
    deposit_cents: b.deposit_cents,
    balance_due_cents: b.balance_due_cents,
    cancel_token: b.cancel_token,
    created_at: b.created_at,
  };
}
