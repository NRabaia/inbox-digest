import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles } from "lucide-react";

type Provider = "openai" | "azure" | "ollama" | "github-copilot" | "windows-copilot";

interface SettingsResponse {
  aiProvider: Provider;
  openai: { apiKey: string; baseUrl: string; model: string };
  azure: { apiKey: string; baseUrl: string; deployment: string; apiVersion: string };
  ollama: { baseUrl: string; model: string };
  githubCopilot: { token: string; baseUrl: string; model: string };
  outlook: { accessToken: string };
  hasSecrets: {
    openaiApiKey: boolean;
    azureApiKey: boolean;
    githubCopilotToken: boolean;
    outlookAccessToken: boolean;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function SettingsDialog({ open, onOpenChange, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [s, setS] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsResponse) => {
        // Clear redacted dot-strings so the user types fresh secrets
        setS({
          ...data,
          openai: { ...data.openai, apiKey: "" },
          azure: { ...data.azure, apiKey: "" },
          githubCopilot: { ...data.githubCopilot, token: "" },
          outlook: { accessToken: "" },
        });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  const update = <K extends keyof SettingsResponse>(
    key: K,
    patch: Partial<SettingsResponse[K]>,
  ) => {
    setS((prev) => (prev ? { ...prev, [key]: { ...(prev[key] as object), ...patch } } : prev));
  };

  const handleSave = async () => {
    if (!s) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: s.aiProvider,
          openai: s.openai,
          azure: s.azure,
          ollama: s.ollama,
          githubCopilot: s.githubCopilot,
          outlook: s.outlook,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your AI provider and email source. Settings are stored locally
            in <code>~/.inbox-digest/config.json</code>.
          </DialogDescription>
        </DialogHeader>

        {loading || !s ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-semibold">AI Provider</Label>
              <RadioGroup
                value={s.aiProvider}
                onValueChange={(v) => setS({ ...s, aiProvider: v as Provider })}
                className="grid grid-cols-2 gap-2"
              >
                {[
                  { v: "openai", label: "OpenAI" },
                  { v: "azure", label: "Azure OpenAI" },
                  { v: "ollama", label: "Ollama (offline)" },
                  { v: "github-copilot", label: "GitHub Copilot (wrapper)" },
                  { v: "windows-copilot", label: "Windows Copilot" },
                ].map((opt) => (
                  <label
                    key={opt.v}
                    className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-colors ${
                      s.aiProvider === opt.v
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <RadioGroupItem value={opt.v} />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <Tabs value={s.aiProvider} onValueChange={(v) => setS({ ...s, aiProvider: v as Provider })}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="openai">OpenAI</TabsTrigger>
                <TabsTrigger value="azure">Azure</TabsTrigger>
                <TabsTrigger value="ollama">Ollama</TabsTrigger>
                <TabsTrigger value="github-copilot">GH Copilot</TabsTrigger>
                <TabsTrigger value="windows-copilot">Win Copilot</TabsTrigger>
              </TabsList>

              <TabsContent value="openai" className="flex flex-col gap-3 pt-3">
                <Field label={`API Key${s.hasSecrets.openaiApiKey ? " (saved — leave blank to keep)" : ""}`}>
                  <Input
                    type="password"
                    placeholder={s.hasSecrets.openaiApiKey ? "•••••••• (saved)" : "sk-..."}
                    value={s.openai.apiKey}
                    onChange={(e) => update("openai", { apiKey: e.target.value })}
                  />
                </Field>
                <Field label="Base URL">
                  <Input
                    value={s.openai.baseUrl}
                    onChange={(e) => update("openai", { baseUrl: e.target.value })}
                  />
                </Field>
                <Field label="Model">
                  <Input
                    value={s.openai.model}
                    onChange={(e) => update("openai", { model: e.target.value })}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Get a key at <a className="underline" href="https://platform.openai.com" target="_blank" rel="noreferrer">platform.openai.com</a>.
                  Works with any OpenAI-compatible endpoint (e.g. OpenRouter, Together).
                </p>
              </TabsContent>

              <TabsContent value="azure" className="flex flex-col gap-3 pt-3">
                <Field label={`API Key${s.hasSecrets.azureApiKey ? " (saved — leave blank to keep)" : ""}`}>
                  <Input
                    type="password"
                    placeholder={s.hasSecrets.azureApiKey ? "•••••••• (saved)" : "your-azure-key"}
                    value={s.azure.apiKey}
                    onChange={(e) => update("azure", { apiKey: e.target.value })}
                  />
                </Field>
                <Field label="Resource Base URL">
                  <Input
                    placeholder="https://your-resource.openai.azure.com"
                    value={s.azure.baseUrl}
                    onChange={(e) => update("azure", { baseUrl: e.target.value })}
                  />
                </Field>
                <Field label="Deployment Name">
                  <Input
                    value={s.azure.deployment}
                    onChange={(e) => update("azure", { deployment: e.target.value })}
                  />
                </Field>
                <Field label="API Version">
                  <Input
                    value={s.azure.apiVersion}
                    onChange={(e) => update("azure", { apiVersion: e.target.value })}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Use this for your company's internal Azure OpenAI deployment. Microsoft 365 Copilot
                  is built on Azure OpenAI under the hood — this is the supported way to call it from a custom app.
                </p>
              </TabsContent>

              <TabsContent value="ollama" className="flex flex-col gap-3 pt-3">
                <Field label="Base URL">
                  <Input
                    value={s.ollama.baseUrl}
                    onChange={(e) => update("ollama", { baseUrl: e.target.value })}
                  />
                </Field>
                <Field label="Model">
                  <Input
                    value={s.ollama.model}
                    onChange={(e) => update("ollama", { model: e.target.value })}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Fully offline. Install <a className="underline" href="https://ollama.com" target="_blank" rel="noreferrer">Ollama</a>,
                  then run <code>ollama pull {s.ollama.model || "llama3.2"}</code>. Nothing leaves your machine.
                </p>
              </TabsContent>

              <TabsContent value="github-copilot" className="flex flex-col gap-3 pt-3">
                <Field label={`Copilot Token${s.hasSecrets.githubCopilotToken ? " (saved — leave blank to keep)" : ""}`}>
                  <Input
                    type="password"
                    placeholder={s.hasSecrets.githubCopilotToken ? "•••••••• (saved)" : "ghu_... or wrapper API key"}
                    value={s.githubCopilot.token}
                    onChange={(e) => update("githubCopilot", { token: e.target.value })}
                  />
                </Field>
                <Field label="Wrapper Base URL">
                  <Input
                    value={s.githubCopilot.baseUrl}
                    onChange={(e) => update("githubCopilot", { baseUrl: e.target.value })}
                  />
                </Field>
                <Field label="Model">
                  <Input
                    value={s.githubCopilot.model}
                    onChange={(e) => update("githubCopilot", { model: e.target.value })}
                  />
                </Field>
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  <p className="font-semibold mb-1">Requires a local Copilot wrapper.</p>
                  <p>
                    GitHub Copilot doesn't ship an official chat REST API, but community wrappers
                    expose it as OpenAI-compatible. Install one of these and point the Base URL above
                    at it:
                  </p>
                  <ul className="list-disc ml-4 mt-1 space-y-0.5">
                    <li><code>npx copilot-api@latest start</code> → http://localhost:4141/v1</li>
                    <li><a className="underline" href="https://github.com/aaamoon/copilot-gpt4-service" target="_blank" rel="noreferrer">copilot-gpt4-service</a> (Docker)</li>
                  </ul>
                  <p className="mt-2">
                    The token is your GitHub OAuth token from the wrapper, or the wrapper's own API key.
                    You need an active GitHub Copilot subscription. Use of GitHub Copilot's API outside its IDE
                    integrations may not be supported by GitHub — check your terms.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="windows-copilot" className="flex flex-col gap-3 pt-3">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
                  <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Windows Copilot doesn't expose a public API.</p>
                    <p>
                      It's a Windows app, not a callable service — third-party apps can't send a prompt and
                      receive a response programmatically. When this provider is selected, Inbox Digest skips
                      automatic AI summaries and instead shows an <strong>"Ask Copilot"</strong> button on each
                      email that opens the Copilot app with the email pre-loaded as a prompt.
                    </p>
                    <p className="mt-2">
                      For automated summarization in a corporate environment, use <strong>Azure OpenAI</strong>{" "}
                      (the same engine Microsoft 365 Copilot is built on).
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col gap-3 border-t pt-4">
              <Label className="text-sm font-semibold">Outlook (Live Mode)</Label>
              <Field label={`Access Token${s.hasSecrets.outlookAccessToken ? " (saved — leave blank to keep)" : ""}`}>
                <Input
                  type="password"
                  placeholder={s.hasSecrets.outlookAccessToken ? "•••••••• (saved)" : "Microsoft Graph access token"}
                  value={s.outlook.accessToken}
                  onChange={(e) => update("outlook", { accessToken: e.target.value })}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Optional. Without an Outlook token you can still use the <strong>Upload .eml</strong> mode.
                Get a token via the Microsoft Graph Explorer or your IT admin.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Build an `ms-copilot:` deep link with the given prompt. Used by Home.tsx. */
export function buildCopilotLink(prompt: string): string {
  return `ms-copilot:?q=${encodeURIComponent(prompt)}`;
}
