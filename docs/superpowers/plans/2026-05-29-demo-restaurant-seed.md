---
title: Demo Restaurant Seed System — Implementation Plan
status: draft
updated: 2026-05-29
created: 2026-05-29
module: seed-infrastructure
tags: [seed, demo-restaurant, supabase, date-dynamic, cascade, payroll, governance, communication, plan]
---

# Demo Restaurant Seed System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic, hollow, date-hardcoded `supabase/seed.sql` with a numbered set of date-dynamic, idempotent, per-domain seed files under `supabase/seed/demo-restaurant/` that build one fully-populated demo workspace — **"Demo Restaurant"** — reproducibly on every `supabase db reset`, gated by a loud self-verifying `99-verify.sql`.

**Architecture:** Eight ordered SQL files (`00-base` → `60-assets` + `99-verify`) wired into `config.toml [db.seed] sql_paths`. Structural rows use stable literal UUIDs with `ON CONFLICT` upsert (no delete); transactional rows use scoped `DELETE` (child→parent) + `INSERT`. All business dates are SQL expressions against `CURRENT_DATE`. Each file carries the same canonical ID-map header comment. `99-verify.sql` asserts per-domain row counts, FK-literal resolution, and **two reads under simulated `authenticated` JWT** (superuser counts alone cannot catch RLS-hollow UI). The legacy `seed.sql` retires to `_archive/`.

**Tech Stack:** PostgreSQL 17, Supabase local CLI, pure SQL (no psql `\set`, no templating). Validation via `psql` against the running local DB, then a full `supabase db reset`.

---

## Source-of-Truth Facts (resolved 2026-05-29 — do not re-derive)

**Canonical ID map (existing — reuse verbatim):**

| Entity | UUID | Detail |
|---|---|---|
| Company | `a0000000-0000-0000-0000-000000000000` | Smartout AS, org 999888777 |
| Workspace | `b0000000-0000-0000-0000-000000000000` | rename → **"Demo Restaurant"** |
| Location | `c0000000-0000-0000-0000-000000000000` | Oslo Downtown Hub, `location_type='main'` |
| Zone Hovedsal | `d1000000-0000-0000-0000-000000000001` | cap 60 |
| Zone Terrasse | `d1000000-0000-0000-0000-000000000002` | cap 30 |
| Zone Bar-område | `d1000000-0000-0000-0000-000000000003` | cap 20 |
| Zone Privat rom | `d1000000-0000-0000-0000-000000000004` | cap 12 |
| Dept Operations | `d0000000-0000-0000-0000-000000000000` | slug operations |
| Dept Kitchen | `d0000000-0000-0000-0000-000000000001` | slug kitchen |
| Dept Service | `d0000000-0000-0000-0000-000000000002` | slug service |
| Dept Bar | `d0000000-0000-0000-0000-000000000003` | slug bar |

**Profiles (existing 10; auth.users `e0000000-…0..9`, profiles `f0000000-…0..9`, all password `password123` via `extensions.crypt(...,gen_salt('bf'))`):**

| profile_id | user_id | code | email | name | role | status | dept | title |
|---|---|---|---|---|---|---|---|---|
| f…0 | e…0 | ADM001 | admin@smartout.local | Local Admin | owner | active | Operations | Restaurant Manager |
| f…1 | e…1 | EMP001 | anna@smartout.local | Anna Olsen | employee | active | Kitchen | Kokk |
| f…2 | e…2 | EMP002 | erik@smartout.local | Erik Pedersen | manager | active | Kitchen | Sous Chef |
| f…3 | e…3 | EMP003 | lise@smartout.local | Lise Markussen | employee | inactive | Service | Servitør |
| f…4 | e…4 | EMP004 | ole@smartout.local | Ole Torp | employee | active | Bar | Bartender |
| f…5 | e…5 | EMP005 | kari@smartout.local | Kari Nilsen | employee | trainee | Service | Servitør |
| f…6 | e…6 | EMP006 | jon@smartout.local | Jon Doe | employee | inactive | Kitchen | Oppvask |
| f…7 | e…7 | EMP007 | sara@smartout.local | Sara Lee | manager | inactive | Service | Hovmester |
| f…8 | e…8 | EMP008 | jonas@smartout.local | Jonas Bakken | employee | trainee | Kitchen | Kokk |
| f…9 | e…9 | EMP009 | silje@smartout.local | Silje Ruud | employee | trainee | Service | Servitør |

> "f…N" / "e…N" = `f0000000-0000-0000-0000-00000000000N` / `e0000000-0000-0000-0000-00000000000N`.
> **New staff to add (§ roster, Task 1):** 4 new profiles `f…a..d` (Sommelier active/Service, 2nd Bartender active/Bar, Pastry active/Kitchen, Vertinne/host active/Service) so a Saturday reads "busy". Activate `f…3`,`f…6`,`f…7` OR keep inactive and add the 4 new actives — net ≥11 schedulable actives. Decision in Task 1 step 1.

**Resolved blockers:**
- Frozen tariff snapshot → `public.shift_cost_snapshot.tariff_rate_snapshot` (JSONB array of `TariffRateInput`). `payroll.tariff_snapshot` is provenance-only — seed a row there ONLY if also setting `workspace_union_binding.derivation_snapshot_id`.
- `is_tariff_bound` lives on `payroll.workspace_settings`; trigger `trg_sync_workspace_settings_union_cache` fires `AFTER INSERT` on `workspace_union_binding` and sets `is_tariff_bound = (union_id != 'non-bound')` WHERE `effective_to IS NULL`. **Precondition:** a `payroll.workspace_settings` row for the workspace MUST exist before the binding insert, else the UPDATE hits 0 rows silently. → seed order in `10-people.sql`: settings row FIRST, then binding.
- `public_holiday` already seeded by migrations (`20260422110400`, `20260422200000`; 26 rows, 2026-27). **Do NOT seed** — read-only dependency. (Flag in HANDOFF: coverage ends 2027, will need refresh.)

**Schema qualifiers (do not get these wrong):**
- `payroll.` schema: `period`, `calculation`, `calculation_line`, `workspace_settings`, `supplement_rule` (wide, workspace-scoped), `tariff_snapshot`.
- `timesheet.` schema: `time_entry` (cols: `time_entry_id, shift_id, profile_id, workspace_id, punch_in, punch_out, breaks, punch_in_location, status, created_at, updated_at`).
- `public.`: everything else (`shift_cost_snapshot`, `workspace_union_binding`, `shift_pay_calculation_event`, `supplement_rule` (narrow template), `tariff_rate_table`, `framework_rule`, `policy`, `protocol`, `procedure`, `routine`, `control_list`, `knowledge_test`, `confirmation`, `channel`, `chat_conversation`, `chat_message`, `asset`, `schedule_shift`, `session_task`, `shift_zone`, `day_line`, `department_session`).

