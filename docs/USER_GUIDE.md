# User Guide

A walkthrough of the app for someone using it for the first time.

---

## 1. Opening Inbox Digest

- **Web (Replit)** — visit the URL the workspace gives you.
- **Standalone folder** — double-click `start.bat` (Windows) or `./start.sh` (Mac/Linux). Your browser opens automatically to `http://localhost:8080`.
- **Single .exe** — double-click `InboxDigest.exe`. Same as above, but a console window also opens; closing it stops the app.

You'll see a calm landing page with two tabs (**Live Outlook** / **Upload `.eml` / `.pst`**), a date picker (**I was away since…**), and a **Catch Me Up** button.

---

## 2. First-time setup — choose an AI provider

Click **Settings** (top-left, gear icon).

1. Pick a provider from the radio list. The tab below switches to its config form.
2. Fill in the required fields (API key, base URL, model). The badge to the right of each provider shows whether secrets are already saved.
3. Click **Save**. The dialog closes; a small badge near the top of the page reflects the active provider (e.g. `AI: openai`).

You only have to do this once per machine. Settings are saved to `~/.inbox-digest/config.json` and survive restarts.

> Don't have an AI key? Pick **Ollama** and follow the on-screen install hint, or pick **Windows Copilot** to use the manual deep-link mode.

---

## 3. Connect your inbox (or upload one)

You have three options — switch between them via the tabs:

### A. Live Outlook

1. Click **Connect Outlook**. A Microsoft sign-in popup opens.
2. Approve the requested permissions (read mail, basic profile).
3. The popup closes; the badge changes from "not connected" to "connected as you@example.com".

### B. Upload `.eml` files

1. Switch to the **Upload** tab.
2. Drag one or more `.eml` files onto the drop zone, or click to browse.
3. Files are parsed in your browser → server in memory and never written to disk.

### C. Upload a `.pst` / `.ost` archive

1. Switch to the **Upload** tab.
2. Drop a single Outlook archive file (`.pst` or `.ost`).
3. Up to 2 GB and 5 000 messages are processed; every folder in the archive is walked.
4. The file is written to a temp directory, parsed, and deleted as soon as parsing finishes.

---

## 4. Run a digest

1. Pick the date you were last in your inbox (calendar icon next to **I was away since**).
2. Click **Catch Me Up**.
3. The app fetches all messages received since that date, sends them to your chosen AI provider in batches, and renders the digest.

You'll see, for each email:

- **Sender** and **subject**
- A **3-sentence summary**
- A 🟠 **flag** if the AI thinks the sender expects a reply
- A **link to open the original** in Outlook (live mode only)

Threads from the same sender are grouped so you can power through a whole conversation in one pass.

---

## 5. Special mode: Windows Copilot

When you've selected the **Windows Copilot** provider, the digest looks slightly different:

- There are **no automatic summaries** (because Microsoft doesn't expose a Copilot API).
- Each row has an **Ask Copilot** button.
- Clicking it opens the Copilot app pre-filled with a "Summarize this email and tell me if it needs a reply" prompt for that specific message.
- You read Copilot's answer in the Copilot app, not in Inbox Digest.

This is a manual, one-email-at-a-time workflow. It exists so you can use Inbox Digest with zero API setup if you have Windows Copilot and nothing else.

---

## 6. Tips

- **Smaller batches feel faster.** If your provider is slow (Ollama on CPU, GitHub Copilot wrapper), shorten the date range so fewer emails go out at once.
- **The settings dialog is your friend.** Switch providers any time — your other providers' keys stay saved in case you switch back.
- **`.eml` mode is fully offline-friendly** when paired with the Ollama provider. No internet needed at all.
- **Don't expose the standalone server to the internet.** It has no auth on `/api/settings` because it's intended for single-user local use. If you need to share it, run it behind a reverse proxy with auth.
- **Stop the app cleanly:** close the browser tab _and_ the console window (standalone), or press Ctrl-C in your dev terminal.

---

## 7. Where things live

| Item | Location |
|---|---|
| Your settings | `~/.inbox-digest/config.json` (chmod 600) |
| Temp `.pst` uploads | OS temp dir (`/tmp/…`, deleted after parse) |
| Logs | The console where the server is running (Pino, JSON) |
| Standalone build output | `standalone/dist/` |

To **reset** Inbox Digest entirely: delete `~/.inbox-digest/`. Next launch starts fresh.
