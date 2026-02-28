---
id: "0020"
title: Vercel Hosting with Dual-Project Split
status: Accepted
date: 2026-02-28
layer: decision
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

| Setting            | smartout-web                                   | smartout-landing                                   |
| ------------------ | ---------------------------------------------- | -------------------------------------------------- |
| Root Directory     | `apps/web`                                     | `apps/landing`                                     |
| Framework Preset   | Next.js                                        | Next.js                                            |
| Install Command    | `cd ../.. && pnpm install`                     | `cd ../.. && pnpm install`                         |
| Build Command      | `cd ../.. && npx turbo run build --filter=web` | `cd ../.. && npx turbo run build --filter=landing` |
| Output Directory   | _(default — Vercel auto-detects .next)_        | _(default — Vercel auto-detects .next)_            |
| Ignored Build Step | `npx turbo-ignore --fallback=HEAD^1`           | `npx turbo-ignore --fallback=HEAD^1`               |
| Node.js            | 20.x                                           | 20.x                                               |

**Root Directory = app dir** (not monorepo root). Vercel auto-detects the pnpm monorepo and hoists installation to the workspace root. The Install and Build commands use `cd ../..` to reach the monorepo root for pnpm install and Turbo builds. Turbo's `^build` dependency ensures workspace packages (`@smartout/types`, `@smartout/ai`) are compiled before the target app.

> **Note:** Setting Root Directory to `.` (monorepo root) caused "No Next.js version detected" because root `package.json` lacks `next`. The `cd ../..` pattern is the correct approach for Turborepo monorepos on Vercel.

### Instrumentation

Both apps include `@vercel/analytics` and `@vercel/speed-insights` in their root layout. These are Server Components that inject a deferred `<script>` tag — zero client JS overhead until async load. They complement (not replace) existing PostHog product analytics and Sentry error tracking.

### Edge Runtime

Web middleware (`apps/web/src/middleware.ts`) runs on Vercel Edge Runtime automatically. It requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` at Edge runtime. Vercel env vars are available to Edge by default.

## Rules & Consequences

- Root `vercel-build` script removed — each project uses Build Command from Vercel dashboard
- Environment variables set per-project, matching each app's `src/env.ts` schema
- `SENTRY_AUTH_TOKEN` required in web project for source map uploads during build
- CI remains the quality gate (lint, typecheck, build, perf budgets); Vercel Preview is the release gate
- `.vercelignore` patterns **must use leading `/`** to anchor to monorepo root — unanchored patterns match at any depth and can silently remove app source files (e.g., `docs/` would also remove `apps/landing/src/app/docs/`)
- `turbo-ignore --fallback=HEAD^1` skips builds when the app's files haven't changed; changes to shared packages trigger both projects
- Web middleware security checks must account for Vercel's reverse proxy headers (`x-forwarded-host` is always present — see Learning-0008)
- Weekly review cadence for Speed Insights and Web Analytics dashboards

## Deployment Learnings

Captured during initial deploy (2026-02-28):

1. **Root Directory must be app dir, not `.`** — Vercel needs `next` in the detected `package.json`. Use `cd ../..` in Install/Build commands to reach monorepo root.
2. **`.vercelignore` depth matching** — Without leading `/`, gitignore patterns match at any depth. `/docs/` excludes only root `docs/`; `docs/` also excludes `apps/landing/src/app/docs/`.
3. **pnpm version** — Vercel respects `packageManager` field in root `package.json`. Keep it pinned to `pnpm@9.15.9`.
4. **`x-forwarded-host` header** — Vercel always sets this. Security middleware that flags it as suspicious will block 100% of production requests with 400.
5. **Turbo `^build` chain** — `typescript-config → types/supabase → ai → web/landing`. All four Turbo tasks must succeed.
