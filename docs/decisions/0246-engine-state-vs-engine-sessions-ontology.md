---
title: "Implementation specification for ADR-0216 Option B + Arena Harness heartbeat-mission-pattern hooks"
id: ADR-0246
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
supersedes: none
amends: none
ratifies: ADR-0216
references:
  - ADR-0216
  - ADR-0224
  - ADR-0173
  - ADR-0186
  - ADR-0078
  - ADR-0204
  - ADR-0215
  - L-0094
  - L-0098
  - L-0126
  - L-0130
---

# ADR-0246: Implementation specification for ADR-0216 Option B + Arena Harness heartbeat-mission-pattern hooks

## Intro

This ADR ratifies the three-table boundary established by ADR-0216 (`engine_missions` / `engine_state`+`engine_state_step` / `engine_sessions`) and specifies the implementation phases that close the phantom-consumer gap (L-0130 mirror of L-0094) without merging tables.

It does NOT supersede ADR-0216. It does NOT merge tables. It SPECIFIES how Arena Harness + heartbeat-as-mission-dispatcher fits inside the three-table boundary.

**Read first:** §Reference to ADR-0216, §Phase A0 schema reconciliation, §Phase A4 split (A4a schema cutover ships independently; A4b emit blocked on ADR-0248).

## Context and Problem Statement

ADR-0216 (accepted 2026-04-28) established three-table boundary: `engine_missions` (journey blueprint), `engine_state`+`engine_state_step` (universal Event Engine runtime, 8 cascade domains), `engine_sessions` (voice/agent-session boundary). "Three tables, three roles, no merge." ADR-0224 Amendment (same day) reaffirms.

Implementation of ADR-0216's chosen path (B1 stage-engine reader + B5 action handlers emitting lifecycle events) was not specified in 0216. Arena Harness construction (`PLAN-arena-harness-migration.md`, heartbeat-as-mission-dispatcher) requires concrete schema + emit specification before Phase 2.

Open gaps (handoff capstone §Known Open-Loop):
- Stage-engine reads `engine_sessions`, never `engine_state` (26 call sites across 9 files)
- No producer emits `journey.completed/stuck/run_failed`
- Fjernkontroll state machine renders `running` indefinitely (DB vocab: `active`)
- Mission-pool worker (Arena Harness) needed but not specified
- Schema mismatches between `engine_sessions` and `engine_state` (workspace_id NOT NULL, process_id NOT NULL, status enum collision, 12+7 unmapped columns)

## Decision Drivers

- **Ratify, don't supersede.** ADR-0216 chose three-table boundary correctly per 139-site cascade-domain evidence. Reopening on 1-day basis would violate decision discipline.
- **Phantom-consumer (L-0130) is real and blocking Arena.** Must be closed without merge.
- **Emit producer must be canonically named.** Two-owner ambiguity (mission-pool worker vs B5 action handlers) creates contract divergence (L-0184, see §References).
- **Schema mismatches are real and must be resolved before stage-engine reads engine_state for non-journey kinds.**
- **Phase A4 emit cannot ship before producer + consumer exist** (L-0094 phantom-emit pattern, 5th occurrence).

## Considered Options

1. **Option A — Reframe as ratification + implementation spec (this ADR).** Accept ADR-0216 boundary. Specify Phase A0–A4 implementation. Split A4 into schema cutover (A4a, ships independently) + emit (A4b, blocked on ADR-0248 + B5 handlers). Mission-pool worker stays as Arena Harness construct, NOT emit owner.
2. **Option B — Supersede ADR-0216.** Rewrite the merge decision. Rejected: requires fresh evidence; 1-day basis is decision discipline violation; ADR-0224 Amendment also blocks.
3. **Option C — Defer Arena Harness until B1+B5 self-organizes.** Rejected: heartbeat-mission-pattern needs concrete schema, leaving B1+B5 unspecified perpetuates the phantom-consumer.

## Decision Outcome

Chosen: **Option A.** ADR-0246 ratifies ADR-0216 + specifies the 5-phase implementation (A0–A4) with A4 split. ADR-0247 captures schema relaxation (workspace_id, process_id nullability). ADR-0248 captures B5 action handlers as canonical emit producer.

## Implementation Phases

### Phase A0 — Schema Reconciliation (1 week, blocking)

