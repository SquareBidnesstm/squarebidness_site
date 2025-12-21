// scripts/build-sitemaps.mjs
import fs from "fs";
import path from "path";

const SITE = "https://www.squarebidness.com";
const PUBLIC_DIR = path.join(process.cwd(), "public");
const BLOG_DIR = path.join(PUBLIC_DIR, "blog");
const POSTS_DIR = path.join(BLOG_DIR, "post");
const OUT_DIR = path.join(PUBLIC_DIR, "sitemaps");
const OUT_FILE = path.join(OUT_DIR, "sitemap-posts.xml");

// Helpers
function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function isDirectory(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isoDateFromFile(filePath) {
  try {
    const d = fs.statSync(filePath).mtime;
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function urlEntry(loc, { changefreq = "monthly", priority = "0.6", lastmod = null } = {}) {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>"
  ].filter(Boolean).join("\n");
}

// Build list
const urls = [];

// Blog hub
if (exists(path.join(BLOG_DIR, "index.html"))) {
  urls.push(urlEntry(`${SITE}/blog/`, { changefreq: "weekly", priority: "0.7" }));
}

// Blog subpages you want indexed (optional)
// Keep this list intentional, not wildcard.
const BLOG_SUBPAGES = ["supima"]; // add more if needed
for (const slug of BLOG_SUBPAGES) {
  const p = path.join(BLOG_DIR, slug, "index.html");
  if (exists(p)) {
    urls.push(urlEntry(`${SITE}/blog/${slug}/`, { changefreq: "monthly", priority: "0.55" }));
  }
}

// Post folders: /blog/post/<slug>/index.html
if (isDirectory(POSTS_DIR)) {
  const postSlugs = fs.readdirSync(POSTS_DIR).filter((name) => {
    const dir = path.join(POSTS_DIR, name);
    return isDirectory(dir) && exists(path.join(dir, "index.html"));
  });

  for (const slug of postSlugs) {
    const htmlPath = path.join(POSTS_DIR, slug, "index.html");
    const lastmod = isoDateFromFile(htmlPath);
    urls.push(
      urlEntry(`${SITE}/blog/post/${slug}/`, {
        changefreq: "monthly",
        priority: "0.65",
        lastmod
      })
    );
  }
}

// Output
if (!exists(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n` +
  urls.join("\n\n") +
  `\n\n</urlset>\n`;

fs.writeFileSync(OUT_FILE, xml, "utf8");

console.log(`[sitemaps] wrote: ${path.relative(process.cwd(), OUT_FILE)}`);
console.log(`[sitemaps] urls: ${urls.length}`);
