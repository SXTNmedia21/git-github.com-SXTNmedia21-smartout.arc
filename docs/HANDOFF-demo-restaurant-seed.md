---
title: Demo Restaurant Seed System — Handoff
status: done
updated: 2026-05-30
created: 2026-05-30
module: seed-infrastructure
tags: [seed, demo-restaurant, supabase, date-dynamic, cascade, payroll, governance, handoff]
---

# Demo Restaurant Seed — Handoff

## Summary

Replaced the monolithic, hollow, date-hardcoded `supabase/seed.sql` with **8 ordered, date-dynamic, idempotent per-domain seed files** under `supabase/seed/demo-restaurant/`, wired into `config.toml [db.seed] sql_paths`. One canonical demo workspace — **"Demo Restaurant"** (`b0000000-0000-0000-0000-000000000000`, reused id) — now reflects a full restaurant in operation across identity, employment, schedule (D6), payroll, governance/HMS, communication and assets. Rebuilt deterministically on every `supabase db reset`, all business dates relative to `CURRENT_DATE`, gated by a loud self-verifying `99-verify.sql` that includes RLS-context reads (closes the L-0348 / hollow-UI class).

Built via subagent-driven development (implementer + spec/quality review per task). Spec: `docs/superpowers/specs/2026-05-29-demo-restaurant-seed-design.md`. Plan: `docs/superpowers/plans/2026-05-29-demo-restaurant-seed.md`.

## Files (load order)

| File | Domain | Owns |
|---|---|---|
| `00-base.sql` | Identity + structure | auth.users/identities (14), company, workspace (renamed "Demo Restaurant"), location, 4 zones, 4 departments, department_location, **28 department_operating_hours**, 8 positions, teams + team_member, 14 profiles, company_member, employee_payroll_profile, invitations |
| `10-people.sql` | Employment | 11 employment_contract (tariff-sourced rates), payroll.workspace_settings, workspace_union_binding (→ trigger sets `is_tariff_bound=true`) |
| `20-schedule.sql` | D6 production | 28 department_session + 28 day_line (full week), 39 schedule_shift (busy Saturday), 21 session_task (incl. HACCP compliance), 12 shift_zone, time_entry punches, schedule_absence, deviation |
| `30-payroll.sql` | Payroll | 4 supplement_rule (payroll+public), 2 payroll.period (1 locked + 1 open), 23 shift_cost_snapshot (frozen `tariff_rate_snapshot`), 23 payroll.calculation, 39 payroll.calculation_line, 39 shift_pay_calculation_event (INSERT-only audit) |
| `40-governance.sql` | Governance/HMS/training | 1 D4 season (self-seeded), 6 policy, 6 protocol, procedures + steps, 3 control_list (HACCP temps in items JSONB), routines, 2 knowledge_test, confirmations, protocol_assignment, season_policy_binding |
| `50-communication.sql` | Communication | 4 channel, 1 chat_conversation, chat_participant, 7 chat_message |
| `60-assets.sql` | Assets | 8 asset (equipment/storage/station across location) |
| `99-verify.sql` | Self-test gate | CORE count + FK-drift + audit-integrity asserts (RAISE EXCEPTION); **2 RLS-context reads** under simulated `authenticated` role; optional-domain counts (NOTICE) |

Legacy `supabase/seed.sql` retired to `supabase/seed/_archive/seed.legacy.sql`. `demo-day-2026-05-29.sql` consolidated into `20-schedule.sql` (removed).

## Verified state (post `supabase db reset`, 2026-05-30)

Full `supabase db reset` passes end-to-end (migrations on fresh DB → 8 seed files in order → 99-verify), reproduced across two runs. No ERROR/EXCEPTION/HOLLOW.

`Demo Restaurant`: 14 profiles · 11 contracts · 28 operating-hours · 39 shifts · 28 sessions · 21 tasks · 12 zones · 2 payroll periods · 23 calculations · 39 calc-lines · `is_tariff_bound=true` · 6 policies · 4 channels · 8 assets · 1 season.

99-verify RLS-context reads (proof of non-hollow UI): admin sees 39 current-week shifts; employee Anna sees 23 payroll.calculation rows — both under `authenticated` role (not superuser bypass).

## Demo logins (LOCAL only — non-secret)

All `@smartout.local`, password `password123`:
- **Admin/owner:** `admin@smartout.local` (Local Admin, Operations) — payroll, governance, schedule authoring, godmode.
- **Manager:** `erik@smartout.local` (Erik Pedersen, Sous Chef, Kitchen).
- **Employee:** `anna@smartout.local` (Anna Olsen, Kokk) — has closed-period payroll, my-salary read-only.
- Plus 11 more (kari/ole/silje/jonas trainees + sofia/mats/nora/even new actives + inactive lise/jon/sara).

## Decisions