**ABSENT tables (probe with `to_regclass`, skip + `RAISE NOTICE` + HANDOFF "deferred"):** `control_point`, `desk`, `announcement` (only `announcement_meta` exists), `conversation` (only `chat_conversation`/`emma_conversation`).

**Local DB connection (validation):** `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"`

---

## Idempotency Contract (applies to every file)

1. **Structural tables (00-base only):** stable literal UUIDs + `INSERT … ON CONFLICT (<pk>) DO UPDATE SET …` (or `DO NOTHING` for `auth.users`/`auth.identities`). NEVER delete structural rows — downstream FKs reference them.
2. **Transactional tables (10→60):** at the top of the file, `DELETE FROM <table> WHERE workspace_id = '<DEMO_WS>'` in **child→parent FK order**, then `INSERT`. On a fresh `db reset` the deletes are no-ops; on manual re-apply they make the file re-runnable.
3. **Temporal-lock trigger:** where a delete is blocked by `trg_schedule_shift_temporal_lock`, wrap the delete only: `ALTER TABLE schedule_shift DISABLE TRIGGER trg_schedule_shift_temporal_lock; DELETE …; ALTER TABLE schedule_shift ENABLE TRIGGER trg_schedule_shift_temporal_lock;` (LOCAL only).
4. Each file is wrapped in `BEGIN; … COMMIT;`.

## Date-Dynamic Contract (applies to every file)

- Week anchor (Monday): `date_trunc('week', CURRENT_DATE)::date`. Busy Saturday: `date_trunc('week', CURRENT_DATE)::date + 5`.
- Timestamptz at Oslo: `((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '08:00') AT TIME ZONE 'Europe/Oslo'`.
- Payroll closed period: `date_trunc('month', CURRENT_DATE)::date - interval '1 month'`; open period: `date_trunc('month', CURRENT_DATE)::date`.
- Seniority: `employment_contract.start_date = CURRENT_DATE - interval 'N months'`.
- **Self-review gate:** `grep -RnE "'20[0-9]{2}-[0-9]{2}-[0-9]{2}'" supabase/seed/demo-restaurant/` must return ZERO hits (public_holiday lives in migrations, not here).

## Canonical ID-Map Header (paste verbatim atop EACH of 00→60 and 99)

```sql
-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001
-- ZONE Terrasse  d1000000-0000-0000-0000-000000000002
-- ZONE Bar       d1000000-0000-0000-0000-000000000003
-- ZONE Privat    d1000000-0000-0000-0000-000000000004
-- DEPT Operations d0000000-0000-0000-0000-000000000000
-- DEPT Kitchen    d0000000-0000-0000-0000-000000000001
-- DEPT Service    d0000000-0000-0000-0000-000000000002
-- DEPT Bar        d0000000-0000-0000-0000-000000000003
-- PROFILES f0000000-…-00000000000{0..9} + new {a..d}; AUTH e0000000-…-{0..9}
-- =================================================================================
```

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/seed/demo-restaurant/00-base.sql` | auth.users/identities, company, workspace (rename), location, zone, department, **department_operating_hours**, position (8), team, company_member, profile (10 existing + 4 new) — all `ON CONFLICT` upsert |
| `supabase/seed/demo-restaurant/10-people.sql` | employment_contract (per active), employee_payroll_profile (date-dynamic seniority), `payroll.workspace_settings` (1 row), `workspace_union_binding` (1 row → trigger sets `is_tariff_bound`) |
| `supabase/seed/demo-restaurant/20-schedule.sql` | department_session + day_line (full week, all depts), schedule_shift (week), session_hook, session_task, shift_zone, `timesheet.time_entry`, schedule_absence, deviation. Consolidates `demo-day-2026-05-29.sql`, date-dynamic |
| `supabase/seed/demo-restaurant/30-payroll.sql` | `public.supplement_rule` (4 workspace rows), `shift_cost_snapshot` (frozen `tariff_rate_snapshot`), `payroll.period` (1 closed + 1 open), `payroll.calculation`, `payroll.calculation_line`, `shift_pay_calculation_event` (audit) |
| `supabase/seed/demo-restaurant/40-governance.sql` | policy, protocol, procedure, routine, control_list (incl. HACCP temperature items as JSONB), knowledge_test, confirmation |
| `supabase/seed/demo-restaurant/50-communication.sql` | channel, chat_conversation, chat_message; PROBE+skip: desk, announcement, conversation |
| `supabase/seed/demo-restaurant/60-assets.sql` | asset (per location) |
| `supabase/seed/demo-restaurant/99-verify.sql` | count asserts + FK-literal drift guard + 2 RLS-context reads (`RAISE EXCEPTION` on hollow) |

---

## Task 0: Scaffolding + legacy archive (no config switch yet)

**Files:**
- Create: `supabase/seed/demo-restaurant/` (dir)
- Move: `supabase/seed.sql` → `supabase/seed/_archive/seed.legacy.sql`
- Leave UNCHANGED: `supabase/config.toml` (still `sql_paths = ["./seed.sql"]`… see step 3)

> Rationale: keep a working `db reset` path until all 8 files exist + pass `psql` validation (Task 9 flips config). But the file it points at is about to move — so in this task we keep a thin pointer.

- [ ] **Step 1: Create dirs**

```bash
cd /home/sxtnl/dev/smartout.ai
mkdir -p supabase/seed/demo-restaurant supabase/seed/_archive
```

- [ ] **Step 2: Archive legacy seed (copy, keep original in place as pointer until Task 9)**

```bash
cp supabase/seed.sql supabase/seed/_archive/seed.legacy.sql
git add supabase/seed/_archive/seed.legacy.sql
```

Expected: `seed.legacy.sql` is a byte-identical copy; `supabase/seed.sql` still present (config still references it; we delete it in Task 9).

- [ ] **Step 3: Confirm local DB reachable**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select current_database();"`
Expected: returns `postgres`. If connection refused → `npx supabase start` first.

- [ ] **Step 4: Capture the 5 schemas this plan does NOT pre-resolve**

Run and paste output into a scratch note (`/tmp/demo-seed-schema.txt`) — these feed Tasks 2, 3, 5:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.employment_contract" \
  -c "\d public.department_session" -c "\d public.day_line" -c "\d public.session_hook" \
  -c "\d public.schedule_absence" -c "\d public.deviation" -c "\d public.session_task" \
  -c "\d public.schedule_shift" -c "\d public.shift_zone" -c "\d public.chat_message" \
  -c "\d public.chat_conversation" -c "\d public.channel" \
  > /tmp/demo-seed-schema.txt 2>&1; cat /tmp/demo-seed-schema.txt
