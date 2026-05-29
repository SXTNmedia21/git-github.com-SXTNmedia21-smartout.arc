---
title: Demo Restaurant Seed System — Design
status: draft
updated: 2026-05-29
created: 2026-05-29
module: seed-infrastructure
tags: [seed, demo-restaurant, supabase, date-dynamic, cascade, payroll, governance, communication]
---

# Demo Restaurant Seed System — Design

## 1. Problem

The local dev database is seeded by a single monolithic `supabase/seed.sql` (238 KB, 3470 lines) that builds an `HQ Workspace` with **hollow** data: bands and a handful of shifts, but **0 session_task, 0 shift_zone, 0 employment_contract, 0 department_operating_hours, no payroll runs, no governance/training/communication/asset data**. Logging into `/dashboard/oppgaver` (or any rich surface) shows an empty shell, not a believable restaurant.

Additionally:
- **72 hardcoded dates** in `seed.sql` → data goes stale; the day-line (which defaults to "today") is empty on any date other than the hardcoded one.
- Per-feature seed files exist in `supabase/seed/` (channel, hms, onboarding, season, notification, doner-bros) but are **not wired into `config.toml [db.seed] sql_paths`** (only `./seed.sql` runs on reset), so they don't load on `supabase db reset`.

**Goal:** a single canonical demo workspace — **"Demo Restaurant"** — that reflects a full restaurant in operation across every domain, rebuilt deterministically on every `supabase db reset`, with **all dates relative to the current date** so it never goes stale.

## 2. Goals / Non-Goals

**Goals**
- One canonical, fully-populated demo workspace named **"Demo Restaurant"**, reusing existing workspace UUID `b0000000-0000-0000-0000-000000000000` and all existing dept/profile IDs (no reference breakage: day-line, e2e fixtures, the existing demo-day all point here).
- A **base seed + one seed file per domain**, composed in deterministic order.
- **100% date-dynamic** — zero hardcoded business dates; everything anchored to `CURRENT_DATE`.
- Runs on `supabase db reset` (via `config.toml sql_paths`) AND is safe to re-apply manually (idempotent).
- Payroll seed respects the four non-negotiable principles (versioning, idempotency, audit-trail, tariff-snapshot freeze).

**Non-Goals**
- No production seeding (LOCAL only; never touches prod).
- No application/migration code changes (seed-data only; if a surface needs a column that doesn't exist, that's a separate sortie, flagged not fixed).
- No renaming of department display strings beyond the workspace name unless a display column exists without test impact (English dept names kept; flagged separately).
- Not a payroll calc-engine implementation — payroll rows are seeded as plausible, principle-compliant fixtures, not computed by the live engine.

## 3. Architecture

### 3.1 File layout — `supabase/seed/demo-restaurant/`

Numbered for deterministic load order; one file per domain (the requested structure):

| File | Domain | Key tables |
|---|---|---|
| `00-base.sql` | Identity + structure ("basik seed") | company, workspace (**"Demo Restaurant"**, `b0000000`), location, zone, department, **department_operating_hours**, position, team, auth.users, auth.identities, company_member, profile |
| `10-people.sql` | People + employment | employment_contract, employee_payroll_profile, tariff binding (read of `tariff_rate_table`) |
| `20-schedule.sql` | D6 production / schedule | schedule_shift (one full week), department_session, day_line, session_hook, session_task, shift_zone, time_entry, schedule_absence, deviation |
| `30-payroll.sql` | Payroll | supplement_rule, frozen tariff snapshot (table TBD — see §5), `payroll.period` (1 closed + 1 open), `payroll.calculation`, `payroll.calculation_line`, shift_pay_calculation_event (audit). **NO "payslip" table — payslip is a UI-derived composite of period + calculation + calculation_line; see §5.6** |
| `40-governance.sql` | Governance / HMS / training | policy, protocol, procedure, routine, control_list, control_point, temperature controls, knowledge_test, confirmation, onboarding journey/mission |
| `50-communication.sql` | Communication | channel, conversation, chat_message, desk, announcement |
| `60-assets.sql` | Assets | asset |
| `99-verify.sql` | Self-test | count-asserts per domain + day-line read simulation (raises notice/exception on hollow result) |

### 3.2 Composition

`config.toml [db.seed] sql_paths` becomes the ordered list:

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

The monolithic `supabase/seed.sql` is **retired** to `supabase/seed/_archive/seed.legacy.sql` (kept for reference, NOT in `sql_paths`). Its still-needed base content (auth users, company_member, identities) migrates into `00-base.sql`.

