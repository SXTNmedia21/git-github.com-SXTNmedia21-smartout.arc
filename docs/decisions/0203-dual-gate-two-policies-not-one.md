---
title: "Dual Authority Gates Are Two Policies, Not One"
id: ADR-0203
status: accepted
layer: decision
created: 2026-04-23
updated: 2026-04-23
module: authority
amends: [ADR_0091, ADR_0099]
related: [ADR_0024, ADR_0077, ADR_0078, ADR_0101, ADR_0138, ADR_0189, ADR_0190, ADR_0204, LEARNING_0066, LEARNING_0097, LEARNING_0107]
tags: [adr, authority, gate-action, cascade-gate-write, composition, council-2026-04-23, c1, c4, cascade-invariant-5]
---

# ADR-0203: Dual Authority Gates Are Two Policies, Not One

**Status:** Accepted
**Date:** 2026-04-23

## Context and Problem Statement

Council B1 (2026-04-23) opened with the premise that Smartout's two authority RPCs — `public.gate_action` (ADR-0099) and `public.cascade_gate_write` (ADR-0091) — represented a drift: "two gates doing the same job, need reconciliation." Plan B1 originally proposed **Option 3: a shared SQL core** extracted from both RPCs so one policy definition would feed both entry points.

Phase 3 Supervisor / agent-coord code-trace, end-to-end, from TS call site through RPC body into the tables each RPC reads, proved the premise false. The two RPCs share **zero** rule logic. They evaluate orthogonal questions against disjoint inputs and produce orthogonal outputs. Calling them "two gates that should unify" is a category error — they are **two policies that must compose**.

This ADR codifies the split as intentional and binds every future author, reviewer, and code-trace to the correct frame: `gate_action` is the **C4 capability-authority policy**; `cascade_gate_write` is the **C1 cascade data-rule policy**. They ran in parallel all along, and they must continue to.

## Decision Drivers

- **Cascade Invariant 5** (cascade model, section "Confident != Authorized"): C1 belief (truth/data-rule) and C4 permission (capability authority) are orthogonal. A shared SQL core that fed both would erase the invariant by giving one policy final say over the other.
- **Code-traced evidence (see table below):** the two RPCs read different tables, evaluate different predicates, and emit different artefacts. No shared predicate exists to extract.
- **L-0107 — "Authority appearance ≠ authority presence."** Option 3 would have produced a file named `authority_core.sql` that *looked* canonical and was in fact an arbitrary intersection of two policies — the classic false-security failure mode.
- **Migration header `cascade_gate_write.sql:7-9` already documents the split as intentional.** The "drift" framing was historical revisionism; the structural separation pre-dates the council.
- **Council 2026-04-23 verdict:** REJECT Option 3 unification variants. CHOOSE Option 4 composition orchestrator (ADR-0204).

## Evidence — Rule Matrix (from agent-coord Phase 3 code-trace)

| Dimension                       | `gate_action` (ADR-0099)                                                 | `cascade_gate_write` (ADR-0091)                                                        |
| ------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Policy class                    | **C4** — capability authority ("may this actor invoke this capability?") | **C1** — cascade data-rule ("does this write conform to the workspace's framework?")   |
| Primary input tables            | `engine_authority_config (workspace_id, capability)`                     | `workspace_framework_binding`, `framework_trigger`                                     |
| Fields read                     | `level`, `min_role`, `requires_four_eyes`, `allowed_channels`            | `framework_id`, `is_active`, trigger predicate match against `proposed_data`           |
| Context input                   | `p_capability`, `p_channel`, `p_actor_profile_id`, `p_action_type`       | `p_entity_type`, `p_entity_id`, `p_action`, `p_proposed_data`, `p_current_data`        |
| Historical input                | Four-eyes history (same actor recently approved same action)             | None — stateless per-row predicate evaluation                                          |
| External policy binding         | ADR-0077 (PII), ADR-0078 (channel guard voice→PII block), ADR-0101 (4E) | Regulatory framework (Riksavtalen, HMS), workspace tariff, workspace policy overrides  |
| On deny                         | Returns `{allow: false, reason}`; caller aborts                          | Creates `change_proposal` row; returns `{outcome: 'proposed', proposal_id}`            |
| On allow                        | Returns `{allow: true, downgrade_to?}`; caller proceeds                  | Returns `{outcome: 'applied'}`; row is written inside same transaction                 |
| Audit destination               | `gate_evaluation` (ADR-0099 §4.1)                                        | `gate_evaluation` + `change_proposal` on deny (ADR-0091 §WP2)                          |
| Shared predicate count          | —                                                                        | **0**                                                                                  |

Migration header excerpt (`supabase/migrations/20260512100000_cascade_gate_write.sql` lines 7–9), preserved verbatim:

```sql
-- NOTE: this RPC is NOT a substitute for gate_action (ADR-0099).
-- gate_action evaluates C4 capability authority (who may invoke).
-- cascade_gate_write evaluates C1 data-rule (does the diff conform to the framework).
```

The comment was written in the original WP2 ship and has been in `main` since 2026-04-18. The "two-gate drift" framing of plan B1 was an artefact of grep-count review (L-0082 / audit-inflation pattern), not a code fact.

