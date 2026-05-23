---
title: "Shift Clock — Data Model"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: shift-clock
tags: [shift-clock, time_entry, shift_clock_config, shift_note, data-model, migrations]
mirror: verified
last_verified: 2026-05-23
---

# Shift Clock — Data Model

## Primary Tables

### `timesheet.time_entry` — Reality Source (ADR-0097)

Schema: `timesheet` (created `20260324090000_timesheet_schema.sql:6`).
The canonical, append-only record of what actually happened on a shift.

| Column | Type | Purpose |
|---|---|---|
| `time_entry_id` | UUID PK | Row identity |
| `workspace_id` | UUID NOT NULL FK → `workspace` | Workspace scoping |
| `profile_id` | UUID NOT NULL FK → `profile` | Employee |
| `shift_id` | UUID FK → `schedule_shift` | The planned shift this entry corresponds to (nullable for ad-hoc) |
| `punch_in` | TIMESTAMPTZ NOT NULL | Observed clock-in time (rounding applied by `trg_punch_rounding` if configured) |
| `punch_out` | TIMESTAMPTZ | Observed clock-out time (NULL while still clocked in) |
| `breaks` | JSONB | Array of `{start, end, startLocation, endLocation}` break entries |
| `status` | ENUM `time_entry_status` | `clocked_in` → `completed`. Value `edited` is deprecated per ADR-0097. |
| `punch_in_location` | JSONB | GPS at punch-in: `{lat, lng, accuracy, timestamp}` (from `20260324090000`) |
| `punch_out_location` | JSONB | GPS at punch-out (added `20260422500200:3`) |
| `break_locations` | JSONB | GPS at break start/end (added `20260422500200:4`) |
| `notes` | TEXT | Optional employee notes (added `20260422500200:5`) |
| `created_at` | TIMESTAMPTZ NOT NULL | |
| `updated_at` | TIMESTAMPTZ NOT NULL | |

**Immutability rule (ADR-0097):** INSERT and UPDATE are permitted while `status='clocked_in'`. After `status='completed'` and `shift_hour_interpretation` references this row, no further UPDATE. Manager corrections go to `shift_approval.edit_justification + approved_hours`, never back to `time_entry`.

**Rounding:** `trg_punch_rounding` (migration `20260527101600`) fires `BEFORE INSERT OR UPDATE OF punch_in, punch_out`. Reads `payroll.workspace_settings.punch_rounding_direction` + `punch_rounding_minutes`. Encodes a payroll policy — do not modify without payroll domain consent.

### `public.shift_clock_config` — Cascading Config

Configures GPS enforcement, ad-hoc shifts, and punch window. Cascades: team overrides department overrides workspace.

