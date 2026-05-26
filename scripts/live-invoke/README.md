# Live-Invoke Smoke Scripts

> **Purpose:** Catch column drift, signature drift, missing functions, and silent SelectQueryError cascades that unit tests with mocks miss.
> **Owner:** every domain in `docs/domains/*` should have a script here scoring `axis 9` in the `prod-ready` skill.

## Background — L-0348 (3rd occurrence, promoted to systemic rule 2026-05-25)

Three Smartout-shipped sorties (C1 scheduler + Phase 1 turnus most recently) had unit tests + Track B mocks + Track E review ALL pass — then live invocation against local Supabase caught real column drifts that would have shipped to production silently.

After the 3rd occurrence, the rule was promoted: **every new DB-read capability MUST end with a Node-script live invoke before close-feature**.

This directory is the scoring path for `prod-ready` axis 9. A missing script = score 0 (failing gate). A passing script = score 2.

## Quick start

```bash
# Run a single domain's smoke:
op run --env-file=.env.template -- node scripts/live-invoke/task.mjs

# Run all live-invoke scripts (CI-style):
op run --env-file=.env.template -- node scripts/live-invoke/_runner.mjs
```

All scripts require:

1. Supabase Local running (`npx supabase status` should show green)
2. `op run --env-file=.env.template --` wrapping the node call (loads secrets)
3. Service role key access (scripts hit RPCs that need to bypass RLS for smoke — caller identity becomes null but signatures + columns are verified)

## Adding a new domain

```bash
cp scripts/live-invoke/_template.mjs scripts/live-invoke/<domain>.mjs
# Edit: replace TODO sections with real RPC/table calls for that domain
# Verify: op run --env-file=.env.template -- node scripts/live-invoke/<domain>.mjs
# Score: /prod-ready domain <domain> — axis 9 should now move 0 → 2
```

## What a live-invoke MUST cover

For each capability tool that reads DB:

1. **Call the actual RPC/select** the production code calls
2. **Assert the response shape** matches `database.types.ts` (catches typegen drift)
3. **Assert no error column** (catches PGRST201/202 ambiguous embed + SelectQueryError class)
4. **Empty result OK** — we are proving signature, not data presence

For each capability tool that writes DB (use a dedicated test workspace ID):

1. **Insert a probe row** with a known synthetic marker (`probe_<timestamp>`)
2. **Verify it appears via the read path**
3. **Clean up** in `finally`

## What it does NOT cover

- E2E flow (Playwright owns that)
- Performance (separate concern)
- Permissions/RLS user-by-user (audit owns that)
- UI rendering (smartout-page-polish owns that)

This is **signature + column + drift smoke** — one job, done well.

## Files

- `README.md` — this file
- `_lib.mjs` — shared helpers (client factory, assertion utils)
- `_template.mjs` — copy-paste starter for a new domain
- `_runner.mjs` — runs every `<domain>.mjs` in this directory, reports pass/fail summary (consumed by `prod-ready` scan)
- `<domain>.mjs` — one per domain in `docs/domains/`

## Exit codes

- `0` — all assertions passed
- `1` — assertion failure (script body)
- `2` — environment/setup failure (Supabase not running, secret missing)
- `3` — script error (unhandled exception)

## Catalogue (scored by `prod-ready` axis 9)

| Domain            | Script                  | Status                                   |
| ----------------- | ----------------------- | ---------------------------------------- |
| task (universal)  | `task.mjs`              | ✅ reference impl (2026-05-26)           |
| scheduling        | `scheduling.mjs`        | 🔴 TODO                                  |
| payroll           | `payroll.mjs`           | 🔴 TODO                                  |
| contracts         | `contracts.mjs`         | 🔴 TODO                                  |
| day-session       | `day-session.mjs`       | 🔴 TODO                                  |
| notifications     | `notifications.mjs`     | 🔴 TODO                                  |
| procedure-engine  | `procedure-engine.mjs`  | 🔴 TODO                                  |
| agent-harness     | `agent-harness.mjs`     | 🔴 TODO                                  |
| announcements     | `announcements.mjs`     | 🔴 TODO                                  |
| billing           | `billing.mjs`           | 🔴 TODO                                  |
| botsson           | `botsson.mjs`           | 🔴 TODO                                  |
| communication     | `communication.mjs`     | 🔴 TODO                                  |
| core-structure    | `core-structure.mjs`    | 🔴 TODO                                  |
| lovsen            | `lovsen.mjs`            | 🔴 TODO                                  |
| onboarding-wizard | `onboarding-wizard.mjs` | 🔴 TODO                                  |
| reports           | `reports.mjs`           | 🔴 TODO                                  |
| scrapling         | `scrapling.mjs`         | 🔴 TODO (Python service — wrapper smoke) |
| shift-clock       | `shift-clock.mjs`       | 🔴 TODO                                  |
| training          | `training.mjs`          | 🔴 TODO                                  |
| year-wheel        | `year-wheel.mjs`        | 🔴 TODO                                  |
| bootstrap         | `bootstrap.mjs`         | 🔴 TODO                                  |
