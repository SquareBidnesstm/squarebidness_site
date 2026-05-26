import {
  VIP_BOOKING_LOCK_KEY,
  acquireRedisLock,
  findVipBooking,
  getVipBookings,
  parseVipCode,
  publicVipBooking,
  releaseRedisLock,
  saveVipBookings,
  sanitizeMetadataValue,
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

function findVipMatches(bookings, { sessionId = "", name = "" } = {}) {
  const cleanSessionId = parseVipCode(sessionId);
  const cleanName = sanitizeMetadataValue(name, 80).toLowerCase();

  if (cleanSessionId) {
    return bookings.filter((booking) => booking.sessionId === cleanSessionId);
  }

  if (!cleanName) return [];

  const exactMatches = bookings.filter((booking) => {
    return sanitizeMetadataValue(booking.customerName, 80).toLowerCase() === cleanName;
  });

  if (exactMatches.length) return exactMatches;

  return bookings.filter((booking) => {
    const bookingName = sanitizeMetadataValue(booking.customerName, 80).toLowerCase();
    return bookingName && bookingName.includes(cleanName);
  });
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
    const matches = findVipMatches(bookings, { sessionId, name });
    const booking = sessionId
      ? findVipBooking(bookings, { sessionId })
      : matches[0] || null;

    if (!sessionId && matches.length > 1) {
      return res.status(409).json({
        ok: false,
        valid: false,
        used: false,
        error: "Multiple VIP reservations match that name. Scan the QR code or enter the full VIP code."
      });
    }

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
      const lockValue =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const locked = await acquireRedisLock(VIP_BOOKING_LOCK_KEY, lockValue, 10);

      if (!locked) {
        return res.status(409).json({
          ok: false,
          valid: false,
          used: false,
          error: "VIP door screen is busy. Try again in a few seconds."
        });
      }

      const now = new Date().toISOString();
      const bookingEventDate = booking.eventDate || "";

      try {
        const latestBookings = bookingEventDate
          ? await getVipBookings(bookingEventDate)
          : (await getVipBookings()).filter((item) => !item.eventDate);
        const latestBooking = findVipBooking(latestBookings, {
          sessionId: booking.sessionId,
          name: booking.customerName
        });

        if (!latestBooking) {
          return res.status(404).json({
            ok: false,
            valid: false,
            used: false,
            error: "VIP reservation not found"
          });
        }

        if (latestBooking.used) {
          return res.status(200).json({
            ok: true,
            valid: true,
            used: true,
            booking: publicVipBooking(latestBooking),
            message: "VIP reservation has already been used."
          });
        }

        const updated = latestBookings.map((item) => {
          if (item.sessionId !== latestBooking.sessionId) return item;
          return {
            ...item,
            used: true,
            usedAt: now
          };
        });

        await saveVipBookings(updated, bookingEventDate);

        return res.status(200).json({
          ok: true,
          valid: true,
          used: true,
          markedUsed: true,
          booking: publicVipBooking({
            ...latestBooking,
            used: true,
            usedAt: now
          })
        });
      } finally {
        await releaseRedisLock(VIP_BOOKING_LOCK_KEY, lockValue).catch(() => {});
      }
    }

    return res.status(200).json({
      ok: true,
      valid: true,
      used: false,
      booking: publicVipBooking(booking)
    });
  } catch (err) {
    console.error("Chocolate City VIP verify error:", err);
    return res.status(500).json({ ok: false, valid: false, error: "Unable to verify VIP reservation" });
  }
}
