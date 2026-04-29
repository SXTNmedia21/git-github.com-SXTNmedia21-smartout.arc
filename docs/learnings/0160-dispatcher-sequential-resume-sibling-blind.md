---
title: "Dispatcher Sequential Resume — Sibling Steps Invisible"
id: LEARNING_0160
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [engine-dispatch, council, post-implementation, code-trace, helpdesk-sla]
---

# Learning-0160: Dispatcher Resume Loop Only Matches Current Step — Sibling Branches Invisible

## Context

Helpdesk Phase 2 SLA wiring. Council 2026-04-28 (Steward + Engine Architect + Code Architect) ratified Approach A: extend `helpdesk_query_lifecycle` blueprint with steps 3+ to react to `helpdesk.query.sla_breached`. ADR-0234 + ADR-0233 written and committed. T2/T3/T4 implementation followed.

T2 builder (botsson-harness-builder/sonnet) flagged in their report after writing migration `20260428120000_helpdesk_sla_blueprint.sql`: *"the dispatcher's sequential resume model makes steps 3-5 unreachable for the breach path."* Self-verification by orchestrator (Read on `engine-dispatch/index.ts` lines 281-491) confirmed the bug.

## Discovery

The dispatcher has TWO state-creation paths:

1. **Trigger fire** (lines 281-389): always inserts `engine_state` with `current_step: 1` (line 348). No mechanism to spawn at any other step.
2. **Waiting-state resume** (lines 411-491): for each waiting state, finds `currentStep = steps.find(s => s.step_order === state.current_step)` (line 413). Match condition at line 441: `currentStep.action_payload.event === event_type`. **Sibling steps in the same process are invisible.**

`getStepsForState()` (lines 88-112) loads ALL steps for the state, but the resume loop only uses the array to find the single step at `state.current_step`. The rest is unused for matching.

Implication: if a process has steps [1: wait-for-A, 2: wait-for-B, 3: wait-for-C] and the state sits at step 2, an event of type C is silently ignored. No queue, no retry, no error. Step 3 only becomes reachable after step 2 completes via a B event.

This is "sequential single-branch state machine" semantics, NOT "concurrent multi-branch wait" semantics. The dispatcher has no parallel-branch primitive.

## Why The Pre-Implementation Council Missed This

The 4-reviewer pre-design council (Steward + Engine Architect + Code Architect) read the dispatcher code at lines 400-491 but READ THE WORDS, did not TRACE THE FLOW. The Steward reported "dispatcher resume loop checks `action_payload?.event === event_type` (line 441)" — true but incomplete. The unstated assumption was that the loop checked all steps. The Code Architect attempted to map step 3 from the migration to step 3 in execution, but did not test the assumption.

The bug was caught by **build-time code-trace** (T2 builder writing the migration and walking through what would actually happen at runtime), not by **pre-design code-review** (council reading the same code earlier).

This is the third documented occurrence of "concept-level review missed implementation reality" (see L-0023 "end-to-end payload tracing ≠ per-file review", L-0036 "4-layer review assignment", and now L-0160). The pattern: a reviewer can read every line of a function and still miss that the function's behavior contradicts the spec.

## Impact

**Process change for councils touching engine-dispatch contracts:**

- Phase 2.5 fact-check MUST include a "trigger-spawn vs resume" trace for any plan that adds blueprint steps. Specifically: enumerate which steps are reachable via spawn (always step 1) vs which are reachable only via resume from a previous step's completion. If the spec needs a step reachable from a non-sequential trigger, the design is wrong before T2.
- Code-tracer mandate (Phase 3 assignment) for dispatcher work MUST include: *"trace one event of each handled event_type from emit → engine_event row → dispatch routing → state creation OR resume → step execution. Do NOT just verify the matching code exists; verify the path reaches the intended step."*
- Build agents writing migrations against engine-dispatch SHOULD self-verify by writing the runtime trace as a header comment in the migration. If the trace doesn't terminate at the intended step, escalate before commit.

**Architectural addition for future councils:**

- The dispatcher's "sequential single-branch" semantics is a load-bearing constraint that has never been documented as an ADR. Capabilities that need parallel-branch waits (e.g., "wait for resolve OR sla-breach") must use **separate transient handler processes** (per ADR-0235), NOT sibling steps in the same process. This pattern should be promoted to Cascade Core Invariant.

**Concrete cost of this miss:**

- 1 council round burned (4 reviewers × ~120K tokens = ~480K tokens of opus pre-design)
- 3 build commits landed and partially reverted (T2 89862577 blueprint extension, T3 011c7546 trigger seed pointing at wrong process, T4 7ce3f46b dispatcher action_type — T4 is preserved, T2/T3 partially reverted)
- 1 follow-up council round (4 reviewers × another ~480K tokens)
- 2 ADRs written for the pre-design that need partial supersession (ADR-0234 marked `superseded-in-part`)
- 2 NEW ADRs written for the actual fix (ADR-0235 + ADR-0236)
- ~4 hours of orchestrator + build agent time

If Phase 2.5 had included a trigger-spawn-vs-resume trace, the bug would have been caught before T2. Estimated savings: ~3 hours + half the council token spend.

## References

- ADR-0234 (`docs/decisions/0234-helpdesk-sla-phase-2-design.md`) — original Approach A, marked `superseded-in-part`
- ADR-0235 (`docs/decisions/0235-helpdesk-sla-consumer-path-breach-handler-process.md`) — replacement consumer-path
- ADR-0236 (`docs/decisions/0236-update-context-targeted-action-type.md`) — cross-state action_type contract
- L-0023 — end-to-end payload tracing ≠ per-file review
- L-0036 — 4-layer review assignment for post-implementation councils
- `supabase/functions/engine-dispatch/index.ts:281-491` — the spawn + resume code
- Council session 2026-04-29 (this council)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
