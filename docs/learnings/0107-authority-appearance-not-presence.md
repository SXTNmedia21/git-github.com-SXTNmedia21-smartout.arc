---
title: "Authority Appearance ≠ Authority Presence — `gateAction` Call Is Intent, Not Evidence"
id: LEARNING_0107
status: canonical
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [authority, c4, gate-action, cve-class, daily-operation, council]
---

# Learning-0107: Authority Appearance ≠ Authority Presence

## Context

Council 2 of the 2026-04-22 daily-operation session reviewed the mutation paths of the reconciliation-v2 surface. A Phase 3 code-trace found that `apps/web/src/app/dashboard/reconciliation/_actions/override-reconciliation-action.ts:68` called `gateAction({ capability: "reconciliation.override", ... })` as part of the admin-override path. Line-level reading showed a present gate, authority wired in, `gate_evaluation` rows being produced. On paper, authorized.

The Phase 2.5 fact-check asked the next question: is `reconciliation.override` seeded in `engine_authority_config`? agent-coord grepped every migration under `supabase/migrations/` for `INSERT INTO engine_authority_config` containing the capability literal. Zero matches. Every admin-override since the feature shipped has therefore passed through `gate_action`, hit the no-config branch, and returned `allow=true, reason=NULL` — indistinguishable in the activity trail from an explicit allow.

This is a CVE-class finding. The surface reads as authorized in code review, but the runtime has no seeded authority record to evaluate against. Council 2 escalated it as a merge-blocker for the reconciliation-v2 milestone.

## Discovery

`gate_action` is built to fail-open when no `engine_authority_config` row exists for `(workspace, capability)`. That default is deliberate — it prevents the function from bricking every new capability during rollout — but it means the gate call site and the seed migration are two independent halves of the same contract:

- **Call site** — encodes *intent* to gate (developer declared "this capability requires authority").
- **Seed migration** — encodes *presence* of gating (`engine_authority_config` row exists, `min_role` set, override rules bound).

Without both halves, the call-site alone is a false-positive signal. Three structural reasons this keeps biting:

1. **`gate_evaluation.reason` is NULL in both default-allow and explicit-allow branches** — no log-side signal distinguishes the two.
2. **Type system can't enforce it** — capability literals are `string`, seed files are SQL, cross-surface relation is implicit.
3. **Code review trusts the call site** — reviewers see `gateAction(...)` and check it off, without running the second half of the check.

The "appearance of authority" trap has at least one prior occurrence (L-0097 — `cascade_gate_write` default-allow behavior). This is the second verified instance with a production surface still exposed.

## Impact

- **ADR-0189 (proposed, this council):** CI gate enforcing capability-literal ↔ seed-migration parity. Every `gateAction({ capability: "x.y" })` literal in `apps/`, `packages/`, `supabase/functions/` must have a matching `INSERT INTO engine_authority_config` in the migration tree. Extraction via `ts-morph` AST walk (see L-0111), not regex.
- **Immediate remediation:** `reconciliation.override` seed row added with `min_role='owner'` and override-tracking policy. Reconciliation-v2 milestone merge-blocked until seed migration lands.
- **Review-checklist addition:** Any PR touching `gateAction` requires reviewer to grep for the seed INSERT in the same PR or a prior accepted migration. "Uses gate_action" is never sufficient.
- **Audit-trail signal:** `gate_evaluation.reason` will be extended to distinguish `allow:default-no-config` from `allow:explicit-config` so the trap is visible in post-hoc audits, not only code review.

## References

- ADR-0099 (original `cascade_gate_write` / `gate_action` authority contract)
- ADR-0189 (proposed — CI capability ↔ seed parity check)
- Learning-0097 (C4 authority defaults are not free — prior occurrence of the same pattern)
- Learning-0111 (CI capability seed parity — the mechanical enforcement of this learning)
- `apps/web/src/app/dashboard/reconciliation/_actions/override-reconciliation-action.ts:68` (discovery site)
- Council 2 verdict, 2026-04-22 daily-operation session

---

> Registered in `docs/learnings/0000-learning-log.md`.
