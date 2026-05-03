# Inbox Digest

A focused inbox triage tool for catching up after a long holiday. Loads your Outlook emails, summarizes each with AI, and flags the ones that need a reply.

## Three Ways to Run It

### 1. On Replit (this app)
The version you're looking at — runs on Replit, uses your connected Microsoft Outlook account.

### 2. Standalone (download & run on your computer)
For corporate or restricted environments. Build it once, copy the folder anywhere, run with `start.bat` (Windows) or `start.sh` (Mac/Linux).

```bash
node standalone/build-standalone.mjs
# → produces standalone/dist/ — copy this folder anywhere
```

See `standalone/dist/README.md` after building for end-user instructions.

### 3. Single Windows `.exe`
A double-clickable `InboxDigest.exe` with Node bundled in.

```bash
node standalone/build-standalone.mjs   # build the bundle first
node standalone/pack-windows.mjs       # then pack into .exe
# → produces standalone/dist/InboxDigest.exe
```

## AI Provider Options

The app supports three AI backends — pick one in your `.env`:

| Provider | When to use | Setup |
|---|---|---|
| **OpenAI** | Default. Public OpenAI API. | `OPENAI_API_KEY=...` |
| **Azure OpenAI** | Corporate environments with private Azure deployments. | `AI_PROVIDER=azure` + Azure config |
| **Ollama** | Fully offline. AI runs on your own machine. | Install [Ollama](https://ollama.com), set `AI_PROVIDER=ollama` |

## Email Source Options

The app supports two email sources:

1. **Live Outlook** — connects to your Microsoft 365 account via OAuth.
2. **Upload `.eml` files** — drag and drop email exports. Works fully offline.

## Pushing to GitHub

To publish this whole repo to GitHub for download/clone:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/inbox-digest.git
git push -u origin main
```

Anyone who clones your repo can run `pnpm install && pnpm --filter @workspace/inbox-digest run dev` and get going.

## Architecture

- `artifacts/inbox-digest/` — React + Vite frontend
- `artifacts/api-server/` — Express + TypeScript backend
- `lib/api-spec/` — OpenAPI contract (single source of truth)
- `standalone/` — Build scripts for the downloadable / .exe distribution
