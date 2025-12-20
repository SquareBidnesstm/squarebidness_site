/**
 * Square Bidness — Sitemap Auto-Builder (Node)
 * -------------------------------------------
 * What it does:
 * - Scans your /public folder for index.html + *.html routes
 * - Builds:
 *   /public/sitemap-index.xml
 *   /public/sitemaps/sitemap-core.xml
 *   /public/sitemaps/sitemap-collections.xml
 *   /public/sitemaps/sitemap-products.xml
 *   /public/sitemaps/sitemap-posts.xml
 *   /public/sitemaps/sitemap-community.xml
 *
 * How to use:
 * 1) Save as: scripts/build-sitemaps.mjs
 * 2) Run:    node scripts/build-sitemaps.mjs
 * 3) Commit + deploy
 *
 * Optional:
 * - Set DOMAIN env: DOMAIN=https://www.squarebidness.com node scripts/build-sitemaps.mjs
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(PUBLIC_DIR, "sitemaps");

const DOMAIN = (process.env.DOMAIN || "https://www.squarebidness.com").replace(/\/+$/, "");
const TODAY = new Date().toISOString().slice(0, 10);

// ------------------------
// CONFIG (edit if needed)
// ------------------------

// Don’t ever include these in sitemaps
const EXCLUDE_DIRS = new Set([
  "cart",
  "checkout",
  "search",
  "model-search",
  "docs",
  "nav",
  "footer",
  "partials",
]);

// Exclude single files by route or filename
const EXCLUDE_ROUTE_PREFIXES = [
  "/cart/",
  "/checkout/",
  "/search/",
  "/model-search/",
  "/docs/",
  "/thank-you/",
  "/success/",
  "/cancel/",
  "/nav/",
  "/footer/",
  "/partials/",
];

const EXCLUDE_EXT = new Set([
  ".map",
]);

// If you have HTML files that should NOT be indexed, add routes here:
const EXCLUDE_ROUTES_EXACT = new Set([
  // "/some-private-preview/",
]);

/**
 * Hard-pin routes that might not exist as HTML (or you want always included).
 * Example: server routes / redirects / etc.
 */
const MANUAL_INCLUDE = [
  // core
  "/",
  "/shop/",
  "/collections/",
  "/stories/",
  "/community/",
  "/connect/",
  "/linkme/",
  "/press/",
  "/media-kit/",
  "/founder/",
  // lanes you mentioned
  "/vsop/",
  "/wintergames/",
  "/supima/",
  "/tax-pass/",
  "/datacenter/",
  "/start2finish/",
  "/taxslayer/",
  "/proposal/",
  "/refinance/",
  "/richardson/",
  "/hammond-homecoming/",
  "/returns/",
  "/privacy/",
  "/terms/",
];

// If a route matches one of these patterns, it will be categorized accordingly.
// Order matters: first match wins.
const CATEGORY_RULES = [
  {
    name: "core",
    match: (r) =>
      [
        "/",
        "/shop/",
        "/collections/",
        "/stories/",
        "/community/",
        "/connect/",
        "/linkme/",
        "/press/",
        "/media-kit/",
        "/founder/",
        "/returns/",
        "/privacy/",
        "/terms/",
      ].includes(r),
  },
  {
    name: "collections",
    match: (r) =>
      r === "/vsop/" ||
      r === "/wintergames/" ||
      r === "/supima/" ||
      r === "/liberty/" ||
      r.startsWith("/collections/"),
  },
  {
    name: "products",
    match: (r) => r.startsWith("/product-") || r.startsWith("/products/"),
  },
  {
    name: "posts",
    match: (r) => r.startsWith("/blog/") || r.startsWith("/stories/post/") || r.startsWith("/blog/post/"),
  },
  {
    name: "community",
    match: (r) =>
      r.includes("spotlight") ||
      r.startsWith("/community-spotlight/") ||
      r.startsWith("/phomatic/") ||
      r.startsWith("/courageaux/") ||
      r.startsWith("/nae-doll/") ||
      r.startsWith("/hammond-homecoming/"),
  },
];

// Defaults if not matched by CATEGORY_RULES
const DEFAULT_CATEGORY = "core";

// changefreq/priority presets
function metaForRoute(route) {
  // Tight + realistic (Google ignores these mostly, but we keep consistent)
  if (route === "/") return { changefreq: "weekly", priority: "1.0" };
  if (route === "/shop/") return { changefreq: "weekly", priority: "0.95" };
  if (route === "/collections/") return { changefreq: "weekly", priority: "0.9" };
  if (route === "/stories/" || route === "/community/") return { changefreq: "weekly", priority: "0.85" };

  if (route.startsWith("/product-") || route.startsWith("/products/")) return { changefreq: "weekly", priority: "0.8" };

  if (route === "/vsop/" || route === "/wintergames/" || route === "/supima/") return { changefreq: "weekly", priority: "0.85" };
  if (route === "/press/" || route === "/media-kit/" || route === "/founder/") return { changefreq: "monthly", priority: "0.7" };
  if (route === "/connect/" || route === "/linkme/") return { changefreq: "monthly", priority: "0.7" };

  if (route === "/returns/") return { changefreq: "yearly", priority: "0.35" };
  if (route === "/privacy/" || route === "/terms/") return { changefreq: "yearly", priority: "0.25" };

  // blog posts / editorial
  if (route.startsWith("/blog/")) return { changefreq: "yearly", priority: "0.65" };

  // default
  return { changefreq: "monthly", priority: "0.55" };
}

// ------------------------
// Helpers
// ------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isExcludedRoute(route) {
  if (EXCLUDE_ROUTES_EXACT.has(route)) return true;
  for (const pre of EXCLUDE_ROUTE_PREFIXES) {
    if (route.startsWith(pre)) return true;
  }
  return false;
}

