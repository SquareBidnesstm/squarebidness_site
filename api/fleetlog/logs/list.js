// /api/fleetlog/logs/list.js
export const config = { runtime: "nodejs" };

// Clean env values (removes quotes + trailing slash)
function upstashBaseUrl() {
  return (process.env.UPSTASH_REDIS_REST_URL || "")
    .replace(/(^"|"$)/g, "")
    .replace(/\/+$/, "");
}

function upstashToken() {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || "")
    .replace(/(^"|"$)/g, "");
}

async function upstashPost(path, body) {
  const base = upstashBaseUrl();
  const token = upstashToken();

  if (!base || !token) {
    throw new Error("Missing Upstash env vars");
  }

  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const j = await r.json().catch(() => null);

  if (!r.ok) {
    throw new Error(`Upstash error: ${r.status} ${JSON.stringify(j)}`);
  }

  return j;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const email = String(req.query.email || "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        ok: false,
        error: "Missing/invalid email",
      });
    }

    // Clamp limit between 1–50
    const limitRaw = parseInt(req.query.limit || "25", 10);
    const limit = Math.min(Math.max(limitRaw || 25, 1), 50);

    // Fetch list of log IDs for this user
    const listKey = `fleetlog:user:${email}:logs`;

    const idsResp = await upstashPost(
      `/lrange/${encodeURIComponent(listKey)}`,
      [0, limit - 1]
    );

    const ids = Array.isArray(idsResp?.result)
      ? idsResp.result
      : [];

    if (!ids.length) {
      return res.status(200).json({
        ok: true,
        logs: [],
      });
    }

    // Pipeline fetch all logs in one call
    const commands = ids.map((id) => [
      "GET",
      `fleetlog:log:${id}`,
    ]);

    const pipeResp = await upstashPost("/pipeline", commands);

    const logs = (pipeResp || [])
      .map((item) => {
        try {
          const raw = item?.result;
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return res.status(200).json({
      ok: true,
      logs,
    });

  } catch (e) {
    console.error("FleetLog list error:", e?.message || e);

    return res.status(500).json({
      ok: false,
      error: e?.message || "Server error",
    });
  }
}
