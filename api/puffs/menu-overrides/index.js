function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function redisPost(pathname) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${REDIS_URL}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Redis request failed (${res.status})`);
  return data;
}

async function redisGet(key) {
  const result = await redisPost(`/get/${encodeURIComponent(key)}`);
  if (!result || typeof result.result !== "string") return null;
  return safeJsonParse(result.result);
}

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ ok: false, error: "Missing Upstash Redis env vars." });
  }

  try {
    const saved = await redisGet("puffs:menu:overrides");

    const overrides = saved || {
      sections: {
        individual: true,
        plates: true,
        sundaySides: true,
        saturdayAddOns: true
      },
      itemsOff: [],
      itemsSoldOut: [],
      customerMessage: "",
      updatedAt: ""
    };

    return res.status(200).json({ ok: true, overrides });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to load Puff’s menu overrides."
    });
  }
}
