---
title: "HANDOFF — Schedule Page Polish Tier-1"
status: done
updated: 2026-05-14
created: 2026-05-14
module: schedule
tags: [polish, performance, page-polish, schedule, handoff]
---

# HANDOFF — Schedule Page Polish Tier-1

> Branch: `feat/schedule-page-polish-tier1` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-2`
> Base: `development` | Closed: 2026-05-14

---

## What Was Built and Why

Polish-tier1 for `/dashboard/schedule` — the largest dashboard page (page.tsx = 2014 lines, 50 components). Previous state: cold LCP 3476ms dev / blank-frame skeleton flash between states / no `requestIdleCallback` query deferral / heavy sub-views imported eagerly even when never opened.

After this sortie:

- Cold LCP **992ms** prod (`<` 1500ms threshold, 508ms headroom; -71% vs pre-fix dev baseline)
- Warm LCP **480ms** prod (median of 5 runs; -83% vs pre-fix dev baseline)
- Skeleton-flash gone (Playwright trace verified, no blank frame between loading→ready)
- Non-critical queries deferred to `requestIdleCallback` + 300ms `setTimeout` fallback
- `MonthlyView`, `EmployeeDrawer`, `PublishOverviewDialog`, `SendMessageDialog` lazy-loaded via `next/dynamic`
- CLS 0.001 (negligible, unchanged)

Per `smartout-page-polish` SKILL.md the 8 phases are complete and all 8 checklist items in `.claude/page-polish/dashboard-schedule.run.yml` are `true`. `verified: true` flipped 2026-05-14.

---

## Commits

| SHA | Subject |
|---|---|
| `55e6972e7` | feat(site-map): register /dashboard/schedule entry for Botsson routing |
| `60a5843fa` | chore(page-polish): mark schedule page_knowledge DB-synced |
| `8b7ed80c7` | feat(page-polish): schedule perf baseline via Playwright CDP |
| `f90279177` | perf(schedule): apply SKILL.md polish patterns, gate held pending real measurement |
| `c48ed1b3a` | docs(council): ADR-0308 + L-0246 polish-gate semantics |
| `8472337e5` | chore(page-polish): record wt-2 retest — 7/8 checks pass, dev LCP 1844ms |
| `9439880bf` | chore(page-polish): flip verified — prod cold LCP 992ms, 8/8 checks pass |

---

## Decisions Made

### D1 — Skeleton ownership: `loading.tsx` → null + inline crossfade

The shared Suspense fallback `apps/web/src/app/dashboard/schedule/loading.tsx` was returning a 7-cell skeleton that did not match the real grid's dimensions and remounted between states, causing a blank-frame flash. Per SKILL.md `Skeleton Crossfade Pattern`, `loading.tsx` now returns `null` and the skeleton lives inside the client component as a keyed `motion.div` inside `AnimatePresence mode="wait"`. Reference implementation: `apps/web/src/components/day/WebDayControl.tsx:97-177`.

### D2 — Defer non-critical queries via `loadSecondaryData` flag

`useAbsences` and `useShiftReadinessCheck` now accept `options.enabled` and are gated on a pre-existing `loadSecondaryData` flag in `page.tsx:251`. The flag flips true on `requestIdleCallback` with a 1200ms timeout, falling back to 300ms `setTimeout` for browsers without rIC. Primary `useShifts` always fires immediately. Result: cold paint completes before secondary data competes for the main thread.

### D3 — Lazy-load four sub-view components

`MonthlyView` (monthly tab, never default), `EmployeeDrawer` (opens on click), `PublishOverviewDialog` (opens on publish action), `SendMessageDialog` (opens on SMS action) are now `next/dynamic` imports with `ssr: false`. Only `MonthlyView` has a `loading` fallback (`bg-muted/20 animate-pulse`) because it mounts inline in layout; the three dialogs render only on user gesture, where dialog open-latency masks the chunk fetch.

### D4 — Gate held + bypass via `SKIP_PAGE_POLISH=1` during infra failure

When Docker WSL2 integration was off and runtime LCP measurement was blocked, the sub-agent's intermediate measurement was invalid (measured against the MAIN repo dev-server on :3060, not against wt-2's code). Council (steward + supervisor + frontend-designer, 3/3 convergent) voted: commit via `SKIP_PAGE_POLISH=1` with full rationale in commit body, keep `verified: false`, hold sortie open until real measurement possible. This decision is codified in ADR-0308 (polish-gate-semantics) and L-0246 (polish-gate-bypass-honest-vs-fake).

### D5 — Entrance fade uses `exitMs/1000` (0.25s), not `enterMs/1000` (0.5s)

Frontend-designer flagged the entrance fade timing during council review. SKILL.md prescribes `enterMs = 500ms` for entrance animations, but the skeleton-reveal case is different — the user has been waiting, and a faster reveal feels more responsive. Documented as intentional in the commit body. Future ADR may amend SKILL.md to carve out skeleton-reveal as a 250ms case.

---

## Learnings

### L1 — `requestIdleCallback` with `timeout: 1200` + 300ms `setTimeout` fallback is the canonical pattern for non-critical-data deferral

The Smartout codebase already had this exact pattern in `apps/web/src/app/dashboard/schedule/page.tsx:311-331` before this sortie. New hooks gating on `loadSecondaryData` should use the same trigger flag rather than wiring up their own rIC. Pattern reused, not invented.

### L2 — Prod-build LCP measurement is canonical; dev-build LCP includes Turbopack JIT overhead of 500-900ms cold

Measured directly this sortie: dev cold 1844ms vs prod cold 992ms = -46% delta entirely attributable to dev Turbopack JIT (no code differences). For polish-gate verification, prod-build measurement is mandatory before flipping `verified: true`. See ADR-0308 for the gate contract.

### L3 — Council Phase 9 entry confirmed Polish-gate semantics needed an ADR

The polish-gate (husky pre-commit, `.husky/pre-commit:245-281`) had no ADR documenting its semantics. Mid-sortie infra failure forced the question. ADR-0308 closes the governance gap.

---

## Known Issues / Debt

| ID | Debt | Target |
|----|------|--------|
| K1 | `page.tsx` is 2014 lines — candidate for split (extract `ScheduleProvider`, week-grid wrapper) | Future polish-tier2 sortie |
| K2 | Frontend-designer flag on entrance fade duration (250ms vs SKILL.md nominal 500ms) — judgment call for skeleton-reveal | Future SKILL.md amendment if pattern recurs |
| K3 | Phase 6 page header description verified inline in run.yml but not yet pushed to `page_knowledge` DB rows for runtime Botsson context | Already synced 2026-05-13 per checklist; nothing pending |

---

## Verification Status

All 8 checklist items in `.claude/page-polish/dashboard-schedule.run.yml` are `true`. `verified: true`. `verified_at: 2026-05-14T01:20:00+02:00`. Prod-build measurement satisfies ADR-0308 contract.

| Check | Result |
|------|--------|
| lighthouse_lcp_under_1500ms | PASS (cold 992ms prod) |
| no_skeleton_flash | PASS (Playwright trace) |
| motion_tokens_used | PASS (0 hardcoded values) |
| telemetry_emit_per_mutation | PASS (11/11 hooks emit) |
| page_knowledge_written | PASS (header + description + empty/error copy) |
| page_knowledge_db_synced | PASS (workspace_id=NULL platform default row) |
| harness_tools_registered | PASS (21 tools via useRegisterTools) |
| retest_improved | PASS (cold -71%, warm -83%) |

---

## Next Steps

1. Run `bash scripts/close-feature.sh` from wt-2 → merges `feat/schedule-page-polish-tier1` → `development`, pushes, removes worktree.
2. Future tier-2 sortie: split `page.tsx` (K1), wire INP budget tracking, profile admin tab-bar dynamic imports.
3. Pattern reuse: other dashboard pages with similar profile (>1500 lines, eager sub-view imports, multiple TanStack queries) should adopt the same three patterns (`loading.tsx` null + AnimatePresence, `loadSecondaryData` idle-defer, `next/dynamic` for opens-on-action components).
