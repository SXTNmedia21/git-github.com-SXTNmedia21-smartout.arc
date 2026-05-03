---
title: "engine_state schema relaxation: workspace_id and process_id nullability with CHECK constraints"
id: ADR_0247
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
references:
  - ADR-0246
  - ADR-0216
---

# ADR-0247: engine_state schema relaxation — workspace_id + process_id nullability

## Intro

Two schema invariants on `engine_state` block ADR-0246 Phase A0 cleanly:
- `engine_state.workspace_id` is `NOT NULL`. Telegram admin sessions are workspace-NULL by design (migration `20260330200000`).
- `engine_state.process_id` is `NOT NULL` referencing `engine_process(id)`. Botsson agent-mode chat has no journey blueprint, no process.

Without resolution, `kind='conversation'` rows cannot be created cleanly under the three-table boundary that ADR-0216 ratified.

## Decision

Relax both columns to nullable. Add per-`kind` CHECK constraints to preserve existing invariants for `kind='journey'` rows.

```sql
ALTER TABLE engine_state
  ALTER COLUMN workspace_id DROP NOT NULL,
  ALTER COLUMN process_id DROP NOT NULL;

ALTER TABLE engine_state ADD CONSTRAINT engine_state_workspace_id_kind_check
  CHECK (
    (kind = 'conversation' AND (workspace_id IS NULL OR workspace_id IS NOT NULL))
    OR (kind IN ('journey', 'recurring') AND workspace_id IS NOT NULL)
  );

ALTER TABLE engine_state ADD CONSTRAINT engine_state_process_id_kind_check
  CHECK (
    (kind = 'conversation' AND process_id IS NULL)
    OR (kind IN ('journey', 'recurring') AND process_id IS NOT NULL)
  );
```

## Considered alternatives

1. **Synthetic `engine_process` row per workspace for "agent-conversation" mode.** Rejected: pollutes process registry with non-process semantics; every workspace needs a synthetic row at provisioning time; adds maintenance surface.
2. **Carve-out: Telegram admin + Botsson agent-mode stay in legacy `engine_sessions`.** Rejected: leaves split-brain that ADR-0216 explicitly closed; requires perpetual dual-codepath in stage-engine.
3. **Relaxation with CHECK constraints (chosen).** Single-table ontology preserved for non-journey kinds. CHECK ensures journey/recurring kinds cannot accidentally lose workspace_id or process_id.

## Rules & Consequences

- **Good, because** preserves three-table boundary; allows `kind='conversation'` rows without synthetic engine_process rows; CHECK constraints prevent regression on journey/recurring kinds.
- **Bad, because** 27+ existing engine_state writers in 8 cascade domains must verify they are NOT writing workspace_id NULL or process_id NULL accidentally for journey kind (caught by CHECK constraint at INSERT-time, but new code-review burden).
- **Agent Impact:**
  - All NEW `engine_state` writers must explicitly set `kind` first.
  - Capability tools writing `kind='journey'` continue to require workspace_id and process_id.
  - Stage-engine writers for `kind='conversation'` (agent-mode chat, Telegram admin) may write NULL workspace_id and process_id.
  - Code review gate: any `INSERT INTO engine_state` without explicit `kind` value rejected.

## Open Items

- Retroactive RLS policy review: existing policies on `engine_state` reference `workspace_id IS NOT NULL` implicitly. Phase A0 audits all RLS policies; nullable workspace_id rows for `kind='conversation'` use a separate policy path or explicit `kind='conversation'` carve-out.

---

> Registered in `docs/decisions/0000-decision-log.md` after merge.
