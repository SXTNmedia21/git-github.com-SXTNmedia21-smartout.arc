---
title: "Dispatcher ENTITY_PK map is a hand-maintained ceiling for capability-tool entity coverage"
id: LEARNING_0085
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [engine-dispatch, capability-tools, entity-pk, silent-failure]
---

# Learning-0085: Dispatcher ENTITY_PK map is a hand-maintained ceiling for capability-tool entity coverage

## Context

The Progressive Channel council (2026-04-20) proposed three new Server Actions (`upgradeChannelToHelpdesk`, `downgradeChannelFromHelpdesk`, `setResponsibleRep`) that, at first glance, could be modeled as `engine_process` steps with `action_type='update_entity'`. Code-trace of `supabase/functions/engine-dispatch/index.ts:494-503` revealed:

```typescript
const ENTITY_PK: Record<string, string> = {
  daily_reconciliation: "id",
  department_session: "id",
  profile: "profile_id",
  protocol_assignment: "id",
  change_proposal: "id",
  observer_request: "id",
};
```

**Missing entries:** `channel`, `channel_message`, `engine_state`, `workspace`, and every other public-schema table not explicitly listed. The `update_entity` path at `index.ts:720-727` silently no-ops when `entity_type` is not in the map — no error, no warning, just a skipped mutation.

This matches the explicit Phase 1 disclaimer in `20260515130200_helpdesk_query_process_seed.sql:14-19`:

> "Only `wait_for_event` steps are used. `assign_task`/`update_entity` for engine_state itself are deferred until the dispatcher gains those handlers."

## The trap

A capability-tool author reading `engine_process` blueprint syntax assumes `action_type='update_entity'` works universally — it's a generic-sounding primitive. Only line-by-line trace of `engine-dispatch/index.ts:494` reveals the hand-maintained whitelist. Unsupported entity types fail **silently**, producing a zero-row-change outcome that looks identical to a successful no-op.

## The learning

**Before proposing capability tools or engine_process steps that mutate non-trivial entities:**

1. Grep `supabase/functions/engine-dispatch/index.ts` for `ENTITY_PK` and confirm every target `entity_type` is listed.
2. If not listed, the capability MUST be expressed as a Server Action (server-only, direct DB write) — not as an engine_process step.
3. Document the gap in any ADR proposing the capability so future readers understand why Server Action was chosen over dispatcher wiring.

**Long-term fix (Phase 2 candidate):** Replace the hand-maintained ENTITY_PK map with a code-generated registry driven by `packages/supabase/src/database.types.ts`. Every table with a PK column gets an auto-registered entry. Capability tools can then target any entity without waiting for hand-rollout.

## Why this surfaced

The Progressive Channel proposal initially assumed `upgradeChannelToHelpdesk` could be a dispatcher step because "it's just an entity update." Code-trace forced the rescope to Server Action. Without the trace, the capability would have shipped with engine_process wiring, fired without error in tests (mock dispatcher has no ENTITY_PK check), and silently no-op'd in production.

## Related

- ADR-0165 (Progressive Channel Discriminator — declares Server Actions for the three helpdesk admin operations)
- L-0075 (migration atomicity 0a/0b/0c pattern) — related structural pattern about staged changes
- L-0081 (mock-schema divergence) — same family of silent-failure traps
