import { getTribute } from "../../_lib/philson-redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const slug = String(req.query.slug || req.query.id || "").trim();
  if (!slug) return res.status(400).json({ ok: false, error: "slug is required." });

  try {
    const tribute = await getTribute(slug);
    if (!tribute) return res.status(404).json({ ok: false, error: "Tribute not found." });

    // Public endpoint — don't expose if not active (unless admin param present)
    if (!tribute.active && req.query.admin !== "1") {
      return res.status(404).json({ ok: false, error: "Tribute not found." });
    }

    return res.status(200).json({ ok: true, tribute });
  } catch (err) {
    console.error("PHILSON TRIBUTE GET ERROR:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Failed to load tribute." });
  }
}
