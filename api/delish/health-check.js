import { Redis } from "@upstash/redis";
import { getDelishOrderingState } from "../_lib/delish-ordering-config.js";
import { getDelishFlashSale } from "../_lib/delish-flash-sale.js";
import {
  DEFAULT_PICKUP_WINDOWS,
  getDisabledPickupWindows,
} from "../_lib/delish-pickup-windows.js";

const REDIS_URL = process.env.DELISH_UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({
        url: REDIS_URL,
        token: REDIS_TOKEN,
      })
    : null;

function pass(label, detail = {}) {
  return { label, ok: true, status: "pass", ...detail };
}

function warn(label, detail = {}) {
  return { label, ok: false, status: "warn", ...detail };
}

function fail(label, detail = {}) {
  return { label, ok: false, status: "fail", ...detail };
}

function getCentralTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const checks = [];
  const details = {};

  try {
    const orderingState = getDelishOrderingState();
    details.ordering = orderingState;
    checks.push(
      pass("Ordering schedule loaded", {
        mode: orderingState.orderingMode || orderingState.mode || "auto",
        openNow: orderingState.openNow,
        today: orderingState.today,
        reason: orderingState.reason,
      })
    );
  } catch (error) {
    checks.push(fail("Ordering schedule failed", { error: error?.message || String(error) }));
  }

  if (!REDIS_URL || !REDIS_TOKEN || !redis) {
    checks.push(fail("Delish Redis env vars missing"));
  } else {
    checks.push(pass("Delish Redis env vars present"));

    try {
      const probeKey = "delish:health:last_probe";
      const probeValue = new Date().toISOString();
      await redis.set(probeKey, probeValue, { ex: 600 });
      const saved = await redis.get(probeKey);

      if (saved === probeValue) {
        checks.push(pass("Redis read/write ok"));
      } else {
        checks.push(warn("Redis read/write returned unexpected value"));
      }
    } catch (error) {
      checks.push(fail("Redis read/write failed", { error: error?.message || String(error) }));
    }

    try {
      const orderIds = await redis.lrange("delish:orders:list", 0, 9);
      details.recentOrderIds = Array.isArray(orderIds) ? orderIds : [];
      checks.push(
        pass("Order list reachable", {
          recentOrderCount: details.recentOrderIds.length,
        })
      );
    } catch (error) {
      checks.push(fail("Order list unreachable", { error: error?.message || String(error) }));
    }
  }

  try {
    const disabledWindows = await getDisabledPickupWindows();
    details.pickupWindows = {
      windows: DEFAULT_PICKUP_WINDOWS,
      disabledWindows,
    };
    checks.push(
      pass("Pickup windows loaded", {
        availableCount: DEFAULT_PICKUP_WINDOWS.length - disabledWindows.length,
        disabledCount: disabledWindows.length,
      })
    );
  } catch (error) {
    checks.push(fail("Pickup windows failed", { error: error?.message || String(error) }));
  }

  try {
    const sale = await getDelishFlashSale();
    details.flashSale = sale;
    checks.push(
      pass("Flash sale state loaded", {
        enabled: sale.enabled,
        active: sale.active,
        itemCount: Array.isArray(sale.items) ? sale.items.length : 0,
      })
    );
  } catch (error) {
    checks.push(fail("Flash sale state failed", { error: error?.message || String(error) }));
  }

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");

  return res.status(hasFail ? 500 : 200).json({
    ok: !hasFail,
    status: hasFail ? "fail" : hasWarn ? "warn" : "pass",
    checkedAt: new Date().toISOString(),
    checkedAtCentral: getCentralTimestamp(),
    checks,
    details,
  });
}
