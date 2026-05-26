// /api/phomatic/admin/block-date.js
// POST /api/phomatic/admin/block-date   { date: "YYYY-MM-DD", reason?: "" }  → block a date
// DELETE /api/phomatic/admin/block-date { date: "YYYY-MM-DD" }               → unblock a date
// GET  /api/phomatic/admin/block-date                                         → list blocked dates
// Requires Authorization: Bearer {adminToken}

import { sbInsert, sbSelect, sbDelete, verifyAdminToken } from "../_config.js";

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !(await verifyAdminToken(token))) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // GET — list all blocked dates
  if (req.method === "GET") {
    const { data } = await sbSelect("phomatic_blocked_dates", {}, {
      select: "id,blocked_date,reason,created_at",
      order: "blocked_date.asc",
    });
    return res.status(200).json({ ok: true, blocked: Array.isArray(data) ? data : [] });
  }

  // POST — block a date
  if (req.method === "POST") {
    const { date, reason } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "date required (YYYY-MM-DD)" });
    }
    const { ok, data } = await sbInsert("phomatic_blocked_dates", {
      blocked_date: date,
      reason: String(reason || "").trim().slice(0, 200) || null,
    });
    if (!ok) return res.status(409).json({ ok: false, error: "Date may already be blocked" });
    return res.status(200).json({ ok: true, blocked: Array.isArray(data) ? data[0] : data });
  }

  // DELETE — unblock a date
  if (req.method === "DELETE") {
    const { date } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "date required (YYYY-MM-DD)" });
    }
    const { ok } = await sbDelete("phomatic_blocked_dates", { blocked_date: `eq.${date}` });
    if (!ok) return res.status(500).json({ ok: false, error: "Delete failed" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