```

Expected: column lists for each. Use these EXACT columns when writing the INSERTs below. (`department_operating_hours` columns also: `\d public.department_operating_hours`.)

- [ ] **Step 5: Commit scaffolding**

```bash
git add supabase/seed/_archive/seed.legacy.sql
git commit -m "chore(seed): archive legacy seed.sql, scaffold demo-restaurant dir

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: `00-base.sql` — identity + structure + operating hours

**Files:**
- Create: `supabase/seed/demo-restaurant/00-base.sql`

- [ ] **Step 1: Decide roster (record decision in file header comment)**

Net ≥11 schedulable actives. Recommended: keep existing 10, add 4 new actives → 14 profiles. New profiles:

| profile_id | user_id | code | email | name | role | status | dept | title |
|---|---|---|---|---|---|---|---|---|
| `f0000000-…-00000000000a` | `e0000000-…-00000000000a` | EMP010 | sofia@smartout.local | Sofia Berg | employee | active | Service | Sommelier |
| `f0000000-…-00000000000b` | `e0000000-…-00000000000b` | EMP011 | mats@smartout.local | Mats Holm | employee | active | Bar | Bartender |
| `f0000000-…-00000000000c` | `e0000000-…-00000000000c` | EMP012 | nora@smartout.local | Nora Lie | employee | active | Kitchen | Konditor |
| `f0000000-…-00000000000d` | `e0000000-…-00000000000d` | EMP013 | even@smartout.local | Even Aas | employee | active | Service | Vertinne |

- [ ] **Step 2: Write `00-base.sql`**

Structure (full file — `ON CONFLICT` upsert, NO deletes; columns from facts + `/tmp` capture for `department_operating_hours`):

```sql
-- <CANONICAL ID-MAP HEADER — paste from plan>
-- 00-base.sql — Demo Restaurant identity + structure. LOCAL only. Idempotent (upsert).
BEGIN;

-- auth.users (10 existing + 4 new). DO NOTHING preserves existing hashes/sessions.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  email_change, phone, phone_change, phone_change_token, reauthentication_token)
VALUES
  ('e0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'sofia@smartout.local', extensions.crypt('password123', extensions.gen_salt('bf')),
   now(), '{"display_name":"Sofia Berg"}', '{"provider":"email","providers":["email"]}', now(), now(),
   '','','','','',NULL,'','',''),
  -- … repeat for mats/nora/even (…b/…c/…d) …
ON CONFLICT (id) DO NOTHING;

-- auth.identities for the 4 new users
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000a',
   '{"sub":"e0000000-0000-0000-0000-00000000000a","email":"sofia@smartout.local"}','email', now(), now(), now()),
  -- … b/c/d …
ON CONFLICT (provider_id, provider) DO NOTHING;

-- company
INSERT INTO public.company (company_id, name, legal_name, org_number, country, industry)
VALUES ('a0000000-0000-0000-0000-000000000000','Smartout AS','Smartout AS','999888777','NO','hospitality')
ON CONFLICT (company_id) DO UPDATE SET industry = EXCLUDED.industry;

-- workspace — RENAME to "Demo Restaurant"
INSERT INTO public.workspace (workspace_id, company_id, name, slug, description, currency, language, country, onboarding_completed)
VALUES ('b0000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000000',
        'Demo Restaurant','demo-restaurant','Full-service restaurant & bar, Oslo','NOK','no','NO',true)
ON CONFLICT (workspace_id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description;

-- location, zones (4), departments (4) — ON CONFLICT DO UPDATE
INSERT INTO public.location (location_id, workspace_id, name, slug, location_type)
VALUES ('c0000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000000','Oslo Downtown Hub','oslo-downtown','main')
ON CONFLICT (location_id) DO UPDATE SET name = EXCLUDED.name;
-- zones d1…1..4 (Hovedsal/Terrasse/Bar-område/Privat rom) ON CONFLICT DO UPDATE
-- departments d0…0..3 (Operations/Kitchen/Service/Bar) ON CONFLICT DO UPDATE

-- positions (8) — extend existing 4 (ab…1..4) with 4 more (ab…5..8: Daglig leder, Kjøkkensjef, Sous Chef → map, Hovmester, Oppvask)
INSERT INTO public.position (position_id, workspace_id, department_id, name, slug) VALUES
  ('ab000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000001','Kjøkkensjef','kjokkensjef'),
  -- … 8 total, dept-aligned …
ON CONFLICT (position_id) DO UPDATE SET name = EXCLUDED.name;

-- teams (3) ON CONFLICT DO UPDATE (existing aa…1..3)

-- profiles (10 existing + 4 new) ON CONFLICT (profile_id) DO UPDATE SET role/status/department_id/display_name/job_title
-- company_member (per user) ON CONFLICT DO NOTHING

-- department_operating_hours — NEW (was NOT seeded). Cover 4 depts × 7 weekdays.
-- columns per /tmp capture; typical: (id, workspace_id, department_id, day_of_week, open_time, close_time, is_closed)
INSERT INTO public.department_operating_hours (id, workspace_id, department_id, day_of_week, open_time, close_time, is_closed)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000', d.dept,
       dow, time '10:00', time '23:00', false
FROM (VALUES
  ('d0000000-0000-0000-0000-000000000000'::uuid),('d0000000-0000-0000-0000-000000000001'::uuid),
  ('d0000000-0000-0000-0000-000000000002'::uuid),('d0000000-0000-0000-0000-000000000003'::uuid)) AS d(dept),
     generate_series(0,6) AS dow
ON CONFLICT DO NOTHING;  -- adjust conflict target to the table's real unique key from /tmp capture

COMMIT;
```

> Fill every `-- …` with explicit rows (full data is in the facts tables above — no placeholders in the final file). Use the EXACT `department_operating_hours` columns + unique key from `/tmp/demo-seed-schema.txt`.

- [ ] **Step 3: Apply + validate**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed/demo-restaurant/00-base.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select name from public.workspace where workspace_id='b0000000-0000-0000-0000-000000000000';
   select count(*) profiles from public.profile where workspace_id='b0000000-0000-0000-0000-000000000000';
   select count(*) opening_hours from public.department_operating_hours where workspace_id='b0000000-0000-0000-0000-000000000000';"
