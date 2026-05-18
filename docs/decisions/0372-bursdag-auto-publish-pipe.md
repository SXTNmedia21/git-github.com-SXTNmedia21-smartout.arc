---
title: "Bursdag (Birthday) Auto-Publish Pipe — Daily Cron + Defense-in-Depth Autonomous Authority"
id: ADR_0372
status: proposed
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0372: Bursdag Auto-Publish Pipe — Daily Cron + Defense-in-Depth Autonomous Authority

> Pontus locked product direction 2026-05-18: auto-publish morning of birthday, no manager
> approval, opt-out via per-employee preference + per-workspace setting. This ADR locks
> the architectural shape before implementation.

## Context and Problem Statement

Smartout stores `user_identity.date_of_birth date` in the GDPR vault
(`supabase/migrations/00001_identity_tables.sql:32`). The vault is restricted to self-reads
and audited Edge Functions. Workspaces want a low-friction "happy birthday" announcement
posted to the news channel on the morning of an employee's birthday — but the manager-
in-the-loop confirm pattern used by `publish_announcement_atomic` (ADR-0369) requires a
human actor and `is_manager_in_workspace()` check. A daily cron has neither.

Three problems must be solved simultaneously: (1) compute today's birthday cohort
per workspace without leaking DOB outside the GDPR boundary, (2) bypass the manager
gate without breaking the defense-in-depth audit pattern, and (3) honour two
independent opt-outs (per-employee social-PII consent + per-workspace social-policy)
without scattering opt-out flags across N tables.

## Decision Drivers

- **GDPR boundary preservation.** `user_identity.date_of_birth` may never leave the vault
  layer; the cohort resolver must return profile_id + display_name only, never DOB itself.
- **C4 authority symmetry (ADR-0287).** Every mutation passes a capability gate. An
  autonomous cron is still a "caller" and must produce an `assert_capability` evaluation
  in `activity_trail`.
