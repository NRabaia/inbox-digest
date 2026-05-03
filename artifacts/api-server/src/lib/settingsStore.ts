import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type AIProvider =
  | "openai"
  | "azure"
  | "ollama"
  | "windows-copilot"
  | "github-copilot";

export interface Settings {
  aiProvider: AIProvider;
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  azure: {
    apiKey: string;
    baseUrl: string;
    deployment: string;
    apiVersion: string;
  };
  ollama: {
    baseUrl: string;
    model: string;
  };
  githubCopilot: {
    token: string;
    baseUrl: string;
    model: string;
  };
  outlook: {
    accessToken: string;
  };
}

const CONFIG_DIR = path.join(os.homedir(), ".inbox-digest");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULTS: Settings = {
  aiProvider: "openai",
  openai: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  azure: {
    apiKey: "",
    baseUrl: "",
    deployment: "gpt-4o-mini",
    apiVersion: "2024-08-01-preview",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2",
  },
  githubCopilot: {
    token: "",
    baseUrl: "http://localhost:4141/v1",
    model: "gpt-4o",
  },
  outlook: {
    accessToken: "",
  },
};

let cache: Settings | null = null;

function applyEnvOverlay(s: Settings): Settings {
  // Env vars take effect only when the stored value is empty (defaults).
  // This makes env-based configuration still work as a fallback.
  return {
    aiProvider:
      s.aiProvider ?? (process.env["AI_PROVIDER"] as AIProvider) ?? "openai",
    openai: {
      apiKey:
        s.openai.apiKey ||
        process.env["OPENAI_API_KEY"] ||
        process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ||
        "",
      baseUrl:
        s.openai.baseUrl ||
        process.env["OPENAI_BASE_URL"] ||
        process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ||
        DEFAULTS.openai.baseUrl,
      model:
        s.openai.model || process.env["OPENAI_MODEL"] || DEFAULTS.openai.model,
    },
    azure: {
      apiKey: s.azure.apiKey || process.env["AZURE_OPENAI_API_KEY"] || "",
      baseUrl: s.azure.baseUrl || process.env["AZURE_OPENAI_BASE_URL"] || "",
      deployment:
        s.azure.deployment ||
        process.env["AZURE_OPENAI_DEPLOYMENT"] ||
        DEFAULTS.azure.deployment,
      apiVersion:
        s.azure.apiVersion ||
        process.env["AZURE_OPENAI_API_VERSION"] ||
        DEFAULTS.azure.apiVersion,
    },
    ollama: {
      baseUrl:
        s.ollama.baseUrl ||
        process.env["OLLAMA_BASE_URL"] ||
        DEFAULTS.ollama.baseUrl,
      model:
        s.ollama.model || process.env["OLLAMA_MODEL"] || DEFAULTS.ollama.model,
    },
    githubCopilot: {
      token:
        s.githubCopilot.token || process.env["GITHUB_COPILOT_TOKEN"] || "",
      baseUrl:
        s.githubCopilot.baseUrl ||
        process.env["GITHUB_COPILOT_BASE_URL"] ||
        DEFAULTS.githubCopilot.baseUrl,
      model:
        s.githubCopilot.model ||
        process.env["GITHUB_COPILOT_MODEL"] ||
        DEFAULTS.githubCopilot.model,
    },
    outlook: {
      accessToken:
        s.outlook.accessToken || process.env["OUTLOOK_ACCESS_TOKEN"] || "",
    },
  };
}

const EMPTY_PERSISTED: Settings = {
  aiProvider: "openai",
  openai: { apiKey: "", baseUrl: "", model: "" },
  azure: { apiKey: "", baseUrl: "", deployment: "", apiVersion: "" },
  ollama: { baseUrl: "", model: "" },
  githubCopilot: { token: "", baseUrl: "", model: "" },
  outlook: { accessToken: "" },
};

/** Load raw persisted values from disk WITHOUT merging defaults, so the env
 * overlay can correctly distinguish "user left it blank" from "user set it". */
function loadFromDisk(): Settings {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        aiProvider: parsed.aiProvider ?? EMPTY_PERSISTED.aiProvider,
        openai: { ...EMPTY_PERSISTED.openai, ...(parsed.openai ?? {}) },
        azure: { ...EMPTY_PERSISTED.azure, ...(parsed.azure ?? {}) },
        ollama: { ...EMPTY_PERSISTED.ollama, ...(parsed.ollama ?? {}) },
        githubCopilot: {
          ...EMPTY_PERSISTED.githubCopilot,
          ...(parsed.githubCopilot ?? {}),
        },
        outlook: { ...EMPTY_PERSISTED.outlook, ...(parsed.outlook ?? {}) },
      };
    }
  } catch {
    // ignore — fall back to empty (env overlay will fill in)
  }
  return EMPTY_PERSISTED;
}

export function getSettings(): Settings {
  if (!cache) cache = applyEnvOverlay(loadFromDisk());
  return cache;
}

export function saveSettings(next: Partial<Settings>): Settings {
  const current = loadFromDisk();
  const merged: Settings = {
    aiProvider: next.aiProvider ?? current.aiProvider,
    openai: { ...current.openai, ...(next.openai ?? {}) },
    azure: { ...current.azure, ...(next.azure ?? {}) },
    ollama: { ...current.ollama, ...(next.ollama ?? {}) },
    githubCopilot: { ...current.githubCopilot, ...(next.githubCopilot ?? {}) },
    outlook: { ...current.outlook, ...(next.outlook ?? {}) },
  };
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), {
    mode: 0o600,
  });
  // Enforce 0600 even if file already existed with broader perms.
  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // best-effort (e.g. on Windows where chmod is a no-op)
  }
  cache = applyEnvOverlay(merged);
  return cache;
}

/** Reset the in-memory cache. Useful for tests; called automatically by saveSettings. */
export function _resetSettingsCache() {
  cache = null;
}

/** Returns settings with secret fields redacted, for safe transport to the UI. */
export function getRedactedSettings() {
  const s = getSettings();
  const redact = (v: string) => (v ? "•".repeat(Math.min(v.length, 12)) : "");
  return {
    aiProvider: s.aiProvider,
    openai: { ...s.openai, apiKey: redact(s.openai.apiKey) },
    azure: { ...s.azure, apiKey: redact(s.azure.apiKey) },
    ollama: s.ollama,
    githubCopilot: { ...s.githubCopilot, token: redact(s.githubCopilot.token) },
    outlook: { accessToken: redact(s.outlook.accessToken) },
    hasSecrets: {
      openaiApiKey: Boolean(s.openai.apiKey),
      azureApiKey: Boolean(s.azure.apiKey),
      githubCopilotToken: Boolean(s.githubCopilot.token),
      outlookAccessToken: Boolean(s.outlook.accessToken),
    },
  };
}
