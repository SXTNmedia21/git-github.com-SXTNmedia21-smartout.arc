---
id: ADR-0388
title: pg_cron enablement + prod cron-registration recovery and silent-skip guard
status: accepted
updated: 2026-05-21
created: 2026-05-21
module: infra
tags: [pg_cron, cron, migrations, prod, drift, ci-guard, observability, recovery]
---

# ADR-0388 — pg_cron enablement + prod cron-registration recovery and silent-skip guard

## Status

accepted (2026-05-21)

## Context

While triaging a red `Migration Coherence` check on the 2026-05-21
`preview → main` release, a read-only probe of the production database
revealed that **`pg_cron` was never enabled on the production Supabase
project** — only `pg_net` (0.19.5) was installed. `SELECT ... FROM cron.job`
returned `42P01 relation "cron.job" does not exist`.

Every cron-scheduling migration in the repository (22 files, 27 distinct
jobs) wraps its `cron.schedule(...)` calls in a guard:

```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(...);
  END IF;
END $$;
```

The guard exists so local dev (no pg_cron) applies migrations cleanly. But
in production the guard was **also** false — so for the entire life of the
prod project, every `cron.schedule()` was silently skipped. The migrations
recorded as `applied`, `Migration Deploy` stayed green, and **zero jobs were
ever registered.** All 27 schedulers were dead in production:

| Area | Representative jobs | Consequence |
|---|---|---|
| Billing | `smartout-dunning-daily`, `generate-monthly-invoices`, `check-billing-run` | No dunning, no recurring invoice generation |
| Sessions | `session-lifecycle`, `session-hook-executor`, `session-watchdog-demoter`, `daily-session-replenish` | Sessions never auto-transition / replenish |
| Comms | `process-notifications`, `morning-digest`, `process-scheduled-communications`, `shift-*-reminder` | No scheduled messages / shift reminders |
| Ops | `ops-monitor`, `ops-day-brief`, `ops-predict`, `ops-learn`, `heartbeat-dispatcher`, `note-fanout-scheduler` | No ops intelligence / heartbeat / note fan-out |
| Retention | `purge_recorder_*`, `engine-memory-ttl-purge`, `archive_completed_engine_states_daily`, `contract-retention-anonymize` | GDPR/retention cleanup never ran |

