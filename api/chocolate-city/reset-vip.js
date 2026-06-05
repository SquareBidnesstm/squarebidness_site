import {
  VIP_BOOKING_KEY,
  VIP_EVENT_DATES,
  VIP_LIMIT,
  getCompatVipEventDates,
  vipBookingKey,
  vipHoldKey
} from "../_lib/chocolate-city-vip.js";

const RESET_MARKER_KEY = "chocolate-city:vip:last-reset-date";

async function redis(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) throw new Error("Missing Upstash env vars");

  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

function getCentralParts() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour)
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const authHeader = String(req.headers.authorization || "").trim();
    const resetToken = req.headers["x-reset-token"];
    const adminToken = req.headers["x-admin-token"];
    const cronSecret = process.env.CRON_SECRET || process.env.CHOCOLATE_CITY_CRON_SECRET || "";

    const resetAllowed =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (process.env.CHOCOLATE_CITY_CRON_SECRET &&
        resetToken === process.env.CHOCOLATE_CITY_CRON_SECRET);

    const adminAllowed =
      process.env.CHOCOLATE_CITY_ADMIN_TOKEN &&
      adminToken === process.env.CHOCOLATE_CITY_ADMIN_TOKEN;

    if (!resetAllowed && !adminAllowed) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const force = req.query.force === "true" || req.body?.force === true;
    const central = getCentralParts();

    if (!force && central.hour < 2) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Before 2AM Central",
        central
      });
    }

    const marker = await redis("GET", RESET_MARKER_KEY);

    if (!force && marker?.result === central.date) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Already reset today",
        central
      });
    }

    for (const eventDate of VIP_EVENT_DATES) {
      for (const lookupDate of getCompatVipEventDates(eventDate.date)) {
        for (let slot = 1; slot <= VIP_LIMIT; slot += 1) {
          await redis("DEL", vipHoldKey(slot, lookupDate));
        }
      }
    }

    if (adminAllowed) {
      await redis("SET", VIP_BOOKING_KEY, JSON.stringify([]));
      for (const eventDate of VIP_EVENT_DATES) {
        for (const lookupDate of getCompatVipEventDates(eventDate.date)) {
          await redis("SET", vipBookingKey(lookupDate), JSON.stringify([]));
        }
      }
    }

    await redis("SET", RESET_MARKER_KEY, central.date);

    return res.status(200).json({
      ok: true,
      reset: true,
      bookingsCleared: !!adminAllowed,
      central
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to reset VIP inventory." });
  }
}