Existing `supabase/seed/*.sql` (channel, hms, onboarding, season, notification, doner-bros, website-factory, dashboard-evolution, service-config) are assessed per file: relevant content folded into the matching domain file; the rest moved to `_archive/` or left as optional extras (not in `sql_paths`). The current `demo-day-2026-05-29.sql` is **consolidated into `20-schedule.sql`** and made date-dynamic (its hardcoded `2026-05-29` becomes `CURRENT_DATE`-anchored).

### 3.3 Date-dynamic mechanism — pure SQL against `CURRENT_DATE`

No template/script/param. Every business date is a SQL expression so the same files work on `db reset` and on manual re-apply, always "today-relative":

- **Week anchor:** `date_trunc('week', CURRENT_DATE)::date` (Monday). Shifts/sessions/day_lines for a full current week = `anchor + N days`. A representative "busy Saturday" is `anchor + interval '5 days'`.
- **Timestamps:** `CURRENT_DATE + time '08:00'` (cast to `timestamptz` at Europe/Oslo as needed).
- **Payroll periods:** closed = `date_trunc('month', CURRENT_DATE) - interval '1 month'`; open = `date_trunc('month', CURRENT_DATE)`.
- **Seniority:** `employment_contract.start_date = CURRENT_DATE - interval 'N months/years'` per employee (drives ansiennitet → tariff tier).
- **Public holidays:** remain real fixed Norwegian dates (they ARE calendar-fixed) — sourced from `public_holiday`, not invented.
- **Absences/deviations:** anchored within the current week/month relative to `CURRENT_DATE`.

Rule: **grep for `'20\d\d-\d\d-\d\d'` in the demo-restaurant files must return zero hits** (except inside `public_holiday` references). This is a self-review gate.

### 3.4 Idempotency

Each domain file opens with a scoped delete then insert:

```sql
-- 20-schedule.sql (illustrative)
DELETE FROM public.schedule_shift WHERE workspace_id = :'DEMO_WS';
-- ... child-table deletes in FK-safe order ...
INSERT INTO public.schedule_shift (...) VALUES (...);
```

On `db reset` the DB is fresh → deletes are no-ops. On manual re-apply they make the file re-runnable. Where a temporal-lock trigger blocks deletes (e.g. `trg_schedule_shift_temporal_lock`), the file disables it for the delete block only and re-enables immediately (LOCAL only) — as already proven in `demo-day-2026-05-29.sql`.

### 3.5 Canonical ID map — literal UUIDs + shared header (NOT psql `\set`)

**Do NOT use psql `\set` variables.** Each `sql_paths` entry runs as a separate execution; psql variables are session-scoped, so a `\set DEMO_WS` declared in `00-base.sql` does NOT survive to `10-people.sql` → later files would reference undefined vars. Worse, it is unconfirmed that Supabase `db reset` even runs seeds through the psql client (backslash meta-commands are psql-only; a pgx/Go driver ignores them silently). No existing seed file uses `\set` (verified — zero hits).

