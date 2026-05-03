# Inbox Digest

> Calm, prioritized catch-up assistant for Microsoft Outlook. Loads your mail, summarizes each thread with AI, and flags the ones that actually need a reply after a long absence (vacation, leave, hand-off). Built to run anywhere — on Replit, inside corporate firewalls, or fully air-gapped on a laptop with no internet.

[![Made with React](https://img.shields.io/badge/frontend-React_+_Vite-61dafb.svg)](#)
[![Express API](https://img.shields.io/badge/backend-Express_5-339933.svg)](#)
[![Offline-capable](https://img.shields.io/badge/runs-offline-success.svg)](#)
[![Five AI providers](https://img.shields.io/badge/AI-5_providers-purple.svg)](#-ai-providers)

---

## Table of contents

- [What it does](#what-it-does)
- [Three ways to run it](#three-ways-to-run-it)
- [Quick start (developers)](#quick-start-developers)
- [Quick start (end users — Windows .exe)](#quick-start-end-users--windows-exe)
- [AI providers](#ai-providers)
- [Email sources](#email-sources)
- [Configuration reference](#configuration-reference)
- [HTTP API reference](#http-api-reference)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Build & release](#build--release)
- [Air-gapped deployment](#air-gapped-deployment)
- [Troubleshooting](#troubleshooting)
- [Security & privacy notes](#security--privacy-notes)
- [License](#license)

---

## What it does

You come back from two weeks off and have 800 emails. Inbox Digest:

1. **Loads your mail** — live from Microsoft 365, from a folder of `.eml` files you drop on the page, or from an Outlook `.pst` / `.ost` archive.
2. **Summarizes each one** — three sentences max, in the AI provider of your choice (OpenAI, Azure, local Ollama, GitHub Copilot wrapper, or a Windows Copilot deep-link).
3. **Flags what needs a reply** — emails where the sender clearly expects a response, or where a thread has been waiting on you since you left.
4. **Groups by sender and topic** — so you can power through a whole conversation in one pass.
5. **Shows the digest in a single calm view** — no unread counters, no badges, no infinite scroll.

The point is the opposite of a typical inbox client: instead of helping you read more, it helps you skip more.

---

## Three ways to run it

| Mode | Best for | What you need |
|---|---|---|
| **Replit web app** | Trying it out, hosted use | A Microsoft 365 account (optional — `.eml` upload works without it) |
| **Standalone folder** | Corporate laptops, locked-down environments | Node 20+ on the target machine |
| **Single Windows `.exe`** | Non-technical users on Windows | Nothing — Node is bundled inside |

All three modes share **the same code, same UI, same provider settings**. The standalone bundle is just the Replit app re-packaged with `esbuild` and a tiny launcher.

---

## Quick start (developers)

Requires Node 20+ and pnpm 9+.

```bash
git clone https://github.com/NRabaia/inbox-digest.git
cd inbox-digest
pnpm install

# Run the API + web app together (two workflows / two terminals)
pnpm --filter @workspace/api-server   run dev    # backend on $PORT (default 8080)
pnpm --filter @workspace/inbox-digest run dev    # frontend on $PORT (default 5173)
```

Then open the URL the frontend prints. Configure your AI provider once via the **Settings** dialog in the top-left of the UI; settings persist to `~/.inbox-digest/config.json` (chmod 600).

> Inside Replit, the workflows are already wired up — just press **Run**.

---

## Quick start (end users — Windows `.exe`)

1. Download `InboxDigest.exe` from the [Releases page](https://github.com/NRabaia/inbox-digest/releases).
2. Double-click it. A small console window opens; your browser opens to `http://localhost:8080` automatically.
3. Click **Settings** (gear icon, top-left). Choose an AI provider and paste keys/URLs as needed.
4. Either click **Connect Outlook** or drag a folder of `.eml` files / a `.pst` file onto the **Upload** tab.
5. Pick the date you were last in your inbox and press **Catch Me Up**.

To stop the app, close the console window. To uninstall, delete the `.exe` and the `~/.inbox-digest/` folder.

---

## AI providers

Inbox Digest is provider-agnostic. Pick one in **Settings**; you can change it any time. All providers read from `~/.inbox-digest/config.json` and fall back to environment variables when the stored value is empty.

| ID | Name | Internet? | Cost | Notes |
|---|---|---|---|---|
| `openai` | **OpenAI** | Required | Pay per token | Default. Works with any OpenAI-compatible endpoint (Together, Fireworks, Groq, etc.) by overriding `OPENAI_BASE_URL`. |
| `azure` | **Azure OpenAI** | Required | Per your Azure contract | The supported way to call **Microsoft 365 Copilot's** underlying engine. Needs base URL, deployment name, API version. |
| `ollama` | **Ollama (local)** | **No** — fully offline | Free | Runs `llama3.2`, `mistral`, `phi3`, etc. on your own CPU/GPU. Ideal for air-gapped or privacy-sensitive use. |
| `github-copilot` | **GitHub Copilot (wrapper)** | Yes | Your existing Copilot subscription | Talks to a community wrapper such as [`copilot-api`](https://github.com/ericc-ch/copilot-api) (`npx copilot-api start`, default `http://localhost:4141/v1`) which exposes Copilot's chat as an OpenAI-compatible endpoint. Sends `Editor-Version` and `Copilot-Integration-Id` headers so the wrapper accepts the request. **Requires an active GitHub Copilot subscription**; using Copilot's chat outside official IDE clients is a gray area under GitHub's terms — the UI calls this out. |
| `windows-copilot` | **Windows Copilot (deep-link)** | Depends on Copilot itself | Free with Windows | Microsoft does **not** expose a Windows Copilot API. When this provider is selected, the backend skips automatic summarization and the UI shows an **Ask Copilot** button per email that opens the Copilot app via `ms-copilot:?q=<prompt>`. You read the answer in the Copilot app, not in Inbox Digest. |

### Picking the right provider

```
Need it offline / air-gapped?            → Ollama
Inside a Microsoft 365 enterprise?       → Azure (calls the M365 Copilot model)
Already paying for GitHub Copilot?       → GitHub Copilot (wrapper)
Just want it to work on Windows?         → Windows Copilot (deep-link)
None of the above?                       → OpenAI (default)
```

---

## Email sources

Three input modes, all reachable from the home screen:

1. **Live Outlook** — OAuth into Microsoft 365 once via the **Connect Outlook** button. Tokens are stored in `~/.inbox-digest/config.json`.
2. **Upload `.eml` files** — drag-and-drop one or more `.eml` exports. Parsed in memory by `mailparser`. No server, no internet.
3. **Upload `.pst` / `.ost`** — drop an Outlook offline archive (up to **2 GB** / **5,000 messages** by default). All folders are walked by `pst-extractor`. Files are written to a temp dir, parsed, and then deleted.

Live Outlook is the only source that requires network access; the other two work fully offline.

---

## Configuration reference

Settings are stored in `~/.inbox-digest/config.json` (file mode `600`). Every field can also be supplied via an environment variable; **env vars are only used when the corresponding stored value is empty**, so editing the file in the UI and editing it via env vars never fight each other.

| Setting | UI field | Env var | Default |
|---|---|---|---|
| AI provider | Provider radio | `AI_PROVIDER` | `openai` |
| OpenAI key | OpenAI tab → API Key | `OPENAI_API_KEY` | _(empty)_ |
| OpenAI base URL | OpenAI tab → Base URL | `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| OpenAI model | OpenAI tab → Model | `OPENAI_MODEL` | `gpt-4o-mini` |
| Azure key | Azure tab → API Key | `AZURE_OPENAI_API_KEY` | _(empty)_ |
| Azure endpoint | Azure tab → Base URL | `AZURE_OPENAI_BASE_URL` | _(empty)_ |
| Azure deployment | Azure tab → Deployment | `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o-mini` |
| Azure API version | Azure tab → API Version | `AZURE_OPENAI_API_VERSION` | `2024-08-01-preview` |
| Ollama base URL | Ollama tab → Base URL | `OLLAMA_BASE_URL` | `http://localhost:11434/v1` |
| Ollama model | Ollama tab → Model | `OLLAMA_MODEL` | `mistral` |
| Copilot wrapper token | GitHub Copilot tab → Token | `GITHUB_COPILOT_TOKEN` | _(empty)_ |
| Copilot wrapper URL | GitHub Copilot tab → Base URL | `GITHUB_COPILOT_BASE_URL` | `http://localhost:4141/v1` |
| Copilot wrapper model | GitHub Copilot tab → Model | `GITHUB_COPILOT_MODEL` | `gpt-4o` |
| Outlook OAuth token | Set automatically by Connect Outlook | `OUTLOOK_ACCESS_TOKEN` | _(empty)_ |
| Server port | n/a | `PORT` | `8080` |
| Session secret | n/a | `SESSION_SECRET` | random per process |

### Redaction

`GET /api/settings` returns secrets as bullet placeholders (`••••••••••••`). The real values never leave the server. The UI knows which secrets exist via a `hasSecrets` boolean map, so blank inputs do not blank stored values — only an explicit, non-empty save updates a secret.

---

## HTTP API reference

All paths are mounted under `/api`. Validation uses Zod; responses are JSON unless noted.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/healthz` | Liveness probe. Returns `{"ok": true}`. |
| `GET` | `/api/config` | Public config: `{ aiProvider, outlookConfigured, standaloneMode, availableProviders }`. Safe to expose. |
| `GET` | `/api/settings` | Full settings, secrets redacted, plus `hasSecrets` map. |
| `POST` | `/api/settings` | Update settings. Empty strings are stripped so they don't blank stored secrets. |
| `GET` | `/api/emails?since=<ISO>` | List Outlook messages since the given date (live mode). |
| `POST` | `/api/emails/upload-eml` | Multipart upload of one or more `.eml` files. Parsed in memory. |
| `POST` | `/api/emails/upload-pst` | Multipart upload of one `.pst` / `.ost` (≤ 2 GB / 5 000 messages). |
| `POST` | `/api/emails/summarize` | Body: `{ emails: [...] }`. Returns one summary + `needsReply` flag per email. Skipped when provider is `windows-copilot`. |
| `POST` | `/api/emails/digest` | Convenience: load + summarize + group in a single call. |

### Example: summarize a few messages with `curl`

```bash
curl -s http://localhost:8080/api/emails/summarize \
  -H 'content-type: application/json' \
  -d '{"emails":[{"id":"1","subject":"Q3 review","from":"boss@acme.com","body":"Please send your slides by Friday."}]}'
```

```json
{
  "results": [
    {
      "id": "1",
      "summary": "Boss is asking for your Q3 review slides by Friday.",
      "needsReply": true,
      "confidence": 0.92
    }
  ]
}
```

---

## Architecture

```
                ┌────────────────────────────┐
                │  Browser (React + Vite)    │
                │  artifacts/inbox-digest    │
                └────────────┬───────────────┘
                             │  HTTP (same origin in standalone)
                             ▼
                ┌────────────────────────────┐
                │  Express API (Node 20)     │
                │  artifacts/api-server      │
                │                            │
                │  ┌──────────────────────┐  │
                │  │   settingsStore      │  │  ~/.inbox-digest/config.json (chmod 600)
                │  ├──────────────────────┤  │
                │  │   aiClient           │──┼──► OpenAI / Azure / Ollama / Copilot wrapper
                │  ├──────────────────────┤  │       (or no-op for windows-copilot)
                │  │   outlookClient      │──┼──► Microsoft Graph (delegated OAuth)
                │  ├──────────────────────┤  │
                │  │   uploadEml /        │  │
                │  │   uploadPst          │  │  multer + mailparser / pst-extractor
                │  └──────────────────────┘  │
                └────────────────────────────┘
```

**Key design choices**

- **Single source of truth for settings.** Both the UI and env vars converge on `~/.inbox-digest/config.json`; the env-var overlay only fires for empty fields, so neither layer can silently win.
- **OpenAI-compatible everything.** Azure, Ollama, and the GitHub Copilot wrapper are all called through the same `openai` SDK with a different `baseURL` and headers. New providers are usually a 30-line addition.
- **Stateless server.** No database is required to run. Postgres is only used by future features (digest history) and is optional.
- **Standalone bundle is just `esbuild`.** No Electron, no Chromium, no Tauri. The frontend is built statically and served by the same Express process; the browser the user already has is the UI.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper walkthrough.

---

## Repository layout

```
inbox-digest/
├── artifacts/
│   ├── api-server/          # Express backend (TypeScript)
│   ├── inbox-digest/        # React + Vite frontend
│   └── mockup-sandbox/      # Internal-only: component preview server
├── lib/
│   ├── api-spec/            # OpenAPI contract + generated types/hooks
│   ├── db/                  # Drizzle schema (optional Postgres)
│   └── …
├── standalone/              # esbuild bundler for offline / .exe distribution
│   ├── build.mjs
│   ├── pack-windows.mjs     # Node SEA → InboxDigest.exe
│   └── dist/                # Build output (gitignored)
├── docs/                    # Long-form documentation
├── scripts/                 # Repo utility scripts
├── replit.md                # Replit-specific architecture notes
└── README.md                # ← you are here
```

A pnpm workspace ties everything together; see `pnpm-workspace.yaml`.

---

## Build & release

```bash
# 1. Type-check the whole monorepo
pnpm run typecheck

# 2. Build the standalone bundle (server + static frontend)
pnpm --filter @workspace/standalone run build
# → standalone/dist/{server.mjs, public/, start.bat, start.sh, README.md, .env.example}

# 3. (Windows only) pack into a single .exe via Node SEA
node standalone/pack-windows.mjs
# → standalone/dist/InboxDigest.exe
```

Drop `standalone/dist/` (or just the `.exe`) anywhere with Node 20+ installed (or none, in the `.exe` case) and run `start.bat` / `start.sh` / double-click the exe.

---

## Air-gapped deployment

Inbox Digest was designed for environments with **no outbound internet**. Recipe:

1. On a connected machine, build the standalone bundle and (optionally) pack the `.exe`.
2. On the same connected machine, run `ollama pull mistral` (or any other model) so the model weights are cached.
3. Copy:
   - `standalone/dist/` (or `InboxDigest.exe`)
   - your Ollama install + `~/.ollama/models/`
   to the offline machine via USB / approved transfer.
4. On the offline machine, start Ollama (`ollama serve`), then start Inbox Digest. In **Settings**, choose **Ollama** and confirm the model name.
5. Use the **Upload `.eml` / `.pst`** tab — the live Outlook tab is disabled when no internet is available.

No telemetry. No phone-home. No cloud calls of any kind in this configuration.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `EADDRINUSE: 8080` on startup | Another process owns the port | `lsof -ti:8080 \| xargs kill -9`, or set `PORT=…` |
| Browser preview blank | Workflow didn't start, or server bound the wrong port | Restart the workflow; check it reads `process.env.PORT` |
| _"Outlook not connected"_ banner | OAuth token missing or expired | Click **Connect Outlook**, re-authorize. Or use the upload tabs. |
| Ollama responses time out | Model not pulled, or weights still loading | `ollama pull mistral`; first call after launch is slow |
| GitHub Copilot wrapper returns 401 | Wrapper not started, or Copilot subscription inactive | `npx copilot-api@latest start`; verify your Copilot subscription |
| `.pst` upload fails | File > 2 GB or > 5 000 messages | Split the archive, or raise the caps in `routes/uploadPst.ts` |
| Settings don't persist | `~/.inbox-digest/` not writable | Check ownership/permissions; the file must be writable by the running user |
| Standalone `.exe` flagged by AV | Node SEA binaries are commonly false-flagged | Sign the exe, or distribute the unpacked `standalone/dist/` folder |

---

## Security & privacy notes

- **Settings file is `chmod 600`** on Unix-like systems and lives in your home directory.
- **Secrets are redacted on read** — they never leave the server in any GET response.
- **No telemetry** is sent anywhere. The only outbound calls are to the AI provider you chose and (if enabled) Microsoft Graph.
- **Single-user, local trust model.** The standalone server has no authentication on `/api/settings` because it is intended to bind to `localhost` for one user. **Do not expose the standalone server to the public internet.** If you need multi-user, run it behind a reverse proxy with auth, or use the Replit-hosted version.
- **Email content is sent to your AI provider.** If that's not acceptable (legal hold, DLP), use the `ollama` or `windows-copilot` providers, which keep content on-device.

---

## License

MIT. See [`LICENSE`](LICENSE).
