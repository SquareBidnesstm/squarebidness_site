function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
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

async function redisGet(key) {
  const result = await redisPost(`/get/${encodeURIComponent(key)}`);
  if (!result || typeof result.result !== "string") return null;

  try {
    return JSON.parse(result.result);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed."
    });
  }

  try {
    const saved = await redisGet("puffs:operator:status");

    const status = {
      mode: cleanString(saved?.mode || process.env.PUFFS_ORDERING_MODE || "auto", 40),
      resumeAt: cleanString(saved?.resumeAt || process.env.PUFFS_ORDERING_RESUME_AT || "", 80),
      message: cleanString(saved?.message || process.env.PUFFS_ORDERING_MESSAGE || "", 180)
    };

    return res.status(200).json({
      ok: true,
      status
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to load operator status."
    });
  }
}
