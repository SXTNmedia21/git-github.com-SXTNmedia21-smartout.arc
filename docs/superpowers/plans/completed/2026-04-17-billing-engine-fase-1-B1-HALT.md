---
title: "B1 Halt Report — Schema drift discovered in plan Tasks 1.7, 1.8, 1.10"
status: resolved
created: 2026-04-17
updated: 2026-04-17
module: billing
tags: [billing, halt, schema-drift, resolved, phase-1]
---

> **RESOLVED 2026-04-17 (Path C).** ADR-0125 written + registered + ADR-0118 amended. Plan updated with:
>
> - Task 1.7 trigger: `schedule_shift.shift_id` → `schedule_shift_id`
> - **Task 1.7.5 (NEW):** `billing_activity_log` table + RLS
> - Task 1.8: `v_invoice_dunning_notes` rewritten to source from `billing_activity_log`
> - Task 1.10: rewritten to use `engine_process` + `engine_step` pattern (two-table seed)
> - Task 2.1: `EventDestination` union gains `"billing_activity_log"`; 11 billing events route to new destination
> - **Task 2.1.5 (NEW):** `writeBillingActivityLog` provider + emit() dispatcher wiring
> - Phase 6 InvoiceTimeline query redirected to `billing_activity_log`
> - Phase 7 dunning/pricing Server Actions redirected accordingly
>
> B1 execution resumes after this amendment lands.

# B1 Halt Report — Billing Engine Fase 1

**Date:** 2026-04-17
**Halted at:** Preflight, before Task 1.1 commit
**Reason:** Plan has column-name drift vs actual DB schema. 3 tasks will fail migration as written. Adjacent ADR (0118) decision is load-bearing on one of the drifted shapes.

---

## What is complete

Phase 0 (already landed):

| Task | Commit | Subject |
|---|---|---|
| 0.1 | `c9ef5aa4` | ADR-0118 Invoice engine as C3 Commercial consumer |
| 0.2 | `250a5191` | ADR-0119 Usage snapshot reproducibility |
| 0.3 | `fac86ff0` | ADR-0120 Invoice immutability + credit note policy |
| 0.4 | `db9c93f6` | ADR-0121 pricing_terms extension |
| 0.5 | `1a1c040b` | Semantic tokens (--success/--warning/--destructive/--info) |

No Phase 1 work started. No Phase 1 commits on the branch.

---

## What halted me

Plan column references don't match the current DB schema in three tables.

### Drift #1 — `activity_trail` (affects Task 1.8, ADR-0118)

Plan `v_invoice_dunning_notes` view assumes:
```sql
at.activity_trail_id,
(at.properties->>'invoice_id')::uuid AS invoice_id,
at.properties->>'note' AS note,
at.actor_user_id,
```

