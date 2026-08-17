import { getDelishWeeklyMenu, saveDelishWeeklyMenu, DAYS } from "../_lib/delish-weekly-menu.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-operator-token");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    try {
      const menu = await getDelishWeeklyMenu();
      return res.status(200).json({ ok: true, weeklyMenu: menu });
    } catch (err) {
      console.error("WEEKLY MENU GET ERROR:", err);
      return res.status(500).json({ ok: false, error: err.message || "Failed to load weekly menu." });
    }
  }

  if (req.method === "POST") {
    try {
      const token = String(req.headers["x-operator-token"] || "").trim();
      const expected = String(process.env.DELISH_OPERATOR_TOKEN || "").trim();

      if (!expected) {
        return res.status(503).json({ ok: false, error: "DELISH_OPERATOR_TOKEN not configured." });
      }

      if (!token || token !== expected) {
        return res.status(401).json({ ok: false, error: "Unauthorized." });
      }

      const body = req.body || {};
      const saved = await saveDelishWeeklyMenu(body);

      return res.status(200).json({ ok: true, weeklyMenu: saved });
    } catch (err) {
      console.error("WEEKLY MENU SAVE ERROR:", err);
      return res.status(500).json({ ok: false, error: err.message || "Failed to save weekly menu." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}
