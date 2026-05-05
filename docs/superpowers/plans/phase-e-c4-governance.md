---
title: Phase E — C4 Governance Control Plane
status: approved_with_changes
updated: 2026-04-14
created: 2026-04-14
module: cascade
tags: [cascade, c4, governance, planning]
---

# Phase E — C4 Governance Control Plane

> "Confident != Authorized" — C1 determines belief, C4 determines permission.

## Council Review

Reviewed by System Council on **2026-04-14**. Verdict: **APPROVE WITH CHANGES**.

- Agents consulted: system-steward (chair), supervisor, system-agent-coordinator. frontend-designer skipped — 95% backend.
- Full entry: [`docs/council/COUNCIL-LOG.md`](../../council/COUNCIL-LOG.md) under `2026-04-14 — Phase E C4 Governance Plan Review`.
- Blocking outcomes, all reflected in this revised plan:
  - ADR-0091 commits governance gate to Postgres RPC with `SECURITY DEFINER`, covers service-role callers.
  - ADR-0093 routes `contract_draft` proposals through the same `apply_cascade()` dispatch as all other cascade mutations (amends ADR-0076).
  - ADR-0094 promotes `framework_rule.severity` from TEXT to enum `rule_severity`; WP1's `evaluate-rules.ts` is retrofitted before WP2 begins.
  - WP1 → WP2 → WP3 is strict sequential, not parallel.
  - WP8 deferred to Phase E.1 (blocked on C1 implementation).
  - WP7 promoted from P1 to P0.
  - `cascade_initiator` enum is NOT extended — authorization context lives in `change_proposal.policy_decision`.
  - Canonical agent tool response shape for governance outcomes established in ADR-0091.
  - `engine_authority_config.min_role` enforcement in the tool-selector is a prerequisite for WP4.

## Pre-WP2 Decisions

Three ADRs MUST be accepted (and for ADR-0094, the migration and retrofit merged) before WP2 opens a branch:

- **[ADR-0091](../../decisions/0091-governance-gate-placement-postgres-rpc.md)** — governance gate lives in a `SECURITY DEFINER` Postgres RPC; agent tools return canonical `GateResponse`.
- **[ADR-0093](../../decisions/0093-contract-draft-proposals-unified-cascade.md)** — `contract_draft` uses the unified `apply_cascade()` dispatch (amends ADR-0076).
- **[ADR-0094](../../decisions/0094-framework-rule-severity-enum.md)** — severity enum + documented mapping + WP1 retrofit commit.

## 1. Current State

**Schema (already exists):**

- `engine_authority_config` — per-workspace, per-capability authority levels (`autonomous | confirm | suggest | read_only | disabled`) + `min_role`
- `change_proposal` — full Terraform-style saved plan: `status` (pending/approved/applied/rejected/expired), `changes` JSONB, `preview` JSONB, `input_state_hash`, `risk_score`, `policy_decision`, `policy_rule_ids`, `approval_required`, approval/rejection audit fields, impact counts
- `evaluation_outcome` enum — `allowed | allowed_with_exception | review_required | blocked`
- `change_proposal_status` enum — `pending | approved | applied | rejected | expired`
- `cascade_initiator` enum — `cascade_engine | admin_manual | c1_calibration | bootstrap` (NOT being extended — see ADR-0091)
- `framework_rule` — `default_outcome`, `severity` (→ enum per ADR-0094), `outcome_overridable`, `config_tighten_allowed`, `config_loosen_allowed`, `override_min_level`, `evaluation_config` JSONB
- `workspace_rule_override`, `workspace_framework_binding`, `framework_trigger` + `framework_trigger_type` enum

**Application code (already exists):**

- `packages/data/src/permissions/check.ts` — C4 RBAC permission matrix (`checkPermission(role, entity, operation, isOwnData)` → `allowed | denied | needs_approval`), 30+ rules. ADR-0091 unifies `needs_approval` with the gate's `review_required`.
- `packages/data/src/cascade/classify.ts` — entity classification with `isGovernanceGated()`
- `packages/data/src/cascade/evaluate-rules.ts` — WP1 evaluator (SHIPPED during council review, 23 tests green; requires ADR-0094 retrofit before WP2)
- `apps/web/src/app/dashboard/ai/_hooks/use-authority-config.ts` — hook for engine_authority_config (8 capabilities)
- `apps/web/src/app/dashboard/ai/config/page.tsx` — admin UI for Mr. Botsson authority
- `apps/web/src/app/dashboard/settings/_hooks/use-change-proposals.ts` — create/approve/reject/apply
- `apps/web/src/app/dashboard/settings/_components/ChangeProposalsPanel.tsx` + `ChangeProposalDialog.tsx`
- `supabase/functions/apply-change-proposal/index.ts` — handles 3 change types via if/else (workspace_hours, department_hours, department_type). Replaced by unified `apply_cascade()` in WP2.

