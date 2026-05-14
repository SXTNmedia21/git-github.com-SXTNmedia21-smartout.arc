---
title: "PLAN — People Page Polish Tier-1"
status: draft
created: 2026-05-14
updated: 2026-05-14
module: people
tags: [sortie, polish, page-polish, performance, tier1]
---

# PLAN — `/dashboard/people` Polish Tier-1

## Scope

Apply the same 8-phase polish workflow proven on `/dashboard/schedule` (closed `b7d7a44ba`, commits `9439880bf` flip + ADR-0308 gate semantics). Target: `/dashboard/people`.

## Deliverables (in order)

1. Phase 1 baseline — Playwright CDP perf script `apps/e2e/scripts/people-perf-baseline.ts` against prod build (`pnpm --filter web build && pnpm --filter web start`). Capture cold + warm LCP, CLS, TTI, INP. Record in `.claude/page-polish/dashboard-people.run.yml`.
2. Phase 2 — Fix bottlenecks. Patterns proven on schedule:
   - `loading.tsx` → `null` + inline AnimatePresence crossfade
   - `requestIdleCallback` + 300ms fallback for non-critical TanStack queries
   - `next/dynamic` for opens-on-action sub-views (employee drawer, contract sheet, etc.)
3. Phase 3 — Re-test prod build. Cold LCP must be `<` 1500ms per ADR-0308 contract.
4. Phase 4 — UI/UX pass via `frontend-designer` skill (Nordic Split tokens, motion).
5. Phase 5 — Telemetry registry verification (every mutation emits).
6. Phase 6 — Page knowledge (header + description + empty/error copy + DB sync).
7. Phase 7 — Harness tools (`useRegisterTools("people", ...)` verified).
8. Phase 8 — Site-map entry in `apps/web/.botsson/site-map.json`.

## Polish-gate compliance

Per ADR-0308: `verified: true` flipped ONLY after prod-build runtime measurement satisfies all 8 checklist items. `SKIP_PAGE_POLISH=1` bypass acceptable when infra blocks measurement (cite per L-0246).

## Skills (must be loaded)

- `smartout-page-polish` — 8-phase workflow
- `smartout-nordic-split` — Phase 4 design rules
- `smartout-database-guide` — if any DB schema changes during page-knowledge sync

## Out of scope

- New features on `/dashboard/people`
- Schema changes to `profile` / `user_identity`
- Mobile parity (separate sortie)

## Risks

- /dashboard/people loads employee roster — likely smaller than schedule (50 components) but check before measuring.
- People page may have variant tab bar (admin vs employee view) — measure both per Phase 3 admin upgrade.
- Avatar images may dominate LCP (largest contentful paint = first big image) — investigate `next/image` priority + size optimization if so.

## Worktree

`~/dev/smartout.ai-wt-6` on branch `feat/people-page-polish-tier1` based on `development`.

## Closure ref

Reuse JOURNEY + HANDOFF template from `feat/schedule-page-polish-tier1`. No new ADR; reuse ADR-0308 + L-0246 as polish-gate canon. New learning only if novel pattern surfaces.
