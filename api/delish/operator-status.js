export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const redisUrl = process.env.DELISH_UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

    const fallbackMode = (process.env.DELISH_ORDERING_MODE || "auto").toLowerCase();
    const fallbackMessage = "";
    const fallbackResumeAt = "";

    if (!redisUrl || !redisToken) {
      return res.status(200).json({
        ok: true,
        mode: fallbackMode,
        resumeAt: "",
        resumeAtDisplay: "",
        message: fallbackMessage,
        source: "env-fallback"
      });
    }

    const [modeRes, resumeRes, messageRes] = await Promise.all([
      redisGet(redisUrl, redisToken, "delish:ordering:mode"),
      redisGet(redisUrl, redisToken, "delish:ordering:resume_at"),
      redisGet(redisUrl, redisToken, "delish:ordering:message")
    ]);

    const mode = normalizeMode(modeRes ?? fallbackMode);
    const rawResumeAt = typeof resumeRes === "string" ? resumeRes : "";
    const message = typeof messageRes === "string" ? messageRes : fallbackMessage;

    const resumeAt = mode === "paused" ? rawResumeAt : "";

    return res.status(200).json({
      ok: true,
      mode,
      resumeAt,
      resumeAtDisplay: formatCentral(resumeAt),
      message,
      source: "redis"
    });
  } catch (error) {
    console.error("DELISH operator-status error:", error);
    return res.status(500).json({
      ok: false,
      error: "Unable to load operator status"
    });
  }
}

function normalizeMode(value) {
  const mode = String(value || "").toLowerCase().trim();
  if (["auto", "open", "paused", "closed"].includes(mode)) return mode;
  return "auto";
}

function formatCentral(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit"
  }).format(d);
}

async function redisGet(redisUrl, redisToken, key) {
  const url = `${redisUrl.replace(/\/$/, "")}/get/${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${redisToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Redis GET failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data?.result ?? null;
}