- **Workspace id reused** (`b0000000-…0`) + all existing dept/profile/zone ids kept — no reference breakage for day-line, e2e fixtures.
- **English department display names kept** (Operations/Kitchen/Service/Bar) to avoid test breakage; Norwegian rename is a separate decision.
- **Tariff binding:** `union_id='riksavtalen'`, `law_version='2026'`, `amendment_classifier='BOOTSTRAP'`. is_tariff_bound flipped by trigger (settings row seeded before binding — load-bearing order).
- **Closed payroll period = current week's already-passed days** (not previous month). Reason: Task 3 seeds only the current week; `payroll.calculation.schedule_shift_id` is NOT NULL, so calculations must reference real seeded shifts. Open period = today → month-end.
- **Rates never hardcoded** — all from `tariff_rate_table` (migration-seeded: minstelonn_faglart 210 / ufaglart 198.50, kveldstillegg, helgetillegg, nattillegg, helligdagstillegg).
- **Frozen tariff snapshot** → `public.shift_cost_snapshot.tariff_rate_snapshot` (the calc-engine's read target; `payroll.tariff_snapshot` is provenance-only). Deterministic `ORDER BY` → bit-identical md5 across re-applies.
- **D4 season self-seeded in 40-governance** (`ac000000-…1` "Vinter 2026") — there is no dedicated D4 seed file; required so `season_policy_binding` FK resolves on a clean reset (the season previously existed only via legacy seed).
- **Payslip is NOT a table** (per spec §5.6) — my-salary derives `PayslipEntry` from period+calculation+calculation_line. No object named "payslip"; positioning term is "lønnsgrunnlag"/"min lønn".

## Deferred domains (table absent — probe+skip+NOTICE)

- `control_point` — does not exist; HACCP temperature points live in `control_list.items` JSONB.
- `desk` — absent (note: `comm_channel_type` has a `desk` *value*, so "desk" is a channel-type, not a table).
- `announcement` — only `announcement_meta` exists (requires a `channel_message` FK; skipped).
- `conversation` — only `chat_conversation`/`emma_conversation` exist.

## Debt / next steps

- **Latent bug (flag, not fixed here):** trigger `trg_auto_assign_protocols` fires on `profile` INSERT and references `NEW.location_id` — a column ADR-0430 M4 dropped from `profile`. 00-base works around it by disabling the trigger during profile insert (LOCAL seed only). This would break any production profile-insert through that trigger path — **needs a dedicated fix sortie** (update or drop the trigger).
- **public_holiday coverage ends 2027** (migration-seeded) — date-dynamic demo will lose holiday alignment after 2027; refresh migration needed.
- **helgetillegg = 0 in the closed period** — the closed period is the current week's Mon–Fri; weekend (Saturday) supplements land in the open period. Coherent, but the closed-period my-salary view shows only kveld+natt supplements.
- **Other unwired `seed/*.sql`** (channel-seed-data, hms-phase-2, onboarding-mission, season-mission, notification-seed-data, website-factory-test, dashboard-evolution, service-config) remain in `supabase/seed/` but are NOT in `sql_paths` (harmless). Optional cleanup: archive stale ones. `doner-bros-showcase.sql` is the deliberate separate-concept precedent — keep (template for future `demo-bar`/`demo-shop` reusing the 00→99 structure).
- **Concept strategy:** each future concept = own workspace UUID + own `demo-<concept>/` folder reusing the 00→99 file structure.

## Learnings

- **`psql < file` does NOT replicate `supabase db reset`.** The Supabase CLI seeder uses a pgx/Go driver that COMMITs between statement batches; `CREATE TEMP TABLE … ON COMMIT DROP` is dropped mid-file → later statements fail (`relation does not exist`). psql runs the whole file in one session and hides this. **Any seed file feeding `sql_paths` MUST be validated via a real `supabase db reset`, not psql piping.** Keep all state statement-local (CTEs, scalar subqueries) — no temp tables / session vars / `\` meta-commands.
- **Cross-file idempotency ordering:** per-file idempotency ≠ whole-set re-apply idempotency. `30-payroll` creates `shift_pay_calculation_event` rows whose `shift_id` FK (NO ACTION) references `20-schedule`'s shifts; on whole-set re-apply, `20-schedule` runs before `30-payroll`'s own cleanup, so `20-schedule` must itself clear those payroll audit rows before deleting shifts. (No-op on fresh reset.)
- **Legacy-seed dependency hunt:** incremental psql-apply validates against a DB still holding legacy rows; a file can pass yet break on fresh reset if it depends on a row only the legacy seed created. Confirmed migration-sourced (reset-safe): tariff_rate_table, regulatory_framework, framework_rule, public_holiday. Caught + fixed: the D4 season (legacy-only → self-seeded).
- **RLS-context verify closes the hollow-UI class:** superuser `count(*)>0` can pass while the UI renders empty (membership/RLS mismatch). 99-verify reads under `set_config('role','authenticated')` + `request.jwt.claims.sub` and asserts >0 — the strongest non-browser proof.

## How to re-seed

`supabase db reset` (runs migrations + all 8 files in order; ~7Gi RAM recommended on WSL2). Manual single-file re-apply during dev: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < supabase/seed/demo-restaurant/<file>.sql` — but always confirm with a full `db reset` before relying on it.