- **Manager-gate asymmetry.** `publish_announcement_atomic` re-checks
  `is_manager_in_workspace()` (defense-in-depth per ADR-0370). A service-role cron is
  neither manager nor anonymous — the RPC's bypass already handles this via
  `v_is_service_role` (line 42 of the RPC), but the actor identity must still be a real
  profile (the workspace's "system" or "Botsson" profile).
- **ADR-0368 alignment.** The proposed visibility matrix already names `date_of_birth`
  as a `pii_field` with `opt_in` source. Per-employee opt-out IS the consent matrix —
  no new opt-out column.
- **Idempotency under retry.** pg_cron + Edge Functions can fire twice. Double-posting
  a birthday is user-visible noise; must be prevented at the persistence layer.
- **Tier semantics.** A birthday is `tier='social'` (low priority, push+in_app, no email).
- **DB-vs-tool enum drift.** `announcement_kind` enum has 7 values, tool has different 5
  (only `staff_event` overlaps). Must resolve in same commit set (L-0292/ADR-0112).
- **Timezone realism.** Workspaces have per-workspace timezone. Hourly cron + EF-side
  timezone filter handles this without per-workspace cron jobs.

## Decision (sub-decisions Q1–Q9)

### Q1 — Source-of-truth cohort resolver

**CHOSEN:** SECURITY DEFINER RPC `fn_birthday_cohort_for_workspace(p_workspace_id uuid,
p_today date) RETURNS TABLE(profile_id uuid, display_name text)`. JOINs `user_identity`
ON `profile.user_id`, WHERE `EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM
p_today)` AND day-match. Returns only profile_id + display_name — DOB never crosses
the function boundary. GRANT EXECUTE to service_role only.

### Q2 — Cron mechanism

**CHOSEN:** pg_cron `'0 * * * *'` (hourly UTC) → Edge Function
`publish-birthday-celebrations` with Bearer auth via `app.watchdog_cron_secret`
(mirror of `20260616100601_note_fanout_scheduler_cron.sql`). EF enumerates workspaces,
filters to those where `(now() AT TIME ZONE workspace.timezone)::time` is in
`[06:00, 07:00)`. Hourly tick handles all timezones in one job.

### Q3 — C4 authority

**CHOSEN:** Keep `communication` capability untouched. NO new authority level. The
autonomous channel = service-role + cron-secret + RPC `v_is_service_role` branch.
"Permission" lives in `workspace_celebration_config.auto_celebrate_birthdays`, not
`engine_authority_config`. Audit symmetry preserved via existing `activity_trail` writes.

### Q4 — Per-employee opt-out

**CHOSEN:** Honour ADR-0368 `profile_visibility` matrix (`field='date_of_birth' AND
audience='hidden' AND source='opt_out'`). Cohort RPC LEFT JOINs the matrix and excludes
opt-outs. Fallback if ADR-0368 slips: temporary JSONB key `celebrate_birthday` on
`profile.notification_pref`, removal-migration scheduled with ADR-0368 ship.

### Q5 — Per-workspace opt-out

**CHOSEN:** New table `workspace_celebration_config` (1 row per workspace,
`auto_celebrate_birthdays bool DEFAULT true`, `target_channel_id uuid`). Auto-created
via trigger on `workspace INSERT`. Admin UI flips it. Pattern mirrors
`tips_workspace_settings`.

### Q6 — Channel routing

**CHOSEN:** `workspace_celebration_config.target_channel_id uuid NOT NULL`, defaults
at insert-trigger time to the workspace's first `channel_type='news'` channel
(`LIMIT 1 ORDER BY created_at`). Admin can reassign; FK + workspace-match trigger.

### Q7 — Message template

**CHOSEN:** i18n keys `komm.celebration.birthday.{title,body}` in `nb` + `en`. Body
interpolates `display_name` (workspace-public). DOB never appears, age never derived,
year-of-birth never exposed. EF resolves locale via `workspace.preferred_language`.

### Q8 — Telemetry

**CHOSEN:** Dual emit — `channel.message.sent` extended with property
`celebration_subtype='birthday'` (reuses Track F registry) AND dedicated
`celebration.auto_published` event for analytics dashboards. Origin reuses existing
`channel_origin_type='scheduler'` (no new enum value).

### Q9 — Idempotency

**CHOSEN:** New table `celebration_publication` with UNIQUE
`(workspace_id, profile_id, celebration_kind, celebration_date)`. RPC inserts with
`ON CONFLICT DO NOTHING RETURNING id`; empty RETURNING = skip publish. Retry-safe at
DB layer, not app layer.

## Decision Outcome

Hourly pg_cron → Edge Function `publish-birthday-celebrations`. EF picks workspaces
whose local time is in `[06:00, 07:00)` AND `auto_celebrate_birthdays=true`. For each:
calls `fn_birthday_cohort_for_workspace(workspace_id, today)`. For each cohort member:
calls `publish_announcement_atomic` with `kind='celebration'`, `tier='social'`,
service-role JWT, actor = workspace's Botsson profile. RPC service-role branch bypasses
manager-gate, new branch verifies celebration config, idempotency enforced by
`celebration_publication` unique constraint.

## Migration plan (forward-only, idempotent)

1. `YYYYMMDD120100_announcement_kind_add_celebration.sql` —
   `ALTER TYPE public.announcement_kind ADD VALUE IF NOT EXISTS 'celebration';`
   (resolves L-0292 enum drift, runs alone — Postgres enum extension constraint).

2. `YYYYMMDD120200_celebration_publication_table.sql` — CREATE TABLE + indexes +
   workspace-scoped RLS (RPC-only writes).

3. `YYYYMMDD120300_workspace_celebration_config_table.sql` — CREATE TABLE + RLS +
   BEFORE INSERT trigger on workspace (auto-create row, NULL-safe target_channel_id).

4. `YYYYMMDD120400_fn_birthday_cohort_for_workspace.sql` — SECURITY DEFINER RPC,
   GRANT EXECUTE service_role only.

5. `YYYYMMDD120500_publish_announcement_atomic_celebration_branch.sql` — CREATE OR
   REPLACE FUNCTION adding kind='celebration' branch (verifies config, inserts into
   `celebration_publication` ON CONFLICT DO NOTHING, skip-with-log if conflict).

6. `YYYYMMDD120600_publish_birthday_celebrations_edge_function_seed.sql` —
   placeholder migration (GUC creation if needed). EF code in
   `supabase/functions/publish-birthday-celebrations/`.

7. `YYYYMMDD120700_publish_birthday_celebrations_cron.sql` — pg_cron `'0 * * * *'`
   with `IF EXISTS pg_cron` guard.

8. `YYYYMMDD120800_workspace_celebration_config_backfill.sql` — `INSERT ... SELECT
   ... ON CONFLICT DO NOTHING` for existing workspaces.

## Test plan

**Integration (vitest):**
- `publishCelebrationBirthday.test.ts` — service-role caller, kind='celebration',
  asserts idempotency, manager-gate bypass, config-disabled skip.
- `birthdayCohortResolver.test.ts` — excludes opt-outs, never returns DOB, 0 rows
  when no birthdays today.

**E2E:**
- `seed-birthday-today.ts` helper — 2 profiles with DOB=today (one opt-out, one not).
- `apps/e2e/specs/birthday-auto-publish.spec.ts` — trigger EF via test endpoint,
  assert one announcement appears with kind=celebration, tier=social, opt-out
  excluded.

**Manual smoke:** Seed admin@smartout.no DOB to today; trigger EF via signed curl;
observe announcement in `/dashboard/komm/nyheter`.

## Rollback path

1. `SELECT cron.unschedule('publish-birthday-celebrations');` (no downtime).
2. `UPDATE workspace_celebration_config SET auto_celebrate_birthdays = false;`
   (immediate, surgical).
3. Revert migration #5 — CREATE OR REPLACE FUNCTION restores prior shape.
4. DROP CASCADE on `celebration_publication` + `workspace_celebration_config` —
   workspace-scoped, no FK dependents.
5. Added enum value `'celebration'` cannot be removed without type-rebuild — inert
   if unused.

## Open questions for Pontus

1. **Cron tick UTC top-of-hour OR per-workspace minute precision?** Recommend UTC
   top-of-hour. Confirms "morning of birthday" tolerates ±30 min.
2. **Anniversary kicker.** `workspace_celebration_config` over-built for
   birthday-only if work-anniversary not on 6-month roadmap. Recommend keeping table
   general; flag YAGNI if you'd rather collapse.
3. **System actor identity.** Path (a) dedicated Botsson profile per workspace
   (already exists per `20260519100000_profile_botsson_channel_bootstrap.sql` —
   RECOMMENDED), or (b) nullable actor when service-role. Recommend (a).
4. **ADR-0368 dependency.** Fallback acceptable if 0368 slips? (JSONB key on
   `profile.notification_pref`, removal-migration scheduled with 0368 ship.)

## Rules and Consequences

- **Good, because** cohort resolver enforces GDPR boundary at RPC surface.
- **Good, because** reuse of `publish_announcement_atomic` preserves fan-out, audit,
  notification-tier, and idempotency in one well-tested code path.
- **Good, because** opt-out consolidated into ADR-0368 matrix — consent singular.
- **Good, because** autonomous path = service-role + cron-secret — no new authority
  level, no privilege regression for human callers.
- **Bad, because** temporary fallback (Q4) if ADR-0368 slips creates 14-day window
  where opt-out lives in `notification_pref` JSONB — tracked + removal-scheduled.
- **Bad, because** hourly cron adds 24-tick load even for empty days — acceptable:
  cheap `workspace_celebration_config` query per tick.
- **Bad, because** adding `'celebration'` to enum touches downstream consumers; CHECK
  constraint `meta_kind_link_consistent` must add branch (celebration allows
  `linked_entity_type IS NULL OR linked_entity_type = 'profile'`).
- **Agent Impact:** Capability authors must NOT shortcut by calling RPC with
  kind='celebration' from agent context. The celebration branch's config precondition
  + service-role CHECK means agent-initiated celebration calls fail gate. Intentional —
  prevents Botsson "spontaneous birthday wishes" without consent-matrix filter.

## Cited ADRs and learnings

- ADR-0078 (channel guard — voice rejection preserved at agent tool)
- ADR-0099 (gate_action canonical authority gate — autonomous path documented)
- ADR-0132 (mobile AI routing — mobile is read-only consumer)
- ADR-0173 (capability boundary — `communication` retained, no proliferation)
- ADR-0287 (gate mandatory on mutations — service-role branch IS the gate here)
- ADR-0368 (profile_visibility matrix — Q4 opt-out source of truth)
- ADR-0369 (announcement atomicity RPC-body fan-out — reused unchanged)
- ADR-0370 (capability boundary for announcement surface — celebration extends, not forks)
- ADR-0371 (announcement schema contract — title+body preserved; celebration uses both)
- L-0177 (silent fallback fail-fast — applied to telemetry emit + cohort empty-result)
- L-0292/ADR-0112 (intent-classifier same-commit lock — enum extension paired)