function toRouteFromFile(filePath) {
  // filePath is absolute path inside /public
  const rel = path.relative(PUBLIC_DIR, filePath).split(path.sep).join("/");

  // ignore weird
  if (!rel || rel.startsWith("..")) return null;

  // ignore excluded extensions
  for (const ext of EXCLUDE_EXT) {
    if (rel.endsWith(ext)) return null;
  }

  // Exclude by top-level dir
  const top = rel.split("/")[0];
  if (EXCLUDE_DIRS.has(top)) return null;

  // Convert to route:
  // - index.html => folder route /folder/
  // - about.html => /about/
  // - folder/page.html => /folder/page/
  if (rel.endsWith("/index.html")) {
    const base = rel.slice(0, -"/index.html".length);
    return "/" + (base ? base.replace(/\/+$/, "") + "/" : "");
  }
  if (rel.endsWith(".html")) {
    const base = rel.slice(0, -".html".length);
    return "/" + base.replace(/\/+$/, "") + "/";
  }

  return null;
}

function walk(dir, outFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);

    // ignore dot dirs
    if (ent.name.startsWith(".")) continue;

    // ignore excluded directories anywhere by name
    if (ent.isDirectory() && EXCLUDE_DIRS.has(ent.name)) continue;

    if (ent.isDirectory()) {
      walk(full, outFiles);
    } else {
      // only html
      if (ent.name.endsWith(".html")) outFiles.push(full);
    }
  }
  return outFiles;
}

function categorize(route) {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(route)) return rule.name;
  }
  return DEFAULT_CATEGORY;
}

function xmlEscape(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildUrlset(urls) {
  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
  for (const u of urls) {
    const loc = `${DOMAIN}${u.route}`;
    lines.push(`  <url>`);
    lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
    lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${u.changefreq}</changefreq>`);
    lines.push(`    <priority>${u.priority}</priority>`);
    lines.push(`  </url>`);
  }
  lines.push(`</urlset>`);
  return lines.join("\n") + "\n";
}

function buildSitemapIndex(items) {
  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
  for (const it of items) {
    lines.push(`  <sitemap>`);
    lines.push(`    <loc>${xmlEscape(it.loc)}</loc>`);
    lines.push(`    <lastmod>${it.lastmod}</lastmod>`);
    lines.push(`  </sitemap>`);
  }
  lines.push(`</sitemapindex>`);
  return lines.join("\n") + "\n";
}

// ------------------------
// MAIN
// ------------------------

function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`❌ public/ not found at: ${PUBLIC_DIR}`);
    process.exit(1);
  }

  ensureDir(OUT_DIR);

  // 1) Crawl HTML in /public
  const htmlFiles = walk(PUBLIC_DIR);
  const discovered = new Set();

  for (const f of htmlFiles) {
    const route = toRouteFromFile(f);
    if (!route) continue;
    if (isExcludedRoute(route)) continue;
    discovered.add(route);
  }

  // 2) Add manual includes
  for (const r of MANUAL_INCLUDE) {
    if (!isExcludedRoute(r)) discovered.add(r);
  }

  // 3) Normalize + sort
  const routes = Array.from(discovered)
    .map((r) => {
      // ensure leading/trailing slash
      let x = r.startsWith("/") ? r : `/${r}`;
      x = x.replace(/\/+$/, "/");
      if (x === "//") x = "/";
      return x;
    })
    .filter((r) => r.startsWith("/") && !isExcludedRoute(r) && !EXCLUDE_ROUTES_EXACT.has(r))
    .sort((a, b) => a.localeCompare(b));

  // 4) Build url objects + categories
  const buckets = {
    core: [],
    collections: [],
    products: [],
    posts: [],
    community: [],
  };

  for (const route of routes) {
    const cat = categorize(route);
    const { changefreq, priority } = metaForRoute(route);
    const u = { route, lastmod: TODAY, changefreq, priority };

    if (buckets[cat]) buckets[cat].push(u);
    else buckets.core.push(u);
  }

  // 5) Write child sitemaps
  const child = [
    { key: "core", file: "sitemap-core.xml" },
    { key: "collections", file: "sitemap-collections.xml" },
    { key: "products", file: "sitemap-products.xml" },
    { key: "posts", file: "sitemap-posts.xml" },
    { key: "community", file: "sitemap-community.xml" },
  ];

  for (const c of child) {
    const xml = buildUrlset(buckets[c.key]);
    fs.writeFileSync(path.join(OUT_DIR, c.file), xml, "utf8");
    console.log(`✅ wrote /public/sitemaps/${c.file} (${buckets[c.key].length} urls)`);
  }

  // 6) Write sitemap index at root: /public/sitemap-index.xml
  const indexXml = buildSitemapIndex(
    child.map((c) => ({
      loc: `${DOMAIN}/sitemaps/${c.file}`,
      lastmod: TODAY,
    }))
  );
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap-index.xml"), indexXml, "utf8");
  console.log(`✅ wrote /public/sitemap-index.xml`);

  // 7) (Optional) Also write /public/sitemap.xml as a single file (handy for simple setups)
  const flat = routes.map((route) => {
    const { changefreq, priority } = metaForRoute(route);
    return { route, lastmod: TODAY, changefreq, priority };
  });
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), buildUrlset(flat), "utf8");
  console.log(`✅ wrote /public/sitemap.xml (flat) (${flat.length} urls)`);

  console.log(`\nDONE ✅`);
  console.log(`Now update robots.txt to:`);
  console.log(`Sitemap: ${DOMAIN}/sitemap-index.xml`);
}

main();
