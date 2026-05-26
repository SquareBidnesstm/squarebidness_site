export const VIP_BOOKING_KEY = "chocolate-city:vip:bookings";
export const VIP_LIMIT = 2;
export const VIP_HOLD_SECONDS = 35 * 60;
export const VIP_HOLD_PREFIX = "chocolate-city:vip:hold:";
export const VIP_BOOKING_LOCK_KEY = "chocolate-city:vip:booking-lock";
export const VIP_EVENT_DATES = [
  { date: "2026-05-22", label: "Friday, May 22" },
  { date: "2026-05-23", label: "Saturday, May 23" },
  { date: "2026-05-24", label: "Sunday, May 24" }
];

export const VIP_PACKAGES = {
  section_one: {
    name: "The Gold Section",
    fullPrice: 300,
    price: 300,
    description: "6 bands, 10 Vegas Bomb shots, 4 waters, VIP parking, no wait in line."
  },
  section_two: {
    name: "The Premium Section",
    fullPrice: 400,
    price: 400,
    description: "6 bands, 10 Vegas Bomb shots, 4 waters, VIP parking, no wait in line, 1 premium bottle of choice."
  },
  city_section: {
    name: "The City Section",
    fullPrice: 650,
    price: 650,
    description: "10 bands, 10 Vegas Bomb shots, 4 waters, 2 premium bottles, 5-beer bucket, hurricane bottle, VIP parking, no wait in line."
  }
};

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

export function getVipPackage(packageId) {
  return VIP_PACKAGES[String(packageId || "")] || null;
}

export function normalizeVipEventDate(value) {
  const clean = String(value || "").trim();
  return VIP_EVENT_DATES.some((eventDate) => eventDate.date === clean)
    ? clean
    : VIP_EVENT_DATES[0].date;
}

export function getVipEventLabel(value) {
  const date = normalizeVipEventDate(value);
  return VIP_EVENT_DATES.find((eventDate) => eventDate.date === date)?.label || date;
}

export function vipBookingKey(eventDate) {
  return `${VIP_BOOKING_KEY}:${normalizeVipEventDate(eventDate)}`;
}

