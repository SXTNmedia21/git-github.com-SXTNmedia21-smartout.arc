---
title: "Pattern B (cascade audit-symmetry) is the default for cross-capability extensions"
id: LEARNING_0310
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [cross-namespace, delegation, audit, adr-0356, pattern, security]
---

# Learning-0310: Pattern B (cascade audit-symmetry) is the default for cross-capability extensions

## Context

Council Phase 5 synthesis on ADR-0367 (2026-05-18) hit the question: when `task.create_session` is extended to accept an optional `day_line_id` parameter, who owns the audit trail? Two patterns considered:

- **Pattern A (lenient):** schema accepts `day_line_id` from any caller (user input OR delegated). No audit-symmetry fields. Light to implement.
- **Pattern B (cascade-symmetric, per ADR-0356):** schema accepts `day_line_id` PLUS `actor_capability` + `delegated_via` audit fields. Emit includes both. Verified-by-design that "who is the real actor" is queryable from `activity_trail`.

System-agent-coordinator C-2 escalated this to a security decision: Pattern A reopens L-0177 silent-fallback class (forgeable identity) because `day_line_id` becomes a body-supplied trusted parameter without authority verification at the receiving capability. Pattern B closes the gap by making the chain explicit.

## Discovery

The ADR-0356 cascade precedent at `packages/telemetry/src/registry.ts:10273-10363` already established the pattern for payroll cross-namespace delegation. The audit fields are:

- `actor_capability` (string) — which capability initiated the write (the "delegate")
- `delegated_via` (string) — which capability the call was routed through (the "delegator")

For payroll: when `payroll.run_period` writes through cascade delegation tools, it emits `actor_capability="cascade"` + `delegated_via="payroll"`. The receiving namespace verifies the caller is allow-listed for delegation.

ADR-0367 generalizes this to ALL cross-capability extensions: whenever capability X extends to accept `Y_id` from capability Y, Pattern B fields are mandatory. Pattern A is FORBIDDEN.

## Impact

Hard rule added to spec template:

> Whenever a capability tool schema extends to accept an identifier from a different capability namespace (e.g. `Y_id` parameter when the tool's owning capability is X, where Y owns the identifier's table), the schema MUST add `actor_capability` + `delegated_via` fields. Tool body MUST verify caller's namespace matches `delegated_via`. Emit MUST include both fields.

Mechanical check:
1. Grep `packages/ai/src/capabilities/*/tools.ts` for schema fields ending in `_id` that reference tables NOT owned by the tool's capability namespace
2. For each match, verify either:
   - Pattern B applied (audit fields present + body verifies caller)
   - Field is server-derived (never body-supplied)

If neither, the tool has the L-0177 silent-fallback class trap.

This becomes the default for any future capability extension. Pattern A is rejected by code review.

## References

- ADR-0356 (Cascade namespace delegation pattern — payroll precedent)
- ADR-0367 v1.2 Rule 7 (Pattern B mandate)
- `packages/telemetry/src/registry.ts:10273-10363` (audit-symmetry pattern in registry)
- L-0177 (silent-fallback / forgeable identity class)
- L-0240 (cross-namespace direct DML forbidden)