This invalidated the load-bearing assumption stated explicitly in **ADR-0386**
("All ~13 other recurring jobs already use in-DB pg_cron … pg_cron still
fires") and implicitly in every cron ADR (0118, 0243, 0305, 0332, 0372, 0377).

`Migration Coherence` could never catch this: its diff scope is
`public,payroll,websites,timesheet` — the `cron` schema is out of scope, and
the guard pattern hides the skip by design.

## Decision

Three-part recovery + prevention:

1. **Enable pg_cron in prod** (operator, done 2026-05-21 via Supabase
   Dashboard → Database → Extensions). pg_cron cannot be enabled by repo
   migration on Supabase — it is a dashboard/`shared_preload_libraries`
   toggle — so this stays a documented operator action, not a migration.

2. **Canonical re-registration migration**
   (`20260621201500_reregister_pg_cron_jobs.sql`). Replays the net-state of
   all 27 distinct jobs (last-definition-wins across the 22 source
   migrations, computed in causal/timestamp order). Each job is
   `cron.unschedule`-if-present then `cron.schedule`d, making the migration
   idempotent and version-agnostic (does not rely on pg_cron
   upsert-by-name). The same `IF EXISTS pg_extension` guard is retained so
   local dev still no-ops. The file carries a `CRON-REGISTRY-CANONICAL`
   marker (see guard below). Command bodies were lifted **verbatim** from
   source via a dollar-quote/paren-aware scanner — no hand-typing — because
   the bodies contain `net.http_post` Bearer construction and multi-statement
   INSERT logic where any paraphrase silently breaks a job.

3. **Two guards against recurrence:**
   - **Static (CI, creds-free):** `Check 0` added to
     `.github/scripts/migration-lint.sh` — asserts every `cron.schedule('name')`
     across all migrations also appears in the `CRON-REGISTRY-CANONICAL`
     file. Forces any future cron job into the canonical registry so a fresh
     DB / re-enabled pg_cron always provisions the complete set.
   - **Runtime observability:** `public.fn_cron_jobs_health()` SECURITY
     DEFINER RPC (service_role only) returns `{pg_cron_enabled, count, jobs}`,
     tolerant of a missing `cron` schema via dynamic `EXECUTE`. This is the
     hook a post-deploy assertion uses to detect "jobs intended but never
     registered."

## Rationale

- **Forward-only recovery.** Old migrations are already recorded as applied
  and cannot re-run; a single idempotent forward migration is the only clean
  way to register the net-state, consistent with smartout-database-guide.
- **Verbatim over re-authoring.** 27 jobs × multi-line bodies = high
  paraphrase risk. Mechanical extraction guarantees byte-fidelity.
- **The static guard targets what CI *can* see.** It cannot detect a disabled
  extension in prod, but it closes the "new cron job not in the canonical
  register" drift that would re-create a partial-registration hole on the
  next fresh provision.
- **The RPC targets what CI *cannot* see.** Runtime job count is the only
  signal that distinguishes "scheduled in code" from "registered in prod."

## Consequences

1. **Prod risk — sub-minute schedule.** `process-notifications` uses
   `'30 seconds'`, which requires pg_cron ≥ 1.5. Verified against the
   now-enabled prod extension version before promotion. If the version were
   older, that one job would need a `* * * * *` fallback.
2. **GUC dependency — CONFIRMED FAILURE, now CI-enforced.** Post-merge
   `cron.job_run_details` showed every `net.http_post` job failing with
   `null value in column "url" of relation "http_request_queue"`. Root cause:
   prod DB had **none** of the 5 required GUCs (`app.supabase_url`,
   `app.watchdog_cron_secret`, `app.service_role_key`,
   `app.process_notifications_secret`, `app.morning_digest_secret`) — only an
   unrelated `app.settings.jwt_exp`. SQL-only jobs (`emma_task_trigger`,
   `process-scheduled-communications`) succeeded; all http jobs failed.
   - These CANNOT live in a migration (secret values → secrets-protocol).
   - They CANNOT be set via the Supabase MCP role (`42501 permission denied
     to set parameter`) — `ALTER DATABASE … SET` requires the `postgres`
     owner role.
   - **Fix:** a "Ensure cron GUCs set (ADR-0388)" step in the Migration Deploy
     job (`ci.yml`) connects as `postgres` via the session pooler and
     idempotently `ALTER DATABASE postgres SET`s all 5 from GH Actions secrets
     on every main deploy. **Requires 3 new repo secrets**:
     `WATCHDOG_CRON_SECRET`, `PROCESS_NOTIFICATIONS_SECRET`,
     `MORNING_DIGEST_SECRET` (the other two reuse existing `SUPABASE_PROD_URL`
     + `SUPABASE_PROD_SERVICE_ROLE_KEY`). The step hard-fails if
     `WATCHDOG_CRON_SECRET` is absent.
   - GUCs apply to new sessions; pg_cron spawns a fresh session per run, so the
     next firing picks them up — no restart.
3. **Runtime prod assertion is a follow-up.** Wiring `fn_cron_jobs_health()`
   into `smoke-probe.sh production` requires service-role-key plumbing in the
   smoke script and is intentionally deferred to a separate change to avoid
   bloating this recovery. Until then the RPC is available for manual /
   heartbeat checks.
4. **Local dev unchanged.** No pg_cron locally → guard false → migration +
   RPC apply cleanly, RPC returns `pg_cron_enabled:false`.

## References

- ADR-0386 — pg_cron over n8n for invoice generation (assumed pg_cron fired)
- ADR-0118 / ADR-0243 / ADR-0305 / ADR-0332 / ADR-0372 / ADR-0377 — ADRs whose cron jobs were dead in prod
- L-0042 — migration timestamp ordering (smartout-database-guide)
- Migration `20260621201500_reregister_pg_cron_jobs.sql` — canonical registry
- `.github/scripts/migration-lint.sh` Check 0 — cron registration coherence guard
- Incident: red Migration Coherence on `preview → main` 2026-05-21 (run 26201591421)

---

## Amendment 2026-05-21 — GUCs unsettable on managed Supabase → pivot to Vault

Consequence #2 assumed `app.*` GUCs could be set. **They cannot.** Supabase
restricts `ALTER ROLE`/`ALTER DATABASE … SET` to the `supabase_admin`
superuser. The `postgres` role (migrations, MCP, pooler) gets
`42501 permission denied to set parameter` for every form tried:

- MCP `execute_sql` `ALTER DATABASE app.supabase_url` → 42501
- psql-as-postgres `ALTER DATABASE app.*` / `ALTER ROLE postgres SET app.*` → 42501
- unclaimed namespace `ALTER ROLE postgres SET smartout.*` → 42501
- `ALTER DATABASE app.settings.*` (the `jwt_exp` class) → 42501
- **Supabase Dashboard SQL Editor** → 42501

`app.settings.jwt_exp` exists because the Supabase *platform* set it, not us.
So `current_setting('app.*')` is permanently unpopulatable by us.
`supabase_vault` IS writable by `postgres` (`vault.create_secret` /
`vault.update_secret` / `vault.decrypted_secrets` all work).

**Revised decision — secrets via Vault, not GUCs:**

1. Reuse the pre-existing `public.get_secret(secret_name)` (from
   `20260228230000_api_key_management.sql`) — SECURITY DEFINER reader of
   `vault.decrypted_secrets`.
2. New migration `20260621202000_cron_jobs_via_vault.sql` re-registers all 27
   jobs with every `current_setting('app.X', true)` swapped for
   `public.get_secret('X')`. Supersedes the GUC-based `20260621201500`.
3. Seed 5 vault secrets: `supabase_url`, `service_role_key`,
   `watchdog_cron_secret`, `process_notifications_secret`,
   `morning_digest_secret`. CI step renamed **"Seed cron secrets into Vault"**
   (idempotent `vault.create_secret`/`update_secret` from GH secrets each main
   deploy) — replaces the dead ALTER-DATABASE step.

**Verified on prod after re-registration:** SQL-only jobs + all 12
`watchdog_cron_secret` jobs → `200`. **Two bugs found via `cron.job_run_details`
+ EF probes:**

- `journey-stuck-detector` cron used `service_role_key` → `401`. Its EF
  actually accepts `WATCHDOG_CRON_SECRET` (doc'd). Fixed in the migration to
  use `watchdog_cron_secret` → `200`.
- `process-notifications` (`PROCESS_NOTIFICATIONS_SECRET`) and
  `send-morning-digest` (`MORNING_DIGEST_SECRET`) → `401`: the value in the
  prod 1Password vault ≠ the deployed Edge Function secret (value drift). These
  two need reconciliation (operator: confirm authoritative value, set EF secret
  = vault value, or vice-versa). Tracked open.

**Open operator items:** (a) add GH secrets `WATCHDOG_CRON_SECRET`,
`PROCESS_NOTIFICATIONS_SECRET`, `MORNING_DIGEST_SECRET` for the CI Vault-seed
step; (b) reconcile the two drifted EF secrets.
