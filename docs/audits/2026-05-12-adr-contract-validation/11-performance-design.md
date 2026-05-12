---
title: "Audit Slice 11 — Performance Design (ADR-0019)"
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, performance-design, adr]
---

# Audit Slice 11 — Performance Design

**ADR in scope:** ADR-0019 (Performance and Build Governance System)
**Surfaces checked:** `apps/web/next.config.ts`, `packages/design-tokens/`, `apps/web/src/app/globals.css`, `docs/architecture/cross-cutting/performance-governance.md`
**Auditor:** claude-sonnet-4-6
**Date:** 2026-05-12

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH     | 1 |
| MEDIUM   | 1 |
| LOW      | 1 |

---

## Findings

### PERF-001 — `typescript.ignoreBuildErrors: true` silently hides type failures from production builds [CRITICAL]

**File:** `apps/web/next.config.ts:192`
**ADR:** ADR-0019 (build health governance — prevents build quality drift)

`next.config.ts` sets `typescript.ignoreBuildErrors: true` under a comment explaining it was added as a "first-rollout" workaround on 2026-05-04 to tolerate a "merge-induced telemetry-brand gap." The comment promises type errors "still surface in dev/CI" — but `next build` itself will not fail on type errors, which means the `build-health` CI job (which calls `pnpm build:health`, a static analysis script) cannot catch type-level regressions introduced between typecheck and the final production bundle. The ADR mandates CI gating on build quality. A permanently set `ignoreBuildErrors` undermines the production-build gate that is half the point of the system.

**Evidence:** `ignoreBuildErrors: true` with no expiry comment or ADR exemption registered.

**Recommended fix:** Resolve the telemetry-brand gap type errors and remove the flag, or register a formal exemption with an `exemptionExpiresOn` date in the ADR/governance doc.

---

### PERF-002 — `perf-budgets` CI job absent from `ci.yml` [HIGH]

**File:** `.github/workflows/ci.yml` (no matching job)
**ADR:** ADR-0019 §Implementation Notes — "CI jobs: `perf-budgets` (warn mode initially)"

ADR-0019 mandates a `perf-budgets` CI job that runs `scripts/perf/audit.mjs` against both `apps/web/perf-budgets.json` and `apps/landing/perf-budgets.json`. The `build-health` job exists (line 102) and runs `pnpm build:health`. However, no `perf-budgets` job is present anywhere in `ci.yml` or the other workflow files. The root `package.json` has `perf:audit:web`, `perf:audit:landing`, and `perf:audit` scripts wired to the audit script — but they are never invoked from CI. The `scripts/perf/audit.mjs` script correctly reads `PERF_ENFORCEMENT` (defaulting to `warn`) and can fail in `fail` mode, but that gate never fires automatically.

**Evidence:** `grep -n "perf"` against `ci.yml` returns zero results. `package.json:22-24` shows the scripts exist but are not called from any workflow.

**Recommended fix:** Add a `perf-budgets` job to `ci.yml` that runs `pnpm perf:audit` with `PERF_ENFORCEMENT: warn` on PRs and `PERF_ENFORCEMENT: fail` on push to `development`.

---

### PERF-003 — `perf-budgets.json` route coverage is minimal [MEDIUM]

**File:** `apps/web/perf-budgets.json`
**ADR:** ADR-0019 — "Route budgets: `apps/web/perf-budgets.json`" covering all routes

The `apps/web/perf-budgets.json` file covers only 4 routes: `/`, `/dashboard`, `/dashboard/schedule`, `/login`. The dashboard surface now includes routes such as `/dashboard/year-wheel`, `/dashboard/my-salary`, `/dashboard/website`, `/platform-admin/**`, and the onboarding wizard flows — none of which appear in the budget file. ADR-0019 requires the performance governance owner to maintain budgets for all routes and update them when route complexity changes. The current file represents the initial baseline from the ADR's creation date (2026-02-28) and has not been extended.

**Evidence:** `apps/web/perf-budgets.json` has 4 routes; live app has significantly more dashboard routes with heavy UI (year-wheel SVG canvas, DnD schedule, Tiptap editor, voice components).

**Recommended fix:** Extend `perf-budgets.json` to cover high-complexity routes (`/dashboard/year-wheel`, `/dashboard/schedule/*`, `/onboarding`, `/join`, `/platform-admin/dashboard`) with appropriate thresholds. Assign route owners per the governance doc's ownership table.

---

### PERF-004 — design-tokens package has no build step; exports raw `.ts` source [LOW]

**File:** `packages/design-tokens/package.json:5-9`
**ADR:** ADR-0019 (design-tokens correctness is a build-health concern)

`packages/design-tokens/package.json` declares `"main": "src/index.ts"` and all `exports` point to `.ts` source files, not compiled `.js` output. There is no `build` script — only `lint`, `typecheck`, and `clean`. The package is listed in `apps/web/next.config.ts:90` under `transpilePackages`, which means Next.js/webpack transpiles it at build time, so this works. However, it creates a gap: any consumer outside the Next.js transpile boundary (e.g., a future React Native surface or a standalone Node script) would fail to import the package because raw TypeScript is not directly executable. The `native.ts` export is intended for mobile (`packages/design-tokens/src/native.ts`) but the `exports` map exposes `"./native": "./src/native.ts"` — still raw TS.

**Evidence:** `package.json` has no `build` script and `exports` entries end in `.ts`. ADR-0019 notes design-tokens package correctness as a build-health concern.

**Recommended fix:** Add a `build` script (`tsc --outDir dist` or `tsup`) and update `exports` to point to `dist/`. Until mobile consumption is in scope, document the transpilePackages dependency explicitly in the package README to prevent silent breakage if a consumer is added outside the transpile boundary.

---

## Conformance

| Requirement | Status |
|---|---|
| Tailwind v4 CSS-config (no `tailwind.config.ts` at app root) | PASS — no `tailwind.config.ts` found anywhere in the repo outside node_modules |
| `globals.css` uses `@import "tailwindcss"` (v4 pattern) | PASS — line 1 |
| design-tokens packaged and importable | PASS (with caveat — see PERF-004) |
| `optimizePackageImports` in `next.config.ts` | PASS — 13 packages listed (lines 43-57) |
| `serverExternalPackages` for browser-only deps | PASS — `posthog-node` and `livekit-client` correctly excluded |
| Turbopack + webpack aliases for `@smartout/ai` subpaths | PASS — both `turbopack.resolveAlias` and `config.resolve.alias` maintained in parallel |
| `Suspense` boundaries on heavy routes | PASS — year-wheel, my-salary, website SectionForm all use `<Suspense>` with fallbacks |
| `Promise.all` for parallel async ops | PASS — `dashboard/layout.tsx:98` uses `Promise.all([profile, wsData])` |
| `next/dynamic` for heavy components | PASS — `dashboard/page.tsx` and `dashboard/query-provider.tsx` use `dynamic` |
| Route budget files exist for both apps | PASS (files exist; coverage gap is PERF-003) |
| `perf-budgets` CI job present | FAIL — PERF-002 |
| `build-health` CI job present | PASS — `ci.yml:102` |
| `prefers-reduced-motion` respected | PASS — `globals.css:350-354` disables `animate-glow-pulse` |
