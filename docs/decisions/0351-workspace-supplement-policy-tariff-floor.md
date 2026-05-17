---
title: "Workspace-supplement-policy — tariff-minimum floor; admin overrides allowed UP, never DOWN"
id: ADR_0351
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [lovsen, payroll, supplement, policy, tariff, floor, workspace, aml-14-15, phase-7d]
amends: none
related_adrs: [ADR-0250, ADR-0252, ADR-0076, ADR-0347, ADR-0350, ADR-0352, ADR-0353, ADR-0354]
---

# ADR-0351: Workspace-supplement-policy — tariff-minimum floor

## Introduction

Three binding principles govern workspace-level supplement overrides:

- **Override UP is always allowed.** A tariff-bound workspace can set any supplement rate *higher* than
  the tariff minimum. More generous terms for the worker are unconditionally legal and encouraged
  ("rørige og dynamiske tillegg" per Pontus directive).
- **Override DOWN is forbidden for tariff-bound workspaces.** Setting a rate *below* the tariff minimum
  violates Aml. §14-15 (lønnstrekk-forbud) for tariff-bound workspaces — the employer cannot effectively
  reduce wages below the collectively agreed floor, regardless of individual agreement.
- **Non-tariff-bound workspaces have no floor.** If `is_tariff_bound = false` on
  `workspace_settings`, admin sets any rate freely. The capability tool emits a Lovsen-sourced advisory
  ("Riksavtalen-norm er X kr/t — du står fritt") but does not block.

The DB CHECK constraint enforces the floor at write-time for tariff-bound workspaces. The capability
tool `add_supplement_override` validates client-side first; the DB constraint is defense-in-depth.

---

## Context and Problem Statement

ADR-0347 (Lovdata canonical source) and the Dynamic-MCP-fetch pattern seed `tariff_rate_table` with
authoritative rates fetched from `lovsen-lovdata-mcp`. This gives admin a live reference. The admin
UX then exposes a per-supplement override surface: admin can adjust rates per workspace to reflect
local agreements, bonuses, or company generosity.

Without a policy ADR, the override tool could trivially write a rate *below* the tariff minimum —
either through misconfiguration or intentional erosion. For tariff-bound workspaces this is a direct
Aml. §14-15 lønnstrekk-forbud violation: the employer may not recover, waive, or structurally reduce
wages below the tariff-agreed minimum, even with employee consent.

The Lovsen Phase 5 council review identified this as a blocker: existing ADRs define tariff versioning
(ADR-0252) and snapshot-and-forward (ADR-0076) but not the runtime policy governing admin override
direction.

---

## Decision Drivers

- **Aml. §14-15 — lønnstrekk-forbud.** Employer cannot withhold or structurally reduce pay below
  minimum for tariff-bound employees. A workspace supplement rate set below the tariff floor is
  economically equivalent to a lønnstrekk on every affected shift.
- **Aml. §14-6(m) — tariff-binding declared in contract.** When `employment_contract` declares
  tariff-binding, the worker's minimum supplement rights are set by the tariff. Workspace policy
  cannot override this downward.
- **ADR-0252 §F — endringsoppsigelse-vurdering.** Material downward changes to pay terms require
  constructive-dismissal evaluation. A permanent downward override is a structural change of that
  class.
- **ADR-0076 — snapshot-and-forward principle.** Override provenance must be traceable: every
  override carries `reason`, actor, and tariff baseline at the time of write.
- **Defense-in-depth.** ADR-0186 (audit trail) and the broader Smartout security posture require
  that DB constraints are not the first line of defense but must exist as the last. Client-side
  validation alone is insufficient.
- **Pontus directive: "rørige og dynamiske tillegg."** Admin authoring power in the UP direction is
  a product requirement. The floor policy must not impede flexible, generous local supplements.
- **Lovsen Phase 5 council blocker.** Phase 7d cannot ship the supplement override capability tool
  without a canonical policy governing allowed direction.

---

## Considered Options

### Option A — No floor: admin can set any rate

Admin has full freedom in both directions. UI shows tariff reference but does not restrict.

**Rejected because:** For tariff-bound workspaces this is a direct Aml. §14-15 violation risk on
every downward override. Smartout cannot ship a tool that makes illegal payroll configurations
trivially expressible. The liability transfers to the workspace operator but Smartout's platform
would be the proximate cause.

### Option B — Floor at UI layer only (client-side validation)

The capability tool validates `override_value >= tariff_minimum` before writing. No DB constraint.

**Rejected because:** Defense-in-depth requires DB enforcement. Any direct DB write, migration
backfill, or future tool that bypasses the capability layer would silently install an illegal
override. The DB is the last enforcer; relying on client validation alone is the same class of
error as "no RLS because the app validates first."

### Option C — DB CHECK + capability tool client-side validation (chosen)

A CHECK constraint on `supplement_rule` (or `supplement_override`, per Phase 7d schema) enforces
`rate_value >= tariff_minimum_for(supplement_type, active_union)` for tariff-bound workspaces.
The capability tool `add_supplement_override` validates client-side first and returns a clear error
citing Aml. §14-15 before any DB round-trip. Non-tariff-bound workspaces: no floor at either layer.

