---
title: "C4 authority defaults are not free — capabilities must seed explicitly"
id: LEARNING_0097
status: canonical
layer: learning
created: 2026-04-21
updated: 2026-04-21
tags: [c4-authority, capabilities, default-allow, seed-migration]
---

# Learning-0097: C4 authority defaults are not free — capabilities must seed explicitly

## Context

`engine_authority_config.level` has default `read_only` (migration `20260302000100_engine_authority_config.sql:10-11`). Spec v1.6.0 implicitly assumed default `suggest`. At the same time, ADR-0091 `gate_action` SECURITY DEFINER RPC default-allows capabilities with no seed row (L-0066, 2026-04-19 Kanaler council).

The combination is dangerous:

- If the authority config default wins → capability is unreachable (`read_only` blocks execution).
- If the dual-gate `gate_action` default-allow wins → capability is auto-autonomous (no authority check).

Neither is the intended behavior. The only safe path is an explicit seed row per capability.

## Discovery

"Defaults are free" is a comfortable assumption during spec-writing. For C4 authority, defaults are never free — they are either blocking or dangerously permissive depending on which code path the caller lands on. Capabilities ship with the wrong default 100% of the time if left implicit.

Second occurrence of this learning class. L-0066 named it for the Kanaler/helpdesk council (2026-04-19). Now repeats for Journey Runner. Promote to a council-level precondition: no spec mentioning a new capability may merge without `engine_authority_config` seed migration in the same PR.

## Impact

- `run-council` skill should add to Phase 5 Agent Trust Gate: *"For every new capability, grep the PR for `engine_authority_config` INSERT — zero matches = reject."*
- `close-feature.sh` should grep for unseeded capabilities in `packages/ai/src/capabilities/` and fail the gate.
- Every new ADR that proposes a capability must cite the matching authority ADR (ADR-0176 for journey).

## References

- ADR-0176 (journey C4 authority seed) — explicit seed response.
- L-0066 (default-allow CVE-class trap, 2026-04-19) — prior occurrence.
- ADR-0091 (`gate_action` unified authority gate) — the dual-gate that makes defaults dangerous.
- Migration `20260505110000_unified_authority_gate.sql:155-157` — the default-allow SQL.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
