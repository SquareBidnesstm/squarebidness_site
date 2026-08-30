import { getOrderByToken, isConfigured } from "../_lib/supabase-philson.js";

const ADMIN_KEY = process.env.PHILSON_ADMIN_KEY || "";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { token, key } = req.query || {};

  // Allow access via eddie token OR admin key
  const hasAdminKey = ADMIN_KEY && key === ADMIN_KEY;
  if (!token) return res.status(400).json({ ok: false, error: "Missing token" });

  if (!isConfigured()) return res.status(500).json({ ok: false, error: "DB unavailable" });

  const order = await getOrderByToken(String(token));
  if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

  // Only expose the admin key view if key matches — otherwise token access is sufficient
  return res.status(200).json({ ok: true, order, isAdmin: hasAdminKey });
}