**Mechanism:** every file uses **literal UUID values inline**, and the canonical map is documented once as a header comment block duplicated verbatim at the top of each domain file. The values are stable and human-auditable; FK coherence (§9 risk #2) rests on copy-faithful literals, not session state.

```sql
-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- DEPT_KITCHEN   d0000000-0000-0000-0000-000000000001
-- DEPT_SERVICE   d0000000-0000-0000-0000-000000000002
-- ... (full map; same block pasted into 00-base..60)
-- =================================================================================
INSERT INTO public.department (id, workspace_id, ...)
VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000', ...);
```

A drift guard belongs in `99-verify.sql`: assert each referenced FK resolves (e.g. every `schedule_shift.department_id` exists in `department`), catching a mistyped literal.

## 4. Restaurant content model

**Identity:** "Demo Restaurant" — a full-service Norwegian restaurant & bar (Oslo). Tariff-bound (NHO Reiseliv / Riksavtalen, `law_version='2026'`) so the payroll layer exercises tariff auto-enforcement.

**Departments (existing IDs, kept):** Kitchen, Service, Bar, Operations (English display kept to avoid test breakage; Norwegian-rename flagged as a separate decision).

**Zones (FoH, existing):** Hovedsal, Terrasse, Bar-område, Privat rom.

**Positions (≈8):** Daglig leder, Kjøkkensjef, Sous Chef, Kokk, Servitør, Hovmester, Bartender, Oppvask.

**Staff (≈12–14):** expand beyond the current 7 schedulable so a Saturday reads "busy" (add host/hostess, sommelier/wine, 2nd bar, pastry, dishwasher). Mix of active/trainee; inactive profiles exist but are never rostered.

**Demo login (required for QA browser path):** `00-base.sql` MUST seed at least one usable credential per role tier, with the full chain `auth.users` → `auth.identities` → `company_member` → `profile` → `workspace`. State the email + password literally in the spec/HANDOFF (LOCAL only, non-secret): an **admin/owner** login (sees payroll, governance, schedule authoring) and an **employee** login (sees my-salary read-only, tasks). Without this the §8.5 browser spot-check is undoable. Reuse the existing E2E seed identity (`SEED_PROFILE_ID = f0000000-…`, `admin@smartout.local`) so existing fixtures keep resolving.

**Schedule (current week):** realistic coverage per day (morning prep → lunch → evening → close), no per-person overlaps, some published + some open shifts, zone assignments for FoH roles, `time_entry` rows so payroll has input.

**Payroll:** supplement_rule for kveld/helg/natt/helligdag; one **closed** previous-month period (locked, frozen tariff snapshot per §5.1, `payroll.calculation_line` traced to `time_entry` + `framework_rule` + `tariff_rate_table`, INSERT-only `shift_pay_calculation_event` audit chain) + one **open** current-month period. Per-employee `payroll.period` + `payroll.calculation` + `payroll.calculation_line` rows so the my-salary UI renders (the "payslip" is derived UI-side — §5.6; no payslip table).

**Governance/HMS/training:** policies + protocols with procedures/routines; `control_list` incl. **temperature controls** (HACCP) with `control_point` measurements; `knowledge_test` (training) + `confirmation`; an onboarding journey/mission.

**Communication:** a few channels, a conversation with messages, desks, and announcements (news).

**Assets:** equipment/inventory rows per location.

## 5. Payroll compliance (non-negotiable, per `payroll-engine-developer`)

The `30-payroll.sql` file MUST:
1. **Freeze the tariff snapshot** (JSONB) for the closed period — re-apply must reproduce bit-exact. **⚠️ Confirm the target table at implementation:** payroll skill says `public.shift_cost_snapshot.tariff_rate_snapshot`, but a `payroll.tariff_snapshot` table also exists. Probe both; seed the one the calc-engine actually reads. Resolving this is a blocker for principle-1 correctness (do not guess).
2. Make every `payroll.calculation` / `payroll.calculation_line` point back to `time_entry_id`, `framework_rule_id`, `tariff_rate_table_id` (audit traceability).
3. Seed `shift_pay_calculation_event` as INSERT-only audit rows (no UPDATE/DELETE semantics).
4. Never hardcode rates — read from `tariff_rate_table` (`law_version='2026'`).
5. Set `is_tariff_bound=true` on **`payroll.workspace_settings`** (NOT the `workspace` table). Per ADR-0355/0356 this column is trigger-maintained from `workspace_union_binding` — prefer seeding the binding row (`union_id != 'non-bound'`) and letting the trigger set the flag, rather than writing the column directly.

These are seeded as **plausible, principle-shaped fixtures**, explicitly NOT engine-computed — `99-verify.sql` asserts structural integrity (every line has its three back-references), not cents-accuracy.

### 5.6 Payslip is NOT a table — wire, do not build

Audit (4 worktrees, 2026-05-29) confirmed **no `payslip` table / view / RPC exists anywhere**, and none should. "Payslip" is a UI-derived composite `PayslipEntry = { period, calculation }` (`apps/web/.../my-salary/_hooks/use-my-salary.ts`), with line detail lazy-loaded from `payroll.calculation_line`. So the payroll seed's job re: payslip is simply: seed `payroll.period` (1 closed + 1 open) + `payroll.calculation` (per profile per period) + `payroll.calculation_line` (the salary-code lines). The my-salary UI renders the "payslip" from those rows — no extra entity.

**Terminology guard:** `apps/e2e/tests/payroll-harness-e2e.spec.ts` blocks the assistant from ever saying "lønnsslipp" — Smartout produces **"lønnsgrunnlag"** (wage basis) for accountants and shows **"min lønn"** to employees; "lønnsslipp/payslip" is positioning drift. Do not name any seed object, comment, or doc string "payslip" beyond the existing `pdf_payslip` export-format enum value.

## 6. Table-existence handling

The implementation must **probe each table before seeding** (`to_regclass`), because some requested domains may not have tables yet. Migration grep (2026-05-29) already resolved several:

- **Confirmed to EXIST** (seed directly, no probe needed): `channel` (`20260422300000`), `chat_message` (`20260320120000`), `asset` (`00002`), `knowledge_test` (`00003`), `shift_zone`, `day_line`.
- **Unconfirmed — probe + skip + flag** (no `CREATE TABLE` found via grep): `desk`, `announcement`, `conversation`, `control_point`, `channel_event`, temperature-log table(s).
- **Confirmed ABSENT by design — do NOT probe for, do NOT create:** `payslip` (see §5.6).

For any unconfirmed-and-missing table: skip its block, emit a `RAISE NOTICE`, record it in the HANDOFF "deferred domains" list.

## 7. Verification (`99-verify.sql`)

Runs last; emits per-domain counts and **fails loudly** (`RAISE EXCEPTION`) if a core invariant is hollow, e.g.:
- `session_task` for the current week > 0
- `shift_zone` > 0
- `employment_contract` = active staff count
- `department_operating_hours` covers all departments × 7 days
- payroll closed-period `payroll.calculation_line` count > 0 AND every line has its 3 back-references
- every FK literal resolves (ID-map drift guard, per §3.5)
- day-line read simulation for `date_trunc('week',CURRENT_DATE)+5d` returns shifts + tasks + zones

**RLS-context read (REQUIRED — superuser counts are NOT sufficient).** The seed runs as superuser/service-role and bypasses RLS, so a `count(*) > 0` assert can pass while the actual UI renders empty (wrong workspace membership, missing `profile`-context, RLS predicate mismatch). This is exactly the HMS hollow-UI / PGRST201-redirect-loop class. `99-verify.sql` MUST therefore also run at least two reads under simulated auth:

```sql
-- simulate the authenticated demo user, then read what the UI reads
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"<demo auth.users uid>","role":"authenticated"}';
-- my-salary: settled periods + calculations visible to this profile
-- day-line: current-week shifts + tasks + zones visible to this workspace member
-- RAISE EXCEPTION if either returns 0 rows
RESET role;
```

Core invariants (must-pass, `RAISE EXCEPTION`) vs optional domains (notice-only): the RLS reads above + schedule/payroll/people counts are CORE; any domain skipped per §6 probe is notice-only so a deferred optional table cannot brick `db reset`.

This converts "did the seed work?" into a deterministic gate (closes the L-0348 / hollow-UI class).

## 8. Rollout

1. Confirm table existence (probe).
2. Author `00-base` (ID map + identity/structure + operating hours), then `10`→`60` in dependency order, each idempotent + date-dynamic.
3. Author `99-verify`.
4. Update `config.toml sql_paths`; archive legacy `seed.sql`.
5. `supabase db reset` → confirm `99-verify` passes; spot-check the day-line in browser.
6. HANDOFF: deferred domains (missing tables), the kept-English-dept-name decision, and any payroll fixtures that need engine-recompute later.

## 9. Risks

- **Payroll fixtures vs engine truth** — seeded payroll is fixture-shaped; if the live calc-engine later recomputes, numbers may differ. Mitigation: verify structure not cents; document as fixtures.
- **FK coherence across files** — mitigated by the single ID map in `00-base`.
- **Missing tables** — mitigated by probe + skip + flag.
- **Temporal-lock triggers on delete** — mitigated by scoped disable/re-enable (LOCAL).
- **`db reset` time/RAM on WSL2** — reset is heavier; run when RAM is ample.
- **Legacy seed.sql retirement** — anything outside the demo workspace that other tests relied on must be folded forward or archived deliberately (assessed per file).

## 10. Open items (resolve at implementation)

- Exact staff roster (names/positions) for the ~12–14 headcount.
- Which existing `seed/*.sql` files fold into domain files vs archive. (Note: `doner-bros-showcase.sql` is the precedent for a separate-workspace concept — reuse its pattern for future `demo-bar` / `demo-shop`, do not fold into demo-restaurant.)
- Whether `public_holiday` is already seeded (keep) or needs date-dynamic-safe fixed dates.
- ~~Confirm `is_tariff_bound` column location + payslip table name.~~ **RESOLVED (audit 2026-05-29):** `is_tariff_bound` is on `payroll.workspace_settings`, trigger-maintained from `workspace_union_binding` (§5.5). **There is no payslip table** — seed `payroll.period` + `calculation` + `calculation_line` (§5.6).
- Confirm frozen-snapshot table: `public.shift_cost_snapshot` vs `payroll.tariff_snapshot` (§5.1) — the one remaining payroll blocker.
- Concept strategy: each concept (restaurant/bar/shop) = its own workspace UUID + its own `demo-<concept>/` folder reusing the 00→99 file structure; `_base` provides only the shared structural template, never cross-concept shared rows.
