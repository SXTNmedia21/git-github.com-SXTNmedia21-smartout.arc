---
title: "Scheduling — Data Model"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scheduling
mirror: verified
last_verified: 2026-05-23
tags: [scheduling, shift, data-model, migrations, tables, telemetry]
---

# Scheduling — Data Model

> Tables, enums, RLS policies, RPCs, telemetry events, and migration grouping.
> Every table cite references migration:line. CODE WINS.

## Core Tables

### `public.schedule_shift`

Migration: `20260301300000_schedule_shift_table.sql:55`

| Column | Type | Notes |
|---|---|---|
| `schedule_shift_id` | UUID PK | `gen_random_uuid()` |
| `workspace_id` | UUID NOT NULL | FK → `workspace` ON DELETE CASCADE |
| `employee_id` | UUID NULL | FK → `profile` ON DELETE SET NULL (null = unassigned) |
| `position_id` | UUID NULL | FK → `position` ON DELETE SET NULL |
| `team_id` | UUID NULL | FK → `team` ON DELETE SET NULL |
| `department_id` | UUID NULL | FK → `department`; derived from `position_id` via trigger `20260520170002` |
| `shift_date` | DATE NOT NULL | |
| `role` | TEXT NOT NULL | |
| `start_time` | TIME NOT NULL | |
| `end_time` | TIME NOT NULL | |
| `work_hours` | NUMERIC(4,2) | Auto-calculated |
| `breaks` | INTEGER | Minutes |
| `day_category` | `day_category` enum | morning/midday/afternoon/evening/night/weekend |
| `status` | `shift_status` enum | created→assigned→published→active→completed→unpublished |
| `is_published` | BOOLEAN | Redundant with status=published; kept for query convenience |
| `pipeline_lock_state_id` | UUID NULL | FK → `engine_state` ON DELETE SET NULL; CAS-style pipeline lock (`20260620110200`) |
| `is_locked` | BOOLEAN | Temporal lock flag (ADR-0066 rollout `20260428133000`) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Enums:**
- `shift_status`: `created`, `assigned`, `published`, `active`, `completed`, `unpublished`
- `day_category`: `morning`, `midday`, `afternoon`, `evening`, `night`, `weekend`

**RLS policies:**
- JWT read: workspace member reads own shifts or manager reads all (`20260301300000`)
- Service role write: all write paths via service-role (shift-mcp, Edge Functions)
- RLS invariant assert: `20260605121000_schedule_shift_rls_invariant_assert.sql`
- `WITH CHECK`: `20260605120000_shift_approval_rls_with_check.sql`

**Temporal lock trigger (ADR-0066):**
- `enforce_schedule_shift_temporal_lock()` BEFORE INSERT/UPDATE trigger
- Locks when `shift_date < v_local_now::date OR shift_start_local <= v_local_now`
- Workspace-timezone aware
- `pipeline_lock_state_id` is explicitly carved out from planning-field lock

**Department backfill trigger:**
- `schedule_shift_derive_department_id()` BEFORE INSERT/UPDATE OF `position_id`
- Sets `department_id` from `position.department_id` when NULL (`20260520170002`)

### `public.shift_hour_interpretation` (Interpretation layer — ADR-0095)

Migration: `20260506100001_shift_derivation_layer.sql:40`

| Column | Type | Notes |
|---|---|---|
| `interpretation_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL | FK → `workspace` |
| `shift_id` | UUID NOT NULL | FK → `schedule_shift` ON DELETE CASCADE |
| `department_id` | UUID NULL | FK → `department` |
| `time_entry_ids` | UUID[] | Input provenance — which `time_entry` rows consumed |
| `framework_rule_ids` | UUID[] | Which D3 rules applied |
| `regular_hours` | NUMERIC(5,2) | |
| `overtime_hours` | NUMERIC(5,2) | |
| `night_hours` | NUMERIC(5,2) | |
| `holiday_hours` | NUMERIC(5,2) | |
| `weekend_hours` | NUMERIC(5,2) | |
| `break_deductions` | NUMERIC(5,2) | |
| `total_interpreted_hours` | NUMERIC(5,2) | |
| `derivation_version` | INT | Append-only; re-derivation bumps version |
| `derived_at` | TIMESTAMPTZ | |
| `derived_by` | TEXT | `derive_shift_hours@v1` |

UNIQUE constraint: `(shift_id, derivation_version)`.

### `public.shift_cost_snapshot` (Derivation layer C3 — ADR-0095)

Migration: `20260506100001_shift_derivation_layer.sql` (ALTER of pre-existing table)

Extended columns added: `interpretation_id`, `tariff_rate_snapshot`, `payroll_profile_id`, `snapshot_version`.

### `public.shift_approval` (Decision layer C1 — ADR-0095)

Migration: `20260304200200_deviation_shift_approval.sql`

| Column | Type | Notes |
|---|---|---|
| `shift_approval_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL | |
| `schedule_shift_id` | UUID NOT NULL | FK → `schedule_shift` |
| `shift_approval_status` | enum | `pending`, `approved`, `edited`, `disputed` |
| `edit_justification` | TEXT | Override reason (ADR-0097 — edits go here, never to `time_entry`) |
| `approved_by` | UUID | FK → `profile` |
| `approved_at` | TIMESTAMPTZ | |

