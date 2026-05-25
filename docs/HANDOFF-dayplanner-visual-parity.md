---
title: "HANDOFF — dayplanner-visual-parity"
status: done
feature: dayplanner-visual-parity
created: 2026-05-25
updated: 2026-05-25
module: day-session
tags: [handoff, dayplanner, oppgaver, visual-polish]
---

# HANDOFF — dayplanner-visual-parity

## Summary

Closed 6 MINOR DEVIATIONS identified in the Wave 2 audit of `/dashboard/oppgaver` vs the Manager Timeline prototype. This was a pure UI polish sortie — no data layer changes, no telemetry events, no migrations. All 6 closures are presentation-only and pass Nordic Split design system constraints.

## What Shipped

| # | Deviation | Fix |
|---|-----------|-----|
| 1 | Hardcoded `orange-500` in drop-target highlight (ADR-0361 violation) | Replaced with `color-mix(in oklch, var(--brand-orange) 10%, transparent)` Tailwind arbitrary-value |
| 2 | Dimmed AreaBand opacity at 50% (prototype spec: 30%) | Changed to `opacity-[0.30]` — also added `data-dimmed="true"` HTML attribute for E2E hooks |
| 3 | `data-dimmed` attribute absent (E2E spec depends on it) | Added `data-dimmed={isDimmed ? "true" : undefined}` to AreaBand render |
| 4 | Band-name typography not using Instrument Serif | Added `font-heading` class to band-name `<span>` — maps to `--font-heading` CSS var from globals.css |
| 5 | `resolveDeptToken()` missing for Norwegian location_id values | Created `apps/web/src/app/dashboard/oppgaver/_chart/dept-token-resolver.ts` with NORM_MAP (ASCII + Unicode variants) + `var(--border)` fallback with single console.warn |
| 6 | FilterChip + SegmentGroup using `transition-all` instead of `transition-colors` | Verified already using `transition-colors` per Nordic Split §10.4 (no code change needed — documented as verified) |

## Decisions

**ADR-0361 color fix syntax.** The arbitrary-value form `color-mix(in oklch, var(--brand-orange) 10%, transparent)` was chosen over `bg-brand-orange/10` because the CSS variable is not registered in Tailwind's color palette at the opacity modifier level. The `color-mix` form is the most token-faithful arbitrary-value syntax available without modifying `globals.css`.

**dept-token-resolver placement.** Located in `apps/web/src/app/dashboard/oppgaver/_chart/` (component-local) rather than `packages/`. Rationale: the mapping table is a local presentation concern tied to this surface's location_id values. Easy to promote to a package if a second surface needs it.

**Norwegian variant handling.** NORM_MAP covers both `kjokken` (ASCII, URL-safe) and `kjøkken` (Unicode, display-form) to absorb both DB storage conventions. Same pattern for `sal`/`bar`.

## Learnings

- **frontend-designer agent has Skill-only tool access** — cannot write code. Always dispatch botsson-harness-builder for code edits even on UI work. The skill boundary is firm.
- **SKIP_PAGE_POLISH=1 bypass** is documented in `dashboard-oppgaver.run.yml` line 86 — acceptable per the deferred-polish note on that file. Not a quality debt item.
- **Turbo+WSL2 OOM recurrence** — direct `tsc --noEmit` in apps/web confirms green when the turbo wrapper crashes on <4Gi available memory. `TURBO_CONCURRENCY=1 --force` is the correct workaround (7Gi available → passed cleanly in this sortie).

## Debt

- **Page-polish gate (`dashboard-oppgaver.run.yml`) still bypassed.** Should clear after a follow-up sortie covers remaining feature-completion items (right-rail, multi-day, header padding, gutter-width, broadcast tab).
- **`--font-heading` load dependency.** If Instrument Serif fails to load, band-name silently falls back to Geist Sans. No test catches this; considered acceptable given the font is loaded at root layout level.

## Next Steps

1. Promote to preview (HOP A) when development branch is release-ready.
2. Address remaining out-of-scope items from the plan: right-rail layout, multi-day view, header padding, gutter-width, broadcast tab, and remaining audit items marked OUT-OF-SCOPE.
