---
title: "Campaign — year-wheel"
status: active
updated: 2026-04-23
created: 2026-04-20
module: year-wheel
tags: [campaign, roadmap, cascade, d1, d4]
---

# Campaign — year-wheel

> Branch: `campaign/year-wheel` | Worktree: /home/sxtnl/dev/smartout.ai-year-wheel | Module: year-wheel | Started: 2026-04-20

## Vision

Close the cascade gap the 2026-04-20 redesign exposed but did not fix: activating a season must actually move D1 (operating hours) and D4 (demand/budget) together. Today the Year Wheel is a beautiful D4-only surface — activation produces zero `department_operating_hours` rows, so the schedule engine never sees a season change. This campaign makes season activation a real cascade event, then works outward to polish (design-debt) and agent surface (voice/chat parity with Schedule).

## Scope

### In scope

- **M1 Cascade-gap closure (P0):** Wire `season.activate` → `department_operating_hours` generation. Includes activation gate, `SeasonActivationProposal` preview, rollback path.
- **M2 Design-debt sweep:** Remove hardcoded color classes in `apps/web/src/app/dashboard/year-wheel/**` + `apps/web/src/app/dashboard/season/**`. Kill `isDark` prop drilling. Replace spring constants with Nordic Split tokens (stiffness=30, damping=20). Implement `useReducedMotion()`. Enforce ≥44pt touch targets. Migrate ~15 hardcoded Norwegian strings to i18n.
- **M3 Agent surface:** Register the 5 orphan tools in `packages/ai/src/tools/season/` behind a new `season` capability. Add `season` to intent classifier. Voice + chat parity with `/dashboard/schedule`. C4 authority seeded via migration.
- **M4 Deferred-from-redesign completions (P1, L-0074):** `SeasonGoalsTab` + `SeasonProceduresTab` out of `_deferred/`, activation checklist gate, Activate/Archive/Duplicate actions on the Season page, Seeded pill state.

### Explicitly out of scope

- **The redesign itself** — shipped on `feat/year-wheel` → `development` already (canvas, shell, season route, quick-create sheet, migration `20260420120000`). No re-do here.
- **D6 / daily ops / hooks / tasks** → `campaign/daily-operation`.
- **Helpdesk / ticket-as-engine_state** → `campaign/helpdesk`.
- **Journey Engine / JourneyIR / capability seeds for journey** → `campaign/journey-engine`.
- **Stage engine / voice routing / agent-router changes** → `campaign/botsson-arena`. This campaign only *registers* season tools into existing routing; it does not modify the router itself.
- **Any migration outside `supabase/migrations/` that touches tables other than `department_operating_hours`, `season`, `engine_authority_config` (season rows), `planning_event`.**

## Source of truth

1. PRD: `docs/modules/MODULE_YEAR_WHEEL_PRD.md` v2.0.0
2. Handoff: `docs/handoffs/HANDOFF-year-wheel-prd-consolidation.md` (council gaps 1–12)
3. Redesign spec (shipped, reference only): `docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md`
4. Redesign plan (done): `docs/superpowers/plans/2026-04-20-year-wheel-redesign.md`
5. Binding ADRs: 0085 (year-wheel governance policy), 0164 (telemetry prefix "season "), plus 0074/0024 for cascade + C4.
6. Binding learnings: L-0046 (triple-lens convergence), L-0066/0097 (C4 defaults not free), L-0074 (P1 deferrals), L-0075 (migration atomicity 0a/0b/0c).

## Milestones

- [ ] **M1 — Cascade-gap closure (P0)** — `season.activate` generates `department_operating_hours` rows. Activation preview + rollback. Ownership of `is_default` vs `season_id IS NULL` canvas resolution clarified in code.
- [ ] **M2 — Design-debt sweep** — Nordic Split clean across year-wheel + season routes. No hardcoded colors, no `isDark` drilling, springs on tokens, reduced-motion respected, touch targets ≥44pt, i18n complete.
- [ ] **M3 — Agent surface parity** — 5 season tools registered under `season` capability, intent classifier extended, voice + chat work on `/dashboard/year-wheel` and `/dashboard/season/[seasonId]`. Authority rows seeded via migration.
- [ ] **M4 — Deferred P1 completions** — Goals/Procedures tabs live, activation gate + checklist, Activate/Archive/Duplicate, Seeded pill.

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

## Decisions

See `docs/decisions/0000-decision-log.md` (inherited from development at campaign start).
Campaign-specific decisions register there with a `year-wheel` tag.

### Pre-accepted (inherited)

- **ADR-0085** — Year Wheel governance policy.
- **ADR-0164** — Telemetry prefix `"season "` unified.
- **ADR-0024 / 0074** — Cascade + authority primers.

### Expected from this campaign

- M1 will need an ADR on cascade-activation semantics (D4 → D1 fan-out, rollback, idempotency).
- M3 will need a C4 authority seed ADR for the 5 season tools (parallel to journey's ADR-0176).

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date       | Development HEAD | Merge commit |
|------------|------------------|--------------|
| 2026-04-23 | f31f5804         | f31f5804 (fast-forward — no divergence) |
