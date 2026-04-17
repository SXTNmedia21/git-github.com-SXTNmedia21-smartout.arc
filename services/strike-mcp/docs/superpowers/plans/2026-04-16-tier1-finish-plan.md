---
title: "Plan — finish Tier 1 Wrightegaarden migration (all remaining entities)"
status: in_progress
updated: 2026-04-16
created: 2026-04-16
module: strike-mcp
tags: [plan, migration, tier1, wrightegaarden]
---

# Plan — finish Tier 1 Wrightegaarden migration

## Context

4/13 entities attested via auto_align + ADR-0004 framework
(workspace, company, locations, departments). 9 remaining. This plan
maps each to v3, classifies execution path, identifies risks, and
sequences work.

## Classification matrix

| Entity | Bubble samples | v3 target | Path | Notes |
|---|---|---|---|---|
| employee_types | 3 | `public.employee_type` | auto + special | K1a platform-level; workspace_id NULL allowed |
| teams | 22 | `public.team` | auto | Standard pattern; team_type enum has DEFAULT |
| invitations | 0 | `public.invitation` | known_empty_source | No active invitations to migrate; attest as empty |
| users | 127 | `public.user_identity` | **manual orchestration** | Hard FK to `auth.users(id)`; needs Supabase Admin API |
| profiles | 135 | `public.profile` | auto + complex | 46 fields → 21 v3 cols; role/status enums tricky |
| shifts | 2750 | `public.schedule_shift` | auto + complex | 69 denormalized fields → 21 v3 cols; day_category derivation needed |
| salary_transactions | 17,607 | `public.payroll_ledger_archive` | auto + raw_json | 17.6k rows; raw_json column captures full source per ADR-0110 |
| shift_satellites | 100/2750 | (folded) | drop | Folded into schedule_shift; no standalone target |
| records | 5,434 | `timesheet.time_entry` | manual_only | Aggregation transform required (workTime + nested breaks) |
| employment_contracts | 0 | `public.employment_contract` | manual synthesis | Synthesized shells from profile + employee_type per ADR-0109 |
| swaprecords | 18 (14 pending) | (drop all) | drop | v3 models swaps as engine_process; cutover notice required |

## Per-entity plan

### 1. employee_types (auto + workspace_id NULL)

**Bubble:** ⏱️employee_type, 3 rows in Wrightegaarden (Månedslønn, Timelønn sesongmedarbeider, Frivillig).

**v3 target:** `public.employee_type` (K1a — workspace_id is NULLABLE per council 2026-04-15).

**Mapping plan:**
- `_id` → `employee_type_id` (`fk_uuid:employee_type`)
- `Title` → `title` (`trim`)
- `_employementCategory` → `employment_form_derived` — needs custom transform: 'Full time' → 'permanent', 'Temporary' → 'temporary', NULL → NULL. **Defer or handle inline?**
- `Fixed salary?` → `fixed_salary` (boolean passthrough)
- `max_hours_week` → `max_hours_week` (numeric passthrough)
- `Accounting_Account_Code` → `accounting_account_code` (trim)
- `_color`, `_color_pallet` → `color_pallet` (trim if present)
- `max_vacation_days`, `days_trial_period` → same names (numeric)
- `Created Date` / `Modified Date` → timestamps

