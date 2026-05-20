---
title: "ADR-0379: Signature as C4 Authorization for Employee Activation"
id: ADR-0379
status: proposed
layer: decision
created: 2026-06-21
updated: 2026-05-20
---

# ADR-0379: Signature as C4 Authorization — Employee Activation

**Status:** Proposed (reverted from Accepted by council 2026-05-20 — see Remediation)
**Date:** 2026-06-21

> **Council REJECT (2026-05-20):** the original implementation merged in PR #434 was
> NON-FUNCTIONAL — the docuseal webhook wrote `engine_event` directly but nothing invoked
> engine-dispatch, so no `engine_state` was created and `profile.status` never flipped.
> Remediated in `feat/contract-activation-remediation`. This ADR returns to `proposed`;
> re-accept only after runtime proof (sign contract → assert profile flipped + telemetry
> landed). Two text corrections below (min_role, autonomous mechanism) per fact-check.

## Context and Problem Statement

When an employee signs an employment contract (via DocuSeal), the cascade requires
`profile.status` to transition from `trainee` to `active`. The cascade skill mandates
"Confident ≠ Authorized" — C4 governs permission. The engine-dispatch `update_entity`
handler calls `gate_action()` before every mutation, passing `p_capability = state.process_id`.

The question: does this activation require an admin to confirm via `change_proposal`,
or does the legal signature itself constitute sufficient C4 authorization?

## Decision Drivers

- The employment contract is legally binding under Norwegian labor law (arbeidsmiljøloven §14-6).
  Both parties (employer = admin/owner + employee) must sign. Their signatures represent
  explicit informed consent and legal authorization.
- A `change_proposal` after signing would create a paradox: the legal act is done, but the
  system state awaits admin confirmation of something already authorized at a higher level.
- The `employee_activation` process is system-initiated (actor = system). No human clicks
  "confirm" — the engine executes automatically on contract.signed. A `change_proposal`
  would require a human to confirm an action the system is already legally obligated to complete.
- ADR-0099 `gate_action()` `autonomous` level: allow=true without role check. Correct for
  system-only processes where authorization comes from an external legal act.

## Considered Options

1. **C4-gated**: Route through `change_proposal`. Admin must confirm profile activation
   after contract is signed.
2. **Signature = authorization (NO C4 gate)**: The legal contract signature IS the C4
   authorization. System flips profile.status directly. Audit trail via `engine_state_step`
   + `profile.activated` telemetry.
3. **Hybrid**: Immediate flip, with a `change_proposal` created in parallel as an audit
   record (not a gate).

## Decision Outcome

**Chosen: Option 2 — Signature = Authorization.**

The `employee_activation` engine_process is seeded with `engine_authority_config`
`level='autonomous'`, `min_role='owner'`, `requires_four_eyes=false`. No
`change_proposal` is created.