**Chosen because:** Two-layer enforcement matches the defense-in-depth principle. Admin retains full
UP-direction flexibility. Illegal downward overrides are structurally impossible, not merely warned
against.

---

## Decision Outcome

**Chosen: Option C — DB CHECK + capability tool client-side validation.**

### Schema constraint (pseudo-SQL; exact form in Phase 7d migration)

```sql
ALTER TABLE payroll.supplement_rule
  ADD CONSTRAINT supplement_rule_tariff_floor CHECK (
    CASE
      WHEN workspace_id IN (
        SELECT workspace_id FROM payroll.workspace_settings
        WHERE is_tariff_bound = true
      )
      THEN rate_value >= (
        SELECT MIN(rate_value)
        FROM public.tariff_rate_table
        WHERE supplement_type = payroll.supplement_rule.supplement_type
          AND tariff_id = (
            SELECT active_union
            FROM payroll.workspace_settings
            WHERE workspace_id = payroll.supplement_rule.workspace_id
          )
      )
      ELSE TRUE
    END
  );
```

The exact column names, `active_union` reference, and subquery join path depend on the Phase 7d
schema migration (see Implementation gates T1). This pseudo-SQL is a semantic specification, not
final SQL.

### Capability tool: `add_supplement_override`

Signature: `add_supplement_override(supplement_type, override_value, reason)`

Behavior:

- **Tariff-bound workspace (`is_tariff_bound = true`):**
  - Fetch `tariff_minimum = tariff_minimum_for(supplement_type, active_union)` from K1a layer.
  - If `override_value < tariff_minimum`: reject with structured error
    `{ code: "SUPPLEMENT_BELOW_TARIFF_FLOOR", aml_ref: "§14-15", tariff_min: X, proposed: Y }`.
    UI surfaces: "Satsen er under tariff-minimum (X kr/t). Aml. §14-15 forbyr dette for
    tariff-bundne arbeidsplasser."
  - If `override_value >= tariff_minimum`: proceed to DB write.
- **Non-tariff-bound workspace (`is_tariff_bound = false`):**
  - Accept any rate ≥ 0.
  - If `override_value < tariff_minimum_for(supplement_type, 'riksavtalen')`: emit Lovsen advisory
    (non-blocking): "Riksavtalen-norm er X kr/t — du står fritt til å sette lavere."
- **Always:** `reason` parameter is required (non-empty string). Written to `activity_trail`.
- **Gate:** `gate_action: "payroll.add_supplement_override"` — confirm-class, admin-only
  (C4 authority per ADR-0204).

---

## Override Types Allowed (tariff-bound workspaces)

| Type | Description | Allowed |
|---|---|---|
| **UP-override** | Rate higher than tariff minimum for the supplement type | Always |
| **LOCAL-supplement** | Supplement type NOT covered by tariff (e.g. "drikkepenger workplace-bonus") | Always (floor = 0) |
| **CONDITION-NARROW** | Tariff fires on broad condition; workspace narrows scope | Allowed if narrowed hours still pay ≥ tariff rate for affected hours |

---

## Override Types Forbidden (tariff-bound workspaces)

| Type | Description | Enforcement |
|---|---|---|
| **DOWN-override** | Rate lower than tariff minimum | DB CHECK rejects; capability tool rejects client-side |
| **CONDITION-WIDEN** | Tariff fires on narrow condition; workspace widens such that already-covered hours pay less | DB CHECK rejects on rate basis |
| **SKIP-tariff** | Removing a tariff-defined supplement entirely | DB rejects (must use UNION-SWITCH flow per ADR-0353) |

---

## Audit Trail

Every successful `add_supplement_override` call fires event
`payroll.supplement_override_created` registered in `packages/telemetry/src/registry.ts`.

Payload:

```typescript
{
  supplement_type: string;
  tariff_min: number;          // tariff floor at time of write
  override_value: number;
  reason: string;
  workspace_id: string;
  actor_id: string;            // profile_id of admin
  is_tariff_bound: boolean;
  active_union: string | null;
}
```

Four-destination routing per CLAUDE.md §"Telemetry": PostHog, Logger, activity_trail, engine_event.
Append-only to `activity_trail` per ADR-0186. The `tariff_min` field at write-time is load-bearing:
it provides the audit evidence that the override was above-floor at the moment it was created, even
if the tariff floor later changes (see Edge case: lønnsoppgjør below).

---

## Edge Cases

### Lønnsoppgjør: tariff floor rises above existing override

When `tariff_rate_table` is updated via ADR-0252 bulk-amendment flow, existing overrides whose
`rate_value` was above-floor at creation may now be below the new floor.

Handling:

1. Background cron (Phase 7f T3) runs after each `framework.tariff_version_changed` event and
   evaluates all active `supplement_rule` rows for tariff-bound workspaces.
