---
title: "Smart Cover via Event Engine"
id: ADR_0067
status: accepted
layer: decision
created: 2026-03-28
updated: 2026-03-28
module: scheduling
tags: [smart-cover, event-engine, cascade, council-approved]
---

# ADR-0067: Smart Cover via Event Engine

## Context and Problem Statement

When an employee reports absence, the restaurant manager must manually call 8+ people to find a replacement — the #1 operative pain point for shift-based hospitality managers. This process is time-consuming, error-prone, and often results in understaffed shifts. Smartout needs an automated cover flow that respects cascade dimensions, temporal locks, and existing engine architecture without introducing new database tables.

## Decision Drivers

- Must reuse existing `engine_process` / `engine_state` workflow orchestration — no new state tables
- Candidate eligibility logic must live in `packages/` for mobile parity (not `apps/web/`)
- Cover workflow authority must be separate from agent (Botsson) authority — C4 governance via `engine_authority_config`
- Race conditions on shift acceptance must be handled atomically
- Temporal shift lock (ADR-0066) compliance is mandatory
- Notification tiering: preferred candidates first, expand pool after timeout

## Considered Options

1. **Event Engine orchestration** — `engine_process` blueprint + `engine_state` instances, `schedule_control` action handler for candidate resolution, cover state in `engine_state.context`
2. **Dedicated cover tables** — New `cover_request`, `cover_candidate`, `cover_response` tables with custom workflow logic
3. **Agent-driven flow** — Botsson handles full orchestration via tool calls, no engine involvement

## Decision Outcome

Chosen option: **"Event Engine orchestration"**, because it reuses proven infrastructure, avoids schema sprawl, maintains the cascade principle that engine produces and agents consume, and keeps all workflow state in `engine_state.context` as typed metadata.

### Key Architectural Choices

**Engine authority is SEPARATE from agent authority.** C4 gate via `engine_authority_config` with `capability = 'smart_cover'`. The engine process has its own authority level independent of any conversational agent. "Confident != Authorized" applies — the engine may identify a perfect candidate but still require manager approval based on C4 policy.

**Agent (Botsson) is conversational surface only.** Three new tools added to the schedule capability: `getCoverStatus`, `requestCover`, `reviewCoverCandidates`. The agent does not drive automation — it provides a conversational interface to engine state. The engine drives the workflow.

**Provenance.** All shift mutations performed via cover carry `source_type = 'smart_cover'` and `source_id` pointing to the `engine_state.id`. This enables full audit trail and rollback traceability.

**Race condition handling.** Shift acceptance uses an atomic DB operation: `UPDATE schedule_shift SET accepted_by = $1 WHERE id = $2 AND accepted_by IS NULL RETURNING *`. If the RETURNING clause returns no rows, the shift was already claimed. No optimistic locking or retry loops.

**Temporal shift lock compliance.** All cover mutations respect ADR-0066 lock windows. A cover assignment within a locked period requires explicit unlock or elevated authority.

**Notification tiering.** Preferred candidates (same department, matching skills, availability confirmed in D2) are notified first. After a configurable timeout, the pool expands to adjacent departments and then to all eligible profiles. `profile.department_id` (singular FK) is used for department matching — there is no departments array.

**`schedule_control` action handler.** The `schedule_control` action type in `engine-dispatch` gets its first consumer. This handler resolves candidate eligibility by querying D2 (availability), D3 (rule compliance), and D1 (department envelope). Eligibility logic lives in `packages/ai/` (or a new `packages/scheduling/`) for mobile parity.

### Implementation Order

1. **Absence approval flow** — Manager approves/acknowledges absence, triggers cover engine process
2. **Cover engine process** — `engine_process` blueprint with steps: assess need → resolve candidates → notify tier 1 → wait → expand → notify tier 2 → wait → escalate to manager
3. **Cover response UI** — Employee accepts/declines via notification deep link, manager reviews candidates via dashboard or Botsson tools

## Rules & Consequences

- **Good, because** zero new database tables — all state in `engine_state.context` with typed TypeScript interfaces
- **Good, because** `schedule_control` handler becomes a real, tested code path instead of a reserved placeholder
- **Good, because** mobile parity from day one — eligibility logic in `packages/`, not `apps/web/`
- **Good, because** full provenance chain — every cover mutation traceable via `source_type = 'smart_cover'`
- **Bad, because** `engine_state.context` is a JSONB column — no DB-level schema enforcement on cover state (mitigated by Zod validation in TypeScript)
- **Bad, because** notification tiering adds complexity to the engine process blueprint — multiple wait/expand steps
- **Agent Impact:** 5 new telemetry events must be registered in `packages/telemetry/src/registry.ts`: `smart_cover.requested`, `smart_cover.candidates_resolved`, `smart_cover.offer_sent`, `smart_cover.accepted`, `smart_cover.escalated`. The `schedule_control` handler in `supabase/functions/engine-dispatch/index.ts` must be implemented. The `update_entity` handler allowlist must be extended to include `schedule_shift` mutations for cover assignments.

---

> Status: Accepted (Council session 2026-03-28, all 4 agents reviewed)
> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
