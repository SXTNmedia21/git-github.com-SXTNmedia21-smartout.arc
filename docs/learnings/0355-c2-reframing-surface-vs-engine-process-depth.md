---
title: "C2 Reframing — Duplicate-Logic Surface vs engine_process Gap Depth"
id: L-0355
status: accepted
layer: learning
created: 2026-05-25
updated: 2026-05-25
---

# L-0355: C2 Reframing — Surface vs Depth Asymmetry Between Reviewers

## What happened

Restaurant-sim council 2026-05-25 Phase 3 surfaced a C2-intelligence-pipeline gap (Pattern
1' / GAP-A4-12). The sim synthesizer framed it as "no Event Engine process invokes the
briefing capability tools."

Supervisor's Phase 3 review went deeper on the surface: verified that
`supabase/functions/ops-day-brief/index.ts` (157 lines, 0 references to `compileDayBrief`)
EXISTS and runs daily at 05:00 via `20260414230100_ops_day_brief_cron.sql`. The gap is
NOT "nothing invokes them" — it's "two paths exist (cron EF + capability tool) and they
DUPLICATE the logic instead of sharing." The capability is for chat/voice on-demand; the
cron is for scheduled daily fanout; both reimplement briefing-compose-logic.

System-Agent-Coordinator's Phase 3 review went deeper on architecture: the duplicate-logic
problem has an EE-respecting fix — new `invoke_capability_tool` action-type in
engine-dispatch ([[ADR-0424]]) + `engine_process('shift_briefing_pipeline')` blueprint.
Cron-trigger spawns engine_state → step invokes capability tool → tool posts to session
channel. Single source of logic. ADR-0173 frozen-4 preserved. Pattern 1 sub-pattern C
(EF/capability duplication, per [[L-0353]]) closes structurally.

## Why it matters

Supervisor identified the SURFACE (duplicate logic). Agent-Coord identified the
ARCHITECTURAL FIX (engine_process + new action-type, preserving frozen-4). Both are correct
slices. Synthesizer's framing was wrong but pointed at the right gap.

This is a recurring council pattern: **when a steward / supervisor identifies a "duplicate"
or "diverged" pattern, the next move is to ask system-agent-coordinator for the
EE-boundary-respecting fix BEFORE scoping the sortie.** Without the agent-coord depth,
the sortie risks shipping a custom-cron path that doesn't respect cascade-produces /
event-engine-consumes boundary (CLAUDE.md core principle).

## Lesson learned

**Surface depth and architectural depth are two different reviews.** A reviewer identifying
a surface gap is necessary but not sufficient for sortie scoping. The architectural fix
requires:

1. Surface review (Supervisor / Steward layer)
2. Architectural fix proposal (System-Agent-Coordinator / Botsson-Harness-Builder layer)
3. EE-boundary check (chair / cascade-developer skill)

If sortie ships without (2) + (3), it produces:
- Type C from [[L-0353]] sub-pattern (EF/capability duplication recurs)
- "Logic beside cascade" violation that steward must later flag
- 2-3x effort to refactor later vs land right the first time

## How to apply

- **When chairing a council on any "duplicate / diverged" pattern:** explicitly dispatch
  system-agent-coordinator (or harness-builder if Botsson-layer) for the EE-boundary-
  respecting fix before issuing a verdict
- **When framing a sortie that touches both EF and capability layers:** the sortie scope
  MUST include the action-type or engine_process work needed to collapse the duplication
  THROUGH the Event Engine, not around it
- **When reviewing a sortie plan:** if it ships an Edge Function that overlaps a capability
  tool without using [[ADR-0424]] `invoke_capability_tool`, the plan is incomplete

## References

- 11-agent restaurant-week sim council 2026-05-25 (Phase 5 synthesis)
- [[ADR-0424]] — `invoke_capability_tool` Engine-Dispatch Action-Type (this learning's
  enforcement ADR)
- [[L-0353]] sub-pattern C — EF/capability duplication
- [[ADR-0173]] — frozen-4 capability boundaries
- [[ADR-0356]] — cascade-namespace-delegation audit symmetry
- CLAUDE.md "Never treat cascade pipeline and Event Engine as the same thing"
- `supabase/functions/ops-day-brief/index.ts` (the duplicated surface)
- `packages/ai/src/capabilities/communication/briefing.ts` (the canonical capability)