| Column | Type | Default | Purpose |
|---|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` | |
| `workspace_id` | UUID NOT NULL FK CASCADE → `workspace` | | Workspace scope |
| `department_id` | UUID FK CASCADE → `department` | NULL | Department override |
| `team_id` | UUID FK CASCADE → `team` | NULL | Team override |
| `gps_required` | BOOLEAN NOT NULL | `false` | Block punch if outside radius |
| `gps_radius_meters` | INT NOT NULL | `200` | Geofence radius |
| `gps_reference_lat` | NUMERIC(10,7) | NULL | Reference point latitude |
| `gps_reference_lng` | NUMERIC(10,7) | NULL | Reference point longitude |
| `adhoc_shifts_enabled` | BOOLEAN NOT NULL | `false` | Allow ad-hoc shift creation |
| `adhoc_requires_approval` | BOOLEAN NOT NULL | `true` | Leader approval required for ad-hoc |
| `punch_window_minutes` | INT NOT NULL | `30` | Minutes before shift start that punch is allowed |
| `created_at` | TIMESTAMPTZ NOT NULL | | |
| `updated_at` | TIMESTAMPTZ NOT NULL | | |
| UNIQUE | `(workspace_id, department_id, team_id)` | | One config row per scope level |

**RLS:** All workspace members can SELECT (needed to render punch UI). Admins can INSERT/UPDATE/DELETE. API key SELECT for external integrations.

### `public.shift_note` — Per-Shift Notes

Free-text employee comments attached to a shift.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | |
| `shift_id` | UUID NOT NULL FK CASCADE → `schedule_shift` | The shift this note belongs to |
| `profile_id` | UUID NOT NULL FK → `profile` | Author |
| `workspace_id` | UUID NOT NULL FK CASCADE → `workspace` | Workspace scope |
| `content` | TEXT NOT NULL | Note text |
| `created_at` | TIMESTAMPTZ NOT NULL | |
| `updated_at` | TIMESTAMPTZ NOT NULL | |

**RLS:** All workspace members can SELECT. Employees can INSERT own notes (profile_id + workspace_id check). No UPDATE RLS defined (append-only pattern).

## Cross-domain Table References

| Table | Schema | Owner domain | Shift-clock relationship |
|---|---|---|---|
| `schedule_shift` | public | scheduling | READ: fetch shift for punch-in; ad-hoc columns `is_adhoc`, `adhoc_approved_by`, `adhoc_approved_at` written on ad-hoc creation |
| `payroll_supplement_rule` | payroll | payroll | READ: list available supplement options for SupplementSheet |
| `payroll_manual_supplement` | payroll | payroll | WRITE: employee claims (status, employee_comment, reviewed_by, reviewed_at) |
| `payroll_break_rule` | payroll | payroll | READ: for break classification (paid/unpaid) |
| `department_session` | public | day-session | Indirect: clock-out triggers `trg_push_session_pending_signoff` on `department_session.status` transition |

## 9-Migration Audit

### Group 1: Foundation

| Migration | Date | Purpose |
|---|---|---|
| `20260324100001_shift_clock_mobile_fixes.sql` | 2026-03-24 | First `shift_clock_config` + `shift_note` + `supplement_claim_status` ENUM. Mobile fixes for chat policies. GPS/notes columns on `time_entry` (IF timesheet schema exists). `is_adhoc` columns on `schedule_shift`. |

### Group 2: Config Fixes (2 migrations — idempotent re-creates)

| Migration | Date | Purpose |
|---|---|---|
| `20260406100000_fix_shift_clock_config.sql` | 2026-04-06 | `CREATE TABLE IF NOT EXISTS shift_clock_config` with correct FK CASCADE + fresh RLS policies. |
| `20260406100002_fix_shift_clock_config.sql` | 2026-04-06 | Identical idempotent re-create. Both are no-ops if `20260422500000` ran; kept for historical accuracy. |

### Group 3: Foundation (canonical re-create)

| Migration | Date | Purpose |
|---|---|---|
| `20260422500000_shift_clock_config.sql` | 2026-04-22 | `DROP TABLE IF EXISTS shift_clock_config CASCADE` then `CREATE TABLE` with correct FK `ON DELETE CASCADE` constraints. This is the canonical foundation migration. |

### Group 4: GPS columns

| Migration | Date | Purpose |
|---|---|---|
| `20260422500200_alter_time_entry_gps.sql` | 2026-04-22 | Adds `punch_out_location JSONB`, `break_locations JSONB`, `notes TEXT` to `timesheet.time_entry` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). |

### Group 5: Cascade fixes

| Migration | Date | Purpose |
|---|---|---|
| `20260424200000_shift_clock_cascade_fixes.sql` | 2026-04-24 | Adds `ON DELETE CASCADE` to FK constraints on both `shift_clock_config` and `shift_note` (council fix — original mobile migration lacked CASCADE). Fixes `jwt_insert_shift_note` policy to include workspace_id check. |

### Group 6: Approval cleanup

| Migration | Date | Purpose |
|---|---|---|
| `20260418100400_remove_shift_approval_punch.sql` | 2026-04-18 | Removes `punch_in` and `punch_out` columns from `shift_approval`. Punch data now lives exclusively in `timesheet.time_entry` per ADR-0097. |

### Group 7: Cross-domain triggers

| Migration | Date | Purpose | Owner |
|---|---|---|---|
| `20260527101600_payroll_punch_rounding_trigger.sql` | 2026-05-27 | `trg_punch_rounding` + `timesheet.apply_punch_rounding()` + `timesheet.round_timestamp()`. Reads `payroll.workspace_settings`. Fires on `time_entry` INSERT/UPDATE. | Payroll domain logic; timesheet schema location |
| `20260516150000_push_dispatch_clockout_link.sql` | 2026-05-16 | `trg_push_session_pending_signoff` + `trigger_push_session_pending_signoff()`. Fires on `department_session.status` UPDATE when `active→pending_signoff`. Dispatches clockout deep-link push to duty leader. | Notifications domain dispatch; shift-clock semantic event |

## Telemetry Events

Source: `packages/telemetry/src/registry.ts`. All `shift.*` events relevant to shift-clock:

| Event | Registry line | Destinations |
|---|---|---|
| `shift punched_in` | ~818 | PostHog, logger, activity_trail, engine_event |
| `shift punched_out` | ~838 | PostHog, logger, activity_trail, engine_event |
| `shift break_started` | ~854 | PostHog, logger, activity_trail |
| `shift break_ended` | ~863 | PostHog, logger, activity_trail |
| `shift supplement_claimed` | ~877 | PostHog, logger, activity_trail |
| `shift supplement_reviewed` | ~886 | PostHog, logger, activity_trail |
| `shift note_added` | ~899 | logger, activity_trail |
| `shift adhoc_created` | ~908 | PostHog, logger, activity_trail, engine_event |
| `shift adhoc_approved` | ~917 | PostHog, logger, activity_trail |
| `shift call_initiated` | ~926 | PostHog, logger |
| `shift.manual_time_entry_created` | ~1251 | activity_trail (audit) |

`shift_session.clocked_in` / `shift_session.clocked_out` (registry lines ~11151/11162) belong to the `shift_session` table (scheduling/day-session domain), not `time_entry`. They are separate events from `shift punched_in/out`.

## Authority Seeds

No `engine_authority_config` seeds directly owned by shift-clock found in migrations. Clock-in is a direct employee action (no C4 gate needed for the employee punching themselves in). Manual punch-in by manager uses `shift.manual_time_entry` capability gated by `shift_lifecycle` capability authority.
