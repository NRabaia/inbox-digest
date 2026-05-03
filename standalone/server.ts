/**
 * Standalone server entrypoint — bundles the Express app and serves the
 * built React frontend as static files on the same port.
 *
 * Used by build-standalone.mjs.
 */
import express from "express";
import path from "node:path";
import url from "node:url";
import { existsSync } from "node:fs";
import app from "../artifacts/api-server/src/app";

const PORT = Number(process.env["PORT"] ?? 3000);

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "public");

if (!existsSync(publicDir)) {
  console.error(`Frontend assets not found at ${publicDir}`);
  console.error("Did you run the standalone build script?");
  process.exit(1);
}

// Serve frontend static files
app.use(express.static(publicDir));

// SPA fallback — any non-API route serves index.html
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("════════════════════════════════════════");
  console.log("  Inbox Digest is running");
  console.log(`  Open http://localhost:${PORT}`);
  console.log(`  AI Provider: ${process.env["AI_PROVIDER"] ?? "openai"}`);
  console.log("  Press Ctrl+C to stop");
  console.log("════════════════════════════════════════");
  console.log("");
});
