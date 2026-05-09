---
title: "ADR-0278: Task create via mobile BFF wrap"
id: ADR-0266
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
---

# ADR-0278: Task Create via Mobile BFF Wrap

**Status:** Proposed
**Date:** 2026-05-04

## Context and Problem Statement

`actionMap.create_task` in `apps/mobile/src/lib/sync/action-map.ts` performed a
direct `supabase.from("session_task").insert(p)`. This bypassed the C4 authority gate
(`gate_action('task.add_task_manual')`), the telemetry emit (`task.added_manual`), and
the workspace + profile derivation chain mandated by ADR-0151.

The audit finding (2026-05-04): every other manager-level mutating action that went
through `actionMap` also bypassed these gates. The `create_task` fix is the
smallest of three sorties addressing this gap (Phase B1 mobile BFF parity).

## Decision Drivers

- ADR-0099: every mutation must call `gate_action` before writing.
- ADR-0134: every mutation must emit with non-null `workspace_id` + `actor_id`.
- ADR-0151: `workspace_id` and `profile_id` must be server-derived, never body-supplied.
- ADR-0132: mobile is a thin client — it never calls capabilities or tables directly;
  AI/mutation traffic routes through the web BFF.
- ADR-0114: Server Actions are the canonical mutation primitive on the web surface;
  the BFF exposes them to mobile via Bearer-authenticated Route Handlers.

## Considered Options

1. **BFF wrap (chosen):** Create `/api/mobile/tasks` (Bearer-auth Route Handler) that
   resolves identity from the JWT, delegates to `addTaskAction()` with a pre-resolved
   `actor` param, passes `channel='system'`.
2. **Capability tool delegation:** Route through the stage-engine `task.*` capability.
   Rejected — over-engineered for a manager-UI action; adds stage-engine dependency for
   a non-AI write; duplicates gate logic already in `addTaskAction`.
3. **Keep direct insert, add gate call inline:** Rejected — violates ADR-0132 (direct
   table access from mobile), ADR-0151 (body-supplied workspace_id), and ADR-0134
   (no emit chain).

## Decision Outcome

Chosen option: **1 — BFF wrap**.

`addTaskAction()` is extended with optional `actor?: ResolvedActor` and
`channel?: "chat" | "system"` parameters (§B2/B3). When `actor` is supplied the
cookie lookup is skipped; `channel` flows through to `gateAction()` and the telemetry
`source` field. Backward-compatible: existing cookie callers are unchanged.

`/api/mobile/tasks` is the sole mobile entry point. It resolves workspace + profile
from the Bearer JWT via the admin client, validates the request body (no identity
fields), and calls `addTaskAction(body, actor, "system")`.

`actionMap.create_task` replaces the direct insert with a `fetch` to
`getMobileTasksUrl()` using the current session access token as Bearer. The payload
mapping converts `department_session_id → sessionId`, `assigned_to → ownerProfileId`,
`session_hook_id → hookId` to match `AddTaskInput`.

## Rules & Consequences enforced for Agents

- **Good, because** `create_task` now flows through gate + emit, closing the
  ADR-0099 / ADR-0134 violations for this action.
- **Good, because** workspace resolution is server-side — no forgeable identity in the
  body (ADR-0151 closed for this path).
- **Bad, because** the network hop adds ~20–50 ms to sync (acceptable trade-off; the
  action is manager-initiated, not high-frequency).
- **Agent Impact:** Any new mobile write action that creates/mutates manager-level
  records MUST follow this pattern: add a `/api/mobile/<entity>/route.ts` BFF,
  extend or create the corresponding Server Action with `actor?` + `channel?`, and
  update `actionMap` to call the BFF. Never add a new direct `.from(...).insert()`
  for manager mutations in `action-map.ts`.

## Related

- ADR-0099 — unified authority gate
- ADR-0114 — Server Actions as canonical mutation primitive
- ADR-0132 — mobile AI routing / thin client
- ADR-0134 — mobile telemetry contract
- ADR-0151 — server-side identity derivation
- ADR-0261 — BFF as mutation host for non-agent capabilities
