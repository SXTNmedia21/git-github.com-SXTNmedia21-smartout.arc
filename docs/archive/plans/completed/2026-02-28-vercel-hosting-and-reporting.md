---
title: "Vercel Hosting and Reporting Plan"
id: PLAN_VERCEL_HOSTING
status: completed
layer: plan
created: 2026-02-28
updated: 2026-02-28
---

# Vercel Hosting and Reporting Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Host both Smartout products on Vercel with clean domain split (`app.smartout.ai` → dashboard, `smartout.ai` → landing) and add Vercel-native performance/reporting instrumentation alongside existing PostHog/Sentry.

**Architecture:** Two independent Vercel projects from the same monorepo. Both use Root Directory `.` (monorepo root) with Turborepo `--filter` to build only the target app. Vercel Speed Insights and Web Analytics complement (not replace) existing PostHog product analytics and Sentry error tracking. CI remains the quality gate; Vercel Preview deployments become the release gate.

**Tech Stack:** Vercel Platform, `@vercel/speed-insights`, `@vercel/analytics`, Next.js 16 App Router, Turborepo, pnpm 9, GitHub Actions CI.

---

## Current State Assessment

| Item                       | Status                   | Notes                                                                                                                                                                                            |
| -------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Landing Vercel project     | Exists but misconfigured | `.vercel/project.json` in `apps/landing/` names it `"web"` — needs renaming                                                                                                                      |
| Web Vercel project         | Not linked               | No `.vercel/` in `apps/web/`                                                                                                                                                                     |
| `@vercel/analytics`        | Not installed            | Neither app has it                                                                                                                                                                               |
| `@vercel/speed-insights`   | Not installed            | Neither app has it                                                                                                                                                                               |
| Root `vercel-build` script | Wrong                    | `turbo run build --filter=web` — only builds web, ignores landing                                                                                                                                |
| PostHog                    | Web only                 | Landing has `/ingest/*` rewrites but NO `PHProvider` — dead code                                                                                                                                 |
| Sentry                     | Web only                 | Full setup: client, server, edge configs + `withSentryConfig()` wrapper                                                                                                                          |
| Middleware                 | Web only                 | `apps/web/src/middleware.ts` runs on Vercel Edge Runtime — auth, security, platform-admin gating                                                                                                 |
| Env validation             | Both apps                | `@t3-oss/env-nextjs` + Zod, `SKIP_ENV_VALIDATION` bypass available                                                                                                                               |
| CI perf budgets            | Both apps                | `perf-budgets.json` per app, warn/fail enforcement                                                                                                                                               |
| `.vercelignore`            | Missing                  | No file — Remotion deps, Python services, docs all deployed unnecessarily                                                                                                                        |
| Domain mapping             | Not done                 | No custom domains configured yet                                                                                                                                                                 |
| Workspace packages         | Source imports           | UI, AI, design-tokens, telemetry export from `src/` directly — no build step needed. Next.js transpiles at build time. Only `@smartout/types` and `@smartout/supabase` have `tsc` build scripts. |

### Build Chain (Turborepo `^build` Dependency Order)

```
1. @smartout/types           → tsc → dist/
2. @smartout/supabase        → tsc → dist/
3. @smartout/design-tokens   → no build (source import)
4. @smartout/ui              → no build (source import)
5. @smartout/telemetry       → no build (source import)
6. @smartout/ai              → no build (source import)
7. web / landing             → next build (consumes dist/ from 1-2, src/ from 3-6)
```

### Middleware on Vercel Edge (Web App)

`apps/web/src/middleware.ts` runs automatically on Vercel Edge Runtime:

- Blocks suspicious requests via `detectSuspiciousRequest()`
- Redirects `/` → `/dashboard`
- Refreshes Supabase auth cookies via `updateSession()`
- Gates `/platform-admin` routes — checks `is_super_admin` via service role

**Implication:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` must be available at Edge runtime. Vercel env vars are available to Edge by default — no extra config needed.

---

## Phase 1: Code Changes (Safe — No Dashboard Dependencies)

### Task 1: Create `.vercelignore`

**Files:**

- Create: `.vercelignore` (repo root)

**Step 1: Create the ignore file**

Create `.vercelignore` at repo root:

```
# Python services — deployed separately (DigitalOcean)
services/

