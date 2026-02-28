# Vercel Deployment Handoff

**Date:** 2026-02-28
**Status:** Fix implemented — ready to deploy to Vercel

---

## What Was Done (Completed)

### Code Changes (all committed & pushed)

1. **`.vercelignore`** — Created. Excludes `services/`, `apps/e2e/`, `docs/`, `scripts/`, etc.
2. **`@vercel/analytics` + `@vercel/speed-insights`** — Installed in both `apps/web` and `apps/landing`
3. **Root layouts updated** — Both `apps/web/src/app/layout.tsx` and `apps/landing/src/app/layout.tsx` have `<Analytics />` and `<SpeedInsights />` components
4. **Dead PostHog rewrites removed** from `apps/landing/next.config.ts`
5. **Legacy `vercel-build` script removed** from root `package.json`
6. **Telemetry barrel export fix** — Split `@smartout/telemetry` into server-safe root (`./`) and client-only (`./react`) exports. React hooks no longer pollute server imports.
7. **AI agent barrel export fix** — Removed agent re-exports from `@smartout/ai` barrel. API routes now import directly via subpath: `@smartout/ai/agents/onboarding`, `@smartout/ai/agents/docs`
8. **Dashboard layout type fix** — `ROUTE_MISSION_MAP` lookup narrowed correctly for strict mode
9. **`transpilePackages`** — Added to both `next.config.ts` files for all `@smartout/*` workspace packages
10. **`next build --webpack`** — Both apps use webpack instead of Turbopack for production builds
11. **ADR-0020** — `docs/decisions/0020-vercel-hosting-strategy.md` written
12. **Operations review guide** — `docs/cross-cutting/vercel-operations-review.md` written
13. **CLAUDE.md** — Updated with ADR-0020, telemetry exports

### Vercel Project Configuration (via API)

Both projects (`smartout-web`, `smartout-landing`) are configured:

| Setting                         | smartout-web                                   | smartout-landing                                   |
| ------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Git repo                        | SXTNmedia21/smartout.ai                        | SXTNmedia21/smartout.ai                            |
| Production branch               | SmartOut.ai                                    | SmartOut.ai                                        |
| Framework                       | Next.js                                        | Next.js                                            |
| Root Directory                  | `apps/web`                                     | `apps/landing`                                     |
| Install Command                 | `cd ../.. && pnpm install --frozen-lockfile`   | `cd ../.. && pnpm install --frozen-lockfile`       |
| Build Command                   | `cd ../.. && npx turbo run build --filter=web` | `cd ../.. && npx turbo run build --filter=landing` |
| Output Directory                | `.next`                                        | `.next`                                            |
| Node Version                    | 20.x                                           | 20.x                                               |
| sourceFilesOutsideRootDirectory | true                                           | true                                               |
| ENABLE_EXPERIMENTAL_COREPACK    | 1                                              | 1                                                  |
| Speed Insights                  | enabled                                        | enabled                                            |
| Web Analytics                   | enabled                                        | enabled                                            |

### Env Vars Set on Vercel

**Web:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST, NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT, OPENROUTER_API_KEY, SUPABASE_SERVICE_ROLE_KEY, ULTRAVOX_API_KEY, SENTRY_DSN

**Landing:** NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ULTRAVOX_API_KEY, STRIPE_SECRET_KEY, INTERVJU_MCP_WEBHOOK_SECRET

---

## What's Blocking (The Problem)

### Both apps build perfectly locally, but fail on Vercel

**Error:** `Module not found: Can't resolve '@smartout/ai/agents/onboarding'`

This happens with BOTH Turbopack and webpack on Vercel.

### Root Cause Analysis

The `@smartout/ai` package uses **subpath exports** in `package.json`:

```json
"exports": {
  ".": "./src/index.ts",
  "./agents/onboarding": "./src/agents/onboarding.ts",
  "./agents/docs": "./src/agents/docs.ts"
}
```

These point to raw `.ts` files (the package is not pre-built). This works locally because pnpm workspace symlinks + Next.js `transpilePackages` resolve them correctly. On Vercel, the module resolution fails — both Turbopack and webpack can't find the files.

### What Was Tried

1. **Turbopack (default)** → `Module not found` on subpath exports
2. **Webpack (`--webpack` flag)** → Same `Module not found`
3. **Barrel re-exports** (before subpath imports) → `Module not found` on relative `./agents/*` imports within barrel
4. **`transpilePackages`** in next.config.ts → No effect
5. **pnpm 10 (Vercel default)** → Same error
6. **pnpm 9 via corepack** → Same error (confirmed corepack works, pnpm version is not the issue)
7. **`sourceFilesOutsideRootDirectory: true`** → Set, doesn't fix resolution

### Fix Applied: Option A — Pre-build @smartout/ai

**Root cause confirmed:** `@smartout/ai` had `noEmit: true` and no `build` script. Turbo skipped it during `"dependsOn": ["^build"]`. On Vercel, webpack's enhanced-resolve couldn't resolve `exports` entries pointing to raw `.ts` files. Meanwhile `@smartout/supabase` worked because its `tsc` build produced `dist/*.js` files as fallback.

**Changes made:**

1. `packages/ai/tsconfig.json` — removed `noEmit: true`, added `outDir: "dist"` and `rootDir: "src"`
2. `packages/ai/package.json` — added `"build": "tsc"` script, updated all `exports` to conditional format pointing to `dist/*.js` + `dist/*.d.ts`
3. No `.gitignore` changes needed — `dist` already ignored globally

**Verified:** Both `npx turbo run build --filter=web` and `--filter=landing` pass locally. Turbo correctly builds `@smartout/ai` before the apps.

---

## Commits Made This Session

```
5b063f7 fix: use webpack for production builds to fix Vercel deployments
b38c05d fix: use subpath imports for AI agents to fix Vercel Turbopack builds
9ffde96 fix: add transpilePackages for workspace deps to fix Vercel builds
a8e6a59 docs: update CLAUDE.md with @smartout/telemetry export split
629c9ee fix: resolve web build errors — telemetry barrel export and type narrowing
def9c77 chore: remove legacy vercel-build script
11b9f12 chore: commit accumulated work from multiple sessions
d59b7f9 feat: add Vercel hosting instrumentation and documentation
```

---

## Vercel API Access

- **CLI:** `vercel` v50.9.6, authenticated as `sxtnmedia21`
- **Auth token location:** `C:\Users\sxtnl\AppData\Roaming\com.vercel.cli\Data\auth.json`
- **Team ID:** `team_bbtw5JnNxRkKlecAKQB7qqzG`
- **Web Project ID:** `prj_NncMfppdZW4CyBhsF1rVFoJvSDPb`
- **Landing Project ID:** `prj_QrU6ffv3oPoDnOygHt9owIQQaGdH`

All project settings were modified via `PATCH https://api.vercel.com/v9/projects/{id}?teamId={teamId}` with the bearer token.
