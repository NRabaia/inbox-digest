# AI Provider Guide

Inbox Digest supports five AI providers. Pick one in **Settings**; you can change it at any time without restarting the server.

| Provider | Internet required | Cost model | Privacy |
|---|---|---|---|
| OpenAI | Yes | Pay per token | Email content sent to OpenAI |
| Azure OpenAI | Yes | Per Azure contract | Email content sent to your Azure tenant |
| Ollama | **No** | Free | Email content never leaves your machine |
| GitHub Copilot (wrapper) | Yes | Existing Copilot subscription | Email content sent through wrapper to GitHub |
| Windows Copilot (deep-link) | Depends on Copilot | Free | You manually paste into Copilot — nothing automated |

---

## OpenAI (default)

Works with the public OpenAI API or any OpenAI-compatible endpoint (Together AI, Fireworks, Groq, OpenRouter, vLLM, llama.cpp server, etc.).

**Settings**

| Field | Default | Notes |
|---|---|---|
| API Key | _(empty)_ | Required. `sk-…` for OpenAI; provider-specific for others. |
| Base URL | `https://api.openai.com/v1` | Override for compatible providers, e.g. `https://api.together.xyz/v1`. |
| Model | `gpt-4o-mini` | Any chat-completions-capable model. |

**Env vars:** `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.

Also accepts Replit AI Integrations env vars when running on Replit, so you don't have to configure anything in that environment.

---

## Azure OpenAI

The supported way to call **Microsoft 365 Copilot's** underlying engine inside an enterprise tenant. You must have an Azure OpenAI resource with at least one deployed model.

**Settings**

| Field | Example | Notes |
|---|---|---|
| Base URL | `https://my-resource.openai.azure.com` | No trailing slash, no path. |
| API Key | _(your key)_ | From the Azure Portal → "Keys and Endpoint". |
| Deployment | `gpt-4o-mini` | The **deployment name** you chose, not the underlying model name. |
| API Version | `2024-08-01-preview` | Check the [Azure OpenAI changelog](https://learn.microsoft.com/azure/ai-services/openai/reference) for the latest stable. |

**Env vars:** `AZURE_OPENAI_BASE_URL`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`.

Inbox Digest constructs the URL as `${baseUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}` and sets the `api-key` header.

---

## Ollama (fully offline)

Best choice for air-gapped environments, regulated industries, or anyone who doesn't want email content leaving their laptop.

**Setup**

```bash
# 1. Install Ollama from https://ollama.com
# 2. Pull a model (mistral is the lightest sensible default)
ollama pull mistral
# 3. Start the server (auto-starts on macOS / Windows after install)
ollama serve
```

**Settings**

| Field | Default | Notes |
|---|---|---|
| Base URL | `http://localhost:11434/v1` | Ollama's OpenAI-compatible endpoint. |
| Model | `mistral` | Any model you've pulled: `llama3.2`, `phi3`, `qwen2.5`, etc. |

**Env vars:** `OLLAMA_BASE_URL`, `OLLAMA_MODEL`.

**Performance tips**

- First call after `ollama serve` starts is slow (model loads into RAM/VRAM). Subsequent calls are fast.
- For inboxes > 200 messages, prefer a 7-8B model on a machine with at least 16 GB RAM, or any model on a machine with a GPU.
- Lower the **summary batch size** in the UI if your machine swaps.

---

## GitHub Copilot (wrapper)

Talks to a community-maintained wrapper that exposes your existing GitHub Copilot subscription as an OpenAI-compatible endpoint. Inbox Digest sends `Editor-Version: vscode/1.95.0` and `Copilot-Integration-Id: vscode-chat` headers so the wrapper accepts the request as if it came from a real IDE.

**Setup — pick one wrapper**

```bash
# Option A: copilot-api (Node, easiest)
npx copilot-api@latest start
# → listens on http://localhost:4141, opens device-flow auth in your browser

# Option B: copilot-gpt4-service (Docker)
docker run -p 4141:8080 ghcr.io/aaamoon/copilot-gpt4-service
```

**Settings**

| Field | Default | Notes |
|---|---|---|
| Token | _(empty)_ | Many wrappers don't need one in localhost mode; required if your wrapper expects a Bearer token. |
| Base URL | `http://localhost:4141/v1` | Match the port your wrapper prints. |
| Model | `gpt-4o` | What the wrapper advertises — `gpt-4o`, `claude-3.5-sonnet`, etc. |

**Env vars:** `GITHUB_COPILOT_TOKEN`, `GITHUB_COPILOT_BASE_URL`, `GITHUB_COPILOT_MODEL`.

**Caveats**

- Requires an **active GitHub Copilot subscription** (Individual, Business, or Enterprise).
- Using Copilot's chat outside official IDE clients is a **gray area** under GitHub's terms of service. The Settings UI calls this out explicitly. Use at your own discretion.
- Latency is higher than the OpenAI API because the wrapper proxies through GitHub's chat backend.

---

## Windows Copilot (deep-link)

Microsoft does **not** expose a programmatic API for Windows Copilot. Inbox Digest works around this by changing its UI when this provider is selected:

- The backend **skips automatic summarization** entirely (provider returns a no-op).
- Each email row shows an **Ask Copilot** button.
- Clicking the button constructs a `ms-copilot:?q=<prompt>` URL and asks the OS to open it.
- Windows opens the Copilot app pre-filled with a summary prompt for that email.
- You read the answer in the Copilot app, not in Inbox Digest.

**Settings:** none — this provider has no configuration.

**When this is the right choice**

- You're on Windows 11 with Copilot enabled.
- You don't have an OpenAI key, an Azure tenant, a Copilot subscription, or the resources to run Ollama.
- You're OK with one click per email instead of an automatic batch summary.

---

## Picking a provider — decision flow

```
                   ┌──────────────────────────┐
                   │ Need it offline / on-prem? │
                   └────────────┬─────────────┘
                                │ yes
                                ▼
                          ┌──────────┐
                          │  Ollama  │
                          └──────────┘
                                │ no
                                ▼
              ┌─────────────────────────────────┐
              │ Inside a Microsoft 365 tenant?  │
              └────────────┬────────────────────┘
                           │ yes
                           ▼
                    ┌──────────────┐
                    │  Azure       │
                    └──────────────┘
                           │ no
                           ▼
       ┌───────────────────────────────────────┐
       │ Already paying for GitHub Copilot?    │
       └────────────┬──────────────────────────┘
                    │ yes
                    ▼
            ┌──────────────────────┐
            │  GitHub Copilot      │
            │  (wrapper)           │
            └──────────────────────┘
                    │ no
                    ▼
       ┌────────────────────────────────────────┐
       │ On Windows 11 with Copilot, but no key │
       └────────────┬───────────────────────────┘
                    │ yes
                    ▼
          ┌────────────────────────┐
          │  Windows Copilot       │
          │  (deep-link)           │
          └────────────────────────┘
                    │ no
                    ▼
              ┌──────────┐
              │  OpenAI  │
              └──────────┘
```
