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
    const data = await redis("GET", DRINK_KEY);
    const credits = data?.result ? JSON.parse(data.result) : [];

    const activeCredits = credits
      .filter(c => !c.redeemed)
      .slice()
      .reverse();

    return res.status(200).json({
      ok: true,
      count: activeCredits.length,
      credits: activeCredits
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
