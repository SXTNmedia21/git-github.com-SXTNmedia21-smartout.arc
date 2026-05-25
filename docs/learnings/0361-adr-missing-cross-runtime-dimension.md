---
title: "ADR missing cross-runtime dimension — Phase 2.5 rule (3rd occurrence)"
id: LEARNING_0361
status: canonical
layer: learning
created: 2026-05-25
updated: 2026-05-25
tags: [council, phase-2.5, adr, cross-runtime, deno-node-boundary, chair-self-reversal, SKILL-promotion]
related_adrs: [ADR-0151, ADR-0193, ADR-0424]
related_learnings: [L-0147, L-0294, L-0356, L-0359, L-0177]
slot_note: "Originally drafted as L-0358 in council briefing; that slot taken by 0358-forward-only-repair-doctrine-collision-aliasing.md (also 2026-05-25). Slot-yield via outsider-renumber per L-0147 doctrine + ADR-0349/0351 precedent. Pattern numbering preserves chronology; absolute slot is operational."
---

# Learning-0361: ADRs touching runtime boundaries must specify Transport layer

## Context

Council R6 2026-05-25 PM session escalated from Sortie F Phase 2 (T-Handler) failure. Phase 1
of ADR-0424 (`invoke_capability_tool` action-type) shipped in three clean PRs (#476 schema,
#477 resolver shim, #478 telemetry registration) and merged to `development`. Phase 2 (the
EF handler) immediately blocked on a structural impossibility: the handler must execute in
`supabase/functions/engine-dispatch/index.ts` (Deno EF runtime), but capability tool bodies +
the resolver live in `packages/ai` (Node ESM). Deno cannot import Node ESM. Three sibling
code comments already document this boundary explicitly:

- `supabase/functions/engine-dispatch/index.ts:3057-3061`
- `supabase/functions/engine-dispatch/handlers/sync-integration.ts:16-19`
- `supabase/functions/pos-sync/index.ts:50-52`

The blocker is documented in `docs/plans/SORTIE-F-HANDLER-BLOCKED.md`.

ADR-0424 was authored 2026-05-25 AM (same day) and reviewed in the 11-agent sim council.
None of the 11 council agents — nor the Phase 2.5 fact-checker, nor the Phase 3 reviewers,
nor the Phase 5 chair — surfaced the Deno↔Node module boundary problem. The ADR's
"§Handler invariants" specified gate placement, recursion depth, audit symmetry, and
telemetry emit — all the **content** dimensions. It did not specify the **transport**
dimension: where does the handler code physically run, and how does it reach the resolver
and tool bodies?

The result: a structurally invalid ADR shipped with a hidden runtime-boundary blocker,
discovered only when the build-agent attempted Phase 2 implementation.

## Discovery

**ADRs that introduce a new action-type, capability, or scheduled invocation MUST surface
the runtime in which the new code executes — and verify the imports needed by that code are
reachable from that runtime.**

This is the 3rd occurrence of a related "cross-axis omission" class:

| #   | Date       | Occurrence                                                                  | Axis omitted                             |
| --- | ---------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | 2026-05-17 | L-0356 — ADR-0367 tri-layer D6 collision (cross-dimension D5 vs D6)         | Cross-dimension (cascade layer overlap)  |
| 2   | 2026-05-25 | L-0294 / L-0147 13th — chair self-reversal protocol (axes coverage)         | Cross-perspective (reviewer axis matrix) |
| 3   | 2026-05-25 | L-0361 — this entry, ADR-0424 transport layer missing (Deno↔Node boundary)  | Cross-runtime (module-system boundary)   |

The unifying signature: a multi-axis problem is reasoned about along the axes the briefing
makes explicit; orthogonal axes (other cascade layers, other reviewer perspectives, other
runtimes) remain invisible until implementation surfaces them.

## Rule (promotion to council infrastructure)

Pre-vote Phase 2.5 fact-check gains a new checklist item:

```
Does this ADR cross a runtime boundary?
  - Deno (Edge Functions) vs Node (services, packages)
  - Client (browser, React Native) vs Server (Node, Deno)
  - Cross-region / cross-tenant if applicable
  - EF cron / scheduled-event vs interactive request

If YES → the ADR MUST include an explicit §Transport layer section specifying:
  - Which runtime owns each piece of code
  - How runtimes communicate (HTTP, RPC, queue, shared DB)
  - Identity propagation pattern (per ADR-0151 cross-runtime extension)
  - Gate placement (which side runs gate_action)
  - Recursion / depth enforcement (which side enforces, which asserts as defense)
  - Telemetry split (avoid double-emit across runtime boundary)
  - Env var contract (new keys, scopes, drift-check coverage)
  - Documentation surfaces required in same PR (SERVICE_ROUTING.md, EDGE_FUNCTIONS_REFERENCE.md, ENV_VARS.md)

If §Transport layer missing → REJECT or HOLD pending amendment.
```

