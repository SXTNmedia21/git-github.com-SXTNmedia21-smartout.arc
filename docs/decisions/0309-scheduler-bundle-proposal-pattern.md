---
title: "Scheduler Bundle Proposal Pattern — Single Row, JSONB Array, Atomic Accept"
id: ADR_0309
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
---

# ADR-0309: Scheduler Bundle Proposal Pattern — Single Row, JSONB Array, Atomic Accept

## Context and Problem Statement

ADR-0307 (greedy constraint-solver scheduler) requires the solver to write its
proposed plan to `change_proposal` for manager review under the existing C4
governance gate. ADR-0307's first draft assumed per-row proposals — N rows per
solver run, manager approves an arbitrary subset. G1 council (2026-05-14)
revealed this design collides with three runtime contracts that data-model
review missed:

- `mutateWithGate` helper (`packages/ai/src/capabilities/_shared/mutate-with-gate.ts:255-409`) is single-call, NOT bulk-aware. Per-row N-call loop produces N gate evaluations (correct provenance, N RPC round-trips). Single-call bulk-insert produces one gate eval for N writes — violates ADR-0099 "one gate eval per atomic write unit."
- ADR-0134 telemetry cardinality contract: bundle accept = one logical event. Per-row loop emits N "approved" events unless explicitly aggregated; recurring violation pattern (G4, B5).
- `change_proposal_status` enum has no `partial_applied` value. Per-row partial-accept needs either new enum value (cross-campaign DDL coordination) or row-level mix-of-statuses (Option A); single-row partial-accept needs JSONB mutation (violates Cascade Invariants 3/5/8).

Council G1 verdict (Phase 5, chair self-reversal per Skill §1.5): **single-row
bundle proposal with atomic all-or-nothing accept V1**. Defers per-row
partial-accept to V2 with documented migration paths.

## Decision Drivers

- `mutateWithGate` single-call structural constraint (Harness code-trace evidence).
- ADR-0134 one-emit-per-logical-event telemetry cardinality.
- Cascade Invariants 3 (reproducibility) + 5 (C1/C4 separation) + 8 (provenance) — JSONB must not be mutated post-creation.
- Nordic Split UX 40% reduction principle + animation budget on mid-tier Android (Frontend code-trace evidence).
- Greedy V1 solver is fast (sub-second) — re-run with adjusted constraints is acceptable V1 escape for partial-accept use case.

## Considered Options

1. **Option A — Per-shift `change_proposal` rows + new `proposal_group_id` correlation column.** Bulk-fits cascade audit granularity but breaks `mutateWithGate` single-call contract; Telemetry cardinality requires explicit bundle aggregation.
2. **Option B — One `change_proposal` row + `changes.proposed_shifts[]` JSONB + partial-accept via JSONB mutation.** Fits `mutateWithGate` but mutates JSONB post-creation = breaks Cascade Invariants 3/5/8.
3. **Option C — One `change_proposal` row + `changes.proposed_shifts[]` JSONB + atomic all-or-nothing accept V1, partial-accept deferred V2.** Fits all four constraints simultaneously.

## Decision Outcome

Chosen option: **Option C — single-row bundle, atomic accept V1, partial-accept deferred V2**.

### V1 Persistence Shape

- **One `change_proposal` row per solver run.**
- `kind` = `'scheduler_bundle'` (added to existing TEXT taxonomy via COMMENT update + adr-contract-audit slice).
- `trigger_type` = `'manual_override'` (existing enum value; manager-initiated solver run = human optimization; provenance lives in JSONB, not enum — per Agent-Coordinator + chair-conceded position).
- `changes` JSONB shape:

```jsonc
{
  "solver_version": "greedy_v1",
  "solver_run_id": "<uuid>",
  "solver_inputs_hash": "<sha256 of cascade D2+D3+D4+D6 snapshot>",
  "objective_score": 0.87,
  "gap_count": 3,
  "proposed_shifts": [
    {
      "shift_id_proposed": "<uuid>",
      "department_id": "<uuid>",
      "start_at": "2026-05-20T10:00:00Z",
      "end_at": "2026-05-20T18:00:00Z",
      "position_id": "<uuid>",
      "assigned_profile_id": "<uuid>",
      "rationale": "lowest-utilized eligible profile",
      "tariff_rule_ids": ["<uuid>", "<uuid>"]
    }
  ],
  "gaps": [
    {
      "department_id": "<uuid>",
      "start_at": "2026-05-20T22:00:00Z",
      "end_at": "2026-05-21T02:00:00Z",
      "position_id": "<uuid>",
      "blocker_codes": ["no_eligible_profile_after_aml_rest_check"]
    }
  ]
}
```

- **`changes` JSONB is IMMUTABLE post-creation.** No mutation paths; if accept-then-modify is needed, write a new `change_proposal` row.

### V1 Accept Semantics