**ADRs:**
- ADR-0056 — cascade as independent layer, lists `derive_impacts()`, `compute_cascade_preview()`, `persist_change_proposal()`, `apply_cascade()` as NOT implemented
- ADR-0076 — contract composition produces `change_proposal` of type `contract_draft` (amended by ADR-0093)
- ADR-0085 — year wheel governance policy
- ADR-0090 — evaluation config schema (Phase E / WP1)
- **ADR-0091, 0093, 0094** — Phase E structural decisions (see Pre-WP2 Decisions above)

## 2. Gap Analysis

| Gap | Description | Status |
|-----|-------------|--------|
| G1  | No framework evaluation gate in write path. `isGovernanceGated()` exists but nothing calls it before mutations | **Partially resolved** — ADR-0091 commits to Postgres RPC gate, implementation in WP3 |
| G2  | No `apply_cascade()` pure function. Current apply is hardcoded if/else | WP2 |
| G3  | No proposal generation from cascade-input mutations (only manual admin path) | WP2/WP3 |
| G4  | No rule evaluation engine. `evaluation_config` JSONB has no interpreter | **Shipped** (WP1) — retrofit pending per ADR-0094 |
| G5  | No monitor-mode rule graduation (shadow mode observe → graduate to enforcing) | WP6 (ADR-0092 reserved) |
| G6  | No governance audit trail (structured log of decisions) | WP7 (promoted P0) |
| G7  | No staleness detection (`input_state_hash` column unused) | WP5 |
| G8  | Proposal expiration not enforced (`expires_at` column unused) | WP5 |
| G9  | `engine_authority_config` disconnected from cascade proposal pipeline | WP4 (gated by `min_role` prerequisite) |
| G10 | No C4-to-C1 gating (planning_factors/adjustment_factors writes are ungated) | **Deferred** to Phase E.1 (was WP8) |

## 3. Work Packages

| WP  | Name | Effort | Dependencies | Priority |
|-----|------|--------|--------------|----------|
| WP1 | Rule Evaluation Engine **(shipped; severity retrofit per ADR-0094 before WP2)** | 3-5d | — | P0 |
| WP2 | Cascade Preview Pipeline (`derive_impacts`, `compute_cascade_preview`, `persist_change_proposal`, `apply_cascade`, `computeStateHash`) + `contract_draft` handler (ADR-0093) | 5-8d | WP1 retrofit | P0 |
| WP3 | Governance Gate RPC (ADR-0091) + gate client in `@smartout/data` + mutation wrappers | 3-5d | WP2 | P0 |
| WP4 | Authority Config ↔ Cascade Integration | 2-3d | WP3 + `min_role` prerequisite | P1 |
| WP5 | Staleness Detection + Expiration Enforcement | 2-3d | WP2 | P1 |
| WP6 | Monitor Mode + Rule Graduation | 3-5d | WP1, WP3 | P2 |
| WP7 | Governance Audit Trail (`governance_audit_log` table) | 2-3d | WP3 | **P0** (promoted from P1 — every gate decision writes here) |
| ~~WP8~~ | ~~C4 Gating of C1 Writes~~ | — | — | **DEFERRED — blocked on C1 implementation. Moved to Phase E.1.** |

**Implementation order: WP1 (retrofit) → WP2 → WP3 → WP7 → WP4 / WP5 → WP6.** Strict sequential through WP3; WP4 and WP5 can run in parallel after. WP8 is not in scope.

**Prerequisite outside Phase E scope:** tool-selector in `packages/ai/src/router/tool-selector.ts` must enforce `engine_authority_config.min_role` before WP4 opens. Flagged by agent-coordinator; this is a C4-boundary correctness fix that cannot wait for WP4.

**Total scope (revised, excluding WP8): 20-32 engineering days.**

## 4. Schema Changes

**New tables:** `governance_audit_log` (WP7)

