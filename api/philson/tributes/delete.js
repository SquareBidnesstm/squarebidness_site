import { checkAuth, deleteTribute } from "../../_lib/philson-redis.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  const slug = String(req.query.slug || "").trim();
  if (!slug) return res.status(400).json({ ok: false, error: "slug is required." });

  try {
    await deleteTribute(slug);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("PHILSON TRIBUTE DELETE ERROR:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Failed to delete tribute." });
  }
}
