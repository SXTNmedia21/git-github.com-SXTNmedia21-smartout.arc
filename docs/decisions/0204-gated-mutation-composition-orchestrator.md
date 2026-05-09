---
title: "Composition Orchestrator for Dual-Gate Mutations"
id: ADR-0204
status: accepted
layer: decision
created: 2026-04-23
updated: 2026-04-24
module: authority
bound-by: [ADR_0091, ADR_0099, ADR_0114, ADR_0138, ADR_0203]
related: [ADR_0024, ADR_0077, ADR_0078, ADR_0101, ADR_0189, ADR_0190, ADR_0196]
tags: [adr, authority, gate-action, cascade-gate-write, orchestrator, composition, ci-gate, council-2026-04-23]
---

# ADR-0204: Composition Orchestrator for Dual-Gate Mutations

**Status:** Accepted (flipped at SS-4 merge 2026-04-24 — all 4 per-cap
gate.ts wrappers now delegate to `gatedMutation()`; feature-flag default
flipped from OFF → ON; adapter preserves legacy `GateActionResult`
shape so `tools.ts` consumers are unchanged until SS-5).
**Date:** 2026-04-23 (proposed), 2026-04-24 (accepted)

## Context and Problem Statement

ADR-0203 established that `gate_action` (C4 capability authority, ADR-0099) and `cascade_gate_write` (C1 cascade data-rule, ADR-0091) are two orthogonal policies. Every mutation must cross **both**. In the current code, they are crossed inconsistently: some call sites call only `gate_action` (agent-router path), some call only `cascade_gate_write` (Server Action path via `gatedInsert/Update/Delete`), some call neither (33 ESLint `smartout/no-direct-supabase-write` warnings as of 2026-04-22), and at least one (`apps/web/src/app/dashboard/memory/_actions/tools.ts:73`) calls `gate_action` inline outside any abstraction.

Without a single orchestrator, each call site invents its own composition. The two audit rows are not correlated. A denial from one policy is surfaced with a different shape than a denial from the other. Future authors have no canonical call pattern to follow, and reviewers have no grep pattern to enforce.

This ADR specifies the orchestrator: `packages/ai/src/gate/gatedMutation.ts`, a single TypeScript function that calls both RPCs in sequence, short-circuits on first deny, writes a correlated audit chain, and returns a discriminated union aligned with ADR-0138. CI enforces that inline RPC calls to either gate outside the orchestrator are merge blockers.

## Decision Drivers

- **ADR-0203 compliance:** two policies, composed in order, with one correlated audit trail. No call site may cross one policy without the other.
- **ADR-0138 alignment:** tool result shape is a discriminated union; orchestrator return type extends that shape so capability tools can forward it unchanged.
- **ADR-0114 alignment:** Server Actions are the canonical mutation primitive for web. The orchestrator lives on the server side and is the only legal path from a Server Action or capability `execute()` to `gate_action` / `cascade_gate_write`.
- **ADR-0196 Invariant 11 (no phantom emits):** the orchestrator emits `gate_evaluated` only after real DB rows are written to `gate_evaluation`. If either RPC delegation fails (RPC returns an unexpected shape, connection error, schema drift), the orchestrator returns `{ok: false, denied_by: 'not_implemented', ...}` WITHOUT emitting `gate_evaluated`.
- **Correlation:** a future audit reader must be able to join the two `gate_evaluation` rows (one per policy) written for a single mutation attempt. A shared correlation id, not inference by timestamp, is the only reliable join key.
- **Ordering:** channel guard (ADR-0078 voice→PII block) and four-eyes (ADR-0101) live in `gate_action`. If capability authority denies, data-rule evaluation is wasted work *and* leaks intent via `change_proposal` rows on a policy the actor was never allowed to invoke. Authority FIRST is structural, not preference.

## Decision Outcome

### 1. The orchestrator

A new module `packages/ai/src/gate/gatedMutation.ts` exports one primary function:

```ts
export type GatedMutationResult =
  | { ok: true;  proposal_id?: string; gate_evaluation_id: string }
  | { ok: false; denied_by: 'capability' | 'data_rule' | 'not_implemented';
      reason: string; gate_evaluation_id?: string };

export async function gatedMutation(args: {
  workspace_id: string;
  actor_profile_id: string;
  capability: string;
  channel: 'chat' | 'voice' | 'system' | 'web' | 'mobile';
  action_type: string;
  // Pathway B (cascade data-rule) inputs:
  entity_type: string;
  entity_id: string | null;           // null on insert before row exists
  action: 'create' | 'update' | 'delete';
  proposed_data: Json;
  current_data?: Json | null;
  // Execution callback — runs INSIDE the orchestrator's RPC transaction
  // ONLY IF both policies allow. Orchestrator returns after execute() resolves.
  execute: (client: SupabaseClient) => Promise<{ ok: true } | { ok: false; reason: string }>;
}): Promise<GatedMutationResult>;
```

Behaviour:

1. Generate a `correlation_id` (UUID v7).
2. Call `gate_action` RPC with `(workspace_id, capability, channel, actor_profile_id, action_type, correlation_id)`. Write `gate_evaluation` row 1 with `parent_evaluation_id = NULL`, `correlation_id = correlation_id`.
3. If `allow=false`, emit `gate_evaluated` with `denied_by='capability'`, return `{ok: false, denied_by: 'capability', reason, gate_evaluation_id: row1.id}`. **Do not call `cascade_gate_write`.**
4. If `allow=true`, call `cascade_gate_write` RPC with `(entity_type, entity_id, action, workspace_id, proposed_data, current_data, actor_profile_id, capability, correlation_id)`. Row 2's `parent_evaluation_id = row1.id`, `correlation_id = correlation_id`.
5. If `cascade_gate_write` returns `outcome='blocked'`, emit `gate_evaluated` with `denied_by='data_rule'`, return `{ok: false, denied_by: 'data_rule', reason, gate_evaluation_id: row2.id}`.
6. If `cascade_gate_write` returns `outcome='proposed'`, emit `gate_evaluated` with outcome `proposed`, return `{ok: true, proposal_id, gate_evaluation_id: row2.id}` — the caller did not perform a write; a proposal was created. The `execute` callback is NOT invoked.
7. If `cascade_gate_write` returns `outcome='applied'`, invoke `execute(client)`. On success, emit `gate_evaluated` with outcome `applied`, return `{ok: true, gate_evaluation_id: row2.id}`.
8. If any RPC returns a shape that does not parse against the contract, or throws on transport, return `{ok: false, denied_by: 'not_implemented', reason: 'gate_rpc_failure:<detail>'}`. **Do not emit `gate_evaluated`** — Invariant 11 prohibits emitting a success-shaped event when delegation failed.

### 2. Schema change (ships with SS-3)

Add to `gate_evaluation` table:

```sql
alter table public.gate_evaluation
  add column correlation_id uuid,
  add column parent_evaluation_id uuid references public.gate_evaluation(id);

create index gate_evaluation_correlation_idx
  on public.gate_evaluation (correlation_id)
  where correlation_id is not null;
```

Two columns instead of one because:

- `correlation_id` groups the two rows a single orchestrator call produces (flat join key; useful for dashboards).
- `parent_evaluation_id` is the causal link (row 2 only exists because row 1 allowed). Future multi-step orchestrators (e.g. four-eyes handoff) can chain further without widening `correlation_id` semantics.

Chosen over a single `correlation_id`-only scheme because ADR-0190's audit-consumption tech debt hint (future dashboard) needs both "group by attempt" and "show the causal chain."

### 3. CI enforcement (ships with SS-3)

Grep gate in `scripts/ci/no-inline-gate-rpc.sh`:

```bash
# Fails CI if any .ts/.tsx file outside packages/ai/src/gate/ contains
# a direct RPC call to gate_action or cascade_gate_write.
grep -Rn --include='*.ts' --include='*.tsx' \
  -E "supabase\.rpc\(['\"](gate_action|cascade_gate_write)['\"]" \
  apps packages services \
  | grep -v '^packages/ai/src/gate/' \
  | grep -v '^packages/supabase/src/gate-client\.ts' \
  && { echo "Inline gate RPC call outside orchestrator — blocked by ADR-0204"; exit 1; } \
  || true
```

Allowed internal call sites:

- `packages/ai/src/gate/gatedMutation.ts` — the orchestrator itself.
- `packages/supabase/src/gate-client.ts` — the existing `gatedInsert/Update/Delete` wrapper (which, after SS-4, internally delegates to `gatedMutation` rather than calling `cascade_gate_write` directly).

Any other match is a merge blocker.

### 4. Ordering rationale — authority FIRST

Authority is always evaluated first, non-negotiable. Reasons:

1. **Channel guard lives in `gate_action`** (ADR-0078). A voice caller attempting a PII-handling capability must be blocked before any cascade data-rule runs. Running data-rule first would at best waste work; at worst, the `change_proposal` row would leak intent on a capability the voice caller was never authorised to invoke.
2. **Four-eyes history lives in `gate_action`** (ADR-0101). Requiring four-eyes is a property of *who invoked*, not of *what is being written*. Evaluating data-rule first would create `change_proposal` rows for actors who are not permitted to invoke the capability.
3. **`min_role` downgrade** (ADR-0099) can change the `action_type` before data-rule runs. Running data-rule with the pre-downgrade action is wrong.
4. **Audit readability.** The parent/child shape reads left-to-right as "the actor was allowed → the diff was evaluated." Reversing it reads as "the diff was evaluated on behalf of an actor who then turned out not to be allowed."

### 5. Return shape — alignment with ADR-0138

The discriminated union in §1 is a superset of the ADR-0138 `CapabilityToolResult` shape. A capability `execute()` that wraps `gatedMutation` forwards the result directly; on `{ok: false, denied_by}`, the tool returns `{ok: false, reason: result.reason, code: denied_by}`. On `{ok: true}`, the tool returns `{ok: true, data: ...}` per its per-capability contract.

### 6. Invariant 11 compliance

The orchestrator emits `gate_evaluated` ONLY after writing the corresponding `gate_evaluation` row. The three legitimate no-emit paths:

- RPC transport failure → `{ok: false, denied_by: 'not_implemented'}` — no row written, no emit.
- RPC returns unrecognised shape (schema drift) → same.
- Library misuse (missing required arg caught by orchestrator pre-check) → same.

Invariant 11 forbids the shape `emit('gate_evaluated') → return {ok: true, note: 'skeleton'}`. The orchestrator never produces that shape; every `ok: true` return is backed by at least one real `gate_evaluation` row and, when `execute` ran, the caller's domain write.

## Considered Options

Options 0–3 are rejected per ADR-0203 (unification variants). Composition-shaped options considered in this ADR:

- **4a — Orchestrator in `packages/ai/src/gate/` (CHOSEN).** Server-only module, TS, tree-shaken out of client bundles. Co-located with capability tooling. CI grep is trivial.
- **4b — Orchestrator in `packages/supabase/src/gate-client.ts` (existing file).** Rejected because `gate-client.ts` is tied to Pathway B today; extending it to Pathway A would make the file the structural equivalent of Option 3 (a shared-core module). ADR-0203's "two policies, not one" would be undermined by a single file owning both. Instead, `gate-client.ts` becomes a thin wrapper that *calls* `gatedMutation` for backward compatibility with existing `gatedInsert/Update/Delete` sites (SS-4).
- **4c — Orchestrator as a Postgres function calling both RPCs.** Rejected because the `execute` callback (§1) runs TypeScript — it must live in the same runtime the caller is in (Node for Server Actions, Deno for Edge Functions). A plpgsql orchestrator cannot own the domain write.
- **4d — Per-capability double-call, no orchestrator.** Rejected because every call site would re-implement correlation, error mapping, and order. Correlation chain would be lost the first time a hurried PR forgot to thread `correlation_id`.

## Rules & Consequences

- **Good, because** every mutation in the codebase has exactly one legal call shape. Reviewers grep for it; authors learn by rejection.
- **Good, because** the correlation chain is a real DB relationship, not an inference. Future audit dashboards (ADR-0190 tech debt) can join on `correlation_id` deterministically.
- **Good, because** ADR-0138 alignment means capability tools can forward the orchestrator result without reshaping — one less place for denied-by semantics to get lost in translation.
- **Good, because** Invariant 11 is enforced by construction: the orchestrator never emits before the row is written.
- **Bad, because** every mutation now pays two RPC roundtrips minimum (three if proposal is created). Mitigated by plpgsql SECURITY DEFINER speed and by short-circuit on authority deny (majority of denies are expected at authority, not data-rule).
- **Bad, because** the `execute` callback inside a Server Action introduces a lambda boundary authors may misuse (forgetting `await`, catching errors silently). Mitigated by orchestrator-level try/catch mapping every throw into `{ok: false, denied_by: 'not_implemented'}` — the capability sees a structured denial, not an exception.
- **Agent Impact:**
  - Every new capability tool `execute()` that writes to the DB MUST compose via `gatedMutation`. Inline `supabase.rpc('gate_action', ...)` or `supabase.rpc('cascade_gate_write', ...)` are merge blockers.
  - Every existing `gate.ts` per-capability helper (shift-lifecycle, contract-intake, journey) MUST migrate to the orchestrator under SS-4. No new per-capability `gate.ts` files.
  - `gatedInsert / gatedUpdate / gatedDelete` in `packages/supabase/src/gate-client.ts` continue to exist as thin delegators to `gatedMutation` (SS-4). Direct `supabase.from().insert()` on governance-gated entities remains an ESLint error per ADR-0091 WP4.
  - The 33 current ESLint `smartout/no-direct-supabase-write` warnings resolve under SS-5 by migrating call sites to `gatedMutation`. Warning-count trend is the SS-5 acceptance metric.
  - `apps/web/src/app/dashboard/memory/_actions/tools.ts:73` (inline `supabase.rpc('gate_action', ...)`) is a merge-blocker prerequisite and is fixed under SS-1 before any other SS can close.

## Rollout

| Sub-sortie | Scope                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| SS-1       | Fix `memory/tools.ts:73` inline `gate_action` call (merge-blocker prerequisite). |
| SS-2       | Land `gate_evaluation` schema change (`correlation_id`, `parent_evaluation_id`). |
| SS-3       | Land `gatedMutation` orchestrator + CI grep. Status flips ADR to `accepted`.     |
| SS-4       | Migrate three per-cap `gate.ts` files + `gate-client.ts` delegation.             |
| SS-5       | Close the 33 ESLint warnings via call-site migration to `gatedMutation`.         |

## Related ADRs

- ADR-0091 — Governance gate placement (Pathway B RPC; amended to note composition).
- ADR-0099 — Unified authority gate (Pathway A RPC; amended to note composition).
- ADR-0114 — Server Actions as canonical mutation primitive.
- ADR-0138 — Capability tool result shape (orchestrator return type aligns).
- ADR-0196 — Journey engine Invariant 11 (no phantom emits; binds orchestrator).
- ADR-0203 — Dual gates are two policies (the *why*; this ADR is the *how*).

---

> Registered in `docs/decisions/0000-decision-log.md` on acceptance (SS-3 merge).
