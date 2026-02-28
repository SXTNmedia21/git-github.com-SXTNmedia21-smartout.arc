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
