---
id: ADR-0417
title: change_proposal kind=template_apply — week-template application as proposal bundle
status: accepted
date: 2026-05-25
author: System Council (system-steward chair)
supersedes: none
extends: ADR-0309
related: ADR-0173, ADR-0204, ADR-0240, ADR-0288, ADR-0356
tags: [scheduling, capability, schedule, change_proposal, template, ADR-0309-extension]
---

# ADR-0417 — change_proposal kind=template_apply

## Context

Council 2026-05-25 ("Sett opp juni for meg" gap analysis) identified gap 4: `schedule.apply_week_template` — capability tool to apply a `schedule_template` (week shift skeleton) to a date range.

Two divergent bulk-write patterns surface as risk:

- `scheduler.propose_plan` → ONE `change_proposal` (kind=`scheduler_bundle`) → manager review → `scheduler.accept_proposal` atomic INSERT of N shifts (ADR-0309)
- Direct multi-row INSERT to `schedule_shift` from `apply_week_template`

Direct pattern bypasses audit trail, gate evaluation, rollback path, and ADR-0309 single-bundle invariant. Two bulk-write pipelines in the same namespace violates cascade invariant #1 (single canonical pipeline).

`change_proposal.kind` is TEXT (not enum) per `20260611120000_wfm_foundation.sql:261-292`. Table COMMENT documents accepted values: `scheduler_bundle`, `wage_line_override`, NULL legacy. New kinds require migration COMMENT update + Zod schema in capability tool body.

## Decision

`schedule.apply_week_template` writes a single `change_proposal` row with `kind='template_apply'`. Manager reviews via existing `/dashboard/schedule/proposed-plan` surface (reuses scheduler_bundle UI). Accept path is `scheduler.accept_proposal` extended to handle template_apply payload (or new `scheduler.accept_template_apply` mirror tool).

Payload JSONB shape:

```jsonc
{
  "kind": "template_apply",
  "template_id": "<schedule_template.id>",
  "applied_date_range": { "from": "2026-06-01", "to": "2026-06-30" },
  "department_id": "<department.department_id>",
  "proposed_shifts": [{ "shift_date": "...", "shift_type_id": "...", "slot_index": 0 }, ...],
  "gap_count": 0,
  "applied_template_provenance": { "applied_at": "<iso>", "applied_by": "<profile_id>" }
}
```

Authority: `confirm` min_role `manager`. Channel: chat-only (Compose verb per ADR-0133). Single `mutateWithGate` wraps the INSERT.

## Consequences

- Preserves ADR-0309 single-bundle invariant — every bulk shift creation lands in `change_proposal` first
- Reuses existing accept/reject infrastructure + telemetry events
- One new `kind` literal — requires migration COMMENT update + Zod schema in `schedule/tools.ts`
- Manager sees template-apply proposals alongside solver-bundle proposals in `/dashboard/schedule/proposed-plan` (UI must render both kinds)
- `accept_proposal` body must branch on `kind` field to extract the right `proposed_shifts[]` shape (scheduler_bundle vs template_apply payload differ)
- Provenance carried into `schedule_shift.applied_from_template_id` (optional new column) if traceability required

## Status

**Accepted 2026-05-25 (Phase 1 sortie `turnus-diagnose-and-template`).** Pre-work bug fixes closed on development:
- C1 L-0348 solver column drift → commit `39f1fbd5f`
- C2 G10 TZ wrong-day → commit `b0c8e7dca`
- C3 G9 profile_id forgery (regression tests; route was already fixed `84f374cc5`) → commit `b9a66f98d`

Implementation lands in Phase 1 sortie `feat/turnus-diagnose-and-template` (this ADR's accept-event). Track A (system-steward, 2026-05-25) verified zero new schema beyond single `COMMENT ON COLUMN` migration for the new TEXT literal.

**Track A scope corrections (must be honored by Track C):**
- Use `planning_cycle.status = 'archived'` for template list (not `committed` — enum has `draft|active|archived` only, see `database.types.ts:23604`).
- Payload `proposed_shifts[]` MUST mirror real `schedule_shift` columns (`shift_date DATE, role TEXT, start_time TIME, end_time TIME, position_id UUID?, department_id UUID`). Drop `shift_type_id` + `slot_index` from V1 — those columns don't exist in `schedule_shift` (`supabase/migrations/20260301300000_schedule_shift_table.sql:44-71`).
- Extend `scheduler.accept_proposal` at `packages/ai/src/capabilities/scheduler/tools.ts:498,660` to branch on `kind` field (currently throws on `kind !== 'scheduler_bundle'`). Otherwise Phase 1 ships orphan write surface (R3 BLOCKER).

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- `packages/ai/src/capabilities/scheduler/tools.ts:260-371,385,549` (scheduler_bundle pattern)
- `supabase/migrations/20260611120000_wfm_foundation.sql:261-292` (change_proposal.kind TEXT + COMMENT contract)
- `apps/web/src/app/dashboard/schedule/proposed-plan/page.tsx` (existing UI surface)
- ADR-0309 (bundle proposal pattern)
