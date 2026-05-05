import {
  DEFAULT_PICKUP_WINDOWS,
  getDisabledPickupWindows,
} from "../_lib/delish-pickup-windows.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const disabledWindows = await getDisabledPickupWindows();

    return res.status(200).json({
      ok: true,
      windows: DEFAULT_PICKUP_WINDOWS,
      disabledWindows,
    });
  } catch (error) {
    console.error("GET /api/delish/pickup-windows error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load pickup windows.",
    });
  }
}