RLS: JWT read for workspace members; service-role writes; API key read `20260407100001`.

### `public.schedule_shift_offer` (Marketplace sidecar — ADR-0306)

Migration: `20260611120000_wfm_foundation.sql:171`

| Column | Notes |
|---|---|
| `schedule_shift_offer_id` UUID PK | |
| `workspace_id` UUID NOT NULL | FK → `workspace` |
| `schedule_shift_id` UUID NOT NULL | FK → `schedule_shift` — sidecar, does NOT duplicate shift row |
| `offer_status` enum | `schedule_shift_offer_status`: `open`, `claimed`, `approved`, `complete`, `cancelled` |
| `posted_by_profile_id` | manager who posted |
| `claimed_by_profile_id` | employee who claimed (nullable) |
| `engine_state_id` | FK → `engine_state` (marketplace_lifecycle blueprint instance) |

RLS hotfix: `20260615120000_wfm_foundation_rls_hotfix.sql:46`.

### `public.shift_session` (ADR-0367 runtime per-employee slot)

Migration: `20260620120300_shift_session_table.sql:7`

| Column | Notes |
|---|---|
| `shift_session_id` UUID PK | |
| `workspace_id` UUID NOT NULL | |
| `department_session_id` UUID NOT NULL | FK → `department_session` — binds to D6 runtime container |
| `schedule_shift_id` UUID NOT NULL | FK → `schedule_shift` ON DELETE CASCADE |
| `employee_id` UUID NOT NULL | FK → `profile` |
| `business_date` DATE NOT NULL | |
| `location_id` UUID NOT NULL | FK → `location` |
| `department_id` UUID NOT NULL | FK → `department` |
| `status` | `shift_session_status` |
| `clocked_in_at` / `clocked_out_at` | Timestamptz |
| `push_topic` | Push notification topic |

UNIQUE: `(schedule_shift_id)` — one session per shift slot.
Day-line junction: `20260620120400_shift_session_day_line_junction.sql`.

**Note on ownership edge:** `shift_session` bridges scheduling (plan) and day-session (runtime). Scheduling domain owns the `schedule_shift` FK side; day-session consumes via `department_session_id`. Do not write to `department_session` from scheduling code.

### `public.engine_authority_pipeline` (Pipeline blueprint store — ADR-0340)

Migration: `20260620110200_shift_lifecycle_pipeline_v2.sql`

Blueprint table (NOT instance table). Per-(workspace, capability, action_type, stage_index) configuration. Instance state lives in `engine_state` (ADR-0067, ADR-0340 Q1).

## Supporting Tables

| Table | Migration | Notes |
|---|---|---|
| `timesheet.time_entry` | `20260324090000_timesheet_schema.sql` | Reality layer — append-only after Interpretation consumes (ADR-0097). Owned by day-session execution path; scheduling reads it in `interpret_shift`. |
| `public.daily_reconciliation` | `20260304200100_daily_reconciliation.sql` | Decision layer aggregate — day-session domain owns writes |
| `public.pos_account` | `20260611120000_wfm_foundation.sql:37` | POS integration (Lightspeed K-Series) — WFM foundation co-migration |
| `public.pos_sale_event` | `20260611120000_wfm_foundation.sql:95` | Append-only POS sale events — demand signal input for D4 |

## Migrations — 52 total, grouped by phase

### Phase 1: Foundation (2026-03-01)

| Migration | Purpose |
|---|---|
| `20260301300000_schedule_shift_table.sql` | `schedule_shift` table + `shift_status` + `day_category` enums |
| `20260301600003_schedule_persistence_tables.sql` | Additional persistence tables (ADR-0047) |
| `20260304200100_daily_reconciliation.sql` | Decision layer aggregate |
| `20260304200200_deviation_shift_approval.sql` | Decision layer: `shift_approval` |
| `20260304300000_seed_daily_close_process.sql` | Event Engine: `daily_close` 8-step process |

### Phase 2: Mobile / Template / Clock (2026-03-24 – 2026-04-06)

