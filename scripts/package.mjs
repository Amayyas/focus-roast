// Zips the built extension into distributable archives at the repo root:
//   focus-roast-chrome-v<version>.zip   (from dist/)
//   focus-roast-firefox-v<version>.zip  (from dist-firefox/)
//
// The manifest sits at the root of each zip (we zip the *contents* of the
// build dir, not the dir itself), which is what the stores and about:debugging
// expect. Run after a build via `npm run package`.

import { execFileSync } from "node:child_process";
import { access, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

const targets = [
  { dir: "dist", zip: `focus-roast-chrome-v${version}.zip` },
  { dir: "dist-firefox", zip: `focus-roast-firefox-v${version}.zip` },
];

for (const { dir, zip } of targets) {
  const srcDir = join(root, dir);
  try {
    await access(srcDir);
  } catch {
    console.error(`✗ ${dir}/ not found — run \`npm run build:firefox\` first.`);
    process.exit(1);
  }

  const zipPath = join(root, zip);
  await rm(zipPath, { force: true });
  // -r recurse, -X drop extra file attributes for reproducible archives.
  // cwd = the build dir so paths inside the zip are relative to it.
  execFileSync("zip", ["-rX", zipPath, "."], { cwd: srcDir, stdio: "inherit" });
  console.log(`✓ ${zip}`);
}
