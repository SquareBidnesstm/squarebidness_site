import { saveDisabledPickupWindows } from "../_lib/delish-pickup-windows.js";

function getToken(req) {
  return (
    req.headers["x-operator-token"] ||
    req.headers["x-delish-operator-token"] ||
    ""
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const expectedToken = String(process.env.DELISH_OPERATOR_TOKEN || "").trim();
    const token = String(getToken(req) || "").trim();

    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized.",
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const disabledWindows = Array.isArray(body.disabledWindows)
      ? body.disabledWindows
      : [];

    const cleanDisabled = await saveDisabledPickupWindows(disabledWindows);

    return res.status(200).json({
      ok: true,
      disabledWindows: cleanDisabled,
    });
  } catch (error) {
    console.error("POST /api/delish/save-pickup-windows error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to save pickup windows.",
    });
  }
}
