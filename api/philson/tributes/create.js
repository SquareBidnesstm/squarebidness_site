import { checkAuth, getTribute, saveTribute, slugify } from "../../_lib/philson-redis.js";

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 350_000; // ~350KB each

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .slice(0, MAX_PHOTOS)
    .map((p) => String(p || "").trim())
    .filter((p) => p.startsWith("data:image/") && p.length <= MAX_PHOTO_BYTES);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    const body = req.body || {};
    const name = String(body.name || "").trim().slice(0, 120);
    const date = String(body.date || "").trim();
    const notes = String(body.notes || "").trim().slice(0, 400);
    const active = body.active !== false;

    let slug = slugify(body.slug || body.name);
    if (!slug) return res.status(400).json({ ok: false, error: "Name is required." });

    const isUpdate = body.isUpdate === true;

    if (!isUpdate) {
      const existing = await getTribute(slug);
      if (existing) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
    }

    const photos = normalizePhotos(body.photos);

    const tribute = {
      slug,
      name,
      date,
      notes,
      photos,
      active,
      createdAt: isUpdate ? (body.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTribute(tribute);

    return res.status(200).json({ ok: true, tribute });
  } catch (err) {
    console.error("PHILSON TRIBUTE CREATE ERROR:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Failed to save tribute." });
  }
}
