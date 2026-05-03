---
title: "Slice 11 — Performance Governance + Nordic Split Design Tokens"
status: done
created: 2026-05-02
updated: 2026-05-02
module: cross-cutting
tags: [audit, performance, design-tokens, adr-0019, turbopack, nordic-split]
---

# Slice 11 — Performance Governance + Nordic Split Design Tokens

## Summary (top 5)

1. **Turbopack switch is BLOCKED** — `next.config.ts:88–149` has a webpack-only `config.resolve.alias` block with 12 `@smartout/ai/*` subpath aliases. These never fire in Turbopack builds. The `turbopack.resolveAlias` block at lines 60–75 mirrors them, but the webpack block is not guarded/removed. Concurrent existence means webpack builds use file aliases, Turbopack uses `resolveAlias` — behavior is not proven equivalent. STATE-SUMMARY P1.5 calls this the Wave 1 follow-up blocker.
2. **`perf-budgets` CI job is ABSENT** — ADR-0019 mandates a `perf-budgets` CI job (warn → fail enforcement via `PERF_ENFORCEMENT`). The `build-health` job exists and uploads artifacts, but no route-budget check job exists. The enforcement model is documented but not wired in CI.
3. **Hardcoded zinc/gray/slate debt is near-zero** — The 140-file count from memory is stale. Grep for actual Tailwind-namespaced color classes (`bg-zinc-`, `text-gray-`, etc.) returns 0 files. The 15 files with "zinc" in them reference it only in comments (design rule reminders: "no zinc/gray/slate"). The design token migration appears substantially complete.
4. **`React.cache()` is well adopted** — `apps/web/src/app/dashboard/_data/queries.ts` wraps all 7 server-side data fetchers in `cache()`. Pattern is consistent.
5. **Sentry instrumentation skips non-production** — `instrumentation.ts:4` returns early if `NODE_ENV !== 'production'`. This is correct (cuts build noise) but means development errors never reach Sentry. Acceptable tradeoff per STATE-SUMMARY P1.5 assessment.

---

## Perf Governance Check Table

| Rule | Status | Evidence |
|---|---|---|
| `Promise.all()` for independent async | PASS | `api/botsson/chat`, `api/contracts`, `api/emma/voice` all use `Promise.all`; dashboard queries use `cache()` dedup |
| Direct imports (no app-level barrels) | PARTIAL | 14 `index.ts` barrel files exist in `apps/web/src`. Most are UI primitive groups (`forms/`, `helpdesk-orb/`, `cascade/`) — low-risk. Action adapters (`billing/_actions/*/index.ts`) and `dashboard/contexts/index.ts` are higher-risk barrel re-exports |
| `next/dynamic` for heavy components | PASS | 22 files use dynamic imports. Recharts (`PeopleSection`, `StaffingSection`, etc.), TipTap, LiveKit `CallRoom.tsx` — all in `"use client"` components. No SSR-heavy direct imports found in page server components |
| `<Suspense>` boundaries | PASS | 36 files use `<Suspense>`. Coverage appears broad across dashboard routes |
| `React.cache()` for request dedup | PASS | All 7 dashboard server data fetchers in `queries.ts` use `cache()`. Help queries also wrapped |
| `optimizePackageImports` | PASS | `next.config.ts:43–57` lists 14 packages (lucide, framer-motion, recharts, dnd-kit, tiptap, sonner, etc.) |
| Route budgets (perf-budgets.json) | PARTIAL | Files exist at `apps/web/perf-budgets.json` + `apps/landing/perf-budgets.json`. CI job (`perf-budgets`) to enforce them is ABSENT |
| CI enforcement (`PERF_ENFORCEMENT`) | FAIL | No CI workflow references `PERF_ENFORCEMENT`. `build-health` job runs but does not gate on route budgets |
| Sentry instrumentation (Next 16 pattern) | PASS | `instrumentation.ts` uses `register()` + `onRequestError = Sentry.captureRequestError` — correct Next 16 pattern. Source-map upload gated to `VERCEL_ENV === 'production'` only |

---

## Hardcoded Color Debt — Top 10

**Finding: The 140-file debt from memory is stale.**

Precise grep for Tailwind-namespaced hardcoded classes (`bg-zinc-N`, `text-gray-N`, `border-slate-N`, etc.): **0 files**.

