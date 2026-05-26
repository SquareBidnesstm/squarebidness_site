import { Redis } from "@upstash/redis";

export const DELISH_FLASH_SALE_KEY = "delish:flash_sale";
export const DELISH_FLASH_PICKUP_WINDOWS = [
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
];

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

export function getCentralNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function normalizePrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Number(price.toFixed(2));
}

function normalizeLimit(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 0) return 0;
  return Math.floor(limit);
}

function normalizePickupWindows(value, legacyPickupWindow = "") {
  const requested = Array.isArray(value) ? value : [];
  const clean = requested.filter((windowLabel) =>
    DELISH_FLASH_PICKUP_WINDOWS.includes(String(windowLabel || "").trim())
  );

  if (clean.length) return [...new Set(clean)];

  const legacy = String(legacyPickupWindow || "").trim();
  if (DELISH_FLASH_PICKUP_WINDOWS.includes(legacy)) return [legacy];

  return [];
}

export function normalizeFlashSale(input = {}) {
  const items = Array.isArray(input.items)
    ? input.items
        .map((item) => {
          const sourceId = String(item.sourceId || "").trim();
          const name = String(item.name || "").trim();
          const description = String(item.description || item.desc || "").trim();
          const price = normalizePrice(item.price);
          const limit = normalizeLimit(item.limit);

          if (!sourceId || !name || !price) return null;

          return {
            sourceId,
            flashId: `flash_${sourceId}`,
            name,
            description: description.slice(0, 140),
            price,
            limit,
          };
        })
        .filter(Boolean)
    : [];

  return {
    enabled: input.enabled === true,
    title: String(input.title || "Special Items").trim().slice(0, 80) || "Special Items",
    message: String(input.message || "").trim().slice(0, 180),
    startAt: String(input.startAt || "").trim().slice(0, 20),
    endAt: String(input.endAt || "").trim().slice(0, 20),
    pickupWindows: normalizePickupWindows(input.pickupWindows, input.pickupWindow),
    items,
    updatedAt: new Date().toISOString(),
  };
}

export function isFlashSaleActive(sale, now = getCentralNow()) {
  if (!sale?.enabled || !Array.isArray(sale.items) || !sale.items.length) return false;
  if (!Array.isArray(sale.pickupWindows) || !sale.pickupWindows.length) return false;
  if (sale.startAt && now < sale.startAt) return false;
  if (sale.endAt && now > sale.endAt) return false;
  return true;
}

export async function getDelishFlashSale() {
  const saved = await redis.get(DELISH_FLASH_SALE_KEY);
  const sale = normalizeFlashSale(saved || {});
  return {
    ...sale,
    active: isFlashSaleActive(sale),
    now: getCentralNow(),
  };
}

export async function saveDelishFlashSale(input) {
  const sale = normalizeFlashSale(input);
  await redis.set(DELISH_FLASH_SALE_KEY, sale);
  return {
    ...sale,
    active: isFlashSaleActive(sale),
    now: getCentralNow(),
  };
}
