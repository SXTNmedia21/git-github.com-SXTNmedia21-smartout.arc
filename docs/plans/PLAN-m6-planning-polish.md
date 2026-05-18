---
title: "Plan — m6-planning-polish"
status: draft
updated: 2026-05-18
created: 2026-05-18
module: dashboard-planning
tags: [plan, polish, m6, ui-shell, cascade-d4, cascade-d5]
---

# Plan — m6-planning-polish

> Branch: `feat/ui-shell-m6-planning-polish` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: dashboard-planning | Started: 2026-05-18

## Goal

Drive M6 Planning cluster (3 dashboard routes) through the 8-phase `smartout-page-polish` workflow until each route is production-grade.

## Scope (routes)

| Step | Route | Cascade | Notes |
|---|---|---|---|
| 2 | `/dashboard/proposals` | D6 → C2 | Cascade change-proposals; lives in Drift group on sidebar |
| 3 | `/dashboard/year-wheel` | D4 (season_budget, day_factor, hour_factor) + D5 | Coordinate with `world-best-wfm` campaign if scheduler logic overlaps |
| 4 | `/dashboard/setup` | I1 bootstrap residual | Setup wizard hand-off route |

## Tasks

Per route, run the 8-phase workflow:

- [ ] Phase 1 — Speed-test baseline (LCP/CLS/TTI capture before any edit)
- [ ] Phase 2 — Bottleneck fix (root-cause whatever Phase 1 surfaces)
- [ ] Phase 3 — Speed-test re-baseline (verify delta)
- [ ] Phase 4 — UI/UX pass (Nordic Split semantic tokens; no hardcoded zinc/gray)
- [ ] Phase 5 — Telemetry registration (emit() on every mutation; route-mount view_change event)
- [ ] Phase 6 — Page instructions (header description that says what the page is FOR, not what it shows)
- [ ] Phase 7 — Harness tool descriptions (every `useRegisterTools` entry has a one-sentence description)
- [ ] Phase 8 — Site-map registration (`apps/web/.botsson/site-map.json` route entry with `polished_at` stamp + tools array + common_intents)

Per-route checklist applied in order — speed-test first means later phases get measured against a real baseline.

## Out of scope

- `/dashboard/calendar` — separate sortie `m6-calendar-polish` (different cluster, Drift group not Planlegging)
- Scheduler logic changes inside D4 — only UI polish here; defer to `world-best-wfm`
- New ADRs — pure polish, no architecture decisions expected. Capture as learnings if surprises arise.

## Acceptance Criteria

- [ ] All 3 routes have `polished_at` entry in `apps/web/.botsson/site-map.json`
- [ ] All 3 routes have header description per Phase 6
- [ ] All 3 routes have telemetry view_change registered + emit() on every mutation
- [ ] No hardcoded color literals (`zinc-*`, `gray-*`, raw OKLCH) — use Nordic Split semantic tokens (`bg-background`, `text-foreground`, `border-border`)
- [ ] `loading.tsx` + `error.tsx` present per route
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated (only if new ADR drafted)
- [ ] User journeys written: `docs/journeys/JOURNEY-m6-planning-polish.md` with ≥ 1 journey per route
- [ ] HANDOFF at `docs/handoffs/HANDOFF-m6-planning-polish.md` documenting all 3 routes' polish state + any deferred LOW findings
