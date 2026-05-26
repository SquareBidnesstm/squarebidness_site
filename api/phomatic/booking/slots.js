// /api/phomatic/booking/slots.js
// GET /api/phomatic/booking/slots?date=YYYY-MM-DD
// Returns available time slots for a given date.

import {
  AVAILABLE_DAYS, TIME_SLOTS, BOOKING_WINDOW_MONTHS,
  sbSelect, isAvailableDay,
} from "../_config.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "date param required (YYYY-MM-DD)" });
  }

  // Past date check
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T12:00:00`);
  if (target < today) {
    return res.status(200).json({ ok: true, available: [], blocked: true, reason: "past" });
  }

  // Booking window check
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + BOOKING_WINDOW_MONTHS);
  if (target > maxDate) {
    return res.status(200).json({ ok: true, available: [], blocked: true, reason: "too_far_ahead" });
  }

  // Day-of-week check
  if (!isAvailableDay(date)) {
    return res.status(200).json({ ok: true, available: [], blocked: true, reason: "not_available_day" });
  }

  try {
    // Check if date is blocked
    const { data: blocked } = await sbSelect("phomatic_blocked_dates", {
      blocked_date: `eq.${date}`,
    }, { select: "id,reason", limit: 1 });

    if (Array.isArray(blocked) && blocked.length > 0) {
      return res.status(200).json({
        ok: true, available: [], blocked: true,
        reason: blocked[0].reason || "date_blocked",
      });
    }

    // Get confirmed/pending bookings on this date
    const { data: bookings } = await sbSelect("phomatic_bookings", {
      session_date: `eq.${date}`,
      status: "in.(pending,confirmed)",
    }, { select: "session_time" });

    const booked = new Set(
      Array.isArray(bookings) ? bookings.map((b) => b.session_time) : []
    );

    const available = TIME_SLOTS.filter((slot) => !booked.has(slot));

    return res.status(200).json({ ok: true, available, blocked: false });
  } catch (err) {
    console.error("PHOMATIC SLOTS ERROR:", err);
    return res.status(500).json({ ok: false, error: "Failed to check availability" });
  }
}
