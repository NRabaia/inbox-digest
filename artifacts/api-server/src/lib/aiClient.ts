import OpenAI from "openai";
import { getSettings, type AIProvider } from "./settingsStore";

export type { AIProvider };

interface AIConfig {
  provider: AIProvider;
  client: OpenAI;
  model: string;
}

/**
 * Builds an OpenAI-compatible client for the configured provider.
 * Throws for "windows-copilot" since it has no programmatic API — the
 * frontend handles that mode by deep-linking into the Copilot app instead.
 */
export function getAIConfig(): AIConfig {
  const s = getSettings();
  const provider = s.aiProvider;

  if (provider === "windows-copilot") {
    throw new Error(
      "Windows Copilot does not expose a programmatic API. Use the per-email 'Ask Copilot' buttons in the UI, or pick a different provider in Settings.",
    );
  }

  if (provider === "azure") {
    const { baseUrl, apiKey, deployment, apiVersion } = s.azure;
    if (!baseUrl || !apiKey) {
      throw new Error(
        "Azure OpenAI selected but base URL or API key is not set. Open Settings to configure it.",
      );
    }
    const client = new OpenAI({
      apiKey,
      baseURL: `${baseUrl.replace(/\/$/, "")}/openai/deployments/${deployment}`,
      defaultQuery: { "api-version": apiVersion },
      defaultHeaders: { "api-key": apiKey },
    });
    return { provider, client, model: deployment };
  }

  if (provider === "ollama") {
    const { baseUrl, model } = s.ollama;
    const client = new OpenAI({ apiKey: "ollama", baseURL: baseUrl });
    return { provider, client, model };
  }

  if (provider === "github-copilot") {
    const { token, baseUrl, model } = s.githubCopilot;
    if (!token) {
      throw new Error(
        "GitHub Copilot selected but no token is set. Open Settings to add a Copilot/GitHub token, and make sure your local Copilot wrapper (e.g. copilot-api) is running.",
      );
    }
    const client = new OpenAI({
      apiKey: token,
      baseURL: baseUrl,
      defaultHeaders: {
        "Editor-Version": "vscode/1.95.0",
        "Copilot-Integration-Id": "vscode-chat",
      },
    });
    return { provider, client, model };
  }

  // Default: OpenAI-compatible
  const { apiKey, baseUrl, model } = s.openai;
  if (!apiKey) {
    throw new Error(
      "OpenAI selected but no API key is set. Open Settings to add one, or use the Replit AI Integration.",
    );
  }
  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  return { provider, client, model };
}

export function getAIProviderName(): AIProvider {
  return getSettings().aiProvider;
}
