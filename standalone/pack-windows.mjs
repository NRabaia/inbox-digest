#!/usr/bin/env node
/**
 * Packages the standalone build into a single Windows .exe using Node SEA
 * (Single Executable Applications — built into Node 21+).
 *
 * Prerequisite: run `node standalone/build-standalone.mjs` first.
 *
 * Output: standalone/InboxDigest.exe
 *
 * Note: Node SEA bundles the JS into a copy of node.exe. The frontend assets
 * (public/) and node_modules (for nodemailer external) must still ship alongside.
 * For the simplest distribution, zip the entire `standalone/dist/` folder
 * including the .exe.
 */
import { execSync } from "node:child_process";
import { existsSync, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

if (!existsSync(path.join(distDir, "server.mjs"))) {
  console.error("Run `node standalone/build-standalone.mjs` first.");
  process.exit(1);
}

console.log("→ Preparing SEA config...");
const seaConfig = {
  main: "server.mjs",
  output: "sea-prep.blob",
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
};
await fs.writeFile(
  path.join(distDir, "sea-config.json"),
  JSON.stringify(seaConfig, null, 2),
);

console.log("→ Generating SEA blob...");
execSync("node --experimental-sea-config sea-config.json", {
  cwd: distDir,
  stdio: "inherit",
});

console.log("→ Locating node.exe...");
// On non-Windows, we need to download a Windows node.exe. On Windows, we copy the local one.
const nodeVersion = process.version;
let nodeExePath;

if (process.platform === "win32") {
  nodeExePath = process.execPath;
  console.log(`  Using local node: ${nodeExePath}`);
} else {
  // Download Windows node.exe matching this Node version
  const winNodeUrl = `https://nodejs.org/dist/${nodeVersion}/win-x64/node.exe`;
  const downloadPath = path.join(distDir, "node-win.exe");
  console.log(`  Downloading Windows node from ${winNodeUrl}...`);

  await new Promise((resolve, reject) => {
    const file = createWriteStream(downloadPath);
    https
      .get(winNodeUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          https
            .get(response.headers.location, (r2) => {
              r2.pipe(file);
              file.on("finish", () => file.close(resolve));
            })
            .on("error", reject);
        } else {
          response.pipe(file);
          file.on("finish", () => file.close(resolve));
        }
      })
      .on("error", reject);
  });

  nodeExePath = downloadPath;
}

const exePath = path.join(distDir, "InboxDigest.exe");
await fs.copyFile(nodeExePath, exePath);

console.log("→ Injecting SEA blob into executable...");
// npx postject is the official tool
execSync(
  `npx --yes postject "${exePath}" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
  { cwd: distDir, stdio: "inherit" },
);

console.log("");
console.log("✓ Built InboxDigest.exe");
console.log(`  Location: ${exePath}`);
console.log("");
console.log("To distribute: zip the entire standalone/dist folder");
console.log("(the .exe needs the public/ folder and node_modules/nodemailer next to it)");
