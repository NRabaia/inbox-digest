# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: Inbox Digest

A website that loads Outlook emails, summarizes them with AI, and flags ones needing reply after a long absence. Designed to run online (Replit), in corporate networks, or fully air‑gapped (Ollama).

### Artifacts
- `artifacts/inbox-digest` — React + Vite frontend. Two source modes: Live Outlook + Upload .eml. Drag‑drop upload, AI provider badge, "Outlook not connected" warning.
- `artifacts/api-server` — Express API. Routes: `/api/emails` (list/post), `/api/emails/summarize`, `/api/emails/digest`, `/api/emails/upload-eml` (multer + mailparser), `/api/config`.
- `standalone/` — Self‑contained Windows/Mac/Linux build. `pnpm --filter @workspace/standalone run build` produces `standalone/dist/{server.mjs, public/, start.bat, start.sh, README.md, .env.example}`. `pack-windows.mjs` produces a single `InboxDigest.exe` via Node SEA.

### AI Provider Abstraction
`artifacts/api-server/src/lib/aiClient.ts` switches via `AI_PROVIDER` env:
- `openai` (default) — uses `OPENAI_API_KEY` or Replit AI Integrations env vars.
- `azure` — uses `AZURE_OPENAI_BASE_URL`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`.
- `ollama` — fully offline. `OLLAMA_BASE_URL` (default `http://localhost:11434/v1`), `OLLAMA_MODEL` (default `llama3.2`).
Microsoft/GitHub Copilot has no public chat API and no Replit integration — not supported as a provider.

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
