import {
  DRINK_KEY,
  normalizeDrinkCredit
} from "../_lib/chocolate-city-drinks.js";

const DRINK_REDEEM_LOCK_KEY = "chocolate-city:drink:redeem-lock";

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

async function acquireRedisLock(key, value, seconds = 10) {
  const result = await redis("SET", key, value, "EX", String(seconds), "NX");
  return result?.result === "OK";
}

async function releaseRedisLock(key, value = "") {
  if (value) {
    const existing = await redis("GET", key);
    if (existing?.result !== value) return;
  }

  await redis("DEL", key);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const token = req.headers["x-admin-token"];

    if (!process.env.CHOCOLATE_CITY_ADMIN_TOKEN || token !== process.env.CHOCOLATE_CITY_ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const sessionId = String(req.body?.sessionId || "").trim();

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: "Missing sessionId" });
    }

    const lockValue =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const locked = await acquireRedisLock(DRINK_REDEEM_LOCK_KEY, lockValue, 10);

    if (!locked) {
      return res.status(409).json({ ok: false, error: "Drink screen is busy. Try again in a few seconds." });
    }

    try {
      const data = await redis("GET", DRINK_KEY);
      const credits = data?.result ? JSON.parse(data.result).map(normalizeDrinkCredit) : [];
      const credit = credits.find(c => c.sessionId === sessionId);

      if (!credit) {
        return res.status(404).json({ ok: false, error: "Drink credit not found" });
      }

      if (credit.redeemed) {
        return res.status(200).json({
          ok: true,
          redeemed: true,
          alreadyRedeemed: true,
          sessionId
        });
      }

      const updated = credits.map(c => {
        if (c.sessionId === sessionId) {
          return {
            ...c,
            redeemed: true,
            redeemedAt: new Date().toISOString()
          };
        }

        return c;
      });

      await redis("SET", DRINK_KEY, JSON.stringify(updated));

      return res.status(200).json({
        ok: true,
        redeemed: true,
        sessionId
      });
    } finally {
      await releaseRedisLock(DRINK_REDEEM_LOCK_KEY, lockValue).catch(() => {});
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to redeem drink credit" });
  }
}