**Constant columns:** `source = 'bubble_migration'` per ADR-0108 (employee_type is in M7 source column scope per the wt-3 plan? Actually NO — employee_type was excluded per council Q2 verdict because it's K1a platform data. So constant_columns NOT needed for employee_type).

**Risks:**
- `_employementCategory` mapping requires conditional transform. Either register `enum_value_map:full_time=permanent,temporary=temporary,null=null` or skip and accept NULL (Frivillig case).
- Wrightegaarden employee_types are NOT really platform-level (specific to this workspace). But council verdict said seed as platform with `workspace_id = NULL`. Conflict: do we set workspace_id to Wrightegaarden's UUID, or NULL?
  - Council: NULL (platform-level shared across workspaces).
  - Implication: if Wrightegaarden's "Frivillig" gets seeded as platform, all other workspaces inherit it. Probably wrong long-term.
  - **Decision needed:** seed as platform (NULL workspace_id) per council, OR seed scoped to Wrightegaarden (workspace_id set)?

### 2. teams (auto, standard pattern)

**Bubble:** 🎎team, 22 rows, 30 fields.

**v3 target:** `public.team` (workspace_id, team_id, name, slug NOT NULL; team_type enum has DEFAULT 'operational').

**Mapping plan (standard ADR-0004):**
- `_id` → `team_id` (`fk_uuid:team`)
- `🏰 Workspace` → `workspace_id` (`fk_uuid:workspace`)
- `🏠 department` (if present) → `department_id` (`fk_uuid:department`) — nullable in v3
- `Title`/`name_text` → `name` (`trim`)
- `_color` → `color` (trim)
- `Created Date` / `Modified Date` → timestamps
- `derived_columns: { slug: { from: "Title", transform: "slugify" } }`
- `constant_columns: { source: "bubble_migration" }`

**Drops:** member arrays, role assignments, badges, i18n, leader (defer until profiles done), team_type Bubble values (don't coerce to enum)

**Risks:** 22 teams — name uniqueness by workspace_id? Slug collision possible. Need to check v3 team slug constraint.

### 3. invitations (known_empty_source)

**Bubble:** 🎎invitation, 0 rows in Wrightegaarden.

**v3 target:** `public.invitation`.

**Plan:** Set `mapping.known_empty_source = true`, attest as empty. No SQL emitted. Cutover notice: "If invitations created post-migration in Bubble, manually re-create in v3."

**Risk:** none (empty).

### 4. users (manual orchestration — Supabase Auth required)

**Bubble:** User, 127 rows in Wrightegaarden, 22 fields.

**v3 target:** `public.user_identity` with `user_id uuid PRIMARY KEY REFERENCES auth.users(id)`. The user_id must exist in Supabase's auth.users table BEFORE inserting into user_identity.

**Why auto_align can't handle this:**
- Hard FK to auth.users
- Generating uuidv5(bubble_id) won't work unless we ALSO call Supabase admin.createUser with that UUID for each row first
- Email sending (welcome/invite) policy not in scope of strike-mcp
- Duplicate handling: existing auth.users with same email? Reject? Merge? — needs policy

**Proposed path (out of strike-mcp scope):**
1. Strike-mcp emits a CSV of (uuidv5(bubble_id), email, first_name, last_name, ...)
2. Separate Supabase Admin script reads CSV and calls `supabase.auth.admin.createUser({ id, email, ... })` per row
3. THEN strike-mcp emits user_identity INSERTs using the same uuidv5

**Decision needed:** classify users as `manual_only` in registry + ADR-0003 amendment. Defer to a follow-up auth-bridge tool.

**Risk:** identity migration is the most fragile step. Email duplicates between Bubble and existing v3 auth.users could collide.

### 5. profiles (auto + complex, 46 → 21 fields)

**Bubble:** profile, 135 rows in Wrightegaarden, 46 fields.

**v3 target:** `public.profile` — workspace_id, user_id, company_id, profile_code, display_name NOT NULL. role + status enums have DEFAULT.

**Mapping plan (provisional):**
- `_id` → `profile_id` (`fk_uuid:profile`)
- `🏰 user` (Bubble FK to user) → `user_id` (`fk_uuid:user_identity`) — DEPENDS on users migration succeeding
- `🏰 Workspace` → `workspace_id` (`fk_uuid:workspace`)
- `🏰 company` (if present) → `company_id` (`fk_uuid:company`)
- `firstName_lastName` or composite → `display_name` (NOT NULL)
- `_role` → `role` (enum — defer, use DEFAULT 'employee')
- `_profileStatus` → `status` (enum — defer, use DEFAULT 'trainee')
- `🏠 Department` → `department_id` (FK; nullable)
- `📍 location` → `location_id` (FK; nullable)
- Bubble `departments` array → `departments uuid[]` (would need fk_uuid_array transform — already registered)
- Timestamps

**Derived columns:** `profile_code` is NOT NULL but has no Bubble source. Either:
- derived_columns from Bubble `_id` (e.g., last 8 chars) — readable code
- constant per-row using row index — fragile
- Use Bubble `Account number` if exists

**Constant columns:** `source = 'bubble_migration'`

**Risks:**
- 135 profiles, all need user_identity to exist FIRST — blocks on users migration
- profile_code generation strategy
- role/status enums dropped → all migrate as 'employee' + 'trainee' which may need post-migration cleanup
- ADR-0109 says synthesized contracts get status='migration_incomplete' on profile too

### 6. shifts (auto + complex, 69 → 21 fields)

**Bubble:** shift (denormalized, 2750 rows, 69 fields).

**v3 target:** `public.schedule_shift` — workspace_id, shift_date, role, start_time, end_time, work_hours, breaks, day_category, status NOT NULL.

**Mapping plan (provisional):**
- `_id` → `schedule_shift_id` (`fk_uuid:shift`)
- `workspace` → `workspace_id` (`fk_uuid:workspace`) — note: bubble uses `workspace` not `🏰 Workspace`
- `profileId` → `employee_id` (`fk_uuid:profile`)
- `teamId` → `team_id` (`fk_uuid:team`)
- `departmentId` → `department_id` — wait, schedule_shift doesn't have department_id directly; it's via position_id → position → department. Drop or skip.
- `date.start` (full datetime) → split into `shift_date` (DATE) + `start_time` (TIME)
- `date.end` → `end_time` (TIME)
- `durationsSeconds` → `work_hours` (NUMERIC, divide by 3600)
- `_shiftStatus` → `status` (enum — defer, use DEFAULT 'created')
- `shiftType` → `role` (NOT NULL text)
- `isLive?` → `is_published` (boolean)

**Required derivations:**
- `day_category` (NOT NULL enum) — needs lookup against public_holiday + day-of-week. Cannot derive from Bubble alone. Either:
  - Set constant: `day_category = 'weekday'` with post-migration fix-up
  - Defer: requires holiday calendar join
- `breaks` (INT, minutes) — Bubble denormalizes but this is complex
- `work_hours` from `durationsSeconds` — needs new transform `seconds_to_hours`
- `shift_date` + `start_time` from a single ISO datetime — needs new transforms `iso_to_date`, `iso_to_time`

**Drops:** all denormalized cache fields (team.title, profileName, department.title — v3 derives via JOIN), all FK arrays for satellite data

**Risks:**
- 2750 shifts × broken day_category derivation = 2750 wrong assumptions
- Time/date splitting requires new transforms (3 new: `iso_to_date`, `iso_to_time`, `seconds_to_hours`)
- Bubble's `_shiftStatus` enum coercion vs v3 enum
- Position FK doesn't exist in Bubble shift — schedule_shift.position_id stays NULL for migrated rows (acceptable per nullable)

### 7. salary_transactions (auto + raw_json archive)

**Bubble:** ⏱️salary_transaction, 17,607 rows, 28 fields.

**v3 target:** `public.payroll_ledger_archive` — workspace_id, profile_id, transaction_date, bubble_record_id, raw_json NOT NULL.

**Mapping plan:**
- `_id` → `payroll_ledger_id` (`fk_uuid:payroll_ledger`)
- `_id` (also) → `bubble_record_id` (literal string passthrough — no UUID transform)
  - **Problem:** field_map only allows ONE target per source. Need either:
    - derived_columns to copy `_id` to `bubble_record_id` via `nullable` (or new identity transform)
    - OR a new `string_passthrough` transform
- `🏰 workspace` → `workspace_id` (`fk_uuid:workspace`)
- `🎎 Profile` → `profile_id` (`fk_uuid:profile`)
- `Related_Shift` → `schedule_shift_id` (`fk_uuid:shift`, nullable)
- `🏠 department` → `department_id` (`fk_uuid:department`, nullable)
- `🎎 team` → `team_id` (`fk_uuid:team`, nullable)
- `4. Date` → `transaction_date` (date)
- `9. Hours` → `hours` (numeric)
- `10. Base Salary` → `base_salary` (numeric)
- `11. Total Salary` → `total_salary` (numeric)
- `a_melding_code` → `a_melding_code` (trim)
- `Accounting_Account_Code` → `accounting_account_code` (trim)
- raw_json — needs the WHOLE Bubble record as JSONB. Cannot map per-field; needs special engine support.

**New framework needed:** `raw_json` capture pattern. Either:
- New `raw_json_target` field on Mapping schema that the engine populates with `JSON.stringify(record)` per row
- OR derived_columns with `transform: "json_self"` reading from synthetic `__self` field

**Risks:**
- 17,607 rows — biggest table by row count
- Profile FK depends on profiles migrated first
- Shift FK depends on shifts migrated first
- raw_json schema needs framework extension (mini ADR)

### 8. shift_satellites (drop, folded into shifts)

**Bubble:** shift_satellite, denormalized cache rows for shifts.

**v3 target:** none — folded into schedule_shift via JOIN at transform time.

**Plan:** Delete `mappings/shift_satellites.json` from active set. Document in ADR-0003 as `manual_only` (or new `folded` strategy).

### 9. records → timesheet.time_entry (MANUAL_ONLY)

**Per ADR-0003:** Bubble row-per-entry (workTime, break, meal) doesn't map 1:1 to v3 timesheet.time_entry (one row per shift with nested breaks JSONB). Custom aggregation transform required.

**Plan:** Out of scope for auto_align. Hand-written SQL migration that:
- Groups Bubble records by shift_id
- For each shift's records:
  - One workTime record → one timesheet.time_entry row with start/end
  - All break/meal records on that shift → nested into time_entry.breaks JSONB
- Inserts to timesheet.time_entry

### 10. employment_contracts (MANUAL synthesis)

**Per ADR-0109 (smartout.ai):** Wrightegaarden has 0 Bubble employment_contracts. Migration synthesizes shell contracts from profile + employee_type with `status = 'migration_incomplete'`.

**Plan:** Out of scope for auto_align. Hand-written SQL migration that:
- For each migrated profile, create one employment_contract row
- Set employee_type_id from profile's employment_profile.employee_type FK (lookup at migration time)
- Tripletex columns left null until enriched
- status = 'migration_incomplete'

### 11. swaprecords (drop all 18, no migration)

**Per council 2026-04-15:** All 14 pending swaprecords dropped. v3 models swaps as engine_process instances. Cutover notice: "Re-initiate pending swaps in v3 after migration."

**Plan:** Mark known_empty_source on mapping (even though Bubble has 18 rows, we choose not to migrate). Or simply skip from active mapping set + document in HANDOFF.

## Framework gaps surfaced by this plan

Three transforms need to be registered (extend ADR-0004):
1. **`iso_to_date`** — extract YYYY-MM-DD from ISO 8601 string
2. **`iso_to_time`** — extract HH:MM:SS from ISO 8601 string  
3. **`seconds_to_hours`** — divide numeric by 3600, round to 2 decimals

One new mapping schema feature needed:
- **`raw_json_target: string`** on Mapping — engine populates this v3 column with `JSON.stringify(record)` per row. Alternatively: `derived_columns.X = { from: "$record", transform: "json_self" }` with a special `$record` source identifier.

One conflict-strategy classification needed:
- **`folded`** strategy in ADR-0003 — entity intentionally has no v3 target table because data is merged into another entity's migration.

## Sequencing (FK-safe order)

```
Phase A — Reference + structure (no FK to identity)
  1. employee_types (K1a, workspace_id NULL OR Wrightegaarden — pending decision)

Phase B — Identity (manual orchestration step required)
  2. users → public.user_identity (manual; Supabase Auth Admin API)

Phase C — Profiles + downstream
  3. teams (after employee_types because team_type enum etc.)
  4. profiles (after users for FK; depends on employee_types via employment_profile)
  5. employment_contracts MANUAL (depends on profiles + employee_types)

Phase D — Operational
  6. shifts (after profiles + teams + departments)
  7. salary_transactions (after shifts + profiles)
  8. records MANUAL (after shifts; aggregation transform)

Phase E — Empty / dropped
  9. invitations (known_empty_source, attest as empty)
  10. swaprecords (drop all per council)
  11. shift_satellites (folded into shifts)
```

## Open questions for user review

**Q1: employee_type seeding scope** — platform-level (workspace_id NULL, shared across all v3 workspaces) per council 2026-04-15, OR scoped to Wrightegaarden (workspace_id set)? Council said NULL but cross-tenant pollution is a real concern.

**Q2: users orchestration** — accept that users is a manual step requiring a separate Supabase Admin script? Or does strike-mcp grow a `bridge_auth_users` capability?

**Q3: profile_code derivation** — what's the rule? `EMP-{last_8_chars_of_uuid}`? Sequential from a counter? Take from Bubble `Account_number` if present?

**Q4: enum coercion strategy** — for role, status, day_category, etc.: drop all and use DEFAULTs (post-migration cleanup), OR write enum_value_map transforms now?

**Q5: shift day_category** — schedule_shift requires this NOT NULL but Bubble doesn't have it. Default to 'weekday' and post-fix? Or compute via public_holiday lookup at transform time (requires holiday data already in v3)?

**Q6: raw_json framework** — add to ADR-0004 amendment or new ADR-0005? `raw_json_target` field vs `derived_columns.X.from: "$record"` syntax?

**Q7: scope** — finish all today (8 attestations + 3 manual + 2 framework changes) or split? My estimate: 4-6 hours focused work for everything except records (which is its own day-long aggregation effort).

## Recommended path

**Day 1 (now, ~3 hours):**
- Decide Q1, Q3, Q4, Q5, Q6 (need user input)
- Frame Q2 as out-of-scope (separate auth-bridge work)
- Add framework: 3 new transforms + raw_json_target
- Write ADR-0005 (framework: raw_json + iso transforms)
- Attest: employee_types, teams, invitations (empty)

**Day 2 (~3 hours):**
- Manual orchestration script for users → user_identity
- Attest: profiles
- Write hand-written SQL: employment_contracts (synthesized shells)

**Day 3 (~4 hours):**
- Attest: shifts, salary_transactions
- Write hand-written SQL: records → timesheet.time_entry (the aggregation work)
- Document swaprecords drop in HANDOFF

**Day 4 (~2 hours):**
- End-to-end SQL emit + apply against local Supabase
- Verify FK integrity, row counts
- Task #6 closure

## What's NOT in this plan

- Tripletex sync (separate workstream)
- Performance tuning (17.6k payroll rows — should be fine in single transaction; if not, batch)
- Production cutover plan (this is dry-run only per ADR-0002)
- Roll-back strategy (relying on Postgres BEGIN/COMMIT atomicity per emitted file)
