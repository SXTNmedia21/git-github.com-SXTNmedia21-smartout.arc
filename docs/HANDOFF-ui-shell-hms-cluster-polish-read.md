---
title: "HANDOFF — hms-cluster-polish-read"
status: done
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [handoff, ui-shell, polish, nordic-split, telemetry, hms, M5-sortie-3]
---

# HANDOFF — hms-cluster-polish-read

> Branch: `feat/ui-shell-hms-cluster-polish-read` | Commits: `445db09c4` + G4 follow-up | M5 Sortie 3 of 4

## What Was Built

Polished 5 HMS read-heavy routes per `smartout-page-polish` workflow: error boundaries, loading skeletons, Nordic Split token sweep across 11 components, and 4 read-surface telemetry events. Sortie closes loop with Sortie 1 (mutation closure) + Sortie 2 (tool-name collision-fix). Next is Sortie 4 (policies-handbook + DeviationKanban).

## Routes Polished

| Route | error.tsx | loading.tsx | Telemetry event |
|---|---|---|---|
| `/dashboard/hms` (umbrella) | NEW | existing | `hms.umbrella.viewed` |
| `/dashboard/hms/training` | NEW | NEW | `hms.training.viewed` |
| `/dashboard/hms/drift` | NEW | NEW | `hms.drift.viewed` |
| `/dashboard/hms/documents` | NEW | NEW | `hms.documents.opened` |
| `/dashboard/hms/governance` | NEW | NEW | — (deferred to governance ADR) |

All 5 error.tsx ship Norwegian retry button ("Prøv igjen") with semantic destructive token.

## Files Changed

### Routes (9 new files)

- `apps/web/src/app/dashboard/hms/error.tsx`
- `apps/web/src/app/dashboard/hms/training/error.tsx`
- `apps/web/src/app/dashboard/hms/training/loading.tsx`
- `apps/web/src/app/dashboard/hms/drift/error.tsx`
- `apps/web/src/app/dashboard/hms/drift/loading.tsx`
- `apps/web/src/app/dashboard/hms/documents/error.tsx`
- `apps/web/src/app/dashboard/hms/documents/loading.tsx`
- `apps/web/src/app/dashboard/hms/governance/error.tsx`
- `apps/web/src/app/dashboard/hms/governance/loading.tsx`

### Components polished (7 of 11 had hardcoded tokens)

- `DriftFocusCard.tsx` — Badge + progress dots → `bg-destructive/15 text-destructive`, `bg-success`
- `DriftSessionTable.tsx` — status palette + progress bar → `bg-info/15 text-info` (upcoming), `bg-success/15 text-success` (active), `bg-warning/15 text-warning` (pending), `bg-destructive/15 text-destructive` (missed), `bg-success` (progress)
- `DriftTimeline.tsx` — "now" marker red → `bg-destructive border-destructive text-destructive`
- `DepartmentReadiness.tsx` — `readinessColor` + `readinessBg` helpers → `text-{success,warning,destructive}`, `bg-{success,warning,destructive}`
- `LearnFlow.tsx` — past stage + done state greens → `bg-success/{10,5} text-success border-success/30`
- `CompetenceMatrix.tsx` — 3 status Badges + progress fill + readiness percent text → `bg-{warning,success,destructive}/15 text-{warning,success,destructive}`, `bg-primary` (progress), `text-{success,warning,destructive}` (readiness)
- `DriftTaskList.tsx` (G4 follow-up) — overdue count text-red-500 → `text-destructive`
- `HmsSubNav.tsx` (G4 follow-up) — added `nav` landmark + `role="tablist"` + `role="tab"` + `aria-current`; fixed "Opplaering" → "Opplæring" (Norwegian æ)

### Already clean (4 of 11)

- `DriftInsightStrip.tsx` — already using `text-warning text-destructive border-warning/40`
- `DocumentBrowser.tsx`
- `DocumentViewer.tsx`
- (HmsSubNav.tsx had no color tokens — but G4 surfaced ARIA + typo gaps)

### Telemetry registry

- `packages/telemetry/src/registry.ts` — extended `EventCategory` with `"hms"`. Added 4 interfaces (`HmsUmbrellaViewed`, `HmsDriftViewed`, `HmsDocumentsOpened`, `HmsTrainingViewed`) + `SmartoutEvent` union entries + `EVENT_ROUTING` entries (destinations: posthog + logger + activity_trail; no engine_event — reads do NOT trigger downstream workflow steps).

