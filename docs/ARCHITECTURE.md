# Architecture

Inbox Digest is a small, deliberately boring two-tier app: a React SPA talks to an Express API; the API talks to whatever AI provider and email source you configured. There is no message queue, no microservices, no Electron. Everything that runs on the user's machine in standalone mode is the same code that runs on Replit.

## Components

### `artifacts/inbox-digest` — frontend

- React 18, Vite, TypeScript.
- TanStack Query for data fetching, generated from the OpenAPI spec by Orval.
- Tailwind + a small set of shadcn/ui primitives (`Tabs`, `RadioGroup`, `Dialog`, `Input`, `Button`).
- Single page. Two modes via tabs: **Live Outlook** and **Upload `.eml` / `.pst`**. Settings live in a modal.

The frontend never holds secrets. It only sees:
- the active provider name,
- which secrets are present (`hasSecrets`),
- redacted placeholder bullets where secret values would otherwise be.

### `artifacts/api-server` — backend

Express 5, TypeScript, Pino. The interesting modules:

| Module | Responsibility |
|---|---|
| `lib/settingsStore.ts` | Loads/saves `~/.inbox-digest/config.json` (chmod 600). Applies env-var overlay only when stored value is empty. Redacts secrets on read. |
| `lib/aiClient.ts` | Returns an OpenAI-compatible client configured for the active provider. One branch per provider; `windows-copilot` returns a no-op client. |
| `lib/outlookClient.ts` | Microsoft Graph wrapper. Fetches messages since a given date, paginates, normalizes to a small canonical email shape. |
| `routes/config.ts` | `GET /api/config`, `GET/POST /api/settings`. Validates with Zod. |
| `routes/emails.ts` | `GET /api/emails`, `POST /api/emails/summarize`, `POST /api/emails/digest`. |
| `routes/uploadEml.ts` | `multer` (memory) + `mailparser`. |
| `routes/uploadPst.ts` | `multer` (disk, 2 GB cap) + `pst-extractor`. Walks every folder, flattens, deletes the temp file when done. |

The server is stateless. Restarting it loses nothing except in-flight uploads.

### `standalone/` — packaging

`build.mjs` runs three steps:

1. `vite build` for the frontend → static assets.
2. `esbuild` the API server into a single ESM bundle (`server.mjs`) with all deps inlined except `pst-extractor`'s native add-on.
3. Copy launchers (`start.bat`, `start.sh`), `README.md`, `.env.example` into `dist/`.

`pack-windows.mjs` then takes `server.mjs` plus a copy of Node 20, fuses them into `InboxDigest.exe` via Node Single Executable Applications, and embeds the static assets via `postject`.

The resulting `.exe`:
- has no external dependencies,
- writes config to `%USERPROFILE%\.inbox-digest\config.json`,
- opens the user's default browser to `http://localhost:8080`,
- prints logs to a console window (close to quit).

## Data flow: a typical "catch me up" request

```
Browser                        Express                       AI Provider
   │   POST /api/emails/digest   │                                │
   │   { since, limit }          │                                │
   │ ──────────────────────────► │                                │
   │                             │  outlookClient.list(since)     │
   │                             │ ─────────────────────────────► Microsoft Graph
   │                             │ ◄───────────────────────────── messages[]
   │                             │  aiClient.summarize(batch)     │
   │                             │ ─────────────────────────────► chat/completions
   │                             │ ◄───────────────────────────── summaries[]
   │                             │  groupBySender(summaries)      │
   │ ◄────────────────────────── │  digest                        │
```

When the active provider is `windows-copilot`, the second arrow is skipped; the server returns the raw messages with `needsReply: null`, and the UI renders an **Ask Copilot** button per row that opens `ms-copilot:?q=<prompt>` instead of calling the API at all.

## Settings reconciliation

Two sources of truth would be a nightmare; we chose one:

```
                         ┌──────────────────────────────┐
   env vars  ───────────►│  applyEnvOverlay(stored)     │──► effective settings
   stored JSON ─────────►│  only if stored field empty  │
                         └──────────────────────────────┘
```

Consequences:

- Editing the file (or the UI) always wins over env vars for that field.
- An empty field in the file gets re-filled from the env on next read.
- The UI's "save" never blanks a secret: empty strings in the POST body are stripped before merge.

This is what `EMPTY_PERSISTED` in `settingsStore.ts` enforces.

## Choices we deliberately did not make

- **No Electron.** Adds 100 MB and a Chromium attack surface for a UI the user's existing browser already renders.
- **No database in the default install.** Postgres is wired up in `lib/db/` for future digest-history features but the app runs fine without it.
- **No background workers.** Summarization is synchronous on the request. Batches of 50 messages complete well under a minute on every provider; if you need more, paginate from the UI.
- **No auth on the standalone server.** It binds to localhost and is single-user by design. Do not expose it.
