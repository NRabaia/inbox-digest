import OpenAI from "openai";

export type AIProvider = "openai" | "azure" | "ollama";

interface AIConfig {
  provider: AIProvider;
  client: OpenAI;
  model: string;
}

let cached: AIConfig | null = null;

export function getAIConfig(): AIConfig {
  if (cached) return cached;

  const provider = (process.env["AI_PROVIDER"] ?? "openai") as AIProvider;

  if (provider === "azure") {
    const baseURL = process.env["AZURE_OPENAI_BASE_URL"];
    const apiKey = process.env["AZURE_OPENAI_API_KEY"];
    const deployment = process.env["AZURE_OPENAI_DEPLOYMENT"] ?? "gpt-4o-mini";
    const apiVersion =
      process.env["AZURE_OPENAI_API_VERSION"] ?? "2024-08-01-preview";

    if (!baseURL || !apiKey) {
      throw new Error(
        "Azure OpenAI selected but AZURE_OPENAI_BASE_URL or AZURE_OPENAI_API_KEY is not set",
      );
    }

    const client = new OpenAI({
      apiKey,
      baseURL: `${baseURL.replace(/\/$/, "")}/openai/deployments/${deployment}`,
      defaultQuery: { "api-version": apiVersion },
      defaultHeaders: { "api-key": apiKey },
    });

    cached = { provider, client, model: deployment };
    return cached;
  }

  if (provider === "ollama") {
    const baseURL =
      process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434/v1";
    const model = process.env["OLLAMA_MODEL"] ?? "llama3.2";

    const client = new OpenAI({
      apiKey: "ollama",
      baseURL,
    });

    cached = { provider, client, model };
    return cached;
  }

  // Default: OpenAI (Replit AI Integrations or user-supplied key)
  const baseURL =
    process.env["OPENAI_BASE_URL"] ??
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ??
    "https://api.openai.com/v1";
  const apiKey =
    process.env["OPENAI_API_KEY"] ??
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  const model = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";

  if (!apiKey) {
    throw new Error(
      "OpenAI selected but OPENAI_API_KEY is not set. Provide your own key or use the Replit AI Integration.",
    );
  }

  const client = new OpenAI({ apiKey, baseURL });
  cached = { provider, client, model };
  return cached;
}

export function getAIProviderName(): string {
  try {
    return getAIConfig().provider;
  } catch {
    return "unconfigured";
  }
}
