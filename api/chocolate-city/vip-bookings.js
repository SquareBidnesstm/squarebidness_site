const BOOKING_KEY = "chocolate-city:vip:bookings";

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
    const token = req.headers["x-admin-token"];

    if (!process.env.CHOCOLATE_CITY_ADMIN_TOKEN || token !== process.env.CHOCOLATE_CITY_ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const data = await redis("GET", BOOKING_KEY);
    const bookings = data?.result ? JSON.parse(data.result) : [];

    return res.status(200).json({
      ok: true,
      count: bookings.length,
      bookings: bookings.slice().reverse()
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
