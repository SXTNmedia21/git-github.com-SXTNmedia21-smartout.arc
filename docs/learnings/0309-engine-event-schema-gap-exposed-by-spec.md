---
title: "`engine_event` schema gap exposed by spec assumption — verify columns pre-Phase-2.5"
id: LEARNING_0309
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [engine-event, schema-verification, fact-check, spec-discipline]
---

# Learning-0309: `engine_event` schema gap exposed by spec assumption

## Context

ADR-0367 spec v1.1 §5.5 (push pipeline) declared the idempotency anchor as `engine_event` with `event_type='day_line_item.notified'` AND `entity_id='<item_id>:<shift_session_id>'`. Supervisor Phase 3 C7 raised the concern: is `engine_event.entity_id` typed `TEXT` or `UUID`? Code-trace verification against `supabase/migrations/20260304100000_engine_process_tables.sql:101-123` revealed the column does NOT EXIST.

## Discovery

Actual `engine_event` schema:

```sql
CREATE TABLE public.engine_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  idempotency_key TEXT,
  fired_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_engine_event_idempotency
  ON engine_event (idempotency_key) WHERE idempotency_key IS NOT NULL;
```

The correct idempotency anchor is `idempotency_key TEXT` with partial-unique index — no migration needed for push pipeline composite-key. Spec v1.2 amended to use `idempotency_key` directly.

The trap is structural: spec authors assume column shapes that "feel right" without grepping. The Phase 2.5 fact-check stage caught it on this council; without that gate, the migration would have added a redundant `entity_id` column or worse, broken the existing idempotency contract.

## Impact

Phase 2.5 fact-check checklist addition (hard rule, promoted via this learning):

For every column reference in a spec that proposes a new write path:
1. Grep `packages/supabase/src/database.types.ts` for the column name
2. If absent, grep `supabase/migrations/` for the table's `CREATE TABLE` definition
3. If still absent, the spec is referencing a column that doesn't exist — fail-fast with file:line citation

Sibling traps:
- L-0190 (stale-dist failure) — similar class: assumed type/column existed; reality was stale build artifact
- L-0292 wrong-scope-key grep — assumed enum value; reality was schema mismatch
- L-0294 mapping-fidelity — assumed file:line cited content matched; reality was prose-drift

All four traps share the same root cause: **spec authors and reviewers treating prose claims as factual without code-trace verification**. Phase 2.5 fact-check is the structural mitigation.

## References

- Council Phase 3 supervisor C7 (2026-05-18)
- ADR-0367 v1.2 Rule 4 amendment
- `supabase/migrations/20260304100000_engine_process_tables.sql:101-123`
- L-0190, L-0292, L-0294 (sibling fact-vs-prose traps)
