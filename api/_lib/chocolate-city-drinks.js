export const DRINK_KEY = "chocolate-city:drink:credits";

const CENTRAL_TIME_ZONE = "America/Chicago";

function getCentralParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    hour12: false
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function addDaysToIsoDate(isoDate, days) {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function getDrinkServiceDate(date = new Date()) {
  const parts = getCentralParts(date);
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour || 0);

  return hour < 6 ? addDaysToIsoDate(isoDate, -1) : isoDate;
}

export function getDrinkServiceLabel(serviceDate = getDrinkServiceDate()) {
  const [year, month, day] = String(serviceDate).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function getDrinkClaimCode(sessionId = "") {
  const clean = String(sessionId || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  const suffix = clean.slice(-6) || "DRINK";

  return `CC-${suffix}`;
}

export function normalizeDrinkCredit(credit = {}) {
  const serviceDate = credit.serviceDate || getDrinkServiceDate(credit.paidAt ? new Date(credit.paidAt) : new Date());

  return {
    ...credit,
    serviceDate,
    serviceLabel: credit.serviceLabel || getDrinkServiceLabel(serviceDate),
    claimCode: credit.claimCode || getDrinkClaimCode(credit.sessionId),
    redeemed: Boolean(credit.redeemed)
  };
}

export function isActiveDrinkCredit(credit = {}, serviceDate = getDrinkServiceDate()) {
  const normalized = normalizeDrinkCredit(credit);
  return !normalized.redeemed && normalized.serviceDate === serviceDate;
}
