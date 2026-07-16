const STATUS_KEY  = "courageaux:status";
const AMARI_PHONE = "+19853512750";

async function redis(command, ...args) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Upstash env vars");
  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

async function sms(to, body) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_HEALTH_NUMBER;
  if (!sid || !auth || !from) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.squarebidness.com");
  if (req.method !== "GET") return res.status(405).end();

  let status = { mobileActive: true };
  try {
    const d = await redis("GET", STATUS_KEY);
    if (d?.result) status = { ...status, ...JSON.parse(d.result) };
  } catch {}

  const available = status.mobileActive !== false;

  if (available) {
    try {
      const now = new Date().toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
      });
      await sms(AMARI_PHONE, `📍 Mobile inquiry — someone checked availability at ${now} CT`);
    } catch (err) {
      console.error("SMS error:", err.message);
    }
  }

  return res.status(200).json({ ok: true, available });
}
