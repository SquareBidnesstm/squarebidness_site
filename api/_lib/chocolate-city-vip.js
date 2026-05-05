export const VIP_BOOKING_KEY = "chocolate-city:vip:bookings";

export function buildVipCode(sessionId) {
  const cleanSessionId = String(sessionId || "").trim();
  return cleanSessionId ? `VIP-${cleanSessionId}` : "";
}

export function parseVipCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/^VIP-/i, "").trim();
}

export async function redis(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) throw new Error("Missing Upstash env vars");

  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

export async function getVipBookings() {
  const data = await redis("GET", VIP_BOOKING_KEY);
  return data?.result ? JSON.parse(data.result) : [];
}

export async function saveVipBookings(bookings) {
  await redis("SET", VIP_BOOKING_KEY, JSON.stringify(bookings || []));
}

export function findVipBooking(bookings, { sessionId = "", name = "" } = {}) {
  const cleanSessionId = parseVipCode(sessionId);
  const cleanName = String(name || "").trim().toLowerCase();

  if (cleanSessionId) {
    return bookings.find((booking) => booking.sessionId === cleanSessionId) || null;
  }

  if (cleanName) {
    return bookings.find((booking) => {
      const bookingName = String(booking.customerName || "").trim().toLowerCase();
      return bookingName && bookingName === cleanName;
    }) || null;
  }

  return null;
}

export function publicVipBooking(booking) {
  if (!booking) return null;

  return {
    sessionId: booking.sessionId || "",
    vipCode: buildVipCode(booking.sessionId),
    customerName: booking.customerName || "",
    packageId: booking.packageId || "",
    packageName: booking.packageName || "",
    paidAt: booking.paidAt || "",
    paymentStatus: booking.paymentStatus || "",
    used: !!booking.used,
    usedAt: booking.usedAt || ""
  };
}