## Decisions

1. **`bg-primary` chosen over `bg-info`** for CompetenceMatrix progress bar fill. The bar is a generic progress indicator, not informational status — primary accent reads as "current progress" semantically.
2. **`text-destructive` not `text-destructive-foreground`** for readiness percent accents. Foreground tokens are paired with destructive backgrounds (e.g. on a destructive chip). Bare accent text on neutral background uses the base destructive token, matching the existing pattern in `DepartmentReadiness.tsx`.
3. **No new Botsson bridge tools** (L-0287 phantom-contract avoidance per council). Existing tool descriptions left unchanged — none were misleading.
4. **No engine_event destination for HMS read events** — reads should not trigger downstream workflow reactions. Engagement audit via `activity_trail` only.

## Learnings

1. **Existing semantic tokens were already partly adopted in HMS.** `DriftInsightStrip.tsx` and `DriftTimeline.tsx` (for task dots) used `text-warning text-destructive bg-success` correctly. Drift came from the "now" marker (separate element) and from helper functions (`readinessColor`/`readinessBg`) that pre-dated the design system. Future polish should grep the helper-function patterns first — they hide multi-site hardcoded values behind a single utility.
2. **G4 design review caught a true a11y gap.** `HmsSubNav` rendered as `<Link>`-in-`<div>` — screen readers saw a link list, not a tab control. Active state computation already existed; just needed ARIA exposure. Cheap fix, real win.
3. **Norwegian typo "Opplaering" slipped through both Sortie 2 (which touched the file for `getProtocolDetail` removal context) and G3 polish review.** Color-token sweeps don't catch i18n string content. Recommend per-sortie grep for ASCII-fallback patterns (`aering`, `oo`, `oe`) when touching Norwegian UI labels.

## Known Issues / Debt

Four LOW-severity findings from G4 design review deferred to follow-up sortie:

1. **Button variant on retry button (5× error.tsx)** — Council prescribed `variant="destructive"` on retry; G4 flagged this as debatable (retry is recovery, not destruction). Defer per polish iterate convention; revisit when establishing error-boundary button standard ADR.
2. **`drift/loading.tsx` layout mismatch with real page** — Skeleton uses generic 2-card + table grid; real `/dashboard/hms/drift` renders `DriftFocusCard` + `DriftInsightStrip` + tabbed timeline/table layout. Cosmetic — skeleton flashes correct *region* but wrong *shape*. Defer to skeleton-tuning sortie.
3. **Telemetry naming dot-separator vs space convention** — New HMS events use `hms.umbrella.viewed` (dot). Existing codebase mixes both (`auth signed_in` space, `cost.overview.viewed` dot, `contract_template.drift_viewed` dot). Pattern is inconsistent; needs ADR to codify. Don't rename in isolation.
4. **`activity_trail` destination on pure view events** — Read-only views fire `activity_trail` writes for manager engagement audit. Defensible compliance framing; leave until cardinality becomes a measurable cost.

## Out-of-Scope Discoveries (for Sortie 4)

- `Deviation*.tsx` and `Procedure*.tsx` components in `_components/` have hardcoded color tokens. Not scoped here — Sortie 4 owns these.

## Verification

- `pnpm --filter web typecheck` → exit 0 (0 errors)
- `pnpm --filter @smartout/telemetry typecheck` → exit 0
- `pnpm lint:tool-collisions` → exit 0, allowlist unchanged (8 known)
- `pnpm --filter web site-map:validate` → exit 0, 52 routes valid
- `grep -E 'bg-(green|amber|red|yellow|orange|blue|emerald|rose)-[0-9]'` across 11 scoped components → 0 hits
- `grep "Prøv igjen"` across 5 error.tsx → 5 hits
- `grep 'role="tablist"'` HmsSubNav → 1 hit
- `grep "Opplaering"` HmsSubNav → 0 hits (good)

## Next Steps (Sortie 4 — final M5)

- Polish `Deviation*.tsx` (kanban, list, drawer, form) — Nordic Split token sweep
- Polish `Procedure*.tsx` (detail tabs, experience) — Nordic Split token sweep
- Polish `/dashboard/hms/deviations` + `/dashboard/hms/procedure/[id]` + `/dashboard/policies` + `/dashboard/handbook` routes — error.tsx + loading.tsx per polish workflow
- DeviationKanban interaction polish (G4 may surface drag-drop a11y gaps)
- Closes M5 HMS 4-sortie sequence
