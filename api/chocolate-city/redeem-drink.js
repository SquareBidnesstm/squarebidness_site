const DRINK_KEY = "chocolate-city:drink:credits";

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

    const data = await redis("GET", DRINK_KEY);
    const credits = data?.result ? JSON.parse(data.result) : [];

    let found = false;

    const updated = credits.map(c => {
      if (c.sessionId === sessionId) {
        found = true;
        return {
          ...c,
          redeemed: true,
          redeemedAt: new Date().toISOString()
        };
      }

      return c;
    });

    if (!found) {
      return res.status(404).json({ ok: false, error: "Drink credit not found" });
    }

    await redis("SET", DRINK_KEY, JSON.stringify(updated));

    return res.status(200).json({
      ok: true,
      redeemed: true,
      sessionId
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
