---
title: "Engine-State vs Engine-Sessions Ontology Clarification"
id: ADR_0216
status: accepted
layer: decision
created: 2026-04-27
updated: 2026-04-28
module: journey-engine
tags: [engine_state, engine_sessions, ontology, fjernkontroll, stage-engine, journey-engine, event-engine]
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

**Chosen option: Option B — stage-engine learns to read `engine_state`. Capabilities unchanged. B5 action handlers emit terminal events.**

Council vote 2026-04-28 — 3-1 for Option B (Steward A2 → REVERSED to B in Phase 5 after Supervisor's 139-site code-trace falsified the Option A "phantom surface" premise).

### Why Option A (capabilities write engine_sessions) was rejected

Council Phase 5 synthesis falsified Option A's framing:

- **engine_state is NOT journey-only.** 139 production sites across 8 unrelated cascade domains read or write engine_state: helpdesk-channel-actions (9 sites, ADR-0160), shift-swap (ADR-0091), contract-intake (ADR-0076), dunning, billing, mobile (4 hooks), e2e tests, engine-dispatch Edge Function. engine_state is the canonical Event Engine universal workflow runtime per CLAUDE.md "engine_process → engine_state → engine_state_step".
- **Status vocabulary mismatch.** engine_state has `(pending, active, waiting, complete, failed, escalated)`; engine_sessions has `(active, complete, expired, abandoned)`. Collapse loses 4 states (pending, waiting, failed, escalated).
- **No equivalent child table.** engine_state_step has FK + cascade DELETE + unique constraint + per-step indexes. engine_sessions has no row-per-step model.
- **process_id FK lost.** engine_state.process_id → engine_process is the universal workflow blueprint, fundamentally different from engine_missions (AI conversations).
- **Sub-option A1 (widen channel CHECK to 'system')** punches CVE-class hole in 3-layer channel guard (ADR-0078 + ADR-0163). Same pattern flagged in kanaler-som-helpdesk council 2026-04-19.
- **5 plan/ADR/learning references** (ADR-0194, L-0146, ADR-0215 §Appendix B, PLAN-mission-resolution-layer, PLAN-journey-engine-honesty) all pre-assume N-C worker reads engine_state.

### Why Option B was chosen

Option B is purely additive:
- Zero schema migration
- Zero capability code changes (ADR-0173 frozen-4 preserved)
- Closes phantom-consumer L-0146 by adding stage-engine reader for `agent_session_envelope.engine_state_id`
- Closes phantom-emit triplet L-0094 (`step_reached`, `completed`, `run_failed`) — B5 action handlers emit from real engine_state_step consumers
- Preserves Event Engine universal runtime for 8 cascade domains
- Preserves channel guard (no CHECK widening)
- Math: Capability E2E coverage 2/4 → 3/4. Phantom-emits 0/3 → 3/3. Cascade regressions 8 → 0.

### Why Option C was rejected

Sync trigger creates new phantom-consumer class. Self-discouraged in original ADR text. Drift risk + sync-lag false-stuck.

### Three-table boundary (canonical)

| Table | Role |
|---|---|
| `engine_missions` | Journey-mode mission registry. Static blueprint, 1 row per mission version. |
| `engine_state` + `engine_state_step` | Universal Event Engine runtime. 1 row per run instance. process_id FK to engine_process. Used by 8 cascade domains. |
| `engine_sessions` | Voice/agent-session boundary. 1 row per chat/voice/telegram thread. Channel-bound (CHECK voice/sms/chat/email/autonomous/telegram). |

Three tables, three roles, no merge. ADR-0224 amended to reflect.

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