```

Expected: name = `Demo Restaurant`; profiles = 14; opening_hours = 28 (4×7).

- [ ] **Step 4: Re-apply to prove idempotency**

Run the same `-f` command again. Expected: no error, counts unchanged (14 / 28).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed/demo-restaurant/00-base.sql
git commit -m "feat(seed): demo-restaurant 00-base — identity, structure, operating hours

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `10-people.sql` — employment + payroll binding

**Files:**
- Create: `supabase/seed/demo-restaurant/10-people.sql`

- [ ] **Step 1: Confirm `employment_contract` columns** from `/tmp/demo-seed-schema.txt` (captured Task 0). Note NOT NULL columns.

- [ ] **Step 2: Write `10-people.sql`**

Order is load-bearing for the `is_tariff_bound` trigger (settings row BEFORE binding):

```sql
-- <CANONICAL ID-MAP HEADER>
-- 10-people.sql — employment + payroll binding. Idempotent. Date-dynamic seniority.
BEGIN;

-- child→parent deletes (this file's tables only)
DELETE FROM public.workspace_union_binding   WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.employment_contract       WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.employee_payroll_profile  WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
-- payroll.workspace_settings: UPSERT (don't delete — binding FK active_binding_id references it)

-- employment_contract — one per ACTIVE profile (date-dynamic start_date)
-- columns per /tmp capture. start_date = CURRENT_DATE - interval 'N months' (vary seniority).
INSERT INTO public.employment_contract (<cols from capture>) VALUES
  -- Local Admin: CURRENT_DATE - interval '5 years'
  -- Anna: - interval '3 years'; Erik: - '4 years'; Ole: - '2 years'; new staff: - '8 months' … etc
  ;

-- employee_payroll_profile — date-dynamic seniority_start_date
INSERT INTO public.employee_payroll_profile
  (workspace_id, profile_id, has_fagbrev, salary_type, agreed_weekly_hours, tariff_category, seniority_start_date, valid_from)
VALUES
  ('b0000000-0000-0000-0000-000000000000','f0000000-0000-0000-0000-000000000001',
   true,'hourly',37.5,'kokk', CURRENT_DATE - interval '3 years', CURRENT_DATE - interval '3 years'),
  -- … one per active profile …
  ;

-- payroll.workspace_settings — MUST exist before binding (trigger precondition)
INSERT INTO payroll.workspace_settings (id, workspace_id, period_type, period_start_day)
VALUES (gen_random_uuid(),'b0000000-0000-0000-0000-000000000000','monthly',1)
ON CONFLICT (workspace_id) DO UPDATE SET period_type = EXCLUDED.period_type;

-- workspace_union_binding — union_id != 'non-bound' → trigger sets is_tariff_bound=true
INSERT INTO public.workspace_union_binding
  (workspace_union_binding_id, workspace_id, union_id, law_version, official_effective_date,
   effective_from, effective_to, amendment_classifier)
VALUES (gen_random_uuid(),'b0000000-0000-0000-0000-000000000000','riksavtalen','2026',
        date '2026-01-01', date '2026-01-01', NULL, 'BOOTSTRAP');
-- effective_to NULL is required for the cache trigger to fire.

COMMIT;
```

> `union_id` value: confirm the canonical Riksavtalen id from existing data: `psql … -c "select distinct union_id from public.workspace_union_binding limit 5;"` or from `tariff_rate_table.source`. The literal `'2026-01-01'` here is a tariff/law effective date (calendar-fixed, like public_holiday) — acceptable; it is NOT a business/demo date, so it does not violate the date-dynamic grep gate (gate excludes union/law/holiday refs — keep these on ONE clearly-commented line).

- [ ] **Step 3: Apply + validate the trigger fired**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed/demo-restaurant/10-people.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select is_tariff_bound, active_union_id from payroll.workspace_settings
   where workspace_id='b0000000-0000-0000-0000-000000000000';
   select count(*) contracts from public.employment_contract where workspace_id='b0000000-0000-0000-0000-000000000000';"
```

Expected: `is_tariff_bound = t`, `active_union_id = riksavtalen`; contracts = active-staff count.

- [ ] **Step 4: Re-apply → idempotent** (same counts, `is_tariff_bound` still `t`).

- [ ] **Step 5: Commit** (`feat(seed): demo-restaurant 10-people — contracts + tariff binding`).

---

## Task 3: `20-schedule.sql` — D6 full week (consolidates demo-day)

**Files:**
- Create: `supabase/seed/demo-restaurant/20-schedule.sql`
- Reference (port from): `supabase/seed/demo-day-2026-05-29.sql`

- [ ] **Step 1: Confirm columns** for `department_session`, `day_line`, `session_hook`, `schedule_absence`, `deviation`, `session_task`, `schedule_shift`, `shift_zone` from `/tmp/demo-seed-schema.txt`. Note `day_line` cols = `(workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close, created_by)`.

- [ ] **Step 2: Write `20-schedule.sql`** — owns the full current week. Pattern (date-dynamic, literal IDs, trigger-aware):

```sql
-- <CANONICAL ID-MAP HEADER>
-- 20-schedule.sql — D6 full current week. Consolidates demo-day. Idempotent + date-dynamic.
BEGIN;

-- child→parent delete (workspace-scoped). Disable temporal lock for shift delete only.
DELETE FROM public.shift_zone     WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.session_task   WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM timesheet.time_entry  WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
ALTER TABLE schedule_shift DISABLE TRIGGER trg_schedule_shift_temporal_lock;
DELETE FROM public.schedule_shift WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
ALTER TABLE schedule_shift ENABLE TRIGGER trg_schedule_shift_temporal_lock;
DELETE FROM public.day_line           WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.department_session WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
-- schedule_absence + deviation deletes too

-- department_session: 4 depts × 7 days. Generate with a DO/INSERT…SELECT over generate_series(0,6).
-- Use deterministic literal-ish IDs OR gen_random_uuid() captured into a temp table for the week.
-- RECOMMENDED: INSERT … SELECT with gen_random_uuid(); capture (dept, business_date) → session_id
-- by SELECTing back, since downstream tasks reference by (dept,date) not by hardcoded id.
INSERT INTO public.department_session (<cols>, workspace_id, department_id, business_date, status)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000', d.dept,
       date_trunc('week',CURRENT_DATE)::date + g,
       CASE WHEN g < extract(dow from CURRENT_DATE)::int THEN 'closed'
            WHEN g = extract(dow from CURRENT_DATE)::int - 1 THEN 'active' ELSE 'upcoming' END
FROM (VALUES (...4 depts...)) d(dept), generate_series(0,6) g;

-- day_line: one per department_session
INSERT INTO public.day_line (workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close, created_by)
SELECT ds.workspace_id, ds.department_session_id, ds.department_id,
       'c0000000-0000-0000-0000-000000000000', ds.business_date, time '10:00', time '23:00',
       'f0000000-0000-0000-0000-000000000000'
FROM public.department_session ds WHERE ds.workspace_id='b0000000-0000-0000-0000-000000000000';

-- schedule_shift: full week, busiest on Saturday (anchor+5). Columns proven in demo-day:
--   (schedule_shift_id, workspace_id, department_id, employee_id, role, shift_date,
--    start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
-- shift_date = date_trunc('week',CURRENT_DATE)::date + N. Insert ≥11 actives on Saturday + lighter weekdays.
-- The trg_ensure_shift_session trigger auto-creates shift_session + links to the matching day_line.

-- shift_zone: look up auto-created shift_session by schedule_shift_id (DO block, as in demo-day lines 237-301),
--   anchor FoH (Service/Bar) shifts to zones. ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING.

-- session_task: port the demo-day 18 tasks, scheduled_at date-dynamic:
--   scheduled_at = ((date_trunc('week',CURRENT_DATE)::date + 5)::timestamp + time '08:00') AT TIME ZONE 'Europe/Oslo'
--   reference department_session_id by SELECTing the Saturday session per dept (not hardcoded uuid).
--   keep ≥2 is_compliance_required=true (HACCP). origin='manual', generated_by='manager', status='pending'.

-- timesheet.time_entry: for the CLOSED days (g < today-dow), punch_in/punch_out so payroll has input.
-- schedule_absence + deviation: 1-2 rows within the current week.

COMMIT;
```

> Because session IDs are now generated (not hardcoded), session_task + day_line + shift_zone must resolve their parent by `(department_id, business_date)` lookup, not by literal UUID. Write those as `INSERT … SELECT … FROM department_session WHERE department_id=… AND business_date=date_trunc('week',CURRENT_DATE)::date + 5`.

- [ ] **Step 3: Apply + validate (busy Saturday non-hollow)**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed/demo-restaurant/20-schedule.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "with sat as (select date_trunc('week',CURRENT_DATE)::date + 5 d)
   select (select count(*) from schedule_shift,sat where shift_date=sat.d) shifts,
          (select count(*) from session_task st join department_session ds on st.department_session_id=ds.department_session_id, sat where ds.business_date=sat.d) tasks,
          (select count(*) from shift_zone where workspace_id='b0000000-0000-0000-0000-000000000000') zones;"
```

Expected: shifts ≥ 8, tasks ≥ 12, zones ≥ 4 (matches demo-day baseline, now on a dynamic Saturday).

- [ ] **Step 4: Re-apply → idempotent** (counts stable; no temporal-lock error).

- [ ] **Step 5: Commit** + delete the now-consolidated demo-day file:

```bash
git rm supabase/seed/demo-day-2026-05-29.sql
git add supabase/seed/demo-restaurant/20-schedule.sql
git commit -m "feat(seed): demo-restaurant 20-schedule — full week D6, consolidate demo-day

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `30-payroll.sql` — principle-compliant fixtures

**Files:**
- Create: `supabase/seed/demo-restaurant/30-payroll.sql`

> Four principles (per `payroll-engine-developer`): versioning, idempotency, audit-trail INSERT-only, tariff-snapshot freeze. Fixtures are plausible/structural, NOT engine-computed. Never hardcode rates — read `tariff_rate_table` (`source='riksavtalen'`, current effective).

- [ ] **Step 1: Write `30-payroll.sql`**

```sql
-- <CANONICAL ID-MAP HEADER>
-- 30-payroll.sql — payroll fixtures (structural, not engine-computed). Idempotent.
BEGIN;

-- child→parent delete
DELETE FROM public.shift_pay_calculation_event WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM payroll.calculation_line WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM payroll.calculation      WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM payroll.period           WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.shift_cost_snapshot WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.supplement_rule   WHERE workspace_id='b0000000-0000-0000-0000-000000000000';

-- supplement_rule (workspace-scoped): kveld/helg/natt/helligdag. rate_value read from tariff_rate_table.
INSERT INTO public.supplement_rule (id, workspace_id, name, supplement_type, rate_type, rate_value, tariff_rate_table_id, match_predicate, paragraf_ref)
SELECT gen_random_uuid(),'b0000000-0000-0000-0000-000000000000','Kveldstillegg','normal','fixed_per_hour',
       trt.amount, trt.id, '{"after":"18:00"}'::jsonb, 'Riksavtalen §X'
FROM public.tariff_rate_table trt WHERE trt.rate_type='evening_supplement' AND trt.workspace_id IS NULL
ORDER BY trt.effective_from DESC LIMIT 1;
-- … helg/natt/helligdag analogously, each reading its tariff_rate_table row …

-- payroll.period: 1 closed (prev month) + 1 open (this month)
INSERT INTO payroll.period (id, workspace_id, start_date, end_date, status, locked_at)
VALUES
  ('c1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000000',
   date_trunc('month',CURRENT_DATE)::date - interval '1 month',
   date_trunc('month',CURRENT_DATE)::date - interval '1 day','locked', now()),
  ('c1000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000000',
   date_trunc('month',CURRENT_DATE)::date,
   (date_trunc('month',CURRENT_DATE)+interval '1 month'-interval '1 day')::date,'open', NULL);

-- shift_cost_snapshot for closed-period shifts — FREEZE tariff_rate_snapshot (the calc-engine's read target).
-- tariff_rate_snapshot = JSONB array of TariffRateInput captured from tariff_rate_table at freeze time.
INSERT INTO public.shift_cost_snapshot
  (id, workspace_id, schedule_shift_id, profile_id, base_hours, base_rate, base_cost,
   supplements, overtime_cost, total_cost, tariff_rate_snapshot, payroll_period_id)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000', ss.schedule_shift_id, ss.employee_id,
       ss.work_hours, 220.00, ss.work_hours*220.00, '[]'::jsonb, 0, ss.work_hours*220.00,
       (SELECT jsonb_agg(jsonb_build_object('rate_type',trt.rate_type,'amount',trt.amount,'unit',trt.unit))
        FROM public.tariff_rate_table trt WHERE trt.workspace_id IS NULL AND trt.source='riksavtalen'),
       'c1000000-0000-0000-0000-000000000001'
FROM public.schedule_shift ss
WHERE ss.workspace_id='b0000000-0000-0000-0000-000000000000' AND ss.employee_id IS NOT NULL
  AND ss.shift_date < date_trunc('month',CURRENT_DATE)::date;  -- closed-period shifts only

-- payroll.calculation (per profile per closed period) — each points back to schedule_shift_id.
-- payroll.calculation_line (base + supplement lines) — each references supplement_rule_id where applicable.
-- shift_pay_calculation_event (INSERT-only audit): one row per applied rule, with
--   tariff_rate_table_id, rule_type, rate_value_applied, amount_nok, provenance JSONB, calculated_by='seed'.

COMMIT;
```

> base_rate `220.00` is a placeholder display rate ONLY where a tariff row is absent; prefer `(SELECT amount FROM tariff_rate_table WHERE rate_type='base_hourly' …)`. The §5 rule "never hardcode rates" applies to the snapshot/audit — those MUST read `tariff_rate_table`. Confirm a base-hourly tariff row exists: `psql … -c "select rate_type,amount from tariff_rate_table where workspace_id is null order by rate_type;"`. If none → seed a workspace-level base rate in this file and flag in HANDOFF.

- [ ] **Step 2: Apply + validate audit back-references**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed/demo-restaurant/30-payroll.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select count(*) periods from payroll.period where workspace_id='b0000000-0000-0000-0000-000000000000';
   select count(*) snaps_with_tariff from public.shift_cost_snapshot
     where workspace_id='b0000000-0000-0000-0000-000000000000' and tariff_rate_snapshot <> '{}'::jsonb and tariff_rate_snapshot <> '[]'::jsonb;
   select count(*) lines from payroll.calculation_line where workspace_id='b0000000-0000-0000-0000-000000000000';"
```

Expected: periods = 2; snaps_with_tariff > 0 (frozen); lines > 0.

- [ ] **Step 3: Re-apply twice → bit-identical `tariff_rate_snapshot`** (freeze must reproduce):

```bash
psql … -c "select md5(string_agg(tariff_rate_snapshot::text, '|' order by id)) from public.shift_cost_snapshot where workspace_id='b0000000-0000-0000-0000-000000000000';"
# run -f again, then re-run the md5 — must match.
```

Expected: same md5 before/after re-apply (idempotent freeze). (Note: the snapshot content is sourced from tariff_rate_table which is stable; gen_random_uuid() ids differ but the JSONB content md5 is stable.)

- [ ] **Step 4: Commit** (`feat(seed): demo-restaurant 30-payroll — periods, frozen snapshot, audit chain`).

---

## Task 5: `40-governance.sql` — policy → protocol → procedures/routines/controls/tests

**Files:**
- Create: `supabase/seed/demo-restaurant/40-governance.sql`

> Columns fully known (facts Part A). `control_point` ABSENT → temperature points go inside `control_list.items` JSONB. `created_by`/`owner_profile_id` = `f0000000-…-0` (admin).

- [ ] **Step 1: Write `40-governance.sql`** — child→parent delete then insert. Minimum coherent set:

```sql
-- <CANONICAL ID-MAP HEADER>
-- 40-governance.sql — governance/HMS/training. Idempotent.
BEGIN;
DELETE FROM public.confirmation   WHERE protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id='b0000000-0000-0000-0000-000000000000');
DELETE FROM public.knowledge_test WHERE protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id='b0000000-0000-0000-0000-000000000000');
DELETE FROM public.routine        WHERE protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id='b0000000-0000-0000-0000-000000000000');
DELETE FROM public.control_list   WHERE protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id='b0000000-0000-0000-0000-000000000000');
DELETE FROM public.procedure      WHERE protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id='b0000000-0000-0000-0000-000000000000');
DELETE FROM public.protocol       WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.policy         WHERE workspace_id='b0000000-0000-0000-0000-000000000000';

