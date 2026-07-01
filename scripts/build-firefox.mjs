// Produces a Firefox-compatible package in dist-firefox/ from the Chrome build.
//
// The source code is already cross-browser (it uses the chrome.* namespace,
// which Firefox aliases). Only the manifest differs:
//   - Firefox MV3 uses an event page (background.scripts), not service_worker.
//   - Firefox requires a browser_specific_settings.gecko.id to install/sign.
//
// Run after `npm run build` (see the build:firefox script in package.json).

import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chromeDist = join(root, "dist");
const firefoxDist = join(root, "dist-firefox");

// Start from a clean copy of the Chrome build.
await rm(firefoxDist, { recursive: true, force: true });
await cp(chromeDist, firefoxDist, { recursive: true });

// Adapt the manifest for Firefox.
const manifestPath = join(firefoxDist, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const workerEntry = manifest.background?.service_worker ?? "service-worker-loader.js";
manifest.background = {
  // Firefox loads the same ES-module entry point as a non-persistent event page.
  scripts: [workerEntry],
  type: "module",
};

manifest.browser_specific_settings = {
  gecko: {
    id: "focus-roast@amayyas",
    // 128 is the first release that supports "optional_host_permissions"
    // (used for the runtime provider host grant); anything lower is rejected
    // by addons-linter and would break the permission request at runtime.
    strict_min_version: "128.0",
  },
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log("✓ Firefox build ready in dist-firefox/");
