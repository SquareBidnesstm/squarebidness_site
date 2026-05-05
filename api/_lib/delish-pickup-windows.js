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