| Migration | Purpose |
|---|---|
| `20260324100001_shift_clock_mobile_fixes.sql` | Shift clock mobile (EDGE — clock-in belongs day-session) |
| `20260326120002_mal_modus_template_shift_id.sql` | Template-mode: `schedule_template_shift` FK |
| `20260406100000_fix_shift_clock_config.sql` | Clock config fix |
| `20260406100001_fix_shift_note.sql` | Shift note fix |
| `20260406100002_fix_shift_clock_config.sql` | Clock config fix 2 |
| `20260406110001_seed_shift_assistant_mission.sql` | Shift-assistant Botsson mission |
| `20260407100001_api_key_shift_approval.sql` | API key RLS on `shift_approval` |

### Phase 3: Swap Engine (2026-04-13 – 2026-04-18)

| Migration | Purpose |
|---|---|
| `20260413123343_shift_swap_engine.sql` | Engine process blueprint `shift_swap` + 3 RPCs |
| `20260413132826_fix_shift_swap_approval.sql` | Swap approval fix |
| `20260417140000_fix_swap_notification_approval_branch.sql` | Swap notification fix |
| `20260418100400_remove_shift_approval_punch.sql` | Remove punch from approval path |

### Phase 4: Lifecycle / D6 Misc (2026-04-22 – 2026-04-28)

| Migration | Purpose |
|---|---|
| `20260422110750_department_shift_type_config.sql` | Department shift type config |
| `20260422500000_shift_clock_config.sql` | Clock config |
| `20260422500100_shift_note.sql` | Shift note schema |
| `20260422500300_alter_schedule_shift_adhoc.sql` | Ad-hoc shift alter |
| `20260424200000_shift_clock_cascade_fixes.sql` | Cascade fixes for shift clock |

### Phase 5: Temporal Lock (2026-04-28)

| Migration | Purpose |
|---|---|
| `20260428130000_schedule_shift_temporal_lock.sql` | `schedule_shift_is_temporally_locked()` function + trigger (ADR-0066) |
| `20260428133000_schedule_shift_lock_rollout_and_audit.sql` | `is_locked` column backfill + audit table |
| `20260428140000_shift_lock_high_access_override.sql` | High-access override policy |

### Phase 6: Crons / Notifications / Swap (2026-05-04)

| Migration | Purpose |
|---|---|
| `20260504100002_scheduled_comm_cron.sql` | Scheduled communication cron |
| `20260504100003_shift_reminder_crons.sql` | Shift reminder crons (ADR-0066; verify pg_cron in prod — ADR-0388 learning) |
| `20260504100004_cancel_shift_swap_rpc.sql` | `cancel_shift_swap()` RPC |
| `20260504100005_swap_notification_triggers.sql` | Swap notification triggers |
| `20260504100006_fix_swap_notification_trigger.sql` | Fix for swap trigger |

### Phase 7: 5-Layer Derivation (2026-05-06 – 2026-05-10)

| Migration | Purpose |
|---|---|
| `20260506100001_shift_derivation_layer.sql` | `shift_hour_interpretation` table + ALTER `shift_cost_snapshot` + `derive_shift_hours()` + `snapshot_shift_cost()` RPCs (ADR-0095 Phase 3) |
| `20260507100000_seed_shift_lifecycle_v1.sql` | `shift_lifecycle_v1` engine process blueprint |
| `20260507100200_unwind_shifts_published_alias.sql` | Unwind dual event-name routing (DEFECT fix from SHIFT_LIFECYCLE_MAP.md) |
| `20260508100000_shift_lifecycle_view.sql` | `v_shift_lifecycle` aggregate read view |
| `20260510200000_split_shift_lifecycle_view_by_role.sql` | `v_shift_lifecycle_employee` (cost columns masked for employees) |

### Phase 8: Authority Seeds (2026-05-17 – 2026-05-18)

| Migration | Purpose |
|---|---|
| `20260517100000_seed_roster_add_shift_authority.sql` | `engine_authority_config` seed: `roster.add_shift_manual` |
| `20260518100000_seed_shift_swap_authority.sql` | `engine_authority_config` seed: shift-swap |
| `20260518110000_schedule_absence_type_enum.sql` | Absence type enum extension |

### Phase 9: Engine State + Backfill (2026-05-20)

| Migration | Purpose |
|---|---|
| `20260520110000_engine_state_scheduling.sql` | `engine_state` scheduling blueprint (ADR-0067) |
| `20260520170001_schedule_shift_dept_backfill.sql` | Backfill `department_id` from `position` on existing rows |
| `20260520170002_schedule_shift_dept_trigger.sql` | `schedule_shift_derive_department_id()` trigger for future rows |

### Phase 10: RLS Hardening (2026-06-05)

