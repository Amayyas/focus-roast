// Fails if package.json and manifest.json disagree on the version.
//
// The store listing, the built extension and the npm metadata must all ship
// the same version, so this guards against bumping one and forgetting the
// other. Run in CI (see the extension workflow) and locally via `npm run
// check:version`.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readVersion(file) {
  const json = JSON.parse(await readFile(join(root, file), "utf8"));
  return json.version;
}

const pkgVersion = await readVersion("package.json");
const manifestVersion = await readVersion("manifest.json");

if (pkgVersion !== manifestVersion) {
  console.error(
    `✗ Version mismatch: package.json is ${pkgVersion} but manifest.json is ${manifestVersion}.`,
  );
  process.exit(1);
}

console.log(`✓ Version is consistent (${pkgVersion}).`);
