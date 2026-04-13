export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const expectedToken = (process.env.DELISH_OPERATOR_TOKEN || "").trim();
    const providedToken = (
      req.headers["x-operator-token"] ||
      req.headers["x-delish-operator-token"] ||
      ""
    ).toString().trim();

    if (!expectedToken) {
      return res.status(503).json({
        ok: false,
        error: "DELISH_OPERATOR_TOKEN is not set yet"
      });
    }

    if (providedToken !== expectedToken) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }

    const redisUrl = process.env.DELISH_UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      return res.status(503).json({
        ok: false,
        error: "Redis is not configured"
      });
    }

    const body = parseBody(req.body);
    const mode = normalizeMode(body.mode);
    const pauseMinutes = Number(body.pauseMinutes || 0);
    const resumeAtInput = typeof body.resumeAt === "string" ? body.resumeAt.trim() : "";
    const messageOnly = !!body.messageOnly;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (messageOnly) {
      await redisSet(redisUrl, redisToken, "delish:ordering:message", message);
      return res.status(200).json({
        ok: true,
        updated: { message }
      });
    }

    if (!mode) {
      return res.status(400).json({
        ok: false,
        error: "Invalid mode"
      });
    }

    if (mode === "open") {
  await Promise.all([
    redisSet(redisUrl, redisToken, "delish:ordering:mode", "open"),
    redisSet(redisUrl, redisToken, "delish:ordering:resume_at", ""),
    redisSet(redisUrl, redisToken, "delish:ordering:message", "")
  ]);

  return res.status(200).json({
    ok: true,
    updated: {
      mode: "open",
      resumeAt: "",
      message: ""
    }
  });
}

    if (mode === "auto") {
  await Promise.all([
    redisSet(redisUrl, redisToken, "delish:ordering:mode", "auto"),
    redisSet(redisUrl, redisToken, "delish:ordering:resume_at", ""),
    redisSet(redisUrl, redisToken, "delish:ordering:message", "")
  ]);

  return res.status(200).json({
    ok: true,
    updated: {
      mode: "auto",
      resumeAt: "",
      message: ""
    }
  });
}

    if (mode === "closed") {
  const closedMessage = "Online ordering is closed for today.";

  await Promise.all([
    redisSet(redisUrl, redisToken, "delish:ordering:mode", "closed"),
    redisSet(redisUrl, redisToken, "delish:ordering:resume_at", ""),
    redisSet(redisUrl, redisToken, "delish:ordering:message", closedMessage)
  ]);

  return res.status(200).json({
    ok: true,
    updated: {
      mode: "closed",
      resumeAt: "",
      message: closedMessage
    }
  });
}

    if (mode === "paused") {
      let resumeAt = "";

      if (resumeAtInput) {
        const parsed = new Date(resumeAtInput);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({
            ok: false,
            error: "Invalid resumeAt value"
          });
        }
        resumeAt = parsed.toISOString();
      } else if (pauseMinutes > 0) {
        const future = new Date(Date.now() + pauseMinutes * 60 * 1000);
        resumeAt = future.toISOString();
      }

      const pauseMessage = resumeAt
        ? `We’re serving current orders now. Online ordering will reopen at ${formatCentral(resumeAt)}.`
        : "We’re serving current orders now. Online ordering is temporarily paused.";

      await Promise.all([
        redisSet(redisUrl, redisToken, "delish:ordering:mode", "paused"),
        redisSet(redisUrl, redisToken, "delish:ordering:resume_at", resumeAt),
        redisSet(redisUrl, redisToken, "delish:ordering:message", pauseMessage)
      ]);

      return res.status(200).json({
        ok: true,
        updated: {
          mode: "paused",
          resumeAt,
          message: pauseMessage
        }
      });
    }

    return res.status(400).json({
      ok: false,
      error: "Unhandled mode"
    });
  } catch (error) {
    console.error("DELISH operator-control error:", error);
    return res.status(500).json({
      ok: false,
      error: "Unable to update operator control"
    });
  }
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function normalizeMode(value) {
  const mode = String(value || "").toLowerCase().trim();
  if (["auto", "open", "paused", "closed"].includes(mode)) return mode;
  return "";
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

async function redisSet(redisUrl, redisToken, key, value) {
  const safeValue = value == null ? "" : String(value);
  const url = `${redisUrl.replace(/\/$/, "")}/set/${encodeURIComponent(key)}/${encodeURIComponent(safeValue)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Redis SET failed: ${response.status} ${text}`);
  }

  return response.json();
}