| Migration | Purpose |
|---|---|
| `20260605120000_shift_approval_rls_with_check.sql` | `WITH CHECK` on `shift_approval` (audit fix) |
| `20260605121000_schedule_shift_rls_invariant_assert.sql` | RLS invariant assert function |

### Phase 11: WFM Foundation / Solver (2026-06-11 – 2026-06-16)

| Migration | Purpose |
|---|---|
| `20260611120000_wfm_foundation.sql` | `pos_account` + `pos_sale_event` + `schedule_shift_offer` (ADR-0305/0306/0309) |
| `20260611120050_wfm_vault_helper.sql` | Vault helper for POS credentials |
| `20260611120100_wfm_capability_authority_seed.sql` | `engine_authority_config` seeds for WFM capabilities |
| `20260615120000_wfm_foundation_rls_hotfix.sql` | RLS hotfix on `schedule_shift_offer` |
| `20260615200150_framework_rule_type_add_solver_values.sql` | Extend `framework_rule_type` enum for solver |
| `20260615200200_riksavtalen_scheduler_framework_rules.sql` | Seed Riksavtalen solver framework rules |
| `20260616100600_note_fanout_scheduler_cron.sql` | Scheduler note fanout cron |

### Phase 12: Pipeline V2 / shift_session (2026-06-20)

| Migration | Purpose |
|---|---|
| `20260620110200_shift_lifecycle_pipeline_v2.sql` | `engine_authority_pipeline` table; seed `shift_swap_lifecycle` + `marketplace_lifecycle` blueprints; ADD `pipeline_lock_state_id` to `schedule_shift` (ADR-0340) |
| `20260620120300_shift_session_table.sql` | `shift_session` table (ADR-0367 runtime layer) |
| `20260620120400_shift_session_day_line_junction.sql` | `shift_session` ↔ `day_line` junction |
| `20260620130000_ensure_shift_session_trigger.sql` | Auto-create `shift_session` on relevant events |

## RPCs

| RPC | Migration | Layer | Purpose |
|---|---|---|---|
| `schedule_shift_is_temporally_locked(uuid, date, time)` | `20260428130000:14` | Execution | Returns true if shift is in immutable window |
| `derive_shift_hours(shift_id)` | `20260506100001` | Interpretation | Deterministic: time_entry + D3 rules → `shift_hour_interpretation` |
| `snapshot_shift_cost(interpretation_id)` | `20260506100001` | Derivation | Deterministic: interpretation × tariff → `shift_cost_snapshot` |
| `initiate_shift_swap(...)` | `20260413123343` | Decision | Employee A initiates swap request |
| `respond_to_shift_swap(...)` | `20260413123343` | Decision | Employee B accepts/rejects |
| `approve_shift_swap(...)` | `20260413123343` | Decision | Manager approves + executes swap |
| `cancel_shift_swap(...)` | `20260504100004` | Decision | Cancel in-flight swap |

## Telemetry Events (registry.ts)

From `packages/telemetry/src/registry.ts`:

| Event | Line ~| Destination |
|---|---|---|
| `shift created` | 694 | activity_trail + PostHog |
| `shift updated` | 709 | activity_trail + PostHog |
| `shift deleted` | 718 | activity_trail + PostHog |
| `shift added_manual` | 737 | activity_trail + PostHog (roster add, ADR-0189 Invariant #13) |
| `shift list_viewed` | 764 | PostHog |
| `shift detail_viewed` | 773 | PostHog |
| `shift published` | 790 | activity_trail + PostHog (per-shift or bulk `shift_ids[]`) |
| `shift completed` | 805 | activity_trail + PostHog |
| `shift punched_in` | 818 | activity_trail + PostHog |
| `shift punched_out` | 838 | activity_trail + PostHog |
| `shift break_started` | 854 | activity_trail |
| `shift break_ended` | 863 | activity_trail |
| `agent.schedule.workspace_queried` | 4766 | Logger (agent audit) |
| `agent.schedule.date_queried_self` | 4781 | Logger |
| `scheduler.proposal.proposed` | 9578 | activity_trail + PostHog (one per bundle run, ADR-0309) |
| `scheduler.proposal.accepted` | 9594 | activity_trail + PostHog |
| `scheduler.proposal.rejected` | 9608 | activity_trail + PostHog |
| `schedule.density_changed` | 9777 | PostHog (ADR-0364) |
| `schedule rollback` | 6076 | activity_trail |

## Authority Seeds

| Capability | Action | Min Role | Migration |
|---|---|---|---|
| `roster.add_shift_manual` | confirm | manager | `20260517100000` |
| shift-swap authority | (confirm) | manager | `20260518100000` |
| WFM capabilities | (marketplace / solver) | (per seed) | `20260611120100` |
