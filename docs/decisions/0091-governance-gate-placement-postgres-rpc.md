---
title: "Governance Gate Placement — Postgres RPC (SECURITY DEFINER)"
id: ADR_0091
status: accepted
layer: decision
created: 2026-04-14
updated: 2026-04-22
module: cascade
tags: [adr, cascade, c4-governance, phase-e, rpc, security-definer, rbac]
---

# ADR-0091: Governance Gate Placement — Postgres RPC (SECURITY DEFINER)

## Context and Problem Statement

Phase E of the cascade foundation introduces a C4 Governance gate that must route every write to a governance-gated entity (`employment_contract`, `regulatory_framework`, `framework_rule`, `tariff_rate_table`, `protocol`, and the full set produced by `isGovernanceGated()`) through four possible outcomes: `allowed`, `allowed_with_exception`, `review_required`, `blocked`.

The gate must hold for **every** caller — user-initiated dashboard mutations, Edge Functions, background jobs in `stage-engine`, agent tool invocations via `supabaseAdmin`, future worker scripts, and manual SQL from operators. If any one of these bypasses the gate, the C4 invariant ("Confident != Authorized") is violated silently. The question is where, structurally, the gate lives.

A second structural question must be answered alongside this one: the existing RBAC matrix `checkPermission()` in `packages/data/src/permissions/check.ts` already returns a three-way verdict (`allowed | denied | needs_approval`), but no caller currently does anything with `needs_approval`. Phase E must unify that signal with the gate's `review_required` outcome so there is a single C4 authority, not two parallel ones.

## Decision Drivers

- **Universal coverage:** service-role callers (`supabaseAdmin`, stage-engine, agent tools) must be gated exactly like anon/authenticated callers. No codepath may skip the gate by choosing a different client.
- **Single source of truth for authority:** two competing authority systems (`checkPermission()` returning `needs_approval` AND a separate gate with `review_required`) is the precondition for drift. One gate, one outcome.
- **Transactional atomicity:** the gate decision and the write it governs must live in the same transaction. A gate that returns "allowed" milliseconds before a write that the gate would have denied is a correctness bug, not a race.
- **Auditability:** every gate decision must produce a row in the audit trail (WP7) with the same identifiers that end up on the downstream `change_proposal` or on the applied write. The gate cannot be a library that different callers log differently.
- **No platform-specific code in `@smartout/data`:** the gate is called from Next.js server code, Edge Functions, Hono services, and React Native — it cannot require a Node-only library or a Next-specific runtime.
- **Rollback is mandatory:** if the gate misfires on a fresh workspace, we need a feature flag to degrade to legacy behaviour per workspace without shipping a revert.

## Implementation Status — 2026-04-18

- **WP1 (evaluate_framework_rules helpers):** status unchanged from original ADR — still pending. WP2 (below) uses `framework_trigger` match as a coarse proxy for "a rule would fire here" until WP1 ships per-rule predicate evaluation.
- **WP2 (Postgres function `public.cascade_gate_write`):** **SHIPPED 2026-04-18 as Option B Smart Trigger Check** — see commits `2278ef52` (initial ship) + `6a431ce2` (council review fix: caller identity via `assert_gate_caller`, pgTAP wired into CI, `GateOutcome` JSDoc clarified). Migrations live at `supabase/migrations/20260512100000_cascade_gate_write.sql`, `20260512100100_assert_gate_caller.sql`, `20260512100200_cascade_gate_write_assert.sql`. Today the SQL emits `applied | proposed`; `blocked` and `applied_with_exception` are reserved for WP1.
- **WP3 (TypeScript wrapper `gatedInsert` / `gatedUpdate` / `gatedDelete`):** wrapper now functional end-to-end. Scaffold shipped 2026-04-17 (commit `b90dc1f5`) at `packages/supabase/src/gate-client.ts`; WP2 unblocks its use. Call sites can now migrate from direct `supabase.from().insert()` on governance-gated tables to the `gated*` helpers.
- **WP4+ (call-site migration, ESLint rule escalation):** unblocked. First-wave call-site migration and escalation of `smartout/no-direct-supabase-write` from `warn` → `error` follow next.

> **Note:** WP1 (`evaluate_framework_rules`) still pending — WP2 uses framework_trigger match as a coarse proxy. This is deliberately over-inclusive (errs on the side of creating proposals) until WP1 lands per-rule evaluation.

Related: ADR-0099 (unified authority gate, `public.gate_action`) is a separate RPC solving authority/capability checks for the agent router + engine dispatch. It is NOT a substitute for `cascade_gate_write` — different semantics (capability gate vs diff-based write gate).

## Considered Options