# E2E tests — CI only
apps/e2e/

# Documentation — not deployed
docs/

# CI scripts and artifacts — not deployed
scripts/
artifacts/

# Claude Code config
.claude/

# GitHub Actions — not deployed
.github/

# Python AI agents — deployed separately
agents/
```

**Why:** Without this, Vercel includes ~200MB of unused Remotion devDeps (in `node_modules` via root), Python services, docs, and scripts in the deployment package.

**Step 2: Verify gitignore consistency**

Confirm `.vercelignore` doesn't conflict with `.gitignore`. The `.vercelignore` only affects what Vercel packages for deployment, not what git tracks.

**Step 3: Commit**

```bash
git add .vercelignore
git commit -m "chore: add .vercelignore to exclude non-deployed files from Vercel"
```

---

### Task 2: Install Vercel Analytics and Speed Insights Packages

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/landing/package.json`
- Modify: `pnpm-lock.yaml` (auto-updated)

**Step 1: Install packages in web app**

Run from repo root:

```bash
pnpm --filter web add @vercel/analytics @vercel/speed-insights
```

Expected: `@vercel/analytics` and `@vercel/speed-insights` added to `apps/web/package.json` dependencies.

**Step 2: Install packages in landing app**

```bash
pnpm --filter landing add @vercel/analytics @vercel/speed-insights
```

Expected: Same packages added to `apps/landing/package.json` dependencies.

**Step 3: Verify both apps still build**

```bash
pnpm turbo run build
```

Expected: Both apps build successfully. The Vercel components are zero-config — they auto-detect the Vercel environment and render nothing locally.

**Step 4: Commit**

```bash
git add apps/web/package.json apps/landing/package.json pnpm-lock.yaml
git commit -m "feat: add @vercel/analytics and @vercel/speed-insights to both apps"
```

---

### Task 3: Add Vercel Components to Web Root Layout

**Files:**

- Modify: `apps/web/src/app/layout.tsx`

**Step 1: Read the current layout**

Current state (`apps/web/src/app/layout.tsx`):

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PHProvider } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PHProvider>{children}</PHProvider>
      </body>
    </html>
  );
}
```

**Step 2: Add Vercel imports and components**

Update to:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PHProvider } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smartout",
  description: "Employee Readiness System for shift-based businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PHProvider>{children}</PHProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

Changes:

1. Added `Analytics` import from `@vercel/analytics/next`
2. Added `SpeedInsights` import from `@vercel/speed-insights/next`
3. Added `<Analytics />` and `<SpeedInsights />` after `PHProvider` in body
4. Fixed placeholder metadata (was "Create Next App" — the default Next.js boilerplate)

**Vercel React Best Practice note:** Both `<Analytics />` and `<SpeedInsights />` are Server Components that inject a deferred `<script>` tag. They self-optimize — zero client JS overhead until async script loads. This aligns with `bundle-defer-third-party` (load analytics after hydration). Placing them in the root layout is the correct Vercel pattern.

**Step 3: Verify build**

```bash
pnpm --filter web build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat: add Vercel Analytics and Speed Insights to web layout"
```

---

### Task 4: Add Vercel Components to Landing Root Layout

**Files:**

- Modify: `apps/landing/src/app/layout.tsx`

**Step 1: Read the current layout**

Current state (`apps/landing/src/app/layout.tsx`):

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartOut - Møt fremtidens workforce management",
  description: "AI-drevet workforce management for den norske serveringsbransjen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body
        className={`${geistSans.className} bg-zinc-950 text-white antialiased selection:bg-orange-500/30`}
      >
        {children}
      </body>
    </html>
  );
}
```

**Step 2: Add Vercel imports and components**