Files that contain the string "zinc" in `apps/web/src`: **15 files**, all in comments only (design rule reminders such as `"no zinc/gray/slate"` or `"warm OKLCH via CSS variables only. No zinc/gray/slate."`).

The `orange-500/200/900` classes appear in `DayTimelineStrip.tsx:289` (timeline progress indicator) — these are semantic brand colors, not the zinc/gray/slate palette violation class.

**Conclusion:** Nordic Split token migration is substantially complete. No active zinc/gray/slate violations in production code. The 140-file count was accurate at time of writing (pre-migration campaign) and is now resolved.

---

## Turbopack Readiness

| Item | Status | Detail |
|---|---|---|
| `--webpack` flag dropped from dev scripts | PASS | No `--webpack` or `--turbo` flag in `apps/web/package.json` or `apps/landing/package.json` dev scripts |
| Webpack alias block still present | BLOCKER | `next.config.ts:88–149` — 12 `@smartout/ai/*` aliases via `config.resolve.alias`. Not gated. Fires on webpack builds only |
| Turbopack `resolveAlias` block | EXISTS | `next.config.ts:60–75` mirrors same 12 aliases for Turbopack. Dual-presence is untested for equivalence |
| `posthog-node` client-side external | PRESENT | `next.config.ts:93–98` guards `posthog-node` as external for client builds — webpack only, no Turbopack equivalent |
| `serverExternalPackages` | PASS | `posthog-node` listed at line 59 |
| Wave 1 follow-up resolution path | PENDING | STATE-SUMMARY offers 3 options: (a) test Turbopack subpath-exports on Next 16.1.6 directly, (b) port webpack block to `turbopack.resolveAlias` and remove webpack block, (c) keep webpack. Option (b) is the safe path — webpack block at lines 88–149 should be deleted once Turbopack `resolveAlias` is verified |

**Turbopack verdict: NOT READY.** The dual alias configuration is risk-bearing. The webpack block at `next.config.ts:88–149` must be removed (or guarded with `if (!options.nextRuntime?.startsWith('turbopack'))`) before switching Vercel builds to Turbopack.

---

## Nordic Split Token Health

| Item | Status | Detail |
|---|---|---|
| `tokens.css` imported in `globals.css` | PASS | `globals.css:2` — `@import "@smartout/design-tokens/tokens.css"` |
| CSS variables in `@theme inline` | PASS | All semantic tokens (`--color-background`, `--color-primary`, sidebar, chart, domain tokens) mapped via `var()` references |
| Domain tokens (dept, status, brand) | PASS | `dept-kitchen`, `dept-floor`, `dept-bar`, `status-trainee/active`, `brand-orange` all present |
| Komm semantic colors | PASS | 18 `--color-komm-*` tokens present in globals.css |
| Onboarding temperature tokens | PASS | 9 `--color-onboarding-*` OKLCH tokens defined inline in globals.css |
| OKLCH warm palette (hue 50–60) | PASS | `tokens.css` uses `oklch(0.99 0.004 60)` for background — consistent with Nordic Split spec |
| No hardcoded zinc/gray/slate in app code | PASS | 0 violations found |

---

## Critical Regressions

**HIGH — CI perf-budget enforcement gap**
ADR-0019 specifies a `perf-budgets` CI job with `PERF_ENFORCEMENT=warn|fail`. The `perf-budgets.json` files exist but no CI job enforces them. Route regressions will not be caught in CI. This has likely been the state since ADR-0019 was written (2026-02-28).

**MEDIUM — Turbopack webpack alias block not cleaned up**
`next.config.ts:88–149` — 12 `@smartout/ai/*` webpack aliases that will be ignored on Turbopack. The Turbopack `resolveAlias` block exists in parallel. Until the webpack block is removed and Turbopack equivalence verified on a Vercel preview deploy, switching build mode carries risk of broken subpath imports.

**LOW — Action-layer barrel re-exports**
`apps/web/src/app/dashboard/billing/_actions/dispatch-rules/index.ts` and equivalent platform-admin paths re-export server action groups. Per ADR-0019, barrel re-exports in app code are prohibited for build performance. These are inside `_actions/` (not pages), so tree-shaking impact is limited, but they violate the direct-import rule.