**Modified tables:**
- `framework_rule`: `severity TEXT` → `severity rule_severity` (ADR-0094, lands ahead of WP2)
- `workspace_rule_override`: add `enforcement_mode` (`enforcing | monitoring | disabled`), `monitor_hit_count`, `monitor_since` (WP6)
- `engine_authority_config`: add `cascade_change_types TEXT[]` (WP4, post-selection filter — see Agent Integration Contract), add `gate_enforcement_mode` (ADR-0091 rollback flag)

**New enums:**
- `rule_severity` — `info | warning | hard_block` (ADR-0094)
- `enforcement_mode` — `enforcing | monitoring | disabled` (WP6)

**Enums NOT extended (per council):**
- `cascade_initiator` — authorization context stays in `change_proposal.policy_decision`, not an initiator variant.
- `framework_trigger_type` — no `authority_check` or `c1_calibration_write` additions; those are handled by the gate, not triggers.

## 5. ADRs Needed

- **ADR-0090** — Evaluation Config JSON Schema (WP1) — **accepted 2026-04-14**.
- **ADR-0091** — Governance Gate Placement (WP3) — **accepted 2026-04-14**. Postgres RPC with SECURITY DEFINER; unifies `checkPermission()` with gate; agent tool response convention.
- **ADR-0092** — Monitor Mode Graduation Criteria (WP6) — **reserved**.
- **ADR-0093** — Contract Draft Proposals Through Unified `apply_cascade()` (amends ADR-0076) — **accepted 2026-04-14**.
- **ADR-0094** — Framework Rule Severity as Enum — **accepted 2026-04-14**.

## 6. Risks & Open Questions

**R1 — Rego/OPA migration complexity.** Defer. Start with typed condition tree (ADR-0090).

**R2 — Rule evaluation performance in hot path.** Mitigate by caching resolved rules per workspace, evaluate in-process. Gate RPC latency budget: p95 < 40ms including audit insert (validated in WP3 smoke tests).

**R3 — C1 dependency.** WP8 is theoretical until C1 calibration is producing writes. Moved to Phase E.1.

**R4 — Approval flow UX scaling.** Auto-generated proposals from WP3 will increase volume. Admin UI needs filtering, bulk actions, priorities, notifications.

**R5 — `confirm` authority level has no UI.** ADR-0091 accepts this known limitation. `confirm` maps to `review_required` until a dedicated inline-confirm UI ships (tracked against WP4).

**Resolved questions:**

- ~~**Q1 — Unify `checkPermission()` with governance gate?**~~ Resolved by ADR-0091. `checkPermission()` remains the in-process pre-flight check for UI enablement; the RPC is authoritative for writes. `needs_approval` and `review_required` are the same signal.
- ~~**Q2 — How does ADR-0076 contract composition interact with governance gate?**~~ Resolved by ADR-0093. Same `apply_cascade()` dispatch, dedicated `contract_draft` handler.
- ~~**Q3 — `framework_rule.severity` is TEXT.**~~ Resolved by ADR-0094. Enum `rule_severity` with three values, mapping documented.

## 7. Cross-WP Invariants

These must hold for every Phase E work package, not restated per WP:

- Every governance-gated mutation emits via `@smartout/telemetry` — no mutation without `emit()`.
- `apply_cascade()` dispatch table is the ONLY path to proposal application. No if/else, no parallel apply functions, no "special case for X".
- No client-side or Next.js-specific code in `packages/data/src/cascade/` — it must run in Edge Functions and React Native.
- RLS is workspace-scoped with BOTH JWT and API-key policies for every new table.
- Severity and outcome are distinct dimensions (per ADR-0094) — never collapse them into one column.
- Gate outcome, audit row insert, and proposal row insert live in one transaction.

## 8. Telemetry Events

Minimum registry entries per WP, registered in `packages/telemetry/src/registry.ts` as part of that WP's PR:

**WP2 — Preview Pipeline**
- `change_proposal.applied` — fired by `apply_cascade()` handler on successful materialisation
- `change_proposal.failed` — fired on handler exception; includes failure reason

**WP3 — Governance Gate**
- `governance_gate.blocked` — gate returned `blocked`; includes rule codes that fired
- `governance_gate.review_required` — gate created a proposal; includes `proposal_id`
- `governance_gate.allowed_with_exception` — write proceeded under exception; includes `exception_reason`
- `change_proposal.created` — gate-initiated proposal insert (distinct from admin-initiated)

