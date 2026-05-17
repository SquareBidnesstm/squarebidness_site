import { getVipBookings } from "../_lib/chocolate-city-vip.js";

export default async function handler(req, res) {
  try {
    const token = req.headers["x-admin-token"];

    if (!process.env.CHOCOLATE_CITY_ADMIN_TOKEN || token !== process.env.CHOCOLATE_CITY_ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const bookings = await getVipBookings();

    return res.status(200).json({
      ok: true,
      count: bookings.length,
      bookings: bookings.slice().reverse()
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to load VIP bookings." });
  }
}
