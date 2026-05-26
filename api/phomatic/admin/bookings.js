// /api/phomatic/admin/bookings.js
// GET  /api/phomatic/admin/bookings          → list all bookings (newest first)
// GET  /api/phomatic/admin/bookings?date=YYYY-MM-DD → filter by date
// GET  /api/phomatic/admin/bookings?status=confirmed
// PATCH /api/phomatic/admin/bookings         → update booking status
//   Body: { booking_id, status }
// Requires Authorization: Bearer {adminToken}

import { sbSelect, sbUpdate, verifyAdminToken } from "../_config.js";

export default async function handler(req, res) {
  // Auth
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !(await verifyAdminToken(token))) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // GET — list bookings
  if (req.method === "GET") {
    const { date, status, limit = "200" } = req.query;
    const filters = {};
    if (date) filters.session_date = `eq.${date}`;
    if (status) filters.status = `eq.${status}`;

    const { ok, data } = await sbSelect("phomatic_bookings", filters, {
      select: "id,booking_code,service_name,session_date,session_time,client_name,client_phone,client_email,client_notes,total_price_cents,deposit_cents,balance_due_cents,status,created_at,cancelled_at,refund_amount_cents",
      order: "session_date.desc,session_time.asc",
      limit,
    });

    if (!ok) return res.status(500).json({ ok: false, error: "Failed to fetch bookings" });
    return res.status(200).json({ ok: true, bookings: Array.isArray(data) ? data : [] });
  }

  // PATCH — update status (complete, no_show, etc.)
  if (req.method === "PATCH") {
    const { booking_id, status } = req.body || {};
    const VALID_STATUSES = ["confirmed", "completed", "no_show", "cancelled"];
    if (!booking_id || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: "booking_id and valid status required" });
    }
    const { ok } = await sbUpdate("phomatic_bookings", { id: `eq.${booking_id}` }, { status });
    if (!ok) return res.status(500).json({ ok: false, error: "Update failed" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
