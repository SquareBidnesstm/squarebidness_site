import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const COURAGEAUX_DIR = path.join(ROOT, "public", "courageaux");
const PARTIALS_DIR = path.join(COURAGEAUX_DIR, "_partials");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function write(filePath, contents) {
  fs.writeFileSync(filePath, contents, "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip partials folder itself
      if (entry.name === "_partials") continue;
      out.push(...walk(p));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(p);
    }
  }
  return out;
}

function applyIncludes(html) {
  // @@include("...") or @@include('...')
  return html.replace(/<!--\s*@@include\((["'])(.+?)\1\)\s*-->/g, (_, __, includePath) => {
    const normalized = includePath.startsWith("/")
      ? includePath.replace(/^\//, "")
      : includePath;

    const abs = path.join(ROOT, normalized);
    if (!fs.existsSync(abs)) {
      throw new Error(`Include not found: ${includePath} -> ${abs}`);
    }
    return read(abs);
  });
}

function main() {
  const pages = walk(COURAGEAUX_DIR);

  // sanity check partials exist
  const nav = path.join(PARTIALS_DIR, "nav.html");
  const footer = path.join(PARTIALS_DIR, "footer.html");
  if (!fs.existsSync(nav)) throw new Error(`Missing: ${nav}`);
  if (!fs.existsSync(footer)) throw new Error(`Missing: ${footer}`);

  let changed = 0;
  for (const file of pages) {
    const original = read(file);
    if (!original.includes("@@include(")) continue;

    const baked = applyIncludes(original);
    if (baked !== original) {
      write(file, baked);
      changed++;
    }
  }

  console.log(`✅ Courageaux includes baked into ${changed} file(s).`);
}

main();

