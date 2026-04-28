---
title: "Engine-State vs Engine-Sessions Ontology Clarification"
id: ADR_0216
status: proposed
layer: decision
created: 2026-04-27
updated: 2026-04-27
module: journey-engine
tags: [engine_state, engine_sessions, ontology, fjernkontroll, stage-engine, journey-engine]
---

# ADR-0216: Engine-State vs Engine-Sessions Ontology Clarification

## Context and Problem Statement

Two tables exist for journey runtime state with overlapping semantics and no clear authority boundary. Neither is fully consumed for guided runs, and neither fully serves the Fjernkontroll UI that needs live state.

- **`engine_sessions`** — used by stage-engine `loadMission()` and the agent session lifecycle (`services/stage-engine/src/core/session-manager.ts`). This is the table the stage-engine reads to understand what run is in progress.
- **`engine_state`** + **`engine_state_step`** — written by `runGuidedTool` and `runDevTool` (capability tools in `packages/ai/src/capabilities/journey/tools.ts`); read only by the web BFF status polling endpoint. `services/stage-engine/src/` has ZERO reads of `engine_state`.
- **Fjernkontroll** — the runtime UI card subscribes to `engine_event` (telemetry) for terminal-state events. No capability tool emits those terminal events today (phantom-consumer pattern, L-0130).

This is the L-0130 phantom-consumer pattern at the architectural level: `runGuidedTool` writes `engine_state` faithfully, but the consumer that actually drives the run (stage-engine) never reads it. The Fjernkontroll UI subscribes to terminal events that no producer emits.

## Decision Drivers

- L-0023 (dev-tracking vs runtime-state) — original guidance that `journey_event` is dev/telemetry and `engine_state` is live. Does not resolve which table stage-engine should own.
- L-0130 (phantom-consumer pattern, this session) — capability writes to a table; nothing reads it. Requires naming the consumer and the read-side test.
- ADR-0177 (Fjernkontroll state machine) — 6-state machine requires live runtime state. Source of that state unresolved.
- ADR-0215 (stuck-detector strategy) — deferred to Phase 3 in part because the runtime table ontology was unresolved.
- Council Phase 8 synthesis (2026-04-27) — raised as open structural question; no decision yet. This ADR frames the options for the next council sortie.

## Considered Options

1. **Option A — Capabilities write to `engine_sessions` (collapse to one table; capability code refactor)**
   - `runGuidedTool` and `runDevTool` stop writing `engine_state` and write to `engine_sessions` instead.
   - Stage-engine can already read `engine_sessions` — zero stage-engine changes needed.
   - Work: capability body refactor (medium), migration to archive/drop `engine_state` (medium, must coordinate RLS), BFF status polling re-pointed (small).
   - Blast radius: `engine_state` RLS policies, `engine_state_step` child table, BFF poll route.
   - Owner: campaign/journey-engine.

2. **Option B — Stage-engine learns to read `engine_state` (extend stage-engine; preserves capability surface)**
   - Stage-engine adds a read path from `engine_state` to check current journey step before advancing.
   - Capabilities continue writing `engine_state` unchanged.
   - Work: stage-engine core changes (medium-large), Fjernkontroll producer wired (capability must now emit terminal events per ADR-0175), `engine_sessions.channel CHECK` constraint may conflict if `engine_state` is the new source.
   - Blast radius: stage-engine session-manager, channel check constraint on `engine_sessions` (currently omits `system` + `telegram`).
   - Owner: campaign/botsson-arena (stage-engine lives there) + campaign/journey-engine (capability side).

3. **Option C — Keep two tables; add adapter table or sync trigger**
   - `engine_state` remains as written by capabilities; a Postgres trigger or background job syncs state changes into `engine_sessions`.
   - Preserves both surfaces unchanged in the short term.
   - Work: trigger/adapter authoring (small-medium), but creates a third layer of indirection and a new class of sync drift bugs.
   - Blast radius: migration + trigger maintenance.
   - Owner: platform/infra.

## Decision Outcome

**No decision yet — pending council vote.** This ADR frames the three options and open questions for the next sortie. Status remains `proposed` until the council vote closes.

Preliminary signal from Phase 8 synthesis: Option A is the lowest blast-radius path if `engine_sessions.channel CHECK` can accommodate journey capability writes. Option C is explicitly discouraged — sync triggers create a new phantom-consumer class risk (L-0130 recurring).

## Rules & Consequences

- **Good (Option A), because** it eliminates the dual-table ambiguity for the most common case and requires no cross-campaign coordination.
- **Bad (Option A), because** it requires touching capability bodies that already have ADR-0196 Invariant 11 E2E tests — those tests must be updated in the same PR.
- **Good (Option B), because** it preserves the capability surface as designed and lets stage-engine own its own read model.
- **Bad (Option B), because** it requires cross-campaign coordination (botsson-arena owns stage-engine) and the `channel CHECK` constraint on `engine_sessions` must be audited for compatibility.
- **Discouraged (Option C), because** sync triggers create a new phantom-consumer risk — the trigger becomes the phantom consumer, and its failure mode is silent state drift.
- **Agent Impact:** Until this ADR is accepted, no new capability writes to `engine_state` without an explicit note that the consumer gap is known and tracked here. Fjernkontroll terminal-event wiring is blocked on this decision.

## Open Questions for Council

1. Does the N-C worker (Phase 3 item #3 in ADR-0215) live in `engine_state` runtime or `engine_sessions` agent runtime? This determines which table "owns" the run and resolves the Option A vs B choice.
2. Does Fjernkontroll subscribe to `engine_state` Postgres Realtime change events OR poll the BFF status route? The answer constrains which table must be the authoritative live-state store.
3. Is `engine_sessions.channel CHECK` (currently omits `system` + `telegram`) a constraint to preserve under Option A, or should it be widened to include `system` for agent-initiated capability writes?

## References

- ADR-0215 (stuck-detector strategy, accepted 2026-04-27) — deferred in part due to this ontology gap.
- ADR-0177 (Fjernkontroll UI contract) — 6-state machine depends on live runtime source.
- L-0023 (dev-tracking vs runtime-state, 2026-04-21) — original separation rule.
- L-0094 (phantom emit contracts, 2026-04-21) — write-side phantom class.
- L-0130 (phantom-consumer pattern, 2026-04-27) — read-side phantom class; this ADR is the architectural response.
- Council Phase 8 synthesis, 2026-04-27 — raised this as open structural question B1.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