> **Correction (2026-05-20):** `min_role` is `'owner'`, NOT `'system'` as an earlier
> draft stated. `capability_default_registry`'s CHECK constraint allows only
> `employee|manager|admin|owner` (`engine_authority_config`'s CHECK was relaxed to add
> `'system'` in 20260516110000, but the registry's was not). `min_role` is functionally
> moot here — `level='autonomous'` skips the role check entirely.
>
> **Correction (2026-05-20):** `autonomous` does NOT "short-circuit to allow=true" via a
> dedicated branch. `gate_action` has no explicit `autonomous` branch — `allow=true` is the
> fall-through default, the SAME code path as an unseeded/NULL-level capability (only
> `disabled` + channel-mismatch + four-eyes deny). Seeding `autonomous` does NOT change the
> runtime allow decision; it only (a) suppresses the `gate.unseeded_capability_invoked`
> warning and (b) propagates the default to new workspaces. The real authorization at
> runtime is the DocuSeal signature + idempotency_key, NOT a gate decision. The gate is
> advisory/observability for this process. Do NOT set `requires_four_eyes=true` — the
> dispatcher does not pass `p_entity_id`, so it would fail-closed on every activation.

Reasoning:
- The legal signature covers both parties. No third-party admin confirmation adds
  legal or security value once both parties have signed.
- Option 1 creates a user-experience failure: employee believes they're hired (signed),
  but cannot access the system until an admin manually confirms. This breaks the cascade
  promise of automated, complete onboarding.
- Option 3 is noise — a `change_proposal` created only for audit purposes is a misuse
  of the change_proposal model (which exists for proposed, not completed, changes).

## Scope boundary

This ADR governs only the trainee→active flip driven by a **newly signed employment
contract** (contract.signed engine_event, DocuSeal webhook path).

It does NOT apply to:
- Manual admin reactivation (inactive→active via people-actions.ts). Those remain
  `profile:update:status` capability, C4-gated per existing `reactivateProfile` flow.
- Future profile status transitions (offboarding, termination). Those require explicit
  ADR amendments.

## Rules & Consequences for Agents

- **Good:** Automated, complete activation. Employee is active the moment both parties sign.
  No dangling trainee state awaiting admin click.
- **Good:** Engine audit trail survives: `engine_state_step` records the flip; `gate_evaluation`
  records the `autonomous` allow; `profile.activated` telemetry event captures workspace_id,
  actor=system, entity=profile.
- **Bad (risk):** If `employment_contract.profile_id` cannot be resolved (migration ordering
  error, data integrity issue), the event falls back to `entity_type=employment_contract`.
  This means the `employee_activation` process's update_entity targets an employment_contract
  row (which is NOT in its allowed list), and the step silently skips. Operator must monitor
  for `entity_type=employment_contract` in `employee_activation` engine_state rows.
- **Agent Impact:** Build agents implementing employee lifecycle tools MUST NOT create a
  `change_proposal` for the contract.signed → trainee→active transition. If asked to
  "confirm" employee activation, agents should check whether the contract is signed (legal
  authorization) rather than check engine_authority_config level.

## Implementation

- `supabase/migrations/20260621100000_engine_process_employee_activation.sql`
  → `employee_activation` process + `update_entity` step
- `supabase/migrations/20260621100100_engine_trigger_employee_activation.sql`
  → `contract.signed` → `employee_activation` trigger (condition: contract_type=employee)
- `supabase/migrations/20260621100200_engine_authority_config_employee_activation.sql`
  → `engine_authority_config` level=autonomous + `capability_default_registry` (ADR-0192)
- `apps/web/src/app/api/webhooks/docuseal/route.ts`
  → Option A: resolve `profile_id` from `employment_contract`, **invoke engine-dispatch**
    (NOT a raw engine_event insert — R0), guarded to `status='trainee'` (R1), fail-loud
    skip when `profile_id` unresolved (R2 — no employment_contract silent-skip fallback).

## Remediation (council 2026-05-20 — REJECT → fix-forward)

`feat/contract-activation-remediation`:
- **R0** docuseal route now `admin.functions.invoke("engine-dispatch", {body})` instead of
  the orphan `engine_event` insert. Proven pattern: `apps/web/src/app/api/engine-dispatch/route.ts`.
- **R1** producer-side `status='trainee'` guard (engine step condition=NULL can't read live
  DB; guard at the route against the live profile row). Out-of-scope statuses skip + log.
- **R2** unresolved `profile_id` → fail-loud skip (removed the silent-skip employment_contract
  fallback that completed engine_state with no flip).
- **R3** ADR text corrected (min_role, autonomous mechanism — above).
- **R4** `profile.activated` emit fail-loud when `INTERNAL_EMIT_URL` env missing (engine-dispatch).
- **R5** ADR reverted to `proposed`; re-accept gated on runtime proof (signed-contract →
  profile flipped → `profile.activated` in activity_trail).
- Learnings: L-0324 (pgTAP-green ≠ runtime-functional), L-0325 (council coverage-gap voids).
- `packages/telemetry/src/registry.ts`
  → `ProfileActivated` interface + `"profile activated"` EVENT_ROUTING entry
- `supabase/functions/engine-dispatch/index.ts`
  → Post-flip emit of `profile.activated` in `update_entity` handler (employee_activation branch)

## References

- ADR-0099 (unified authority gate — gate_action levels)
- ADR-0134 (telemetry IDs — workspace_id + actor_id non-empty)
- ADR-0186 (engine event flow)
- ADR-0192 (capability_default_registry + bootstrap trigger)
- ADR-0281 (platform-actor pattern — actor=system for engine processes)
- Cascade skill: D2 lifecycle vs C3 integration_sync dimension separation
- `supabase/migrations/20260505110000_unified_authority_gate.sql` (gate_action RPC)
