const KEY = "courageaux:status";

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

const DEFAULT = {
  bookingOpen: false,
  flashSaleActive: false,
  flashSaleLabel: "",
  flashSaleDiscount: 0,
  updatedAt: new Date().toISOString()
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.squarebidness.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      let state = DEFAULT;
      try {
        const data = await redis("GET", KEY);
        if (data?.result) state = { ...DEFAULT, ...JSON.parse(data.result) };
      } catch {}
      return res.status(200).json({ ok: true, state });
    }

    if (req.method === "POST") {
      const token = req.headers["x-admin-token"];
      if (!process.env.COURAGEAUX_ADMIN_TOKEN || token !== process.env.COURAGEAUX_ADMIN_TOKEN) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const body = req.body || {};
      const state = {
        bookingOpen: body.bookingOpen === true || body.bookingOpen === "true",
        flashSaleActive: body.flashSaleActive === true || body.flashSaleActive === "true",
        flashSaleLabel: String(body.flashSaleLabel || "").slice(0, 80),
        flashSaleDiscount: Math.min(100, Math.max(0, parseInt(body.flashSaleDiscount) || 0)),
        updatedAt: new Date().toISOString()
      };

      await redis("SET", KEY, JSON.stringify(state));
      return res.status(200).json({ ok: true, state });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
