import {
  findVipBooking,
  getVipBookings,
  parseVipCode,
  publicVipBooking,
  saveVipBookings,
} from "../_lib/chocolate-city-vip.js";

function getToken(req) {
  return (
    req.headers["x-admin-token"] ||
    req.headers["x-chocolate-city-admin-token"] ||
    ""
  );
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const expectedToken = String(process.env.CHOCOLATE_CITY_ADMIN_TOKEN || "").trim();
    const token = String(getToken(req) || "").trim();

    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const body = parseBody(req.body);
    const sessionId = parseVipCode(body.sessionId || body.code || body.vipCode || "");
    const name = String(body.name || body.customerName || "").trim();
    const markUsed = body.markUsed === true || body.action === "mark_used";

    if (!sessionId && !name) {
      return res.status(400).json({
        ok: false,
        valid: false,
        error: "Missing VIP code or name"
      });
    }

    const bookings = await getVipBookings();
    const booking = findVipBooking(bookings, { sessionId, name });

    if (!booking) {
      return res.status(404).json({
        ok: false,
        valid: false,
        used: false,
        error: "VIP reservation not found"
      });
    }

    if (booking.used) {
      return res.status(200).json({
        ok: true,
        valid: true,
        used: true,
        booking: publicVipBooking(booking),
        message: "VIP reservation has already been used."
      });
    }

    if (markUsed) {
      const now = new Date().toISOString();
      const updated = bookings.map((item) => {
        if (item.sessionId !== booking.sessionId) return item;
        return {
          ...item,
          used: true,
          usedAt: now
        };
      });

      await saveVipBookings(updated);

      return res.status(200).json({
        ok: true,
        valid: true,
        used: true,
        markedUsed: true,
        booking: publicVipBooking({
          ...booking,
          used: true,
          usedAt: now
        })
      });
    }

    return res.status(200).json({
      ok: true,
      valid: true,
      used: false,
      booking: publicVipBooking(booking)
    });
  } catch (err) {
    console.error("Chocolate City VIP verify error:", err);
    return res.status(500).json({ ok: false, valid: false, error: err.message });
  }
}