1. **Postgres RPC with `SECURITY DEFINER` (chosen)** — a single SQL function `cascade_gate_write(entity_type, entity_id, action, proposed_data, context)` called by every write path. Internally validates the caller (app role or JWT), evaluates framework rules via `evaluate_framework_rules()` (WP1, invoked from the RPC body), resolves `engine_authority_config`, wraps `checkPermission()` logic, and returns a single structured outcome. Writes that pass proceed; writes that don't either raise a typed SQLSTATE or auto-create a `change_proposal` and raise a gate-deferred error.
2. **Edge Function middleware** — a Deno-level wrapper around the `workspace-api` gateway that runs the gate before forwarding to Postgres.
3. **Client-side hook** — a TanStack mutation wrapper in `@smartout/data` that runs the gate in-process before calling Supabase.
4. **RLS policy extension** — encode the gate as a `BEFORE` trigger per table.

## Decision Outcome

Chosen option: **"Postgres RPC with `SECURITY DEFINER`"**, because it is the only placement where every caller — `anon`, `authenticated`, `service_role`, and direct SQL — is forced through the same gate in the same transaction. Edge Function middleware is rejected because agent tools today talk to Supabase directly via `supabaseAdmin` and trivially bypass it. Client-side hooks are rejected for the same reason plus the service-role scripts problem. A per-table BEFORE trigger is rejected because (a) it hides an expensive call behind every row operation with no way to short-circuit for read_only rows, (b) it splits governance logic across 10+ triggers, and (c) SECURITY DEFINER functions give us explicit role gating while triggers inherit the caller's role.

### Canonical shape

```sql
create or replace function public.cascade_gate_write(
  p_entity_type       text,
  p_entity_id         uuid,
  p_action            text,            -- 'create' | 'update' | 'delete'
  p_workspace_id      uuid,
  p_proposed_data     jsonb,
  p_current_data      jsonb default null,
  p_actor_profile_id  uuid default null,
  p_capability        text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outcome   text;
  v_proposal  uuid;
  v_reason    text;
begin
  -- 1. Role check (see "Role check" below). Prevents gate being used as an
  --    RLS-bypass oracle by a misbehaving caller.
  perform public.assert_gate_caller();

  -- 2. Evaluate framework rules (WP1) and RBAC (checkPermission parity).
  -- 3. Resolve authority: engine_authority_config × min_role × capability.
  -- 4. Produce outcome + optional proposal_id.
  -- 5. Write governance_audit_log row (WP7).
  -- 6. Return structured JSON.
  ...
end;
$$;
```

### Role check

`SECURITY DEFINER` elevates to the function owner, which is `postgres`. Without an internal role check we would have built an RLS-bypass oracle: any authenticated user could call the function with arbitrary workspace context. The function MUST, as its first statement, call `assert_gate_caller()`, which verifies either (a) `auth.uid()` is set and has membership in `p_workspace_id` via `is_member_of_workspace(p_workspace_id)`, or (b) the caller is the `service_role` and `p_actor_profile_id` resolves to a service identity registered in `engine_authority_config`. Any mismatch raises `SQLSTATE '42501'` (insufficient privilege).

### Error-code convention

The gate distinguishes its own denials from RLS denials:

- `P0001` with `MESSAGE = 'gate_blocked'` — rule-based hard block. Non-retryable.
- `P0001` with `MESSAGE = 'gate_review_required'` — write was converted into a `change_proposal`. The returned JSON carries `proposal_id`. Callers should surface this to the user, not retry.
- `P0001` with `MESSAGE = 'gate_allowed_with_exception'` — write proceeded; audit row was written with `exception_reason`.
- `42501` — RLS or role-check failure. Semantically distinct: the caller was not authorized to even ask the gate.

Application code (`packages/data/src/cascade/gate-client.ts`, WP3) maps these to the agent tool response shape below.

### Tool / caller response convention

Every callsite — TanStack mutation, Edge Function handler, SmartoutTool — returns the same shape upstream:

```ts
type GateResponse =
  | { ok: true;  outcome: 'applied' }
  | { ok: true;  outcome: 'applied'; exception_reason: string }   // allowed_with_exception
  | { ok: false; outcome: 'proposed'; proposal_id: string; reason?: string }
  | { ok: false; outcome: 'blocked'; reason: string };
```

This is the canonical agent tool response for any governance-gated operation. Tools that currently return ad-hoc `{ success: boolean }` must migrate to this shape in WP3.

### Unification with `checkPermission()`

`checkPermission()` stays as the in-process RBAC matrix — it is still used pre-flight for UI enablement (greying out buttons) and for tool selection by the agent router. But the **authoritative** outcome for a write is produced by `cascade_gate_write`. Inside the RPC body, the function wraps the RBAC check: a `denied` from `checkPermission()` maps to `blocked`, `needs_approval` maps to `review_required`, `allowed` falls through to framework-rule evaluation. The return type `PermissionResult` in `check.ts` is preserved, but its `needs_approval` case gains a documented guarantee: when the in-process check returns it, the RPC will agree.

### Feature-flag rollback

