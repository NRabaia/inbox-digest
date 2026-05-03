import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  getRedactedSettings,
  getSettings,
  saveSettings,
  type AIProvider,
} from "../lib/settingsStore";

const router: IRouter = Router();

const PROVIDERS: AIProvider[] = ["openai", "azure", "ollama", "windows-copilot"];

const updateSchema = z.object({
  aiProvider: z.enum(["openai", "azure", "ollama", "windows-copilot"]).optional(),
  openai: z
    .object({
      apiKey: z.string().optional(),
      baseUrl: z.string().optional(),
      model: z.string().optional(),
    })
    .partial()
    .optional(),
  azure: z
    .object({
      apiKey: z.string().optional(),
      baseUrl: z.string().optional(),
      deployment: z.string().optional(),
      apiVersion: z.string().optional(),
    })
    .partial()
    .optional(),
  ollama: z
    .object({
      baseUrl: z.string().optional(),
      model: z.string().optional(),
    })
    .partial()
    .optional(),
  outlook: z
    .object({
      accessToken: z.string().optional(),
    })
    .partial()
    .optional(),
});

/** Strip empty strings so they don't overwrite existing values with blanks. */
function stripEmpty<T extends object>(obj: T | undefined): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v === "") continue;
    out[k] = v;
  }
  return out as T;
}

router.get("/config", (_req, res) => {
  const s = getSettings();
  const outlookConfigured = Boolean(
    s.outlook.accessToken ||
      (process.env["REPLIT_CONNECTORS_HOSTNAME"] &&
        process.env["REPL_IDENTITY"] &&
        process.env["OUTLOOK_CONNECTOR_ID"]),
  );
  res.json({
    aiProvider: s.aiProvider,
    outlookConfigured,
    standaloneMode: process.env["STANDALONE_MODE"] === "1",
    availableProviders: PROVIDERS,
  });
});

router.get("/settings", (_req, res) => {
  res.json(getRedactedSettings());
});

router.post("/settings", (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings", details: parsed.error.issues });
    return;
  }
  saveSettings({
    aiProvider: parsed.data.aiProvider,
    openai: stripEmpty(parsed.data.openai) as never,
    azure: stripEmpty(parsed.data.azure) as never,
    ollama: stripEmpty(parsed.data.ollama) as never,
    outlook: stripEmpty(parsed.data.outlook) as never,
  });
  res.json(getRedactedSettings());
});

export default router;
