---
title: "Journey capability model — four named capabilities"
id: ADR-0173
status: accepted
layer: decision
created: 2026-04-21
updated: 2026-04-22
---

# ADR-0173: Journey capability model — four named capabilities

## Context and Problem Statement

Spec v1.6.0 described three journeys (Dev test-run, Docs & Mission publish, Runtime agent-guided) but never enumerated the capabilities that back them. `packages/ai/src/capabilities/types.ts` defines 18 `CapabilityName` values — zero begin with `journey.`. Without explicit capability names, the agent router cannot resolve "who's allowed to do this", `engine_authority_config` has no row to seed, and ADR-0132 (Mobile Thin Client via BFF) cannot declare the tool surface.

## Decision Drivers

- ADR-0132 requires every mobile-triggerable action to route through a named capability with C4 authority.
- ADR-0133 verb boundary needs to classify each journey action as web-compose vs mobile-execute.
- L-0066 (default-allow = CVE-class trap) — capabilities without seed rows are auto-autonomous; unseeded journey capabilities would allow any caller to publish a journey.

## Considered Options

1. **Four capabilities:** `journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided` — one per authoring/runtime verb.
2. **One umbrella capability** `journey.*` with sub-actions in payload.
3. **No capabilities** — route everything through a single `journey-runner` Edge Function.

## Decision Outcome

Chosen option: **"Four capabilities"**, because each verb has a distinct authority audience (dev runs are platform-admin-only, mission publish is workspace-admin, guided runs are employee), distinct telemetry payload shape, and distinct ADR-0133 classification.

| Capability | ADR-0133 | Primary caller | C4 default |
|---|---|---|---|
| `journey.run_dev` | web-only | platform-admin | `suggest` |
| `journey.publish_mission` | web-only | workspace-admin | `suggest` |
| `journey.publish_guide` | web-only | workspace-admin | `suggest` |
| `journey.run_guided` | mobile-allowed | employee | `autonomous` (with per-step gates) |

All four must be registered in `packages/ai/src/capabilities/types.ts::CapabilityName` and implemented in `packages/ai/src/capabilities/journey/`.

## Rules & Consequences

- **Good, because** agent router can reason about authority per verb; mobile surface can expose only `journey.run_guided` and reject the authoring three.
- **Good, because** ADR-0176 (C4 authority seed) can seed four rows explicitly — no default-allow risk.
- **Bad, because** four tools to maintain; version-bumping capability schema requires coordinated migration.
- **Agent Impact:** No code path may invoke journey logic outside these four capabilities. Server Actions that wrap them must call `assertCapability(name)` at entry. Mobile cannot register tools for the authoring three.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
