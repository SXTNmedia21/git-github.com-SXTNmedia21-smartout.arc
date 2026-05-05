---
title: "Handoff — Year Wheel PRD Consolidation"
feature: year-wheel-prd-consolidation
branch: development
date: 2026-04-12
module: year-wheel
tags: [prd, season, hypothesis, council, consolidation]
---

# Handoff — Year Wheel PRD Consolidation

## Summary

Consolidated 5 separate Year Wheel / Season documents into one master PRD (`docs/modules/MODULE_YEAR_WHEEL_PRD.md` v2.0.0). Added the "From Chaos to Cascade" design hypothesis, complete data model with field clarifications, cascade model confirmation, phased implementation roadmap, and AI council persona alignment. Council-reviewed and approved with changes (all P0 conditions addressed).

## What Was Done

- [x] Rewrote `docs/modules/MODULE_YEAR_WHEEL_PRD.md` from Norwegian to English (v1.0.0 → v2.0.0)
- [x] Added Section 3: "From Chaos to Cascade" hypothesis (4 sub-hypotheses + 3-step user journey + AI council persona alignment)
- [x] Expanded Section 4: Canvas/Blocks/Pins with visual language guidance and semantic clarifications
- [x] Added 11 new planned feature requirements (FR-SEA-12 through FR-SEA-19, FR-NAV-11/12, FR-DRW-06, FR-EVT-08)
- [x] Completed Section 9: Data model with ALL columns, all enums, field clarifications for `is_default`, `opening_hours`, `parent_season_id`
- [x] Added event type mapping (UI creation types → DB `planning_event_category` enum)
- [x] Added year copy clone scope table (what gets cloned vs what doesn't)
- [x] Added Section 12: Cascade Model Confirmation with 2 documented gaps
- [x] Added Section 13: Phased implementation roadmap (4 phases + technical debt)
- [x] Added Section 16: Document consolidation notes
- [x] Marked `docs/superpowers/specs/2026-04-10-year-wheel-ux-pivot.md` as `status: superseded`
- [x] Marked `docs/superpowers/specs/2026-04-10-season-year-wheel-gap-closure-design.md` as `status: superseded`
- [x] Logged council session to `docs/council/COUNCIL-LOG.md`

## What Was NOT Done

- [ ] Gap closure execution plan (`docs/superpowers/plans/2026-04-10-season-year-wheel-gap-closure.md`) still has 44 stale `/dashboard/season/` path references — needs updating to `/dashboard/year-wheel/` or marking as superseded
- [ ] No implementation plan written for Phase 1 (Orientation & Visual Clarity) — PRD Section 13 has the feature list but no agentic execution plan
- [ ] No code changes — this was documentation only
- [ ] No branch created — changes are on `development` (uncommitted)

## Critical Findings from Council

### Architecture Gaps (from System Steward)

1. **Cascade Resolution Gap (P0):** Activating a season in the Year Wheel produces ZERO `department_operating_hours` rows. Seasons are visual-only labels — they control budgets/factors (D4) but do not modify operating hours (D1). The cascade scheduling pipeline is operationally disconnected from the Year Wheel UI.
2. **`season.opening_hours` is deprecated:** Migration `20260421210000` explicitly marks it as `LEGACY: deprecated by Cascade A1`.
3. **`is_default` is governance fallback, NOT Canvas:** Restaurant templates use `is_default = true` for policy-binding. Canvas in cascade resolution is `season_id IS NULL`.

### Code Debt (from Frontend Designer)

4. **P0: Hardcoded color classes everywhere** — violates Nordic Split "NEVER use utility color classes" rule
5. **P0: `isDark` prop drilling** — should use CSS variable auto-switching
6. **P0: Spring constants (300/25) are 10x stiffer** than Nordic Split tokens (30/20)
7. **P1: `prefers-reduced-motion` not implemented**
8. **P1: Touch targets below 44px** (buttons, drag handles)
9. **P1: ~15 hardcoded Norwegian strings** in page.tsx bypass i18n

### Agent Gaps (from System Agent Coordinator)

10. **5 orphaned season tools** in `packages/ai/src/tools/season/` — not registered in any capability
11. **Year Wheel has zero voice/chat tools** — schedule page has mature voice tools but Year Wheel has none
12. **No `season` capability** in intent classifier

## Next Session Recommendations

### Option A: Write Phase 1 Implementation Plan
Create a new plan for PRD Section 13 Phase 1 (Orientation & Visual Clarity):
- FR-NAV-11: Health summary bar
- FR-SEA-15: Canvas visual treatment (fractal noise overlay + "NORMAL DRIFT" watermark)
- FR-SEA-16: Empty-year hero CTA with mini-timeline preview
- FR-NAV-12: Year comparison chip

### Option B: Fix Technical Debt First
Address the P0 design system violations before adding features:
- Replace hardcoded color classes with CSS variables across all 29 year-wheel files
- Remove `isDark` prop drilling, use CSS variable auto-switching
- Replace spring constants with Nordic Split tokens
- Migrate hardcoded Norwegian strings to i18n keys

### Option C: Close the Cascade Resolution Gap
Address Gap 1 (P0): Wire season activation to `department_operating_hours`. Without this, "activating" a season is a no-op from a scheduling perspective. This is the most architecturally important gap.

### Option D: Mark gap closure plan as superseded
The 2000+ line execution plan at `docs/superpowers/plans/2026-04-10-season-year-wheel-gap-closure.md` has 44 stale paths pointing to a deleted directory. Either update all paths or mark it as superseded and create fresh plans from the PRD.

## Key Files

| File | Role |
|---|---|
| `docs/modules/MODULE_YEAR_WHEEL_PRD.md` | Master PRD (v2.0.0) — single source of truth |
| `apps/web/src/app/dashboard/year-wheel/` | Implementation (29 files) |
| `docs/decisions/0085-year-wheel-governance-policy.md` | ADR: single active cycle policy |
| `docs/council/COUNCIL-LOG.md` | Council session log (2026-04-12 entry) |
| `docs/superpowers/plans/2026-04-10-season-year-wheel-gap-closure.md` | Stale execution plan (needs path update or superseding) |

## Uncommitted Changes

This session's changes are on the `development` branch but NOT committed. Files modified:
- `docs/modules/MODULE_YEAR_WHEEL_PRD.md` (rewritten)
- `docs/superpowers/specs/2026-04-10-year-wheel-ux-pivot.md` (status: superseded)
- `docs/superpowers/specs/2026-04-10-season-year-wheel-gap-closure-design.md` (status: superseded)
- `docs/council/COUNCIL-LOG.md` (new entry appended)
- `docs/handoffs/HANDOFF-year-wheel-prd-consolidation.md` (this file, new)
