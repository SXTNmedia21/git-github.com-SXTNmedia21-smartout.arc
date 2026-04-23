---
title: "[DEPRECATED] Plan — Dual-Gate Reconciliation"
status: archived
deprecated: 2026-04-23
superseded_by: docs/plans/PLAN-dual-gate-composition.md
updated: 2026-04-23
created: 2026-04-22
module: ai-agent
tags: [plan, authority, gate-action, cascade-gate-write, wave-2b, adr-0091, adr-0099, campaign-b1, deprecated]
---

> **DEPRECATED 2026-04-23.** Council 2026-04-23 rejected all three options in this plan. Code-trace evidence proved the plan's load-bearing premise ("the two RPCs share most logic") was empirically false. Superseded by `PLAN-dual-gate-composition.md` (Option 4 — TypeScript composition orchestrator). See ADR-0203 + ADR-0204 + L-0133/0134/0135. Retained for audit trail only.

# Plan — Dual-Gate Reconciliation

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase B, item B1
> **Unblocks:** Wave 2B (capability dual-gate migration)
> **Related ADRs:** 0091 (gate-client), 0099 (unified gate), 0114 (Server Actions canonical), 0138 (tool result discriminated union, proposed)

## Goal

Synkronisér de to eksisterende authority gate-RPC-ene — `gate_action` (agent tools, ADR-0099) og `cascade_gate_write` (Server Actions, ADR-0091). **Begge beholdes.** Vi trekker delt logikk ut i én felles SQL-kjerne som begge RPC-wrappere delegerer til. Dette er konsolidering av eksisterende kode, ikke rewrite. Ingen RPC-signaturer endres utad — kallere merker ingenting.

## Context

Council 2026-04-18 (Gate-Client Wave 2) deferred WP4 (capability dual-gate) because:
- `gate_action` returns `{allow, downgrade_to, reason, gate_evaluation_id, four_eyes_required, approvers_needed, approvers_present}`
- `cascade_gate_write` returns a different shape (`{authorized, change_proposal_id}` — verify during impl)
- The two functions share most logic but not the same SQL. Policy changes in one place must be manually mirrored in the other. This is fragile.
- STATE-SUMMARY.md:59 calls this out: "Needs reconciliation ADR."

## Scope

**In:**
1. **Decide architectural pattern.** One of:
   - **Option 1:** Drop `cascade_gate_write`; Server Actions call `gate_action` via a small wrapper. Server Action layer adds `change_proposal` row creation on its side.
   - **Option 2:** Drop `gate_action`; agent tools call `cascade_gate_write` via a wrapper. Agent layer adds tool-result translation.
   - **Option 3:** Keep both but extract shared SQL into a third function `authorize_mutation()` that both call. RPC wrappers thin-shim on top.
   - Recommendation (to be validated in council): **Option 3** — shared core, thin wrappers. Preserves existing callers, aligns signatures incrementally.
2. **Write reconciliation ADR** (next number in sequence) documenting the chosen option.
3. **Implement the shared core.** New SQL function `authorize_mutation(workspace_id, capability, action_type, actor_profile_id, channel, entity_id?, approvers_present[]?)` returning a canonical shape. Both wrappers delegate.
4. **Contract tests** in `supabase/tests/`:
   - Identical inputs → identical decision from both RPCs.
   - Four-eyes state consistent across both paths.
   - Audit row (`gate_evaluation`) written exactly once.
5. **Migration guide** for remaining capability tools not yet on unified path.

**Out:**
- Renaming `gate_action` or `cascade_gate_write` (keep names for backwards compat).
- Changing tool result shape (that's ADR-0138 territory).
- Server Actions refactor (that's separate).

## Tasks

- [ ] **Survey** — list every call site of both RPCs. Map: which mutations go through which gate. Produce a 2-column inventory table.
- [ ] **Decide** — council review of Option 1/2/3. Produce ADR with decision + rationale.
- [ ] **Implement core** — new SQL function `authorize_mutation()`. Unit tests in PgTAP.
- [ ] **Wrap wrappers** — `gate_action` + `cascade_gate_write` become thin delegations.
- [ ] **Contract tests** — parity test suite: parametrize over every (capability, channel, role, authority_level) combination, assert both RPCs return identical decisions.
- [ ] **Run existing PgTAP suites** — `gate-action.sql`, `cascade-gate-write.sql` must continue to pass.
- [ ] **Observability** — add `gate_impl='core'|'action'|'cascade'` tag to `gate_evaluation` rows so we can monitor call-site distribution.
- [ ] **Unblock Wave 2B** — produce go/no-go for capability migration with Wave 2 memo's 5 integrity findings re-checked.

## Acceptance Criteria

- [ ] Reconciliation ADR accepted
- [ ] `authorize_mutation()` function exists + PgTAP tests pass
- [ ] Parity test: 100+ parametrized cases, both RPCs return identical `(allow, downgrade_to, reason)`
- [ ] No regression in `gate-action.sql` or `cascade-gate-write.sql` PgTAP suites
- [ ] `gate_evaluation` rows tagged with `gate_impl` for observability
- [ ] Wave 2B go/no-go decision produced (separate council note)
- [ ] HANDOFF written with migration guide for pending capability tools

## Risks

1. **Hidden rule divergence** — parity test may reveal existing rules that differ between the two gates. Stop, resolve the policy intent, encode the winner in the shared core. This is the point of the work.
2. **Performance** — adding a SQL function call wrapper is cheap but measurable. Benchmark on preview; target <1ms overhead.
3. **Four-eyes history** — `gate_four_eyes_history` lookup must work identically from both paths. Verify via parity test with 4-eyes cases.
4. **Breaking existing callers** — keep RPC signatures unchanged externally. Only internal delegation changes.

## Dependencies

- Phase A6 (observability) helpful for monitoring call-site distribution.
- ADR-0138 (discriminated union) optional — tool-result shape is orthogonal.

## Post-Implementation

- [ ] Wave 2B kickoff council with reconciled gate + fixed Wave 2 findings
- [ ] Update ADR-0091 + ADR-0099 cross-references to the reconciliation ADR
- [ ] CAMPAIGN B1 → complete
