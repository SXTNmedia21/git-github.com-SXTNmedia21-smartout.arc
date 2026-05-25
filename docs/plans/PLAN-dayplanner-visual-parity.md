---
title: "Plan — dayplanner-visual-parity"
status: draft
updated: 2026-05-25
created: 2026-05-25
module: day-session
feature: dayplanner-visual-parity
tags: [plan, dayplanner, oppgaver, visual-polish, dnd-touchup]
affected_domains: [day-session]
---

# Plan — dayplanner-visual-parity

> Branch: `feat/dayplanner-visual-parity` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1` | Base: `development` | Started: 2026-05-25

## Goal

Close 6 MINOR DEVIATIONS surfaced in Wave 2 visual-parity audit between `/dashboard/oppgaver` and Manager Timeline design prototype. Pure UI polish — no data layer, no telemetry, no migrations.

## Source

- Audit: `docs/visual-parity-dayplanner.md` (Wave 2 of feat/dayplanner-dnd-and-views)
- Prototype: `docs/domains/day-session/day-planner/project/Manager Timeline.html` + `timeline-chart.jsx`

## Scope — IN (6 items)

1. **ADR-0361 fix:** Replace `bg-orange-500/10` hardcoded color in `UnassignedLane` (AreaBand.tsx ~line 154) with CSS-variable reference using `--brand-orange`. Also check `PersonLane.tsx` drop-target highlight for same pattern.
2. **Dim opacity:** Change `opacity-50` → `opacity-30` on dimmed AreaBands to match prototype.
3. **`data-dimmed` attribute:** Add `data-dimmed={dimmed ? "true" : "false"}` on AreaBand wrapper so E2E can target it without class introspection.
4. **Band-name font:** Apply `font-heading` class (Instrument Serif) on AreaBand header band-name span — match prototype visual hierarchy.
5. **Dept token id mapping:** Add fallback resolver `resolveDeptToken(location_id)` mapping common location-name variants (`"kjokken"` → `"kitchen"`, `"sal"` → `"floor"`, `"bistro"` → `"floor"`) so DB-driven location_id values resolve to existing CSS-var tokens. Place in `apps/web/src/app/dashboard/oppgaver/_chart/dept-token-resolver.ts`. Wire into AreaBand color lookup.
6. **FilterChip/SegmentGroup transitions:** Verify both `@smartout/ui` primitives include `transition-colors` per Nordic Split §10.4. Add if missing (1-line each).

## Scope — OUT

- Right-rail (broadcast/avvik tabs) — separate sortie
- Multi-day support — separate sortie
- Header padding adjustment (8px → 10px) — sub-millimeter, deferred
- Gutter width adjustment (80px → 60px) — needs alignment verification with time-labels first

## Tasks

- [ ] T1: ADR-0361 — replace `bg-orange-500/10` with CSS-var reference in UnassignedLane + PersonLane
- [ ] T2: Dim opacity 50 → 30 in AreaBand (and any sibling consumer)
- [ ] T3: `data-dimmed` attribute on AreaBand
- [ ] T4: `font-heading` on band-name span
- [ ] T5: `dept-token-resolver.ts` + wire into AreaBand
- [ ] T6: Verify FilterChip + SegmentGroup `transition-colors`; add if missing
- [ ] T7: Update Wave 2 E2E spec `journey-1-area-filter.spec.ts` to use new `data-dimmed` attribute
- [ ] T8: Update `docs/visual-parity-dayplanner.md` — mark 6 items MATCH (closed), status:done
- [ ] T9: Vitest + typecheck green
- [ ] T10: HANDOFF + close-feature

## Acceptance Criteria

- [ ] All 6 deviations closed in code
- [ ] `docs/visual-parity-dayplanner.md` updated — MINOR DEVIATIONS → MATCH for the 6 items
- [ ] 1 JOURNEY-*.md `status: verified` + `feature: dayplanner-visual-parity`
- [ ] Wave 2 E2E spec still passes (with new `data-dimmed` selector)
- [ ] `pnpm turbo typecheck --filter web --force` passes
- [ ] No new ADR-0361 violations introduced

## Risks + Open Questions

- **Dept-token-resolver scope creep:** If location_id values vary widely across workspaces, fallback map cannot cover all. Strategy: map the 4 known prototype keys (kitchen/floor/bar/event) + log-once on unmapped. Real DB-side normalization is separate (data-quality sortie).
- **`@smartout/ui` primitive edits:** If FilterChip/SegmentGroup transitions are missing AND primitive lives outside sortie scope, defer with TODO. Don't break sibling consumers.
