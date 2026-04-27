const KEY = "chocolate-city:vip:bookings";

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
    const data = await redis("GET", KEY);
    const bookings = data?.result ? JSON.parse(data.result) : [];

    return res.status(200).json({
      ok: true,
      limit: 2,
      booked: bookings.length,
      remaining: Math.max(0, 2 - bookings.length),
      soldOut: bookings.length >= 2
    });
  } catch (err) {
    return res.status(200).json({
      ok: true,
      limit: 2,
      booked: 0,
      remaining: 2,
      soldOut: false,
      fallback: true
    });
  }
}
