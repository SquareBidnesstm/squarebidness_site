// FILE: /api/delish/menu-overrides.js
import { getDelishMenuOverrides } from "../_lib/delish-menu-overrides.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const overrides = await getDelishMenuOverrides();

    return res.status(200).json({
      ok: true,
      overrides,
    });
  } catch (error) {
    console.error("DELISH MENU OVERRIDES GET ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to load menu overrides.",
    });
  }
}