`engine_authority_config` gains a column `gate_enforcement_mode` (`enforcing | monitoring | disabled`) per workspace × capability. `monitoring` causes the RPC to run every check and write the audit row but always return `applied` — the production equivalent of a dry run. `disabled` short-circuits to legacy behaviour (direct write, no audit). This is the documented rollback path. Ops toggles the flag; no code change ships.

## Rules & Consequences

- **Good, because** the gate is a single-hop call that every caller — JWT, API key, service role, direct SQL via psql — is forced through. There is no "secondary door."
- **Good, because** gate outcome, audit row, and (when `review_required`) `change_proposal` insertion are in the same transaction. A crashed caller leaves no half-state.
- **Good, because** unifying `checkPermission()`'s `needs_approval` with `review_required` removes two things that were quietly one, per council finding.
- **Good, because** the feature flag gives Ops a per-workspace kill switch without a revert PR.
- **Bad, because** routing every governance write through plpgsql adds per-write latency (rule evaluation + audit insert). Mitigated by caching resolved rules in `engine_memory` at workspace load, not per-call; WP1's pure evaluator runs in plpgsql via `plv8`-free `jsonb_path_*` only where cheap, or is mirrored in SQL.
- **Bad, because** plpgsql duplicates logic that already lives in TypeScript (`evaluate-rules.ts`). Mitigated by making TypeScript the reference implementation and generating plpgsql from it or — more realistically for Phase E — calling the TS evaluator from the Edge Function that the RPC trusts. The final placement is settled in WP2.
- **Known limitation:** the `confirm` authority level in `engine_authority_config` has no implemented confirmation UI today. The RPC will return `review_required` for `confirm` writes, which WP3 surfaces as a proposal. A dedicated "inline confirm" UI ships later (tracked against WP4); until then `confirm` is functionally equivalent to `suggest`.
- **Agent Impact:**
  - Every tool that writes to a governance-gated entity MUST use the shared gate client (WP3) and return `GateResponse`. Tools that return `{ ok: boolean, error?: string }` are non-conforming.
  - `packages/data` mutation hooks MUST call the RPC. Direct `supabase.from(...).insert()` against governance-gated tables is an ESLint error (custom rule to ship with WP3).
  - Service-role scripts (`stage-engine`, cron jobs, migrations that touch data) MUST register their service identity in `engine_authority_config` before they can pass `assert_gate_caller()`.
  - The tool-selector in `packages/ai/src/router` MUST enforce `engine_authority_config.min_role` **before** WP4 starts. This is a prerequisite, not a WP4 deliverable — the council called it out explicitly.

---

## Amendment — 2026-04-22 (ADR-0190)

ADR-0190 amends this ADR with the following invariant and runtime observability upgrades for `cascade_gate_write`:

- **Workspace-framework binding invariant:** every production workspace MUST have exactly one `workspace_framework_binding` row with `is_active=true`. Enforced atomically in `finalize_onboarding_workspace` RPC (ADR-0190 Control 1), not via the non-blocking `bootstrap-cascade` path. Direct INSERTs into `workspace_framework_binding` outside the RPC or bootstrap-cascade are a regression.
- **Default-permit observability:** the two default-permit branches (`no-active-framework`, `no-trigger-match`) MUST emit `gate.default_permitted` to `activity_trail` atomically with the `gate_evaluation` INSERT (ADR-0190 Control 3b). Silent default-permit on production workspaces is the defect pattern named in L-0114.
- **Caller-side reason propagation:** `GatedWriteResult` carries the RPC's `reason` field (ADR-0190 Control 3a). Callers can distinguish working-as-designed permit from provisioning-failure permit from policy-incompleteness permit.
- **Capability-seam defense:** `gatedInsert/gatedUpdate/gatedDelete` are forbidden inside `packages/ai/src/{tools,capabilities}/**` (ADR-0190 Control 4, ESLint-enforced). Capability-originated writes to governance-gated entities must flow through pathway A (`gateAction`), not directly through pathway B.
- **CI entity-type coverage:** new script `scripts/cascade-gate-entity-type-coverage.ts` (ADR-0190 Control 2) enforces that every `(entityType, operation)` tuple in `gatedInsert|Update|Delete` call sites has matching coverage in the active `framework_trigger` seed, or an inline exemption.

Named anti-pattern (promoted in ADR-0190 body): **"Authority appearance ≠ authority presence"** (L-0107). Pathway B's default-permit-on-missing-binding is the second documented manifestation after ADR-0099's default-allow-on-missing-config (closed by ADR-0189).

Named tech debt (out of ADR-0190 scope): **"Audit consumption convergence"** — `gate_evaluation` rows are written by both pathways today with zero consumers. Correct fix is converging authority decisions to `activity_trail` emits with typed evidence fields. Tracked for a future authority-observability council.

---

> Registered in `docs/decisions/0000-decision-log.md`.
