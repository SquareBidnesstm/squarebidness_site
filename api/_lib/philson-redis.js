import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.PHILSON_UPSTASH_REDIS_REST_URL,
  token: process.env.PHILSON_UPSTASH_REDIS_REST_TOKEN,
});

const KEY_TRIBUTE = (slug) => `philson:tribute:${slug}`;
const KEY_INDEX = "philson:tributes:index";

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function checkAuth(req) {
  const token = String(req.headers["x-operator-token"] || "").trim();
  const expected = String(process.env.PHILSON_TRIBUTE_TOKEN || "").trim();
  if (!expected) return { ok: false, status: 503, error: "PHILSON_TRIBUTE_TOKEN not configured." };
  if (!token || token !== expected) return { ok: false, status: 401, error: "Unauthorized." };
  return { ok: true };
}

export async function getTribute(slug) {
  return await redis.get(KEY_TRIBUTE(slug));
}

export async function saveTribute(tribute) {
  const slug = tribute.slug;
  await redis.set(KEY_TRIBUTE(slug), tribute);

  const index = await redis.get(KEY_INDEX);
  const list = Array.isArray(index) ? index : [];
  if (!list.includes(slug)) {
    list.unshift(slug);
    await redis.set(KEY_INDEX, list);
  }
}

export async function deleteTribute(slug) {
  await redis.del(KEY_TRIBUTE(slug));
  const index = await redis.get(KEY_INDEX);
  const list = Array.isArray(index) ? index : [];
  await redis.set(KEY_INDEX, list.filter((s) => s !== slug));
}

export async function listTributeSlugs() {
  const index = await redis.get(KEY_INDEX);
  return Array.isArray(index) ? index : [];
}
