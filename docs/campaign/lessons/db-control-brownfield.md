---
topic: db-control-brownfield
status: active
updated: 2026-05-31T15:00:00Z
created: 2026-05-31T00:00:00Z
supersedes:
---

# Decision lesson — db-control-brownfield

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Brownfield Supabase DB inspection is a **separate path** from greenfield `sxtn-supabase-init`
and lives in `sxtn-db-control` (`bin/sxtn-db.sh`). Which project you connect to is **enforced by
declare-and-prove**: the dev declares `SUPABASE_PROJECT_REF`, and the wrapper derives the ref from
the resolved `SUPABASE_DB_URL` _inside the `op run` child_ and refuses on mismatch (`PROJECT
MISMATCH`) — only the non-secret ref ever leaves the child, never the URL/password. Reads are
server-side read-only (`PGOPTIONS=default_transaction_read_only=on`); writes require typed `yes`.
All remote creds are `op://` references — the wrapper default-denies any raw value. Two connection
shapes are supported: a full `SUPABASE_DB_URL`, or `SUPABASE_PROJECT_URL` + `SUPABASE_DB_PASSWORD`
composed into a direct conn inside the op child. A `SXTN_DB_LOCAL=<conn>` mode bypasses op entirely
for a local Docker Postgres (non-secret, explicit opt-in) — used by the test harness to run a real
E2E against an ephemeral `postgres:15` container (read-only enforcement + write-confirm proven, not
just asserted in code).

## Why

Connecting to the wrong database (prod vs staging, someone else's project) is the real hazard, and
trusting a bare connection string makes it invisible. Declaring the ref and proving the URL points
there turns a silent footgun into a hard refusal, while keeping every secret in 1Password and out
of AI context. The greenfield/brownfield split (documented in both SKILL.md files + `supabase/README.md`)
prevents the two from being confused — init _builds_ a schema from a plan, db-control only _checks_
a DB that already exists.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T00:00:00Z — initial: brownfield db-control = separate path; project enforced by declare-and-prove ref match; creds op:// only; reads read-only, writes confirmed.
- 2026-05-31T12:00:00Z — added: dual connection shape (full DB_URL or PROJECT_URL+DB_PASSWORD composed in op child) + SXTN_DB_LOCAL Docker mode; E2E proven against ephemeral postgres:15 (read-only rejection + write-confirm verified live, not just in code).
- 2026-05-31T13:00:00Z — added `telemetry [domain]`: spine path gates on telemetry_event errors per feature (exit 1); when no spine, falls back to brownfield inventory of per-domain \*\_event tables (SmartOut has 14, no unified telemetry_event). Fixed a false-green where a missing table reported "healthy" — a missing spine must default-deny, never pass.
- 2026-05-31T14:00:00Z — KNOWN-WRONG (fix pending): the brownfield `*_event` name heuristic targets the wrong tables. A project's real telemetry sinks are defined by its telemetry registry's `destinations[]`, NOT by table-name pattern. SmartOut (`packages/telemetry/src/emit.ts`) fans 987 events to 5 sinks — posthog (extern), activity_trail, engine_event, billing_activity_log, logger; `journey_event`/`staff_event`/etc are domain app tables, not telemetry. ALSO: the inventory used `pg_stat_user_tables.n_live_tup`, which reports 0 until ANALYZE — it showed 0 while activity_trail held 1588 rows. Rule: detect sinks from the telemetry registry/router, and count rows with `count(*)`, never pg_stat estimates.
- 2026-05-31T15:00:00Z — FIXED: brownfield telemetry now counts with `count(*)` (proven: SmartOut shift_pay_calculation_event=39/engine_event=37/planning_event=13 where pg_stat said 0) and takes an explicit `SXTN_TELEMETRY_SINKS="t1,t2"` list (the right way — declare the registry's sinks); the `*_event` heuristic stays only as a labelled-as-guess fallback. Both paths E2E-tested in the harness (28/28). Regex `~ '_event$'` replaced the brittle `like '%\_event'` (backslash mangled through the op/bash layers).
