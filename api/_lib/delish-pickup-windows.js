import { Redis } from "@upstash/redis";

export const PICKUP_WINDOWS_KEY = "delish:pickup:disabled_windows";

export const DEFAULT_PICKUP_WINDOWS = [
  "11:00 AM - 11:30 AM",
  "11:30 AM - 12:00 PM",
  "12:00 PM - 12:30 PM",
  "12:30 PM - 1:00 PM",
  "1:00 PM - 1:30 PM",
  "1:30 PM - 2:00 PM",
  "2:00 PM - 2:30 PM",
];

function getRedis() {
  const url = process.env.DELISH_UPSTASH_REDIS_REST_URL;
  const token = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function cleanPickupWindows(values = []) {
  const seen = new Set();
  const clean = [];

  for (const value of Array.isArray(values) ? values : []) {
    const windowLabel = String(value || "").trim();
    if (!DEFAULT_PICKUP_WINDOWS.includes(windowLabel) || seen.has(windowLabel)) {
      continue;
    }

    seen.add(windowLabel);
    clean.push(windowLabel);
  }

  return clean;
}

export function isAllowedPickupWindow(value) {
  return DEFAULT_PICKUP_WINDOWS.includes(String(value || "").trim());
}

function getCentralNowParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
  };
}

function parsePickupWindowStartMinutes(windowLabel) {
  const match = String(windowLabel || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-/i);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;

  return (hour * 60) + minute;
}

export function getCurrentCentralMinutes(date = new Date()) {
  const now = getCentralNowParts(date);
  return (Number(now.hour || 0) * 60) + Number(now.minute || 0);
}

export function isFuturePickupWindow(windowLabel, date = new Date()) {
  const startMinutes = parsePickupWindowStartMinutes(windowLabel);
  if (startMinutes === null) return true;
  return startMinutes > getCurrentCentralMinutes(date);
}

export function getFuturePickupWindows(windows = DEFAULT_PICKUP_WINDOWS, date = new Date()) {
  return (Array.isArray(windows) ? windows : []).filter((windowLabel) =>
    isFuturePickupWindow(windowLabel, date)
  );
}

export async function getDisabledPickupWindows() {
  const redis = getRedis();
  if (!redis) return [];

  const disabled = await redis.get(PICKUP_WINDOWS_KEY);
  return cleanPickupWindows(disabled);
}

export async function saveDisabledPickupWindows(values = []) {
  const redis = getRedis();
  if (!redis) {
    throw new Error("Redis is not configured.");
  }

  const cleanDisabled = cleanPickupWindows(values);
  await redis.set(PICKUP_WINDOWS_KEY, cleanDisabled);
  return cleanDisabled;
}
