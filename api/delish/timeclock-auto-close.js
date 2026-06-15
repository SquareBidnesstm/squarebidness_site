import { runDelishMidnightAutoClockOut } from "./timeclock.js";

export const config = {
  runtime: "nodejs"
};

function send(res, status, data) {
  res.status(status).json(data);
}

function isAuthorized(req) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  const managerPin = String(process.env.DELISH_TIMECLOCK_MANAGER_PIN || process.env.DELISH_OPERATOR_TOKEN || "").trim();
  const auth = String(req.headers?.authorization || "").trim();
  const headerManagerPin = String(req.headers?.["x-delish-manager-pin"] || req.headers?.["x-manager-pin"] || "").trim();

  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (managerPin && headerManagerPin === managerPin) return true;

  return false;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET,POST");
      return send(res, 405, { ok: false, error: "Method not allowed." });
    }

    if (!isAuthorized(req)) {
      return send(res, 401, { ok: false, error: "Not authorized." });
    }

    const result = await runDelishMidnightAutoClockOut();
    return send(res, 200, result);
  } catch (err) {
    console.error("DELISH TIMECLOCK AUTO CLOSE ERROR:", err);
    return send(res, err.status || 500, {
      ok: false,
      error: err.message || "Unable to auto close Delish timeclock."
    });
  }
}