## Considered Options

1. **Option 0 — Document only, no code change.** Writes an ADR that says "these are different" and leaves call sites inconsistent (some call only `gate_action`, some call only `cascade_gate_write`, some call neither). Rejected because it perpetuates the divergence at call sites — the actual defect is composition, not documentation.
2. **Option 1 — Drop `cascade_gate_write`.** Fold its logic into `gate_action`. Rejected because the two policies have different signatures (capability vs entity_type + diff), different audit shapes, and different denial semantics (deny-hard vs deny-via-proposal). Collapsing them deletes the C1/C4 distinction — CVE-class per Cascade Invariant 5.
3. **Option 2 — Drop `gate_action`.** Fold its logic into `cascade_gate_write`. Rejected harder: deletes channel guard (ADR-0078, voice-PII block), deletes four-eyes history (ADR-0101), deletes capability-authority evaluation. This is the combination flagged as CVE-class at council Phase 4.
4. **Option 3 — Shared SQL core.** Extract "a shared policy primitive" from both. Rejected because code-trace (Phase 3) returned zero shared predicates; the "shared core" would be an empty module. Worse, it would create the illusion of unification and invite a future PR that adds real shared logic there — collapsing the two policies via drift.
5. **Option 4 — Composition orchestrator (CHOSEN, contract in ADR-0204).** Keep both RPCs structurally separate. Add a TypeScript orchestrator that calls them in sequence (authority FIRST, data-rule SECOND) and writes one correlated audit trail. Every mutation in the codebase routes through the orchestrator. CI enforces "no inline RPC calls outside orchestrator."

## Decision Outcome

Chosen option: **"Two policies, not one — composed, not unified."**

- `gate_action` remains the canonical C4 capability-authority gate per ADR-0099.
- `cascade_gate_write` remains the canonical C1 cascade data-rule gate per ADR-0091.
- Neither RPC's body is to be merged, shared, or extracted into a common core.
- Every mutation must cross **both** policies in order (authority first), via the composition orchestrator specified in ADR-0204.
- CI enforcement, call-site migration, and discriminated-union return type are the subject of ADR-0204.

This ADR records the *why* — the policies are orthogonal. ADR-0204 records the *how* — the orchestrator contract.

## Rules & Consequences

- **Good, because** Cascade Invariant 5 (C1 belief vs C4 permission) is preserved in structure, not just in prose. A future reviewer cannot accidentally collapse the two policies without touching two distinct RPCs.
- **Good, because** the rejected-option catalogue (0/1/2/3) is now on record. A future council proposing "let's just unify the gates" can be answered with a pointer, not a re-litigation.
- **Good, because** the migration-header comment at `cascade_gate_write.sql:7-9` is now backed by an ADR, not a lone SQL comment that the next refactor could delete.
- **Bad, because** every mutation now demonstrably touches two gates (two RPC roundtrips per write). Mitigated by orchestrator batching and the fact that both RPCs are SECURITY DEFINER plpgsql — microseconds of latency per call.
- **Bad, because** "two gates per write" is a concept that must be taught to every new contributor. Mitigated by the CI grep rule (ADR-0204) that makes the pattern the only legal call path — learn-by-rejection rather than learn-by-doc.
- **Agent Impact:**
  - Any capability tool that performs a mutation MUST cross both policies via the orchestrator (ADR-0204). Inline calls to `supabase.rpc('gate_action', ...)` or `supabase.rpc('cascade_gate_write', ...)` are merge blockers outside orchestrator internals.
  - Future authority council plans MUST NOT propose "unify the two gates." The correct framing is always "compose the two policies."
  - Plan authors and code reviewers MUST check the rule-matrix table above before claiming the gates share any logic. The answer is zero shared predicates. Grep and code-trace, not intuition.

## Related ADRs

- ADR-0024 — C4 authority model (primer; this ADR is a direct descendant).
- ADR-0077 — PII handling (channel-restriction primitive lives inside `gate_action`).
- ADR-0078 — Channel restriction / voice-PII block (CVE-class if moved).
- ADR-0091 — Governance gate placement, `cascade_gate_write` RPC (amended here).
- ADR-0099 — Unified authority gate, `gate_action` RPC (amended here — "unified" refers to C4 capability authority across executors, NOT unification with C1).
- ADR-0101 — Four-eyes enforcement (history lives inside `gate_action`).
- ADR-0138 — Capability tool result shape (orchestrator return type extends this).
- ADR-0189 — Authority seed parity CI (pathway A).
- ADR-0190 — Pathway B orthogonal controls (establishes pathways as distinct).
- ADR-0204 — Composition orchestrator contract (the *how* to this ADR's *why*).

## Named Anti-Pattern

**"Two-gate drift is a category error."** Grep-count reviews that notice two gate-shaped RPCs and propose unification fail Phase 3 code-trace in this codebase every time. The policies are orthogonal by construction. Rule: before writing "unify the gates" in any plan, run the rule-matrix table above against current code. If the matrix is still all-different, the answer is composition (ADR-0204), not unification.

---

> Registered in `docs/decisions/0000-decision-log.md`.
