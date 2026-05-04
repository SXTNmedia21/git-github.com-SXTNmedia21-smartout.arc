---
id: L-0134
title: Phantom-capability landmines hide at inline call sites lint doesn't flag
status: active
date: 2026-04-23
updated: 2026-04-23
layer: learning
module: council-process
tags: [learning, council, phantom-capability, gate-action, code-trace, council-2026-04-23]
---

# L-0134: Phantom-Capability Landmines Hide at Inline Call Sites Lint Doesn't Flag

## Context

Council 2026-04-23 B1 dual-gate reconciliation. Briefing enumerated "7
per-capability `gate.ts` files" as the surface for `callGateAction`.
Steward Phase 3 reasoned about gate-surface uniformity on that count.

Agent-Coord code-trace found the count was wrong: **3 per-capability
`gate.ts` files + 1 inline direct RPC = 4 surfaces.** The inline call
in `packages/ai/src/capabilities/memory/tools.ts:73-91` dispatches
`supabase.rpc("gate_action", ...)` directly, bypassing the
per-capability wrapper pattern.

## What actually happened

The inline call in `memory/tools.ts:73-91`:

- Calls `gate_action` RPC directly without the `callGateAction` wrapper.
- Does NOT read the return fields `four_eyes_required`,
  `approvers_needed`, `approvers_present`, `gate_evaluation_id`.
- On a four-eyes-required memory write, the RPC returns
  `{ok:false, reason:"four_eyes_required", ...}`. The inline caller
  treats this as a generic denial and surfaces
  "Minnelagring avslått: four_eyes_required" to the user — with **zero
  approver flow**. The user cannot request an approver, cannot see who
  needs to approve, cannot resume the write.

The existing 33-warning `no-direct-supabase-write` lint rule catches
direct `.insert/.update/.delete`. It does NOT catch direct RPC calls
that happen to target a gate function. `memory/tools.ts:73` looked
compliant to the linter because it was a `.rpc()` call, and the linter
treats RPC calls as legitimate server-side delegation.

This was invisible to the "7 per-cap gate.ts files" count cited in
Steward's Phase 3 briefing. Count appeared to support "uniform
per-cap gate pattern"; reality was one surface outside the pattern,
with a live CVE-class denial-without-approver-flow bug.

## The pattern

**Phantom-capability mode 3**: a capability that calls the gate RPC but
discards the gate's return fields is a phantom capability by Invariant 11
definition — it emits the gate request without honoring the gate's
response semantics. Modes 1 (phantom emit) and 2 (phantom body,
L-0124) are detectable by the existing L-0094/L-0118 grep gates. Mode 3
is not.

Lint-surface enumeration and call-site counts are both blind to Mode 3:
grep for `no-direct-supabase-write` misses RPCs; grep for gate.ts files
misses inline RPC calls to `gate_action`.

## Rule

Enumerate ALL gate-surface sites by grepping BOTH patterns:

```bash
# Pattern A — canonical wrapper:
grep -rn "callGateAction" packages/ai/src apps/web/src

# Pattern B — direct RPC (phantom risk):
grep -rn 'supabase[^.]*\.rpc.*["'\'']gate_action["'\'']' packages/ai/src apps/web/src
grep -rn 'supabase[^.]*\.rpc.*["'\'']cascade_gate_write["'\'']' packages/ai/src apps/web/src
```

Any Pattern-B hit that is not inside the orchestrator (`agent-router.ts`)
or an approved per-capability `gate.ts` is a phantom-capability candidate
per Invariant 11 (ADR-0197).

## Enforcement

- **ADR-0204** codifies a CI grep gate:
  `scripts/close-feature-journey-guardian.sh` fails if Pattern-B returns
  matches outside the allowlist (orchestrator + per-cap `gate.ts`).
- **SS-1 standalone fix** for `memory/tools.ts:73-91`: move to
  `memory/gate.ts` wrapper that honors all six gate return fields, or
  wire the approver-request flow inline. Not deferrable to B1 rollout.
- Council briefing rule: any claim of "N gate surfaces" must run BOTH
  greps (wrapper count + direct-RPC count) and cite both numbers.
  Single-pattern counts are insufficient.

## References

- ADR-0197 (Invariant 11 — phantom capability)
- ADR-0203 (B1 dual-gate reconciliation verdict)
- ADR-0204 (CI grep gate for inline gate RPC calls)
- L-0124 (phantom body vs phantom emit)
- L-0127 (loader-level bugs evade grep-audits)
- `packages/ai/src/capabilities/memory/tools.ts:73-91` (the phantom)
- Council session 2026-04-23 Agent-Coord trace