-- policy (e.g. "Mattrygghet / HACCP", "HMS")
INSERT INTO public.policy (policy_id, workspace_id, policy_type, policy_scope, name, statement, enforcement_status, is_active, created_by)
VALUES ('e1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000000',
        'safety','workspace','Mattrygghet (HACCP)','Alle kjøkkenrutiner følger HACCP.','enforced',true,'f0000000-0000-0000-0000-000000000000');
-- protocol → procedure → routine → control_list (with HACCP temperature items as JSONB) → knowledge_test → confirmation
-- control_list.items example:
--   '[{"label":"Kjøleskap 1","max_c":4},{"label":"Fryser","max_c":-18},{"label":"Varmholding","min_c":60}]'::jsonb
COMMIT;
```

- [ ] **Step 2: Apply + validate** (`psql … -f …`; assert policy ≥1, protocol ≥1, control_list ≥1 with non-empty `items`). Expected: all ≥1.
- [ ] **Step 3: Re-apply → idempotent.**
- [ ] **Step 4: Commit** (`feat(seed): demo-restaurant 40-governance — HACCP policy chain + training`).

---

## Task 6: `50-communication.sql` — channels + chat (probe absent tables)

**Files:**
- Create: `supabase/seed/demo-restaurant/50-communication.sql`

- [ ] **Step 1: Write `50-communication.sql`** — seed `channel` + `chat_conversation` + `chat_message`; PROBE+skip `desk`/`announcement`/`conversation`:

```sql
-- <CANONICAL ID-MAP HEADER>
-- 50-communication.sql — channels + chat. Probes absent tables. Idempotent.
BEGIN;
DELETE FROM public.chat_message      WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.chat_conversation WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
DELETE FROM public.channel           WHERE workspace_id='b0000000-0000-0000-0000-000000000000';

