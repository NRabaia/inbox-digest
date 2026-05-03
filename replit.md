# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: Inbox Digest

A website that loads Outlook emails, summarizes them with AI, and flags ones needing reply after a long absence. Designed to run online (Replit), in corporate networks, or fully air‑gapped (Ollama).

### Artifacts
- `artifacts/inbox-digest` — React + Vite frontend. Two source modes: Live Outlook + Upload .eml. Drag‑drop upload, AI provider badge, "Outlook not connected" warning.
- `artifacts/api-server` — Express API. Routes: `/api/emails` (list/post), `/api/emails/summarize`, `/api/emails/digest`, `/api/emails/upload-eml` (multer memory + mailparser), `/api/emails/upload-pst` (multer disk + pst-extractor; up to 2GB, 5000 messages, walks all folders), `/api/config`, `/api/settings`.
- `standalone/` — Self‑contained Windows/Mac/Linux build. `pnpm --filter @workspace/standalone run build` produces `standalone/dist/{server.mjs, public/, start.bat, start.sh, README.md, .env.example}`. `pack-windows.mjs` produces a single `InboxDigest.exe` via Node SEA.

### AI Provider Abstraction
Settings live in `~/.inbox-digest/config.json` (created by `lib/settingsStore.ts`). Env vars overlay only when the stored value is empty, so both modes work. Configurable from the UI Settings dialog or by editing the JSON file directly.

Providers (`aiProvider` field):
- `openai` (default) — `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`. Also accepts Replit AI Integrations env vars.
- `azure` — `AZURE_OPENAI_BASE_URL`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`. This is the supported way to call Microsoft 365 Copilot's underlying engine.
- `ollama` — fully offline. `OLLAMA_BASE_URL` (default `http://localhost:11434/v1`), `OLLAMA_MODEL` (default `llama3.2`).
- `github-copilot` — GitHub Copilot via a community wrapper (e.g. `npx copilot-api start`, default `http://localhost:4141/v1`). The wrapper exposes Copilot's chat as OpenAI-compatible. Settings: `GITHUB_COPILOT_TOKEN`, `GITHUB_COPILOT_BASE_URL`, `GITHUB_COPILOT_MODEL`. Sends `Editor-Version` and `Copilot-Integration-Id` headers. Requires an active Copilot subscription; using Copilot's chat outside official IDE clients is gray-area per GitHub's terms — UI calls this out.
- `windows-copilot` — Windows Copilot has NO programmatic API. When this provider is selected, the backend skips automatic summarization and the frontend shows an "Ask Copilot" button per email that deep-links into the Copilot app via `ms-copilot:?q=<prompt>`. The user gets the answer in the Copilot app, not back in Inbox Digest.

Routes: `GET /api/config` (provider name + flags), `GET /api/settings` (full settings, secrets redacted), `POST /api/settings` (update; empty strings are stripped so they don't blank-out saved secrets).

### Standalone Notes
- `standalone/` is a workspace package with its own deps (express, pino, openai, etc.) so esbuild can bundle the api‑server's `app` import.
- Vite outputs to `dist/public/` (configured outDir), so the standalone build copies from `artifacts/inbox-digest/dist/public/` (not `dist/`).
- esbuild entry filename must NOT be overridden via `entryNames` — it conflicts with `esbuild-plugin-pino`'s emitted worker files (causes "two output files share the same path"). Keep entry as `server.ts` so natural output is `server.mjs`.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