**WP5 — Staleness / Expiration**
- `change_proposal.expired` — sweep expired a pending proposal past `expires_at`
- `change_proposal.superseded` — newer proposal invalidates an older one on the same entity

**WP6 — Monitor Mode**
- `rule_override.graduated` — monitor-mode rule graduates to enforcing
- `rule_override.enforcement_changed` — admin toggle of enforcement mode

**WP7 — Audit Trail**
- Every governance decision writes a `governance_audit_log` row, always. This is non-negotiable; the RPC's last action before returning success is the audit insert.

## 9. Agent Integration Contract

Addresses agent-coordinator findings C1–C6 from the council review:

- **`cascade_change_types TEXT[]`** (new column on `engine_authority_config`, WP4) is a **post-selection filter**. It narrows what an already-selected capability is authorized to touch. It is NOT a tool-visibility gate — tools are selected by capability and `min_role`, not by change type.
- **`min_role` enforcement** is a prerequisite for WP4. Implement in `tool-selector.ts` before WP4 starts; not a WP4 deliverable.
- **Tool response shape** for every governance-gated operation (per ADR-0091):
  ```ts
  type GateResponse =
    | { ok: true;  outcome: 'applied' }
    | { ok: true;  outcome: 'applied'; exception_reason: string }
    | { ok: false; outcome: 'proposed'; proposal_id: string; reason?: string }
    | { ok: false; outcome: 'blocked'; reason: string };
  ```
  Tools returning `{ success: boolean }` are non-conforming and must migrate in WP3.
- **Non-goal for Phase E:** `memory`, `knowledge`, and `payroll` capabilities are explicitly out of scope. They will be evaluated against the governance gate in a later phase; Phase E does not add gate coverage for them.
- **Channel restrictions** (ADR-0078) are preserved end-to-end by the `contract_draft` handler (ADR-0093). Tools in `contract_intake` must assert `ctx.channel === 'chat'` at tool entry.
- **Service-role callers** (`stage-engine`, cron jobs, scripts) must register a service identity in `engine_authority_config` to pass `assert_gate_caller()` (ADR-0091).

## 10. Proof Tests

Required tests before WP3 can merge. At least one test per invariant, colocated with the artifact it proves:

- **Deterministic re-derivation** — same inputs to `derive_impacts()` + `compute_cascade_preview()` produce byte-identical `change_proposal.changes` JSONB.
- **Provenance completeness** — every applied `contract_draft` has a populated `employment_contract.compliance_provenance` matching ADR-0076's shape.
- **C1/C4 separation** — a workspace with low C1 confidence still passes C4 if the write is authorized; a workspace with high C1 confidence still blocks at C4 if the write is not authorized. "Confident != Authorized" is a test, not a slogan.
- **Override precedence (K1b > K1a)** — workspace-level `workspace_rule_override` always beats platform-level `framework_rule` for rules where `outcome_overridable = true`.
- **Idempotency** — re-running `apply_cascade()` on an already-applied proposal is a no-op that returns the original result, not a second insert.
- **Cross-workspace isolation** — a gate call with workspace A's context can never produce a proposal or audit row in workspace B. RLS + `assert_gate_caller()` coverage.
- **Telemetry-to-domain consistency** — for every `governance_gate.*` event emitted, there is exactly one matching `governance_audit_log` row with the same decision timestamp.

## 11. Critical Files

- `packages/data/src/cascade/classify.ts` — source of truth for governance gate routing
- `packages/data/src/permissions/check.ts` — existing RBAC matrix, unified with gate per ADR-0091
- `packages/data/src/cascade/evaluate-rules.ts` — WP1 evaluator, retrofitted per ADR-0094 before WP2
- `supabase/functions/apply-change-proposal/index.ts` — hardcoded apply, replaced by `apply_cascade()` in WP2. **Note:** the file header references a nonexistent `apply_cascade_proposal` RPC; the body is authoritative. Delete or correct the header during the WP2 replacement.
- `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql` (lines 417-484) — change_proposal definition
- `supabase/migrations/20260421200100_cascade_a2_framework_tables.sql` — framework_rule with `evaluation_config`
- `supabase/functions/engine-dispatch/index.ts` — existing condition evaluator pattern (reference for ADR-0090)
- `packages/ai/src/router/tool-selector.ts` — must enforce `engine_authority_config.min_role` before WP4 starts
