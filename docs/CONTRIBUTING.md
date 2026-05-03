# Contributing

Thanks for your interest! Inbox Digest is a small monorepo and the contribution loop is short.

## Prerequisites

- Node 20+
- pnpm 9+
- (optional) Postgres if you want to work on the digest-history feature

## Layout

This is a [pnpm workspace](https://pnpm.io/workspaces). The packages you'll touch most:

- `artifacts/api-server/` — Express backend
- `artifacts/inbox-digest/` — React + Vite frontend
- `lib/api-spec/` — OpenAPI contract; regenerate types with `pnpm --filter @workspace/api-spec run codegen`
- `standalone/` — esbuild bundle + Windows SEA packaging

See `replit.md` for Replit-specific notes (workflows, ports, etc.).

## Local development

```bash
pnpm install
# In two terminals (or via the Replit workflows):
pnpm --filter @workspace/api-server   run dev
pnpm --filter @workspace/inbox-digest run dev
```

The API binds to `$PORT` (default 8080). The frontend Vite dev server proxies `/api` to it.

## Useful commands

```bash
pnpm run typecheck                                  # full typecheck across the monorepo
pnpm run typecheck:libs                             # libs only (composite build)
pnpm --filter @workspace/api-spec   run codegen     # regen Zod / TanStack Query hooks from the OpenAPI spec
pnpm --filter @workspace/standalone run build       # produce standalone/dist/
node standalone/pack-windows.mjs                    # produce InboxDigest.exe
```

## Adding a new AI provider

The provider abstraction is small on purpose. To add one:

1. Add an entry to `PROVIDERS` and the Zod enum in `artifacts/api-server/src/routes/config.ts`.
2. Add defaults + env-overlay + redaction handling in `artifacts/api-server/src/lib/settingsStore.ts`.
3. Add a branch in `artifacts/api-server/src/lib/aiClient.ts` that returns an OpenAI-compatible client (override `baseURL`, set headers as needed).
4. Add a radio option + tab to `artifacts/inbox-digest/src/components/SettingsDialog.tsx`.
5. Document it in `README.md` and `docs/PROVIDERS.md`.

If your provider doesn't have an API at all (like Windows Copilot), return a no-op client and add a UI mode in `Home.tsx` that handles its non-automated flow.

## Style

- TypeScript strict mode everywhere.
- No `console.log` in server code — use `req.log` in routes and the singleton `logger` elsewhere (Pino).
- Keep components small. The frontend has zero global state outside of TanStack Query caches.
- Validate every API input with Zod. The OpenAPI spec is the source of truth for shapes.

## Pull requests

- Run `pnpm run typecheck` before pushing.
- Include a short note about what you changed and why.
- If you change the OpenAPI spec, run codegen and commit the generated files.
- Be kind in code review. We're all here to ship a calmer inbox.
