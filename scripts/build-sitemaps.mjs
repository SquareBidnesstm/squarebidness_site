// scripts/build-sitemaps.mjs
import fs from "fs";
import path from "path";

const SITE = "https://www.squarebidness.com";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const BLOG_INDEX_JSON = path.join(PUBLIC_DIR, "blog", "index.json");

const OUT_DIR = path.join(PUBLIC_DIR, "sitemaps");
const OUT_FILE = path.join(OUT_DIR, "sitemap-posts.xml");

// ---------- utils ----------
function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function normalizePath(u) {
  // ensure leading slash, remove double slashes, ensure trailing slash for "page-like" urls
  let s = (u || "").trim();
  if (!s) return "/";
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/{2,}/g, "/");
  // Keep trailing slash for clean canonical pages
  if (!s.endsWith("/")) s += "/";
  return s;
}

function isISODate(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function xmlEscape(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlEntry(loc, { changefreq = "monthly", priority = "0.6", lastmod = null } = {}) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>` : "",
    `    <changefreq>${xmlEscape(changefreq)}</changefreq>`,
    `    <priority>${xmlEscape(priority)}</priority>`,
    "  </url>"
  ].filter(Boolean).join("\n");
}

// ---------- main ----------
if (!exists(BLOG_INDEX_JSON)) {
  console.error(`[sitemaps] Missing: ${path.relative(process.cwd(), BLOG_INDEX_JSON)}`);
  process.exit(1);
}

const raw = fs.readFileSync(BLOG_INDEX_JSON, "utf8");
let items;
try {
  items = JSON.parse(raw);
} catch (e) {
  console.error("[sitemaps] index.json is not valid JSON");
  process.exit(1);
}

if (!Array.isArray(items)) {
  console.error("[sitemaps] index.json must be an array");
  process.exit(1);
}

// Start building URLs
const urls = [];

// Blog hub always included if present
const blogHub = `${SITE}/blog/`;
urls.push(urlEntry(blogHub, { changefreq: "weekly", priority: "0.7" }));

// Entries from index.json
for (const it of items) {
  const url = normalizePath(it?.url || "/");
  const loc = `${SITE}${url}`;

  // Use "date" as lastmod if valid
  const lastmod = isISODate(it?.date) ? it.date : null;

  // Heuristic priority: posts a bit higher than generic pages
  // - /blog/post/... = 0.65
  // - /blog/... (non-post) = 0.55
  // - everything else (like /hammond-homecoming/) = 0.5
  let priority = "0.5";
  if (url.startsWith("/blog/post/")) priority = "0.65";
  else if (url.startsWith("/blog/")) priority = "0.55";

  urls.push(urlEntry(loc, { changefreq: "monthly", priority, lastmod }));
}

// Ensure output folder exists
if (!exists(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Write XML
const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n` +
  urls.join("\n\n") +
  `\n\n</urlset>\n`;

fs.writeFileSync(OUT_FILE, xml, "utf8");

console.log(`[sitemaps] wrote: ${path.relative(process.cwd(), OUT_FILE)}`);
console.log(`[sitemaps] urls: ${urls.length}`);
