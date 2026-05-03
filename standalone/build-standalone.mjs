#!/usr/bin/env node
/**
 * Builds a self-contained "standalone" copy of Inbox Digest.
 *
 * Output: standalone/dist/
 *   - server.mjs        → bundled Express server (serves API + frontend)
 *   - public/           → built React frontend
 *   - .env.example      → all configurable options
 *   - start.bat         → Windows launcher
 *   - start.sh          → Mac/Linux launcher
 *   - README.md         → user-facing instructions
 *   - package.json      → minimal deps (only externals from esbuild)
 *
 * Usage:
 *   node standalone/build-standalone.mjs
 */

import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, mkdir, cp, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

globalThis.require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.resolve(__dirname, "dist");

console.log("→ Building standalone bundle...");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 1. Build the frontend (Vite production build)
console.log("→ Building frontend...");
execSync("pnpm --filter @workspace/inbox-digest run build", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: "3000", BASE_PATH: "/", VITE_BASE: "/" },
});

// Copy the built frontend to standalone/dist/public.
// Vite is configured to emit into dist/public/, so the actual frontend
// lives at artifacts/inbox-digest/dist/public/.
const feDist = path.resolve(root, "artifacts/inbox-digest/dist/public");
const publicOut = path.join(outDir, "public");
await mkdir(publicOut, { recursive: true });
const fsp = await import("node:fs/promises");
for (const entry of await fsp.readdir(feDist)) {
  await cp(path.join(feDist, entry), path.join(publicOut, entry), {
    recursive: true,
  });
}

// 2. Build the standalone server entrypoint
console.log("→ Bundling server...");
await esbuild({
  entryPoints: [path.resolve(__dirname, "server.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: [
    "*.node",
    "nodemailer",
    "pg-native",
    "fsevents",
  ],
  sourcemap: false,
  minify: true,
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  banner: {
    js: `import { createRequire as __cr } from 'node:module';
import __p from 'node:path';
import __u from 'node:url';
globalThis.require = __cr(import.meta.url);
globalThis.__filename = __u.fileURLToPath(import.meta.url);
globalThis.__dirname = __p.dirname(globalThis.__filename);`,
  },
});

// 3. Write a minimal package.json for standalone
const pkg = {
  name: "inbox-digest-standalone",
  version: "1.0.0",
  private: true,
  type: "module",
  scripts: {
    start: "node server.mjs",
  },
  dependencies: {
    nodemailer: "^7.0.10",
  },
};
await writeFile(
  path.join(outDir, "package.json"),
  JSON.stringify(pkg, null, 2),
);

// 4. .env.example
const envExample = `# ============================================
# Inbox Digest — Standalone Configuration
# ============================================
# Copy this file to ".env" and fill in the values for your setup.
# Restart the app after changing this file.

# Server port (default 3000)
PORT=3000

# Mark this as a standalone install (shows badge in UI)
STANDALONE_MODE=1

# ============================================
# AI PROVIDER — pick ONE: openai | azure | ollama
# ============================================
AI_PROVIDER=openai

# ---- Option A: OpenAI (public API) ----
# Get a key at https://platform.openai.com
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://api.openai.com/v1

# ---- Option B: Azure OpenAI (your company's Azure deployment) ----
# AI_PROVIDER=azure
# AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
# AZURE_OPENAI_API_KEY=your-azure-key
# AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
# AZURE_OPENAI_API_VERSION=2024-08-01-preview

# ---- Option C: Ollama (fully offline, runs on your machine) ----
# Install Ollama from https://ollama.com, then run: ollama pull llama3.2
# AI_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434/v1
# OLLAMA_MODEL=llama3.2

# ============================================
# OUTLOOK (optional — only for live email mode)
# ============================================
# Live Outlook requires a Microsoft Azure app registration with Mail.Read scope.
# Without this, you can still use the .eml file upload mode.
# OUTLOOK_ACCESS_TOKEN=...
`;
await writeFile(path.join(outDir, ".env.example"), envExample);

// 5. start.bat (Windows)
const startBat = `@echo off
REM Inbox Digest — Windows launcher
cd /d "%~dp0"

if not exist .env (
  echo No .env file found. Copying .env.example to .env...
  copy .env.example .env
  echo.
  echo Please edit .env to configure your AI provider, then run this script again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies (one-time, requires internet)...
  call npm install --omit=dev
)

echo Starting Inbox Digest...
echo Open http://localhost:3000 in your browser
node server.mjs
pause
`;
await writeFile(path.join(outDir, "start.bat"), startBat);

// 6. start.sh (Mac/Linux)
const startSh = `#!/usr/bin/env bash
# Inbox Digest — Mac/Linux launcher
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "No .env file found. Copying .env.example to .env..."
  cp .env.example .env
  echo
  echo "Please edit .env to configure your AI provider, then run this script again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies (one-time, requires internet)..."
  npm install --omit=dev
fi

echo "Starting Inbox Digest..."
echo "Open http://localhost:3000 in your browser"
node server.mjs
`;
await writeFile(path.join(outDir, "start.sh"), startSh, { mode: 0o755 });

// 7. README
const readme = `# Inbox Digest — Standalone

Run Inbox Digest locally on your own machine.

## Quick Start (Windows)

1. Make sure [Node.js 20+](https://nodejs.org) is installed.
2. Double-click \`start.bat\`.
3. On first run it will copy \`.env.example\` to \`.env\` — open it in Notepad and set your AI provider key.
4. Double-click \`start.bat\` again. Open http://localhost:3000 in your browser.

## Quick Start (Mac/Linux)

\`\`\`bash
./start.sh
\`\`\`

## Configuration

Edit \`.env\` to choose your AI provider. Three options:

### OpenAI (public)
Get a key at https://platform.openai.com, then:
\`\`\`
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
\`\`\`

### Azure OpenAI (corporate)
Use your company's internal Azure OpenAI deployment:
\`\`\`
AI_PROVIDER=azure
AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
\`\`\`

### Ollama (fully offline)
Install [Ollama](https://ollama.com), then:
\`\`\`bash
ollama pull llama3.2
\`\`\`
And in \`.env\`:
\`\`\`
AI_PROVIDER=ollama
\`\`\`

## Loading Emails

Two modes available in the UI:

1. **Live Outlook** — requires Outlook OAuth setup (advanced).
2. **Upload .eml files** — works fully offline. Export emails from Outlook as .eml files and drag them into the app.

### How to export .eml from Outlook
- **Outlook desktop**: Drag emails from your inbox to a folder on your desktop — they save as .eml files.
- **Outlook web**: Open an email → "..." menu → Download → saves as .eml.
- **Bulk export**: Use a tool like [readpst](https://www.five-ten-sg.com/libpst/) to convert .pst archives to .eml files.

## Single-File Windows Executable

If you'd prefer a single \`.exe\` with no Node.js install required, run:
\`\`\`
node ../pack-windows.mjs
\`\`\`
This produces \`InboxDigest.exe\` you can double-click.
`;
await writeFile(path.join(outDir, "README.md"), readme);

console.log("");
console.log("✓ Standalone build complete!");
console.log(`  Output: ${outDir}`);
console.log("  To run: cd standalone/dist && node server.mjs");
console.log("  Or use the start.bat / start.sh launchers");