-- channel: a few (e.g. #general dept-wide, #kitchen, #service). Columns per /tmp capture.
INSERT INTO public.channel (id, workspace_id, channel_type, name, department_id, is_read_only, is_archived)
VALUES (gen_random_uuid(),'b0000000-0000-0000-0000-000000000000','department','Kjøkken','d0000000-0000-0000-0000-000000000001',false,false);
-- chat_conversation + chat_message: 1 conversation, a handful of messages between admin/erik/anna (date-dynamic created_at = now()).

-- PROBE absent tables — skip + notice (do NOT fail)
DO $$ BEGIN
  IF to_regclass('public.desk') IS NOT NULL THEN
    RAISE NOTICE 'desk exists — seed it'; -- add INSERT here if/when table lands
  ELSE RAISE NOTICE 'SKIP desk: table absent (deferred)'; END IF;
  IF to_regclass('public.announcement') IS NOT NULL THEN
    RAISE NOTICE 'announcement exists — seed it';
  ELSE RAISE NOTICE 'SKIP announcement: only announcement_meta exists (deferred)'; END IF;
END $$;
COMMIT;
```

- [ ] **Step 2: Apply + validate** (channel ≥1, chat_message ≥1; NOTICE lines for desk/announcement skips). Expected: passes, notices emitted.
- [ ] **Step 3: Re-apply → idempotent.**
- [ ] **Step 4: Commit** (`feat(seed): demo-restaurant 50-communication — channels + chat, probe desk/announcement`).

---

## Task 7: `60-assets.sql`

**Files:**
- Create: `supabase/seed/demo-restaurant/60-assets.sql`

- [ ] **Step 1: Write `60-assets.sql`** (columns known: `asset_id, workspace_id, location_id, name, description, requires_training, requires_routine, is_active`):

```sql
-- <CANONICAL ID-MAP HEADER>
-- 60-assets.sql — equipment/inventory per location. Idempotent.
BEGIN;
DELETE FROM public.asset WHERE workspace_id='b0000000-0000-0000-0000-000000000000';
INSERT INTO public.asset (asset_id, workspace_id, location_id, name, description, requires_training, requires_routine, is_active) VALUES
  (gen_random_uuid(),'b0000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000000','Combi-steamer','Rational kombidamper', true, true, true),
  (gen_random_uuid(),'b0000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000000','Espressomaskin','La Marzocco', true, true, true),
  (gen_random_uuid(),'b0000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000000','Kjølerom','Walk-in kjøl', false, true, true),
  (gen_random_uuid(),'b0000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000000','POS-terminal','Kasse hovedsal', false, false, true);
COMMIT;
```

- [ ] **Step 2: Apply + validate** (asset ≥4). **Step 3: Re-apply → idempotent. Step 4: Commit** (`feat(seed): demo-restaurant 60-assets`).

---

## Task 8: `99-verify.sql` — loud self-test + RLS reads

**Files:**
- Create: `supabase/seed/demo-restaurant/99-verify.sql`

> CORE invariants `RAISE EXCEPTION` (brick the reset); optional/absent domains `RAISE NOTICE` only.

- [ ] **Step 1: Write `99-verify.sql`**

```sql
-- <CANONICAL ID-MAP HEADER>
-- 99-verify.sql — runs last. Fails loudly on hollow data. Includes RLS-context reads.
DO $$
DECLARE ws uuid := 'b0000000-0000-0000-0000-000000000000'; n int; sat date := date_trunc('week',CURRENT_DATE)::date + 5;
BEGIN
  -- CORE counts
  SELECT count(*) INTO n FROM public.profile WHERE workspace_id=ws;
  IF n < 11 THEN RAISE EXCEPTION 'HOLLOW: profiles=% (<11)', n; END IF;

  SELECT count(*) INTO n FROM public.department_operating_hours WHERE workspace_id=ws;
  IF n <> 28 THEN RAISE EXCEPTION 'HOLLOW: operating_hours=% (expected 28)', n; END IF;

  SELECT count(*) INTO n FROM public.session_task st JOIN public.department_session ds
    ON st.department_session_id=ds.department_session_id WHERE ds.business_date=sat;
  IF n = 0 THEN RAISE EXCEPTION 'HOLLOW: 0 session_task on Saturday %', sat; END IF;

  SELECT count(*) INTO n FROM public.shift_zone WHERE workspace_id=ws;
  IF n = 0 THEN RAISE EXCEPTION 'HOLLOW: 0 shift_zone'; END IF;

  SELECT count(*) INTO n FROM public.employment_contract WHERE workspace_id=ws;
  IF n = 0 THEN RAISE EXCEPTION 'HOLLOW: 0 employment_contract'; END IF;

  -- payroll: closed-period lines + 3 back-references present
  SELECT count(*) INTO n FROM payroll.calculation_line WHERE workspace_id=ws;
  IF n = 0 THEN RAISE EXCEPTION 'HOLLOW: 0 payroll.calculation_line'; END IF;
  PERFORM 1 FROM payroll.calculation c WHERE c.workspace_id=ws AND c.schedule_shift_id IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'AUDIT GAP: payroll.calculation with NULL schedule_shift_id'; END IF;

  -- is_tariff_bound trigger result
  PERFORM 1 FROM payroll.workspace_settings WHERE workspace_id=ws AND is_tariff_bound;
  IF NOT FOUND THEN RAISE EXCEPTION 'TARIFF: is_tariff_bound not set (binding/trigger failed)'; END IF;

  -- FK-literal drift guard: every shift's department resolves
  PERFORM 1 FROM public.schedule_shift s LEFT JOIN public.department d ON s.department_id=d.department_id
    WHERE s.workspace_id=ws AND d.department_id IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'FK DRIFT: schedule_shift.department_id with no department'; END IF;

  RAISE NOTICE 'CORE invariants OK (profiles=%, sat=%).', (SELECT count(*) FROM public.profile WHERE workspace_id=ws), sat;
END $$;

-- RLS-CONTEXT READS (superuser bypasses RLS — these prove the UI actually sees rows)
DO $$
DECLARE admin_uid uuid := 'e0000000-0000-0000-0000-000000000000'; n int;
BEGIN
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',admin_uid,'role','authenticated')::text, true);
  -- day-line read (current-week shifts visible to this workspace member)
  SELECT count(*) INTO n FROM public.schedule_shift WHERE shift_date >= date_trunc('week',CURRENT_DATE)::date;
  RESET role;
  IF n = 0 THEN RAISE EXCEPTION 'RLS-HOLLOW: authenticated admin sees 0 current-week shifts'; END IF;
  RAISE NOTICE 'RLS read OK: admin sees % current-week shifts', n;
END $$;
-- Second RLS read (my-salary): authenticate an EMPLOYEE uid and assert visible payroll.calculation > 0.
```

> Confirm the RLS read pattern matches how the app sets context — check an existing helper (e.g. `get_workspace_ids_for_user()`). If RLS needs `request.jwt.claim.sub` (singular) vs `request.jwt.claims` JSON, match the migration's policy predicate. Capture: `psql … -c "select definition from pg_policies where tablename='schedule_shift' limit 3;"`.

- [ ] **Step 2: Apply against the already-seeded DB** — `psql … -f 99-verify.sql`. Expected: all NOTICE "OK", no EXCEPTION.
- [ ] **Step 3: Negative test** — temporarily `DELETE FROM session_task WHERE …` a Saturday row, re-run verify → expect `RAISE EXCEPTION HOLLOW: 0 session_task`. Restore by re-applying `20-schedule.sql`. (Proves the gate bites.)
- [ ] **Step 4: Commit** (`feat(seed): demo-restaurant 99-verify — count + FK + RLS-context gate`).

---

## Task 9: Wire `config.toml`, full reset, browser spot-check, HANDOFF

**Files:**
- Modify: `supabase/config.toml` (`[db.seed] sql_paths`)
- Delete: `supabase/seed.sql` (legacy; copy already archived Task 0)
- Create: `docs/HANDOFF-demo-restaurant-seed.md`

- [ ] **Step 1: Flip `sql_paths`** in `supabase/config.toml`:

```toml
[db.seed]
enabled = true
sql_paths = [
  "./seed/demo-restaurant/00-base.sql",
  "./seed/demo-restaurant/10-people.sql",
  "./seed/demo-restaurant/20-schedule.sql",
  "./seed/demo-restaurant/30-payroll.sql",
  "./seed/demo-restaurant/40-governance.sql",
  "./seed/demo-restaurant/50-communication.sql",
  "./seed/demo-restaurant/60-assets.sql",
  "./seed/demo-restaurant/99-verify.sql",
]
```

- [ ] **Step 2: Remove legacy seed** (assess other `seed/*.sql` first):

```bash
git rm supabase/seed.sql
# Assess existing seed/*.sql: fold-in already done for demo-day (Task 3).
# Leave doner-bros-showcase.sql in place (separate-concept precedent — NOT in sql_paths).
# Move website-factory-test.sql, dashboard-evolution.sql, service-config-seed.sql → _archive/ (stale, not wired).
git mv supabase/seed/website-factory-test.sql supabase/seed/_archive/ 2>/dev/null || true
git mv supabase/seed/dashboard-evolution.sql supabase/seed/_archive/ 2>/dev/null || true
git mv supabase/seed/service-config-seed.sql supabase/seed/_archive/ 2>/dev/null || true
# channel-seed-data / hms-phase-2 / onboarding-mission / season-mission / notification-seed-data:
# fold relevant content into 40/50 OR leave as optional extras (NOT in sql_paths). Decide per file; note in HANDOFF.
```

- [ ] **Step 3: Date-dynamic grep gate**

```bash
grep -RnE "'20[0-9]{2}-[0-9]{2}-[0-9]{2}'" supabase/seed/demo-restaurant/
```

Expected: ZERO hits EXCEPT clearly-commented union/law effective dates in `10-people.sql`. Any business date → fix before reset.

- [ ] **Step 4: Full `supabase db reset` (heavy — ensure RAM, L-0316)**

```bash
free -h   # ensure >6.5Gi available before reset (WSL2 OOM guard)
npx supabase db reset
```

Expected: migrations apply, then all 8 seed files run in order, `99-verify` emits "OK" NOTICEs and NO EXCEPTION. If `99-verify` raises → reset fails loudly → fix the named domain → re-run.

- [ ] **Step 5: Browser spot-check (positive UX confirmation)**

```bash
# start web (under op for env), login admin@smartout.local / password123
op run --env-file=.env.template -- pnpm --filter @smartout/web dev   # port 3060
```

Manually verify (or Playwright the existing `apps/e2e` day-line spec):
- `/dashboard/oppgaver` (day-line) on today/this-week → shows shifts + tasks + zones (NOT empty shell).
- my-salary surface → renders a closed-period "lønnsgrunnlag" with line detail (NEVER the word "lønnsslipp").
- governance/HMS surface → HACCP control list visible.

Expected: populated, believable restaurant. Capture a screenshot for the HANDOFF.

- [ ] **Step 6: Write `docs/HANDOFF-demo-restaurant-seed.md`** (frontmatter + sections):
  - Summary (what built, why), file map, demo logins (admin + employee, LOCAL-only non-secret).
  - **Deferred domains:** `control_point` (JSONB in control_list), `desk`, `announcement` (only `announcement_meta`), `conversation` (only `chat_conversation`) — table-absent, probe+skip.
  - **Decisions:** kept English dept display names (test-impact); `union_id='riksavtalen'`/`law_version='2026'`; base_rate sourcing.
  - **Debt/next:** `public_holiday` coverage ends 2027 (refresh migration needed); doner-bros kept as multi-concept precedent (future `demo-<concept>/` folders reuse 00→99); any payroll fixture needing engine recompute later.
  - **Learnings:** L-0348 hollow-UI class closed by RLS-context verify; `is_tariff_bound` trigger precondition (settings before binding).

- [ ] **Step 7: Typecheck (no app code changed, but confirm clean) + commit**

```bash
TURBO_CONCURRENCY=1 pnpm turbo run typecheck --filter=@smartout/supabase 2>/dev/null || true
git add supabase/config.toml docs/HANDOFF-demo-restaurant-seed.md supabase/seed/
git commit -m "feat(seed): wire demo-restaurant sql_paths, retire legacy seed.sql

Demo Restaurant replaces hollow HQ seed: date-dynamic, idempotent, RLS-verified.
99-verify gates db reset on non-hollow data (closes L-0348 hollow-UI class).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (run before handing to executor)

**1. Spec coverage** — spec §3.1 file layout → Tasks 1-8 (1:1). §3.2 composition/config → Task 9. §3.3 date-dynamic → Date-Dynamic Contract + grep gate (Task 9 step 3). §3.4 idempotency → Idempotency Contract + re-apply step in every task. §3.5 literal-UUID (no `\set`) → ID-Map Header + literal IDs throughout. §4 content model → roster (Task 1), schedule (Task 3). §5 payroll principles → Task 4 (freeze into shift_cost_snapshot resolved; is_tariff_bound via trigger resolved; audit INSERT-only). §5.6 no payslip → never named; my-salary derives from period+calculation+line (Task 9 step 5). §6 table-existence → ABSENT list + probe in Task 6. §7 verify → Task 8 (counts + FK + RLS reads). §8 rollout → Task 9. §10 open items → resolved (snapshot table, is_tariff_bound, public_holiday) or carried to HANDOFF (roster, fold-in, dept names).

**2. Placeholder scan** — domain files use `-- …` only where the FULL data already appears in the facts tables above (DRY pointer, not a logic gap); schema-capture sub-steps (`/tmp/demo-seed-schema.txt`) give exact `\d` commands for the 5 tables whose columns this plan does not pre-resolve (employment_contract, department_session, session_hook, schedule_absence, deviation, chat_message). No "add error handling"/"TBD"/"similar to Task N" without code.

**3. Type/name consistency** — `b0000000-…0` workspace, `f0000000-…N` profiles, `e0000000-…N` auth, `d0000000-…0..3` depts, `d1000000-…1..4` zones consistent across all tasks. Schema qualifiers (`payroll.`/`timesheet.`/`public.`) consistent with facts. `shift_cost_snapshot.tariff_rate_snapshot` (not `payroll.tariff_snapshot`) used in Task 4 + Task 8.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-29-demo-restaurant-seed.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task (sonnet build-agents for SQL), two-stage review between tasks, fast iteration. Tasks 0-9 are sequential (each depends on prior DB state); dispatch one at a time.
2. **Inline Execution** — execute in this session with checkpoints (heavier on context; the `db reset` in Task 9 is RAM-sensitive on WSL2).

Which approach?
