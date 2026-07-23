import { listBookings, updateBookingStatus } from "../_lib/supabase-taxslayer.js";

function auth(req) {
  const token = process.env.TAXSLAYER_ADMIN_TOKEN;
  if (!token) return false;
  const sent =
    (req.headers["x-admin-token"] || "").trim() ||
    (req.headers["authorization"] || "").replace(/^bearer /i, "").trim();
  return sent === token;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!auth(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  if (req.method === "GET") {
    try {
      const status = String(req.query?.status || "all");
      const rows = await listBookings({ status });
      return res.status(200).json({ ok: true, bookings: rows });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || "Failed to load bookings" });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { id, status } = req.body || {};
      const allowed = ["pending", "confirmed", "completed", "canceled"];
      if (!id) return res.status(400).json({ ok: false, error: "id required" });
      if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: "Invalid status" });
      await updateBookingStatus(id, status);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || "Update failed" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
