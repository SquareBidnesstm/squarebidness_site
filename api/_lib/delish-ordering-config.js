// FILE: /api/_lib/delish-ordering-config.js

export const DELISH_ORDERING_MODE = String(
  process.env.DELISH_ORDERING_MODE || "auto"
).toLowerCase(); // auto | open | closed

export const DELISH_HOURS = {
  monday: { open: "11:00", close: "14:00" },
  tuesday: { open: "11:00", close: "14:00" },
  wednesday: { open: "11:00", close: "14:00" },
  thursday: { open: "11:00", close: "14:00" },
  friday: { open: "11:00", close: "14:00" },
  sunday: { open: "11:00", close: "14:00", occurrences: [1, 3] }
};

export function getCentralNowParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const dayOfMonth = Number(map.day || 0);

  return {
    isoDate: `${map.year}-${map.month}-${map.day}`,
    weekday: String(map.weekday || "").toLowerCase(),
    dayOfMonth,
    sundayOccurrence: dayOfMonth ? Math.ceil(dayOfMonth / 7) : 0,
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0)
  };
}

function hhmmToMinutes(value) {
  const [hh, mm] = String(value || "00:00").split(":").map(Number);
  return (hh * 60) + mm;
}

export function getDelishOrderingState(date = new Date()) {
  const now = getCentralNowParts(date);
  const day = now.weekday;
  const config = DELISH_HOURS[day] || null;

  if (DELISH_ORDERING_MODE === "open") {
    return {
      mode: "open",
      reason: "manual_open",
      today: day,
      now,
      openNow: true,
      openTime: config?.open || "",
      closeTime: config?.close || ""
    };
  }

  if (DELISH_ORDERING_MODE === "closed") {
    return {
      mode: "closed",
      reason: "manual_closed",
      today: day,
      now,
      openNow: false,
      openTime: config?.open || "",
      closeTime: config?.close || ""
    };
  }

  if (!config) {
    return {
      mode: "closed",
      reason: "not_a_service_day",
      today: day,
      now,
      openNow: false,
      openTime: "",
      closeTime: ""
    };
  }

  if (day === "sunday") {
    const allowedOccurrences = Array.isArray(config.occurrences) ? config.occurrences : [];
    if (!allowedOccurrences.includes(now.sundayOccurrence)) {
      return {
        mode: "closed",
        reason: "sunday_not_scheduled",
        today: day,
        now,
        openNow: false,
        openTime: config.open,
        closeTime: config.close
      };
    }
  }

  const currentMinutes = (now.hour * 60) + now.minute;
  const openMinutes = hhmmToMinutes(config.open);
  const closeMinutes = hhmmToMinutes(config.close);
  const openNow = currentMinutes >= openMinutes && currentMinutes < closeMinutes;

  return {
    mode: openNow ? "open" : "closed",
    reason: openNow ? "within_service_window" : "outside_service_window",
    today: day,
    now,
    openNow,
    openTime: config.open,
    closeTime: config.close
  };
}
