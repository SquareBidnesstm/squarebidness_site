import {
  DRINK_KEY,
  getDrinkServiceDate,
  getDrinkServiceLabel,
  isActiveDrinkCredit,
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
    const expectedToken = String(process.env.CHOCOLATE_CITY_ADMIN_TOKEN || "").trim();
    const providedToken = String(req.headers["x-admin-token"] || "").trim();
    const wantsAdmin = Boolean(providedToken);

    if (wantsAdmin && (!expectedToken || providedToken !== expectedToken)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const data = await redis("GET", DRINK_KEY);
    const credits = data?.result ? JSON.parse(data.result).map(normalizeDrinkCredit) : [];
    const serviceDate = String(req.query?.serviceDate || getDrinkServiceDate()).trim();
    const includeAll = wantsAdmin && String(req.query?.all || "") === "1";

    const activeCredits = credits
      .filter(c => includeAll ? !c.redeemed : isActiveDrinkCredit(c, serviceDate))
      .slice()
      .reverse();
    const publicCredits = activeCredits.map(c => ({
      recipientName: c.recipientName || "Guest",
      senderName: c.senderName || "Anonymous",
      message: c.message || "",
      label: c.label || "Drink Credit",
      amount: Number(c.amount || 0),
      claimCode: c.claimCode || "",
      serviceLabel: c.serviceLabel || getDrinkServiceLabel(serviceDate)
    }));

    return res.status(200).json({
      ok: true,
      serviceDate,
      serviceLabel: getDrinkServiceLabel(serviceDate),
      count: activeCredits.length,
      credits: wantsAdmin ? activeCredits : publicCredits
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to load drink credits." });
  }
}
