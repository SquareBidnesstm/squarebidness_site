import { getOrders, isConfigured } from "../_lib/supabase-philson.js";

const ADMIN_KEY = process.env.PHILSON_ADMIN_KEY || "";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false });

  const { key, status, limit } = req.query || {};

  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  if (!isConfigured()) return res.status(500).json({ ok: false, error: "DB unavailable" });

  const orders = await getOrders({
    status: status || undefined,
    limit: Math.min(500, Number(limit || 200)),
  });

  return res.status(200).json({ ok: true, orders });
}