Deliverables:
- Migration enumerating all 12 columns on `engine_sessions` and 7 on `engine_state` with no clean analog. Each marked: keep / move to JSONB / move to first-class column / drop.
- `engine_state.kind` enum added: `'conversation' | 'journey' | 'recurring'`. Mapping documented (mode='agent' → conversation; mission_id NOT NULL → journey; SEASON_LIFECYCLE → recurring).
- `engine_state.channel` first-class column (NOT JSONB) — required for ADR-0078 channel guard queryability.
- `engine_state.workspace_id` and `engine_state.process_id` nullability decisions captured in **ADR-0247**.
- Status-enum reconciliation: canonical = `engine_state {pending|active|waiting|complete|failed|escalated|blocked}`. Translation: `engine_sessions.expired → engine_state.failed` (with reason metadata), `engine_sessions.abandoned → engine_state.failed` (with reason metadata).
- ADR-0186 pg-notify-bus filter migration documented.
- Migration matrix enumerating ALL 8 cascade domains (journey + helpdesk + shift-swap + contract-intake + billing + dunning + engine-dispatch + platform-admin), not just frozen-4.
- Recorder dividend named: `services/stage-engine/src/core/session-recorder.ts:68 engine_state_id` field populated by Phase A2.

### Phase A1 — Schema Additions (1 week)

Pure additive DDL per A0 spec. Regenerate `packages/supabase/src/database.types.ts`. Update ADR-0173 frozen-4 capability test assertions for new schema; failing CI here = early contract-drift catch.

### Phase A2 — Dual-Write Behind Feature Flag (1 week)

Feature flag `ENGINE_STATE_DUAL_WRITE`. Every capability writing `engine_sessions` also writes `engine_state` with appropriate `kind`. Hot-path validation: `appendConversationTurn` row-count parity verified in preview before flip.

### Phase A3 — Backfill With Quiesce Gate (1 week)

Backfill projects historical `engine_sessions` rows into `engine_state`. Filter `WHERE status IN ('complete', 'abandoned', 'expired')`. Never backfill active sessions (closes guardian whisper TOCTOU window). Idempotent via `legacy_session_id` UNIQUE INDEX.

### Phase A4a — Schema Cutover (1 week, INDEPENDENT of A4b)

Atomic flip: 27+ consumer reads from `engine_sessions` → `engine_state`. 8 cascade domains, not just frozen-4. ADR-0186 pg-notify-bus filter migrated. Recorder dividend populated. `engine_sessions` reads gated behind read-only fallback flag for one release cycle, then table read-only, then dropped (separate later phase).

### Phase A4b — Emit `journey.*` Lifecycle Events (BLOCKED)

**DO NOT IMPLEMENT until all three gates pass:**
1. ADR-0248 accepted (B5 action handlers as canonical producer).
2. B5 action handlers implemented in `supabase/functions/engine-dispatch/` and emit `engine_step.reached` / `engine_run.completed` / `engine_run.failed`.
3. At least one consumer registered in `packages/telemetry/src/registry.ts` with verified end-to-end delivery to `activity_trail` + `engine_event`.

Until gates pass: do not write A4b code. Do not register placeholder events. Do not stub the producer. Mission-pool worker (Arena Harness construct) does NOT own emit; if it needs to surface state it invokes B5 handlers.

## Rules & Consequences

- **Good, because** ratifies ADR-0216 without 1-day-old reversal; specifies the missing implementation; closes phantom-consumer (L-0130) via B1 reader + B5 emit; A4 split prevents phantom-emit (L-0094) recurrence; all 4 reviewers' technical concerns convert to mandatory Phase A0/A1 deliverables.
- **Bad, because** 5–6 weeks honest cost (not "mostly mechanical"); 8 cascade domains must be enumerated and migrated, not just frozen-4; A4b emit deferred indefinitely until B5 producer ships.
- **Agent Impact:**
  - Capabilities continue writing `engine_sessions` until A2 dual-write flips. No frozen-4 contract change.
  - Stage-engine engineers must add `engine_state` reader paths in 27+ call sites across 9 files during A4a (largest: `core/session-manager.ts`, 6 sites, non-mechanical).
  - All NEW capability writes touching engine state ontology must use `engine_state.kind` discriminator after A1.
  - Mission-pool worker (Arena Harness) is forbidden from emitting `journey.*` directly — must invoke B5 handlers (per ADR-0248).
  - `appendConversationTurn` and other hot-path writers MUST be feature-flagged during A2.
  - Phase A3 backfill MUST filter active sessions (quiesce gate).

## Open Items

- ADR-0247 (schema relaxation) must be drafted alongside this ADR.
- ADR-0248 (B5 emit producer) must be drafted alongside this ADR.
- ADR-0215 (stuck-detector deferred Option C) reactivation conditions naturally met when Phase A4b lands — flip status to `accepted-A` at that point.
- PLAN-arena-harness-migration Phase 2 gate references ADR-0245 in earlier draft; updated reference is ADR-0246 (this ADR).

---

> Registered in `docs/decisions/0000-decision-log.md` after merge. Status `proposed` until Phase A0 lands; promote to `accepted` after A0 merges.