- **Atomic all-or-nothing.** Manager accepts → all `proposed_shifts[]` apply; status flips `pending → applied`. Manager rejects → no shifts apply; status flips `pending → rejected`.
- **No partial-accept V1.** If manager wants subset, re-run solver with adjusted constraints (e.g., excluded employee, shifted time window).
- BFF `/api/scheduler/accept-bundle` (scoped per supervisor "one capability one BFF" convention; not generalized as `/api/proposals/accept-bundle`).
- Apply path: `mutateWithGate` wraps single UPDATE on `change_proposal` (status flip); after-update applier inserts N `schedule_shift` rows transactionally.
- `gateAction({capability: 'scheduler', actionType: 'accept_proposal'})` per ADR-0287.

### Capability Tools (3 total)

| Tool | Channel | mutateWithGate | gate actionType | emit() | Mobile? |
|---|---|---|---|---|---|
| `propose_plan` | chat-only (ADR-0288) | yes — bundle INSERT | `propose_plan` | `scheduler.proposal.proposed` | NO (Compose verb, web-only per ADR-0133) |
| `accept_proposal` | chat-only (ADR-0288) | yes — single UPDATE | `accept_proposal` | `scheduler.proposal.accepted` | YES (Approve verb, mobile-allowed per ADR-0133:R1) |
| `reject_proposal` | chat-only (ADR-0288) | yes — single UPDATE | `reject_proposal` | `scheduler.proposal.rejected` | YES (Approve verb) |

### Mobile V1 Surface

3 components only:

- `BundleCard` — proposal summary (date range, shift count, solver confidence summary like "47 of 50 fully staffed")
- `BundleActionBar` — bundle-granularity Accept ALL / Reject ALL buttons (no per-shift toggle V1)
- `ReadOnlyShiftList` — flat list of proposed shifts (employee + role + start/end time, no toggle affordances)

Per-row partial-accept on mobile = V2 affordance.

### V2 Migration Paths (documented for future)

If partial-accept demand surfaces post-launch, two migration options:

- **V2a — Promote to Option A.** Add `proposal_group_id UUID NULL` column with index `(workspace_id, proposal_group_id) WHERE proposal_group_id IS NOT NULL`. Split bundle into N rows. Add new BFF route `/api/scheduler/accept-subset` accepting `{ proposal_group_id, accepted_change_proposal_ids[] }`. Per-row gate evaluation accepted.
- **V2b — Add partial_applied semantic.** Add `partial_applied` value to `change_proposal_status` enum (cross-campaign DDL coordination required per `20260507110000` migration COMMENT). Track accepted indices in `changes.acceptance_decisions[]`.

V2 trigger: any workspace logging >2 partial-accept user-requests per cycle, or council escalation.

## Rules & Consequences

- **Good, because** satisfies all four runtime constraints simultaneously (mutateWithGate single-call, ADR-0134 telemetry, Cascade Invariants 3/5/8, Nordic Split UX).
- **Good, because** atomic accept = simple manager mental model (one decision per solver run, no opt-out checkbox column).
- **Good, because** JSONB immutability preserves provenance — re-run gives different `solver_run_id` not mutated history.
- **Bad, because** V1 forces re-run on partial-rejection; greedy solver must stay fast (<2s per run) for this to be acceptable UX.
- **Bad, because** future partial-accept requires migration (V2a or V2b path); V1 is a deliberate trade-off.
- **Bad, because** `changes` JSONB carrying 200+ shifts could grow large (~50KB at 200 shifts × 250 bytes per shift). Within TOAST threshold; revisit if any workspace exceeds 500 shifts/run.
- **Agent Impact:**
  - Scheduler capability MUST use `mutateWithGate` per ADR-0287 with single-call shape (one row INSERT, one row UPDATE — never loops).
  - Voice channel: all 3 tools chat-only per ADR-0288 (irreversible C4 act).
  - Mobile UI: bundle-granularity only V1; per-row toggle is V2 work.
  - Telemetry: one emit per logical event (one `proposed`, one `accepted` OR `rejected`, never both).
  - Provenance for solver-initiated proposals lives in `changes` JSONB (`solver_version`, `solver_run_id`, `solver_inputs_hash`), NOT in `framework_trigger_type` enum. Reuse `manual_override`.
  - Future scheduler-adjacent features (e.g., bulk-tariff update, batch-leave approve) MUST evaluate same single-row vs per-row pattern through this ADR's lens before defaulting to one or the other.

## Council Provenance

- G1 council, 2026-05-14. 5 reviewers (steward chair, supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer).
- Phase 3: 3-2 split (A: steward + supervisor + agent-coord; B: harness + frontend).
- Phase 5: chair self-reversal per Skill §1.5 (L-0147 6th precedent). Synthesis Option C accepted by chair.
- Falsifying evidence: `mutate-with-gate.ts:255-409` single-call body (Harness) + Nordic Split 40% reduction principle + Android animation budget (Frontend).
- Companion learnings: L-0247 (runtime-helper-constraints), L-0248 (provenance-in-JSONB-not-enum).

---

> Sibling to ADR-0307 (scheduler greedy V1) + ADR-0287 (mutateWithGate mandate) + ADR-0099 (one-gate-per-write) + ADR-0134 (telemetry cardinality) + ADR-0192 (authority seed pattern). Register in `docs/decisions/0000-decision-log.md`.