Update to:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartOut - Møt fremtidens workforce management",
  description: "AI-drevet workforce management for den norske serveringsbransjen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body
        className={`${geistSans.className} bg-zinc-950 text-white antialiased selection:bg-orange-500/30`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

Changes:

1. Added `Analytics` import from `@vercel/analytics/next`
2. Added `SpeedInsights` import from `@vercel/speed-insights/next`
3. Added `<Analytics />` and `<SpeedInsights />` at end of body

**Step 3: Verify build**

```bash
pnpm --filter landing build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add apps/landing/src/app/layout.tsx
git commit -m "feat: add Vercel Analytics and Speed Insights to landing layout"
```

---

### Task 5: Remove Dead PostHog Rewrites from Landing

**Files:**

- Modify: `apps/landing/next.config.ts`

**Step 1: Read the current config**

Current state (`apps/landing/next.config.ts`):

```typescript
import type { NextConfig } from "next";

// This will force validation of the .env on start/build
import "./src/env";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
};

export default nextConfig;
```

**Problem:** Landing has PostHog rewrites but NO PostHog provider (`PHProvider`), no `posthog-js` dependency, and no tracking code. These rewrites are dead code — they proxy requests to PostHog EU but nothing in the app sends those requests.

**Step 2: Remove the dead rewrites**

Update to:

```typescript
import type { NextConfig } from "next";

// This will force validation of the .env on start/build
import "./src/env";

const nextConfig: NextConfig = {};

export default nextConfig;
```

**Note:** If PostHog is needed on landing later, re-add the rewrites AND add a `PHProvider`. The web app (`apps/web/next.config.ts`) keeps its rewrites — they're actively used there.

**Step 3: Verify build**

```bash
pnpm --filter landing build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/landing/next.config.ts
git commit -m "chore: remove dead PostHog rewrites from landing — no PostHog provider exists"
```

---

## Phase 2: Vercel Dashboard Configuration (Manual — Must Complete Before Phase 3)

### Task 6: Create and Configure Vercel Projects

> This task is done in the Vercel Dashboard. No code changes.

**Step 1: Audit existing Vercel project**

The file `apps/landing/.vercel/project.json` shows:

```json
{
  "projectId": "prj_QrU6ffv3oPoDnOygHt9owIQQaGdH",
  "orgId": "team_bbtw5JnNxRkKlecAKQB7qqzG",
  "projectName": "web"
}
```

Decision: Rename this project to `smartout-landing` in the Vercel dashboard, or delete and recreate. The project name `"web"` is misleading.

**Step 2: Configure the Landing project**

In Vercel Dashboard → Project Settings:

| Setting              | Value                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Name**             | `smartout-landing`                                                                            |
| **Framework Preset** | Next.js                                                                                       |
| **Root Directory**   | `.` (monorepo root)                                                                           |
| **Build Command**    | `turbo run build --filter=landing`                                                            |
| **Output Directory** | `apps/landing/.next`                                                                          |
| **Install Command**  | (leave default — Vercel auto-detects pnpm from `packageManager` field in root `package.json`) |
| **Node.js Version**  | 20.x                                                                                          |

**Step 3: Create the Web project**

In Vercel Dashboard → New Project → Import same repo:

| Setting              | Value                          |
| -------------------- | ------------------------------ |
| **Name**             | `smartout-web`                 |
| **Framework Preset** | Next.js                        |
| **Root Directory**   | `.` (monorepo root)            |
| **Build Command**    | `turbo run build --filter=web` |
| **Output Directory** | `apps/web/.next`               |
| **Install Command**  | (leave default)                |
| **Node.js Version**  | 20.x                           |

**Why Root Directory = `.`:** This is the standard Turborepo + Vercel pattern. Vercel installs from monorepo root (gets pnpm workspace, lockfile, all packages), then runs the filtered build command. Using `cd ../..` from a subdirectory is fragile and non-standard.

**Step 4: Verify Ignored Build Step**

Both projects should skip builds when only unrelated files change. Vercel's built-in Turborepo detection handles this automatically when Root Directory is `.` and the build uses `turbo run build --filter=<app>`. No manual config needed.

If auto-detection doesn't work, set custom "Ignored Build Step" command:

- Landing: `npx turbo-ignore landing`
- Web: `npx turbo-ignore web`

---

### Task 7: Map Domains

> This task is done in the Vercel Dashboard and your DNS provider.

**Step 1: Configure Landing domains**

In Vercel Dashboard → `smartout-landing` → Settings → Domains:

- Add `smartout.ai` (primary)
- Add `www.smartout.ai` (redirect to `smartout.ai`)

**Step 2: Configure Web domains**

In Vercel Dashboard → `smartout-web` → Settings → Domains:

- Add `app.smartout.ai`

**Step 3: Update DNS records**

At your DNS provider (wherever `smartout.ai` is registered):

| Type  | Name  | Value                  | TTL |
| ----- | ----- | ---------------------- | --- |
| A     | `@`   | `76.76.21.21`          | 300 |
| CNAME | `www` | `cname.vercel-dns.com` | 300 |
| CNAME | `app` | `cname.vercel-dns.com` | 300 |

**Step 4: Verify SSL**

Vercel auto-provisions SSL. Verify in Dashboard → Domains that all three show "Valid Configuration" with green checkmark.

---

### Task 8: Configure Environment Variables in Vercel

> Set env vars per project based on each app's `src/env.ts` validation schema.

**Step 1: Set Web project env vars**

In Vercel Dashboard → `smartout-web` → Settings → Environment Variables:

| Variable                        | Environments        | Source                     | Notes                                           |
| ------------------------------- | ------------------- | -------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Production, Preview | Supabase project URL       | Used by middleware (Edge Runtime)               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Supabase anon key          | Used by middleware (Edge Runtime)               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Production only     | 1Password                  | Used by middleware for platform-admin gating    |
| `NEXT_PUBLIC_POSTHOG_KEY`       | Production, Preview | PostHog project            |                                                 |
| `NEXT_PUBLIC_POSTHOG_HOST`      | Production, Preview | `https://eu.i.posthog.com` |                                                 |
| `STRIPE_SECRET_KEY`             | Production only     | 1Password                  | Must start with `sk_`                           |
| `STRIPE_WEBHOOK_SECRET`         | Production only     | 1Password                  | Must start with `whsec_`                        |
| `SENDGRID_API_KEY`              | Production only     | 1Password                  | Must start with `SG.`                           |
| `OPENROUTER_API_KEY`            | Production only     | 1Password                  | For AI agents                                   |
| `SENTRY_DSN`                    | Production only     | Sentry project             | Server-side error tracking                      |
| `NEXT_PUBLIC_SENTRY_DSN`        | Production, Preview | Sentry project             | Client-side error tracking                      |
| `SENTRY_AUTH_TOKEN`             | Production, Preview | Sentry project             | **Required for source map upload during build** |
| `SENTRY_ORG`                    | Production, Preview | `smartout`                 | Sentry org slug                                 |
| `SENTRY_PROJECT`                | Production, Preview | `web`                      | Sentry project slug                             |
| `UPSTASH_REDIS_REST_URL`        | Production only     | Upstash console            | Rate limiting                                   |
| `UPSTASH_REDIS_REST_TOKEN`      | Production only     | Upstash console            | Rate limiting                                   |
| `ULTRAVOX_API_KEY`              | Production only     | 1Password                  | Voice AI                                        |
| `DOCUSEAL_WEBHOOK_SECRET`       | Production only     | 1Password                  | Contract webhooks                               |

**Sentry source maps:** The `withSentryConfig()` wrapper in `apps/web/next.config.ts` uploads source maps at build time. Without `SENTRY_AUTH_TOKEN`, builds succeed but production error traces will be unreadable (no source maps in Sentry).

**Step 2: Set Landing project env vars**

In Vercel Dashboard → `smartout-landing` → Settings → Environment Variables:

| Variable                        | Environments        | Source                     | Notes                         |
| ------------------------------- | ------------------- | -------------------------- | ----------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Production, Preview | Supabase project URL       |                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Supabase anon key          |                               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Production only     | 1Password                  |                               |
| `NEXT_PUBLIC_WEB_APP_URL`       | Production, Preview | `https://app.smartout.ai`  | Link to dashboard             |
| `NEXT_PUBLIC_POSTHOG_KEY`       | Production, Preview | PostHog project            | For future PostHog on landing |
| `NEXT_PUBLIC_POSTHOG_HOST`      | Production, Preview | `https://eu.i.posthog.com` |                               |
| `STRIPE_SECRET_KEY`             | Production only     | 1Password                  |                               |
| `ULTRAVOX_API_KEY`              | Production only     | 1Password                  | Voice wizard                  |
| `INTERVJU_MCP_WEBHOOK_SECRET`   | Production only     | 1Password                  | Interview MCP integration     |

**Step 3: Set Preview-specific overrides**

For Preview deployments, override `NEXT_PUBLIC_SUPABASE_URL` to point to a staging Supabase project (if you have one), or keep it pointing to production with caution. Preview deployments with production Supabase means preview actions affect real data.

---

### Task 9: Enable Speed Insights and Web Analytics in Vercel Dashboard

> The SDK packages installed in Tasks 2-4 only send data if these features are enabled in the dashboard.

**Step 1: Enable for Web project**

In Vercel Dashboard → `smartout-web`:

- Go to **Analytics** tab → Enable Web Analytics
- Go to **Speed Insights** tab → Enable Speed Insights

**Step 2: Enable for Landing project**

In Vercel Dashboard → `smartout-landing`:

- Go to **Analytics** tab → Enable Web Analytics
- Go to **Speed Insights** tab → Enable Speed Insights

**Step 3: Verify data flow**

After first deployment, check both dashboards show incoming data:

- Analytics: should show page views within minutes
- Speed Insights: should show Core Web Vitals (LCP, INP, CLS) within ~30 minutes

---

## Phase 3: Code Cleanup (Depends on Phase 2 Completion)

### Task 10: Remove Root `vercel-build` Script

> **PREREQUISITE:** Task 6 must be complete (Build Command set per-project in Vercel Dashboard). Without dashboard config, removing this script causes Vercel to fall back to the root `build` script which uses `op run` (1Password CLI) — instant build failure.

**Files:**

- Modify: `package.json` (root)

**Step 1: Read current script**

Current (`package.json` line 7):

```json
"vercel-build": "turbo run build --filter=web",
```

Problem: This only builds web. Each Vercel project now has its own Build Command in the dashboard (Task 6), making this script a misleading legacy artifact.

**Step 2: Remove the vercel-build script**

Delete the `vercel-build` line from root `package.json` scripts.

Updated scripts section:

```json
"scripts": {
    "build": "op run --env-file=.env.template -- turbo run build",
    "dev": "op run --env-file=.env.template -- turbo run dev",
    "dev:local": "turbo run dev",
    "lint": "turbo run lint",
    ...
}
```

**Step 3: Verify Vercel still builds**

Trigger a test deployment in both Vercel projects (push to a branch, or use Vercel CLI):

```bash
# If Vercel CLI is installed:
vercel --cwd . --yes
```

Expected: Build uses dashboard-configured Build Command, not the removed script.

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: remove legacy vercel-build script — build configured per-project in Vercel dashboard"
```

---

## Phase 4: Documentation

### Task 11: Write ADR-0020 for Vercel Hosting Strategy

**Files:**

- Create: `docs/decisions/0020-vercel-hosting-strategy.md`
- Modify: `docs/decisions/0000-decision-log.md` (add entry)
- Modify: `CLAUDE.md` (add to ADR table)

**Step 1: Write the ADR**

Create `docs/decisions/0020-vercel-hosting-strategy.md`:

```markdown
---
id: "0020"
title: Vercel Hosting with Dual-Project Split
status: Accepted
date: 2026-02-28
---

# ADR-0020: Vercel Hosting with Dual-Project Split

## Context and Problem Statement

Smartout has two independent Next.js applications (web dashboard and landing page) in a monorepo. Both need production hosting with performance monitoring, preview deployments, and domain mapping. The existing CI pipeline provides build-time quality gates but lacks runtime performance data from real users.

## Decision Drivers

- Two apps need independent deployment lifecycles (landing can ship without affecting dashboard)
- Need real-user Core Web Vitals (LCP, INP, CLS) beyond synthetic CI perf budgets
- Existing PostHog handles product analytics; need infrastructure-level metrics
- Preview deployments needed for stakeholder QA before production promotion
- Monorepo structure requires build isolation per project
- Web app middleware (auth, security) runs on Vercel Edge Runtime

## Considered Options

1. **Single Vercel project with path rewrites** — route `/app/*` to web, everything else to landing
2. **Two Vercel projects from same repo** — independent build commands, domains, env vars
3. **Vercel (landing) + different host (web)** — split hosting providers

## Decision Outcome

Option 2: Two independent Vercel projects from the same monorepo repository.

- `smartout-web` → `app.smartout.ai` (dashboard)
- `smartout-landing` → `smartout.ai` (marketing site)

### Build Configuration (per project)

| Setting          | smartout-web                   | smartout-landing                   |
| ---------------- | ------------------------------ | ---------------------------------- |
| Root Directory   | `.`                            | `.`                                |
| Build Command    | `turbo run build --filter=web` | `turbo run build --filter=landing` |
| Output Directory | `apps/web/.next`               | `apps/landing/.next`               |
| Node.js          | 20.x                           | 20.x                               |

Root Directory = `.` (monorepo root) is the standard Turborepo + Vercel pattern. Vercel installs from monorepo root, then runs the filtered Turbo build. Turbo's `^build` dependency ensures workspace packages (`@smartout/types`, `@smartout/supabase`) are compiled before the target app.

### Instrumentation

Both apps include `@vercel/analytics` and `@vercel/speed-insights` in their root layout. These are Server Components that inject a deferred `<script>` tag — zero client JS overhead until async load. They complement (not replace) existing PostHog product analytics and Sentry error tracking.

### Edge Runtime

Web middleware (`apps/web/src/middleware.ts`) runs on Vercel Edge Runtime automatically. It requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` at Edge runtime. Vercel env vars are available to Edge by default.

## Rules & Consequences

- Root `vercel-build` script removed — each project uses Build Command from Vercel dashboard
- Environment variables set per-project, matching each app's `src/env.ts` schema
- `SENTRY_AUTH_TOKEN` required in web project for source map uploads during build
- CI remains the quality gate (lint, typecheck, build, perf budgets); Vercel Preview is the release gate
- `.vercelignore` excludes non-deployed files (services/, docs/, scripts/, agents/)
- Weekly review cadence for Speed Insights and Web Analytics dashboards
```

**Step 2: Register in decision log**

Add to `docs/decisions/0000-decision-log.md`:

```markdown
| ADR-0020 | 28-02-2026 | [Vercel Hosting with Dual-Project Split](./0020-vercel-hosting-strategy.md) | **Accepted** |
```

**Step 3: Update CLAUDE.md ADR table**

Add to the ADR table in `CLAUDE.md`:

```markdown
| 0020 | Vercel Hosting with Dual-Project Split | Hosting |
```

**Step 4: Commit**

```bash
git add docs/decisions/0020-vercel-hosting-strategy.md docs/decisions/0000-decision-log.md CLAUDE.md
git commit -m "docs: ADR-0020 Vercel Hosting with Dual-Project Split"
```

---

### Task 12: Define Operations Report Cadence

**Files:**

- Create: `docs/cross-cutting/vercel-operations-review.md`

**Step 1: Write the operations review guide**

Create `docs/cross-cutting/vercel-operations-review.md`:

```markdown
# Vercel Operations Review

## Weekly Review (per project: smartout-web, smartout-landing)

### Speed Insights (Core Web Vitals — real user data)

- [ ] LCP < 2.5s (good), flag > 4.0s (poor)
- [ ] INP < 200ms (good), flag > 500ms (poor)
- [ ] CLS < 0.1 (good), flag > 0.25 (poor)
- [ ] Identify route outliers (slowest 3 routes)
- [ ] Compare with previous week — flag regressions > 10%

### Web Analytics

- [ ] Top 10 pages by views
- [ ] Bounce rate by route (flag > 70% on key pages)
- [ ] Referrer distribution
- [ ] Geographic distribution (Norway should be dominant)

### Observability

- [ ] Error rate trend (flag > 1% of requests)
- [ ] Slowest serverless functions (flag > 3s p95)
- [ ] Middleware latency (web app Edge functions)
- [ ] External API latency (Supabase, Stripe, PostHog)
- [ ] Failed deployment count

### Cross-Reference with Existing Tools

- [ ] Compare Vercel error rate with Sentry error volume (web app)
- [ ] Compare Vercel page views with PostHog events (web app)
- [ ] Verify CI perf budgets align with real-user Speed Insights data

## Monthly Optimization Pass

- [ ] Review route-level perf budgets vs. real-user Speed Insights data
- [ ] Update `perf-budgets.json` if budgets are consistently too loose or tight
- [ ] Identify top 3 routes for optimization
- [ ] Cross-reference with PostHog feature usage — optimize high-traffic routes first
- [ ] Update CI enforcement thresholds if needed
- [ ] Review Vercel function duration and memory — right-size if needed

## Escalation Triggers

| Metric                   | Threshold          | Action                                      |
| ------------------------ | ------------------ | ------------------------------------------- |
| LCP p75                  | > 4.0s for 3+ days | Investigate and create Linear issue         |
| Error rate               | > 2% for 1+ day    | Immediate investigation                     |
| Function cold start      | > 5s               | Review bundle size, consider edge runtime   |
| Middleware latency       | > 100ms p95        | Review middleware logic, consider splitting |
| Deployment failure       | 2+ consecutive     | Check build logs, rollback if needed        |
| Sentry unresolved errors | > 10 new in 24h    | Triage and prioritize                       |
```

**Step 2: Commit**

```bash
git add docs/cross-cutting/vercel-operations-review.md
git commit -m "docs: add Vercel operations review cadence"
```

---

## Task Summary

| #   | Task                                      | Type                     | Phase | Depends On            |
| --- | ----------------------------------------- | ------------------------ | ----- | --------------------- |
| 1   | Create `.vercelignore`                    | Code                     | 1     | —                     |
| 2   | Install Vercel packages                   | Code                     | 1     | —                     |
| 3   | Add components to web layout              | Code                     | 1     | Task 2                |
| 4   | Add components to landing layout          | Code                     | 1     | Task 2                |
| 5   | Remove dead PostHog rewrites from landing | Code                     | 1     | —                     |
| 6   | Create/configure Vercel projects          | Manual (Dashboard)       | 2     | —                     |
| 7   | Map domains + DNS                         | Manual (Dashboard + DNS) | 2     | Task 6                |
| 8   | Configure environment variables           | Manual (Dashboard)       | 2     | Task 6                |
| 9   | Enable Speed Insights + Web Analytics     | Manual (Dashboard)       | 2     | Task 6                |
| 10  | Remove root `vercel-build` script         | Code                     | 3     | **Task 6 (CRITICAL)** |
| 11  | Write ADR-0020                            | Docs                     | 4     | —                     |
| 12  | Write operations review guide             | Docs                     | 4     | —                     |

### Execution Strategy

**Phase 1 (Code — Tasks 1-5):** Safe to execute immediately. No Vercel dashboard dependencies. Can be automated by Claude.

**Phase 2 (Manual — Tasks 6-9):** Requires you in the Vercel Dashboard and DNS provider. Do this after Phase 1 code is committed and pushed.

**Phase 3 (Code — Task 10):** Remove `vercel-build` ONLY after confirming Build Command is set per-project in dashboard (Task 6). This is the critical dependency.

**Phase 4 (Docs — Tasks 11-12):** Can be done anytime. No dependencies.

### Parallel Execution Opportunities

- Tasks 1, 2, 5 can run in parallel (no dependencies between them)
- Tasks 3 and 4 can run in parallel after Task 2
- Tasks 6, 11, 12 can run in parallel
- Tasks 7, 8, 9 can run in parallel after Task 6