## How ADR-0424 illustrates the failure mode

ADR-0424 specified:

- ✓ Capability boundary (`actor_capability` + `delegated_via` per ADR-0356)
- ✓ Authority gate placement (gate before body)
- ✓ Recursion limit (depth = 1)
- ✓ Identity propagation (`workspace_id` from parent state per ADR-0151)
- ✓ Telemetry emit (`engine_dispatch.tool_invoked`)
- ✓ Rejected alternative (Option B — extend `assign_task`)

ADR-0424 did NOT specify:

- ✗ Which runtime owns the handler code
- ✗ How the handler reaches the resolver
- ✗ Transport pattern if cross-runtime
- ✗ Identity re-derivation across runtime boundary (vs only within one runtime)
- ✗ Gate-placement-by-runtime (gate side vs execute side when split)
- ✗ Reference doc updates required for cross-runtime work

All five missing dimensions were structurally implied by the EF↔Node runtime boundary that
the ADR never named. The 2026-05-25 amendment (this council R6) adds them retroactively.

## Sibling siblings + chair self-reversal

This learning is sibling to:

- **L-0147** — chair self-reversal protocol. Council R6 itself was a chair self-reversal:
  Phase 3 said "Phase 2 should ship as scoped"; Phase 5 reversed to "Phase 2 cannot ship —
  ADR-0424 missing transport layer is the blocker, amend ADR first." 14th L-0147 precedent.
- **L-0359** — Phase 2.5 doctrine-ADR gap. Same Phase 2.5 weakness surface: fact-check is
  defensive (verify stated claims) not offensive (find missing claims). L-0359 added doctrine
  ADR check; L-0361 adds cross-runtime check.
- **L-0177** — workspace_id silent-fallback class. Cross-runtime identity propagation is the
  same forgery surface, one layer up.
- **L-0356** — same multi-axis omission class, different axis (cascade dimension vs runtime).

**Promotion to council infrastructure (3-date threshold):**

L-0356 (cross-dimension) + L-0359 (cross-doctrine) + L-0361 (cross-runtime) form a triplet
of "Phase 2.5 missed orthogonal-axis-X" learnings within 8 days. The unified rule for the
`run-council` SKILL.md Phase 2.5 section:

```
Phase 2.5 fact-check now includes an "Orthogonal Axes" pass:
  - Other cascade dimensions touched? (L-0356)
  - Doctrine ADRs in docs/decisions/ last 14 days that supersede premise? (L-0359)
  - Runtime boundaries crossed? (L-0361)
  - Other reviewer axes typically missed at this stage? (L-0294 4th-reviewer rule)

Each axis is a separate grep / lookup. Surface any positive hit as section (e) ORTHOGONAL_AXIS_GAP.
```

## Operator detection signal (post-merge audit)

Run weekly via heartbeat:

```bash
# Find ADRs that introduce action-types or capability invocations
# but lack §Transport layer section
for adr in docs/decisions/*.md; do
  if grep -qE "action.type|action_type|invoke_capability|engine_process.*invoke" "$adr"; then
    if ! grep -q "## Transport layer\|§Transport" "$adr"; then
      echo "WARN no-transport: $adr"
    fi
  fi
done
```

False-positive rate: ADRs that describe action-types semantically without introducing new
runtime boundaries (e.g. amendments to existing Node-only flow). Acceptable noise.

## References

- `docs/plans/SORTIE-F-HANDLER-BLOCKED.md` — Phase 2 escalation source
- [[ADR-0424]] §Transport layer — this amendment closes the gap for ADR-0424 specifically
- [[ADR-0151]] §Cross-runtime extension — receiving runtime re-derives identity (consumer of
  this learning)
- [[ADR-0173]] — frozen-4 capability boundaries (preserved across the bridge)
- [[ADR-0421]] sub-pattern C — EF/capability duplication (inline-mirror would re-violate)
- L-0147 — chair self-reversal protocol (R6 was 14th precedent)
- L-0294 — Phase 2.5 promotion + 4th-reviewer rule
- L-0356 — cross-dimension axis-omission (1st-occurrence sibling)
- L-0359 — doctrine-ADR axis-omission (2nd-occurrence sibling)
- L-0177 — silent-fallback class (cross-runtime identity guard prevents)
