---
title: "ADR-0303: Sortie 5 Task Ontology Cutover (Campaign Closure)"
id: ADR_0303
status: accepted
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0303: Sortie 5 Task Ontology Cutover (Campaign Closure)

## Context and Problem Statement

The Sortie 5 campaign (feat/sortie-5-task-cutover) implements the final two rows of the ADR-0298 task ontology plan:

- **Sortie 5a:** Wire voice-agent task surface (`services/voice-agent/src/tools-task.ts`) — 6 thin typed wrappers mirroring the `task` capability tool set, registered into the LiveKit adapter. Closes ADR-0298 row 5a.
- **Sortie 5b:** Hard-delete `operations.complete_task` tool + migrate all 6 caller sites + drop orphaned authority rows + promote ADR-0298 to accepted. Closes ADR-0298 row 5b.

Together, Sortie 5a + 5b complete the `operations.complete_task` → `task.complete` migration that began in Sortie 3 (ADR-0301) and close out the full ADR-0298 task ontology campaign.

## Decision

### Sortie 5a — Voice-agent task surface (shipped)

**R1.** `services/voice-agent/src/tools-task.ts` implements 6 tool wrappers:

- `list_tasks` → `task.list_mine`
- `create_personal_task` → `task.create_personal`
- `create_session_task` → `task.create_session`
- `create_day_ad_hoc_task` → `task.create_day_ad_hoc`
- `complete_task` → `task.complete`
- `cancel_personal_task` → `task.cancel_personal`

**R2.** Each wrapper is typed thin: validates params with Zod, constructs `AgentToolContext`, calls `tool.execute()`, returns string result. No business logic in the wrapper.

**R3.** Voice channel policy inherited from ADR-0298 R6: `create_*` and `cancel_personal` are chat-only V1 (PII risk on free-text names). `list_mine` and `complete` are available on voice.

**R4.** `services/voice-agent/src/adapter.ts` registers the 6 task tools alongside existing tools. `tools-task.ts` is the only new file.

**R5.** Vitest coverage for tools-task wrappers: 6 test cases (happy path per tool). Adapter registration test verifies tool names are present in final tool set.

### Sortie 5b — Hard-delete `operations.complete_task` (shipped)

**R6.** Pre-delete audit: 51 grep hits classified into 17 files with real content and 6 direct callers. All 6 callers migrated before tool deletion.

**R7.** `packages/ai/src/capabilities/operations/tools.ts` — `completeTask` tool definition deleted.

**R8.** `packages/ai/src/capabilities/operations/index.ts` — `completeTask` removed from all arrays. `operations` capability now exposes 1 tool (`createDeviation`).

**R9.** `apps/web/src/actions/complete-session-task.ts` — Server Action rewritten: no longer calls `gate_action` directly or issues raw UPDATE. Delegates to `task.complete.execute({id, source: 'session'}, ctx)`. Gate + emit now owned exclusively by the capability tool body (ADR-0099 + ADR-0134).

**R10.** `packages/ai/src/evals/operations.eval.ts` — `complete_task` fixtures deleted. Eval suite covers `createDeviation` only.

**R11.** `apps/e2e/botsson-harness/A5-operations-complete.spec.ts` — E2E spec removed (spec existed for the deleted tool; removal eliminates orphan test coverage).

**R12.** `supabase/migrations/20260608130000_drop_operations_complete_task_authority.sql` — Deletes `engine_authority_config` rows for `capability='operations.complete_task'`. Idempotent. Applied and verified locally (count=0).

**R13.** ADR-0298 promoted `proposed → accepted` with Closure note appended.

**R14.** `CLAUDE.md` Task Ontology section added under Data Model.

### Deferred (not in Sortie 5)

**D1.** `aliasTaskVerbs` shim in `tool-selector.ts:109-114` — remains live pending eval-gate (OPENROUTER_API_KEY unavailable in agent env). Drop in follow-on sortie when IC1-IC4 accuracy ≥95%.

**D2.** `intent-classifier.test.ts:162-208` IC4 test block — stays until shim drops.

**D3.** 30-day telemetry alias `task.added_manual` — Sortie 5c (2026-06-12).

**D4.** HMS module `useCompleteTask` direct-supabase call — separate sortie (ADR-0287 violation), lower priority than the capability migration.

**D5.** Emma in-memory `completeTask` — unrelated entity; ADR addendum if naming causes future confusion.

## Consequences

### Positive

- `operations.complete_task` is gone from the codebase. No accidental invocation possible.
- Single task completion path: `task.complete` tool → gate → UPDATE → emit.
- `operations` capability is clean: 1 tool, 1 purpose (createDeviation).
- ADR-0298 is accepted — the full campaign is durable architecture, not a proposed plan.
- Voice surface has complete task tooling aligned with capability registry.

### Negative / Risks

- `aliasTaskVerbs` shim adds routing overhead for intent-classifier calls until it drops (Sortie 5c).
- HMS `useCompleteTask` is still a direct-supabase write — ADR-0287 gap persists until its own sortie.

### Neutral

- The eval-gate skip (OPENROUTER_API_KEY absent) is a process gap, not a code gap. The shim is correct code — it just has not been validated by the eval harness yet.

## Cross-references

- ADR-0298: Task Ontology Five Sources (parent ADR, promoted to accepted by this campaign)
- ADR-0299: D6 RLS WITH CHECK hardening (Sortie A, related campaign infrastructure)
- ADR-0300: Task RPC read path (Sortie 2)
- ADR-0301: Task capability unification (Sortie 3, introduces `task.complete`)
- ADR-0302: Mobile Kalender task wire (Sortie 4)
- HANDOFF-voice-task-infra.md: Sortie 5a closure detail
- HANDOFF-hard-delete-operations-complete.md: Sortie 5b closure detail
