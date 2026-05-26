import {
  getActiveVipHolds,
  getVipAvailabilityCounts,
  getVipBookings,
  getVipEventLabel,
  normalizeVipEventDate
} from "../_lib/chocolate-city-vip.js";

export default async function handler(req, res) {
  try {
    const eventDate = normalizeVipEventDate(req.query.eventDate);
    const bookings = await getVipBookings(eventDate);
    const holds = await getActiveVipHolds(eventDate);
    const counts = getVipAvailabilityCounts(bookings, holds);

    return res.status(200).json({
      ok: true,
      eventDate,
      eventLabel: getVipEventLabel(eventDate),
      ...counts
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      error: "VIP availability is temporarily unavailable.",
      limit: 2,
      booked: 0,
      held: 0,
      remaining: 0,
      soldOut: true,
      fallback: true
    });
  }
}
