// api/health/admin-applications.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_HEALTH_URL,
  process.env.SUPABASE_HEALTH_SERVICE_ROLE_KEY
);

const VALID_STATUSES = ["new", "contacted", "scheduled", "placed", "declined"];

export default async function handler(req, res) {
  const allowed = ["https://www.squarebidness.com", "https://health.squarebidness.com"];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = (req.headers.authorization || "").replace("Bearer ", "").trim();
  const adminToken = process.env.HEALTH_ADMIN_TOKEN;
  if (!adminToken || !auth || auth !== adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("health_cna_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[health/admin-applications] GET error:", error);
      return res.status(500).json({ error: "Could not fetch applications." });
    }
    return res.status(200).json({ applications: data });
  }

  if (req.method === "PATCH") {
    const { id, status, sms_blasted_at, priority } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id." });

    const updates = {};
    if (status) {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status." });
      updates.status = status;
    }
    if (sms_blasted_at) {
      updates.sms_blasted_at = new Date().toISOString();
    }
    if (priority !== undefined) {
      updates.priority = Boolean(priority);
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update." });

    const { error } = await supabase
      .from("health_cna_applications")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("[health/admin-applications] PATCH error:", error);
      return res.status(500).json({ error: "Could not update status." });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id." });
    const { error } = await supabase
      .from("health_cna_applications")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[health/admin-applications] DELETE error:", error);
      return res.status(500).json({ error: "Could not delete." });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
