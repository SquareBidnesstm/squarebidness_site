import {
  DRINK_KEY,
  getDrinkClaimCode,
  normalizeDrinkCredit
} from "../_lib/chocolate-city-drinks.js";

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

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const sessionId = String(req.query?.session_id || req.query?.sessionId || "").trim();

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: "Missing session_id" });
    }

    const data = await redis("GET", DRINK_KEY);
    const credits = data?.result ? JSON.parse(data.result).map(normalizeDrinkCredit) : [];
    const credit = credits.find((item) => item.sessionId === sessionId);

    if (!credit) {
      return res.status(200).json({
        ok: true,
        pending: true,
        claimCode: getDrinkClaimCode(sessionId)
      });
    }

    return res.status(200).json({
      ok: true,
      pending: false,
      credit: {
        recipientName: credit.recipientName || "Guest",
        senderName: credit.senderName || "Anonymous",
        message: credit.message || "",
        label: credit.label || "Drink Credit",
        amount: Number(credit.amount || 0),
        claimCode: credit.claimCode,
        serviceDate: credit.serviceDate,
        serviceLabel: credit.serviceLabel,
        redeemed: Boolean(credit.redeemed),
        redeemedAt: credit.redeemedAt || ""
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to load drink credit." });
  }
}