Actual columns (`supabase/migrations/00005_activity_trail.sql`):
- `id BIGSERIAL` — NOT `activity_trail_id`
- `actor_id UUID REFERENCES public.profile(profile_id)` — NOT `actor_user_id`, and FK to **profile** (workspace-scoped), NOT to `user_identity`
- `data JSONB`, `changes JSONB` — NO `properties` column
- `entity_type`, `entity_id` — flat columns (as per L-0038 in the plan's own critical-corrections header)

**Semantic gap exposed:** ADR-0118 decided "dunning notes via activity_trail (no dunning_note table) preserves cascade invariant #2". But `activity_trail.actor_id` FKs to `profile.profile_id` (a workspace-scoped identity). Platform-admin dunning actions are not performed by a `profile` — they're performed by a `user_identity` with `is_godmode = true`. The current schema has no representation for a platform-admin actor in activity_trail.

### Drift #2 — `engine_process` (affects Task 1.10)

Plan seed assumes:
```sql
INSERT INTO public.engine_process (
  process_key, name, description, definition, is_active, created_at
) VALUES (
  'invoice_lifecycle', ..., jsonb_build_object('steps', jsonb_build_array(...)), ...
) ON CONFLICT (process_key) DO NOTHING;
```

Actual columns (`supabase/migrations/20260304100000_engine_process_tables.sql`):
- `id TEXT PRIMARY KEY` — NOT `process_key`
- `workspace_id UUID`, `max_steps INTEGER` — extras not in plan
- NO `definition jsonb` column — **steps live in a separate `engine_step` table** with columns `process_id, step_order, step_group, action_type, action_payload, assignee_rule`
- Canonical seed pattern (see `20260304300000_seed_daily_close_process.sql`): insert into `engine_process` with `id`, then multi-row insert into `engine_step`

The plan's single-row insert with nested `steps` JSON is not how this engine was built. The `engine_state` runtime actually reads `engine_step` rows, not `definition->steps`.

### Drift #3 — `schedule_shift` (affects Task 1.7)

Plan trigger reads `NEW.shift_id` / `OLD.shift_id`.
Actual column is `schedule_shift_id` (see `20260301300000_schedule_shift_table.sql` line 2).

Also — `basis_drift_event` in the plan declares a `shift_id uuid` column, which would be fine as an alias, but the trigger body references a non-existent column on `schedule_shift` so the trigger would fail to create.

---

## Why I didn't auto-fix

User's protocol rules:

> REJECT → halt + report immediately. No auto-fix attempts.
> Do not improvise fixes to unblock yourself on unresolved decisions.

The fixes are not mechanical renames. They touch semantics:

1. **activity_trail actor model** — who is the actor when a platform admin adds a dunning note? The spec and ADR-0118 say "platform-admin only" for these actions. The current `actor_id → profile` FK doesn't admit that. Options:
   - (a) Add a `user_identity` FK column to activity_trail + make `actor_id` nullable (schema change, affects all existing trail writers)
   - (b) Create a synthetic "platform admin" profile per platform admin (violates workspace-scoped profile semantics)
   - (c) Reverse ADR-0118 on this point and create a dedicated `dunning_note` table keyed to `user_identity` (cleanest, but re-opens the "no dunning_note table" decision)
   - (d) Store platform-admin actions in a separate `platform_activity` stream (new table, clean split)

   Pick requires product + compliance judgement. Not mine to make.

2. **engine_process seed shape** — rewriting Task 1.10 to insert into `engine_process` + `engine_step` (multi-row) is a mechanical change, but the plan's blueprint has "wait_for_event" steps with a `config` object that doesn't match the `action_type + action_payload` convention used by existing seeds. Need to confirm action types are accepted by the dispatcher (`supabase/functions/engine-dispatch/index.ts`).

3. **schedule_shift trigger column** — `shift_id` → `schedule_shift_id` is mechanical. Confident fix. But I'm not applying it alone because a council would then ask "did you also audit the other two drifts?"

---

## What I need from you to resume

Pick one of these paths:

### Path A — Fix plan + ADRs first, then resume B1

1. Amend ADR-0118 to specify the platform-admin actor path for activity_trail (or reverse the decision per option c).
2. Update plan Tasks 1.7, 1.8, 1.10 with corrected column names and the multi-row engine_step pattern.
3. Re-run the plan reviewer. Then re-dispatch B1.

**Pros:** Plan-reality alignment restored. Next B1 runs clean.
**Cons:** Adds 1-2 hour delay for plan/ADR work + review.

### Path B — Author a "plan drift patch" commit, then resume B1

Commit a single file `docs/superpowers/plans/2026-04-17-billing-engine-fase-1-drift-patch.md` with corrected SQL for Tasks 1.7, 1.8, 1.10 and an updated view definition that doesn't read non-existent columns. Decide activity_trail actor model inline (probably option c: new `dunning_note` table, reverses ADR-0118 decision) and write ADR-0125 to supersede that part of 0118.

**Pros:** Fast, keeps B1 momentum.
**Cons:** Two-layer plan-overlay is fragile for future agents.

### Path C — Let me draft fixed SQL + ADR-0125 as a proposal, you review before resuming

I'll write the corrected migrations + the ADR-0125 (activity_trail reversal for billing) as a proposal. You read, approve or revise. Then I resume B1.

**Pros:** Gives you the semantic decision explicitly, keeps you in the loop on the one load-bearing call without blocking on plan rewrite.
**Cons:** One extra round-trip.

---

## Status

- Branch: `feat/billing-engine-fase-1`
- HEAD: `1a1c040b` (Phase 0 complete)
- No uncommitted changes besides this halt report and the previously-untracked `docs/plans/PLAN-billing-engine-fase-1.md` (legacy draft)
- Supabase local: running
- Test run protocol (B1-halt-and-report): triggered correctly

Waiting for path decision (A / B / C) before touching any migration or ADR.