2. Rows now-below-floor are flagged with a new status column `floor_violation_pending = true`.
3. Admin is notified via the amendment inbox. Future payroll calculations for affected supplement
   types are blocked until admin either raises the override or removes it (reverting to tariff
   default).
4. The `floor_violation_pending` flag does NOT retroactively invalidate already-calculated shifts.
   Historical `shift_pay_calculation_event` rows are immutable per ADR-0251.

### Multiple active_union (rare)

When a workspace has employees bound to more than one tariff (e.g. Riksavtalen Fellesforbundet +
Riksavtalen Parat), the floor for a given `supplement_type` is `MAX(floor_fellesforbundet, floor_parat)`.
The DB CHECK subquery takes `MIN(rate_value)` across all matching tariff rows for the workspace's
unions. Phase 7d schema must ensure `active_union` can accommodate multiple values (array or
join table) before this edge case is reachable.

### Non-tariff supplement types

For supplement types not covered by any `tariff_rate_table` row for the workspace's union,
`tariff_minimum = 0`. Admin is free to set any non-negative rate. The DB CHECK resolves to `TRUE`.

---

## Rules & Consequences

- **Good, because** Aml. §14-15 compliance is guaranteed at the DB layer for tariff-bound
  workspaces. No capability tool, migration, or future admin surface can install an illegal
  below-floor override without the DB rejecting the write.
- **Good, because** admin retains full "rørige og dynamiske tillegg" authoring power in the UP
  direction. The policy imposes zero friction on above-floor overrides.
- **Good, because** non-tariff-bound workspaces are completely unaffected. The floor logic is
  conditional on `is_tariff_bound`; a CHECK that evaluates to TRUE imposes zero cost.
- **Bad, because** the DB CHECK is cross-table (subqueries into `workspace_settings` and
  `tariff_rate_table`). This adds constraint complexity and must be benchmarked. If subquery
  performance is unacceptable on large workspaces, a denormalized `tariff_floor` column on
  `supplement_rule` (updated by trigger on `tariff_rate_table` change) is the fallback — but this
  adds trigger complexity and is deferred to Phase 7d migration analysis.
- **Bad, because** the migration must backfill and validate all existing `supplement_rule` rows for
  tariff-bound workspaces before adding the constraint. Any existing row below-floor would block
  `ALTER TABLE`. A pre-migration audit query is required.
- **Agent Impact:** `add_supplement_override` capability tool ships in Phase 7f after the Phase 7d
  schema migration lands. Agents dispatched for Phase 7f MUST load this ADR before authoring
  the tool. The tool MUST NOT be shipped without the DB CHECK in place — client-side validation
  alone is insufficient per Option B rejection. Agents must never pass `override_value` without
  fetching the current tariff floor first and including `tariff_min` in the telemetry payload.

---

## Implementation Gates (Phase 7d-followup + 7f)

| Task | Description |
|---|---|
| **T1** | Schema migration: add `active_union` column to `payroll.workspace_settings` (or join table if multi-union); add `floor_violation_pending` boolean to `supplement_rule`; add DB CHECK constraint after pre-migration audit |
| **T2** | Capability tool `add_supplement_override` with client-side floor validation, Lovsen advisory for non-tariff-bound, required `reason` param, `gate_action` wiring |
| **T3** | Background cron: post `framework.tariff_version_changed` → sweep `supplement_rule`, flag `floor_violation_pending`, notify admin via amendment inbox |
| **T4** | UI L1: supplement override form shows tariff floor as reference, red error on downward attempt with Aml. §14-15 citation, Lovsen advisory on non-tariff-bound |

---

## References

- Aml. §14-15 — lønnstrekk-forbud (employer cannot deduct or structurally reduce wages below
  collectively agreed minimum)
- Aml. §14-6(m) — tariff-binding declared in written contract
- ADR-0252 (`docs/decisions/0252-riksavtalen-versjonering-migration-policy.md`) §F —
  endringsoppsigelse-vurdering for material downward changes
- ADR-0076 (`docs/decisions/0076-contract-composition-as-cascade-derivation.md`) — snapshot-and-forward
  principle; override provenance requirement
- ADR-0347 (`docs/decisions/0347-lovdata-canonical-source-for-riksavtalen.md`) — Lovdata as K1a
  canonical source; `lovsen-lovdata-mcp` feeds `tariff_rate_table`
- ADR-0186 — audit trail append-only requirement for `activity_trail`
- ADR-0204 — C4 authority gate; `gate_action` confirm-class for admin-only mutations
- ADR-0251 — `shift_pay_calculation_event` append-only invariant; historical rows immutable
- ADR-0350, ADR-0352, ADR-0353, ADR-0354 — companion Phase 7d ADRs
- `docs/modules/payroll/WORKSPACE-POLICIES.md` — existing configurable policy surface
  (`payroll.supplement_rule` column list)
- `packages/ai/src/industry/packages/hospitality.ts` — `is_tariff_bound` flag on workspace
  industry config
- Riksavtalen (NHO Reiseliv / Fellesforbundet) 2024–2026 and successor agreements

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
