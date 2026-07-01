// Enforces a size budget on the built extension so an accidental heavy import
// (a giant dependency, an un-tree-shaken lib) can't silently bloat what ships
// to users. Compares the gzipped size of the JS/CSS assets in dist/ against the
// budgets below. Run after `npm run build`, via `npm run check:size`.
//
// Budgets are gzipped bytes (what the browser actually downloads), set with
// headroom above the current sizes; bump them deliberately when a real feature
// justifies the growth.

import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const KB = 1024;

const BUDGETS = {
  // Largest single JS/CSS chunk (the popup bundle dominates: React + charts).
  perFileGzip: 150 * KB,
  // All JS/CSS assets combined.
  totalGzip: 180 * KB,
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const ASSET_EXTENSIONS = new Set([".js", ".css"]);

async function collectAssets(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectAssets(full)));
    } else if (ASSET_EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

try {
  await stat(distDir);
} catch {
  console.error("✗ dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const assets = await collectAssets(distDir);
const fmt = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

let total = 0;
const offenders = [];
const rows = [];

for (const file of assets) {
  const gzip = gzipSync(await readFile(file)).length;
  total += gzip;
  const name = relative(distDir, file);
  rows.push({ name, gzip });
  if (gzip > BUDGETS.perFileGzip) {
    offenders.push(`${name} is ${fmt(gzip)} gzipped (budget ${fmt(BUDGETS.perFileGzip)})`);
  }
}

rows.sort((a, b) => b.gzip - a.gzip);
for (const { name, gzip } of rows) {
  console.log(`  ${fmt(gzip).padStart(10)}  ${name}`);
}
console.log(`  ${fmt(total).padStart(10)}  (total, budget ${fmt(BUDGETS.totalGzip)})`);

if (total > BUDGETS.totalGzip) {
  offenders.push(`total is ${fmt(total)} gzipped (budget ${fmt(BUDGETS.totalGzip)})`);
}

if (offenders.length > 0) {
  console.error("\n✗ Bundle size budget exceeded:");
  for (const line of offenders) console.error(`  - ${line}`);
  process.exit(1);
}

console.log("\n✓ Bundle size within budget.");