export function sanitizeMetadataValue(value, maxLength = 120) {
  return String(value || "")
    .replace(/[^\w .,'@+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function vipHoldKey(slot, eventDate) {
  return `${VIP_HOLD_PREFIX}${normalizeVipEventDate(eventDate)}:${slot}`;
}

export async function getActiveVipHolds(eventDate) {
  const holds = [];
  const normalizedEventDate = normalizeVipEventDate(eventDate);

  for (let slot = 1; slot <= VIP_LIMIT; slot += 1) {
    const data = await redis("GET", vipHoldKey(slot, normalizedEventDate));
    if (!data?.result) continue;

    try {
      holds.push({ eventDate: normalizedEventDate, slot, ...JSON.parse(data.result) });
    } catch {
      holds.push({ eventDate: normalizedEventDate, slot });
    }
  }

  return holds;
}

export function getVipAvailabilityCounts(bookings = [], holds = []) {
  const confirmedSessionIds = new Set(
    bookings.map((booking) => booking.sessionId).filter(Boolean)
  );
  const activeHolds = holds.filter((hold) => {
    return !hold.sessionId || !confirmedSessionIds.has(hold.sessionId);
  });
  const reserved = bookings.length + activeHolds.length;

  return {
    limit: VIP_LIMIT,
    booked: bookings.length,
    held: activeHolds.length,
    reserved,
    remaining: Math.max(0, VIP_LIMIT - reserved),
    soldOut: reserved >= VIP_LIMIT
  };
}

export async function acquireVipHold({ packageId, customerName, eventDate }) {
  const normalizedEventDate = normalizeVipEventDate(eventDate);
  const bookings = await getVipBookings(normalizedEventDate);
  const holds = await getActiveVipHolds(normalizedEventDate);
  const before = getVipAvailabilityCounts(bookings, holds);

  if (before.soldOut) return null;

  const holdId =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  for (let slot = 1; slot <= VIP_LIMIT; slot += 1) {
    const hold = {
      holdId,
      slot,
      eventDate: normalizedEventDate,
      eventLabel: getVipEventLabel(normalizedEventDate),
      packageId,
      customerName: sanitizeMetadataValue(customerName, 80),
      createdAt: new Date().toISOString()
    };
    const result = await redis(
      "SET",
      vipHoldKey(slot, normalizedEventDate),
      JSON.stringify(hold),
      "EX",
      String(VIP_HOLD_SECONDS),
      "NX"
    );

    if (result?.result !== "OK") continue;

    const latestBookings = await getVipBookings(normalizedEventDate);
    const latestHolds = await getActiveVipHolds(normalizedEventDate);
    const after = getVipAvailabilityCounts(latestBookings, latestHolds);

    if (after.reserved <= VIP_LIMIT) return hold;

    await releaseVipHold(hold);
    return null;
  }

  return null;
}

export async function refreshVipHold(hold, sessionId) {
  if (!hold?.slot || !hold?.holdId) return;
  const eventDate = normalizeVipEventDate(hold.eventDate);

  await redis(
    "SET",
    vipHoldKey(hold.slot, eventDate),
    JSON.stringify({ ...hold, eventDate, sessionId }),
    "EX",
    String(VIP_HOLD_SECONDS)
  );
}

export async function getVipHold(slot, eventDate) {
  if (!slot) return null;

  const data = await redis("GET", vipHoldKey(slot, eventDate));
  if (!data?.result) return null;

  try {
    return JSON.parse(data.result);
  } catch {
    return null;
  }
}

export async function releaseVipHold(hold) {
  if (hold?.slot) {
    await redis("DEL", vipHoldKey(hold.slot, hold.eventDate));
  }
}

export async function acquireRedisLock(key, value, seconds = 30) {
  const result = await redis("SET", key, value, "EX", String(seconds), "NX");
  return result?.result === "OK";
}

export async function releaseRedisLock(key, value = "") {
  if (value) {
    const existing = await redis("GET", key);
    if (existing?.result !== value) return;
  }

  await redis("DEL", key);
}

export async function getVipBookings(eventDate = "") {
  if (eventDate) {
    const normalizedEventDate = normalizeVipEventDate(eventDate);
    const data = await redis("GET", vipBookingKey(normalizedEventDate));
    const bookings = data?.result ? JSON.parse(data.result) : [];
    return bookings.map((booking) => ({
      ...booking,
      eventDate: booking.eventDate || normalizedEventDate,
      eventLabel: booking.eventLabel || getVipEventLabel(normalizedEventDate)
    }));
  }

  const allBookings = [];

  for (const eventDate of VIP_EVENT_DATES) {
    const bookings = await getVipBookings(eventDate.date);
    allBookings.push(...bookings);
  }

  const legacy = await redis("GET", VIP_BOOKING_KEY);
  if (legacy?.result) {
    const legacyBookings = JSON.parse(legacy.result);
    allBookings.push(
      ...legacyBookings.map((booking) => ({
        ...booking,
        eventDate: booking.eventDate || "",
        eventLabel: booking.eventLabel || "Legacy VIP"
      }))
    );
  }

  return allBookings;
}

export async function saveVipBookings(bookings, eventDate = "") {
  const key = eventDate ? vipBookingKey(eventDate) : VIP_BOOKING_KEY;
  await redis("SET", key, JSON.stringify(bookings || []));
}

export function findVipBooking(bookings, { sessionId = "", name = "" } = {}) {
  const cleanSessionId = parseVipCode(sessionId);
  const cleanName = sanitizeMetadataValue(name, 80).toLowerCase();

  if (cleanSessionId) {
    return bookings.find((booking) => booking.sessionId === cleanSessionId) || null;
  }

  if (cleanName) {
    return bookings.find((booking) => {
      const bookingName = sanitizeMetadataValue(booking.customerName, 80).toLowerCase();
      return (
        bookingName &&
        (bookingName === cleanName ||
          bookingName.includes(cleanName) ||
          cleanName.includes(bookingName))
      );
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
    eventDate: booking.eventDate || "",
    eventLabel: booking.eventLabel || "",
    paidAt: booking.paidAt || "",
    paymentStatus: booking.paymentStatus || "",
    used: !!booking.used,
    usedAt: booking.usedAt || ""
  };
}
