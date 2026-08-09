import { checkAuth, getTribute, listTributeSlugs } from "../../_lib/philson-redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    const slugs = await listTributeSlugs();
    const tributes = await Promise.all(
      slugs.map(async (slug) => {
        const t = await getTribute(slug);
        if (!t) return null;
        // Strip photos from list view — too heavy
        const { photos, ...rest } = t;
        return { ...rest, photoCount: Array.isArray(photos) ? photos.length : 0 };
      })
    );
    return res.status(200).json({ ok: true, tributes: tributes.filter(Boolean) });
  } catch (err) {
    console.error("PHILSON TRIBUTE LIST ERROR:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Failed to list tributes." });
  }
}
