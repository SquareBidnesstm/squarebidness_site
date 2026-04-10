function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanString(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

async function redisPost(pathname) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${REDIS_URL}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Redis request failed (${res.status})`);
  }
  return data;
}

async function redisSet(key, value) {
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(JSON.stringify(value));
  return redisPost(`/set/${encodedKey}/${encodedValue}`);
}

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed."
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const mode = cleanString(body.mode || "auto", 40);
    const resumeAt = cleanString(body.resumeAt || "", 80);
    const message = cleanString(body.message || "", 180);

    const allowedModes = new Set(["auto", "paused", "force_open"]);
    if (!allowedModes.has(mode)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid operator mode."
      });
    }

    const status = {
      mode,
      resumeAt,
      message,
      updatedAt: new Date().toISOString()
    };

    await redisSet("puffs:operator:status", status);

    return res.status(200).json({
      ok: true,
      status
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to save operator status."
    });
  }
}
