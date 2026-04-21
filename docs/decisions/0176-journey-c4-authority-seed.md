---
title: "Journey capability C4 authority seed — mandatory non-default rows"
id: ADR_0176
status: proposed
layer: decision
created: 2026-04-21
updated: 2026-04-21
---

# ADR-0176: Journey capability C4 authority seed — mandatory non-default rows

## Context and Problem Statement

`engine_authority_config.level` default is `read_only` (migration `20260302000100_engine_authority_config.sql:10-11`). Spec v1.6.0 assumed default `suggest` — inverse of reality. Without explicit seed rows, all four journey capabilities (ADR-0173) are either (a) unreachable because the default blocks everything, or (b) in the dual-gate model (ADR-0091 `gate_action`) default-allowed to run autonomously if the SECURITY DEFINER RPC takes precedence — same class as L-0066 (default-allow CVE-class trap).

## Decision Drivers

- L-0066 / 2026-04-19 Kanaler council — every new capability must ship with explicit seed migration; no default-allow.
- ADR-0173 defines four journey capabilities — each needs a row.
- Runtime agent-guided journey (Journey 3) cannot run without authority; Trust Gate rejected spec v1.6.0 on this point.

## Considered Options

1. **Seed migration with four rows** — one per capability, explicit `level`, explicit `target_roles`.
2. **Rely on default** — accept whatever `read_only` produces.
3. **One umbrella row** with capability_pattern `journey.*` — single migration row.

## Decision Outcome

Chosen option: **"Seed migration with four rows"**, because default behavior is the wrong behavior for all four capabilities and pattern-matching on `journey.*` would grant a single authority level to capabilities that need different levels.

Seed table:

| Capability | `level` | `target_roles` | Reason |
|---|---|---|---|
| `journey.run_dev` | `suggest` | `{'platform_admin'}` | Dev runs should prompt-confirm; platform-admin only |
| `journey.publish_mission` | `suggest` | `{'workspace_admin'}` | Publishing mutates agent behavior; workspace-admin confirm |
| `journey.publish_guide` | `suggest` | `{'workspace_admin'}` | Publishing mutates user-facing docs; workspace-admin confirm |
| `journey.run_guided` | `autonomous` | `{'employee','workspace_admin','platform_admin'}` | Guided runs are read-only from user POV; per-step gates handle mutation surfaces |

Migration file ships as part of the v1.7.0 landing, in the 0a/0b/0c order (per L-0075) — enum first, capability registration second, authority seed third.

## Rules & Consequences

- **Good, because** every capability is explicitly reachable; no hidden default-allow.
- **Good, because** per-role targeting is explicit — future audit can grep for roles and answer "what can X role do?"
- **Bad, because** seed migration must be updated every time a capability is added.
- **Agent Impact:** Any capability added in `packages/ai/src/capabilities/` MUST ship with an `engine_authority_config` seed row in the same PR. `close-feature.sh` should grep for unseeded capabilities as a future gate.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
