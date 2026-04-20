---
title: "Wrightegaarden Tier 1 Migration — end-to-end plan"
status: in_progress
created: 2026-04-15
updated: 2026-04-15
module: strike-mcp
tags: [migration, bubble, wrightegaarden, tier-1, plan]
---

# Wrightegaarden Tier 1 Migration

End-to-end plan for the first real customer migration. Wrightegaarden is
chosen as the pilot because it has realistic operational data (5434+ record
rows, 373 tasks, 26 handbooks) without the complexity and risk surface of
Strøm Mat & Bar. The work proven here becomes the template for every
subsequent workspace migration.

## Goal

Migrate Wrightegaarden from Bubble (version-test branch) into v3 Supabase
(local first, later cloud). Produce a reviewable SQL bundle, verify it
against a local Supabase, and capture every mapping decision in the
append-only decision log for later cross-workspace pattern reuse.

## Scope — Tier 1 entities (14)

Confirmed with user 2026-04-15. Numbers are field counts from live meta.

| # | Bubble type | → v3 target | workspaceFieldKey | Fields |
|---|---|---|---|---|
| 1 | `workspace` | `workspace` + `company` | — (root) | 51 |
| 2 | `🏰company` | `company` | TBD at research | 40 |
| 3 | `location` | `location` | `workspace` | 41 |
| 4 | `🏠department` | `department` (D1) | `workspace` | 35 |
| 5 | `🎎team` | `team` (D2) | `🏰 Workspace` | 45 |
| 6 | `user` | `user_identity` | `workspace` | 26 |
| 7 | `profile` | `profile` | `workspace` | 50 |
| 8 | `⏱️employment_profile` | merge → `employment_contract` (D2) | `🏰 workspace` | 45 |
| 9 | `⏱️employment_contract` | `employment_contract` (D2) | TBD | 36 |
| 10 | `⏱️employee_type` | `employee_type` (new v3 table?) | `🏰 Workspace` | 22 |
| 11 | `🎎invitation` | `invitation` (only pending) | `🏰 Workspace` | 31 |
| 12 | `shift` | `schedule_shift` (D6) | `workspace` | 61 |
| 13 | `shift_satellite` | merged into schedule_shift | `workspace` | 26 |
| 14 | `🗓️record` | `shift_time_entry` (new) with `kind ∈ {workTime, break, meal}` | `🏰 lookup` | 41 |
| 15 | `⏱️swaprecord` | `schedule_swap` (D6, pending only) | `🏰 Workspace` | 19 |

Note: `🗓️record` migrates FULL history — it is the payroll worktime source
of truth, not just recent weeks.

## Out of scope (by tier)

- **Tier 3 (rebuild from K1a):** `⏱️salary_rule`, `🔥timeperiod_rule`,
  `🕹️timerule`, `🕹️ruletemplate`, `🕹️⏱️punchclock_rules`, `⏱️basesalary`,
  `⏱️salary_type(supplement)`, `⏱️shifttype_modifyer`. Rules are sourced
  from industry packages (Riksavtalen etc.) via K1a, not migrated.
- **Tier 4 (drop):** ~79 types including Stripe, gamification, hospitality
  inventory, chat, notifications, payroll history, activity logs,
  `⏱️employee_accounts`, all `🚫`-suffix deprecated types.
- **Tier 2 (defer to phase 4):** `handbook` tree, `🎎training`,
  `🍾controllist`, `task`/`subtask`. Migrated later once Tier 1 cutover is
  proven.

## Steps

### 1. Update entity registry

Rewrite `src/entities.ts` to reflect the live meta findings:

- 14 Tier 1 types with exact `bubbleType` (including emoji prefixes)
- `workspaceFieldKey` set to the **display name** of the workspace-link
  field as it exists in Bubble today (e.g. `"🏰 lookup"`, `"🏰 Workspace"`,
  `"workspace"`). Bubble constraints use display names.
- Remove types moved to Tier 3/4
- Add inline comments citing the 2026-04-15 meta-scan source

**Exit:** typecheck clean, existing tests pass.

### 2. Write ADR-0002: incremental migration

File: `docs/superpowers/decisions/0002-incremental-migration.md`

Content:
- **Problem:** customers stay live in Bubble for days/weeks between initial
  migration and final cutover. New shifts/time records/swaps accumulate in
  Bubble that must land in v3 without disturbing previously migrated rows.
- **Decision:** watermark-based delta migration for append-heavy entities
  (`shift`, `shift_satellite`, `🗓️record`, `⏱️swaprecord`). Identity and
  structure entities (workspace, location, department, profile, etc.) are
  one-shot — treat "new record after cutover" as an operational signal,
  not a migration concern.
- **Mechanism:**
  1. After every migration run, write
     `supabase/migration-staging/<slug>/watermark.json` recording the
     max `Modified Date` seen per entity.
  2. `migrate_<entity> --since=<iso>` adds
     `Modified Date >= <iso>` as a Bubble constraint.
  3. Generated SQL uses `INSERT ... ON CONFLICT (id) DO NOTHING` for
     append-heavy entities so re-runs are idempotent. Deterministic
     UUIDv5 guarantees stable keys.
  4. Identity entities stay on `INSERT` without `ON CONFLICT` so
     duplicate attempts fail loudly — that is the safety rail we want.
- **Safety model unchanged:** still dry-run only, still staging directory,
  still no write capability against Supabase.

### 3. Commit entity registry + ADR

Two atomic commits on `main` in `~/dev/strike-mcp`:

- `feat(entities): rewrite registry for Tier 1 live-meta alignment (2026-04-15)`
- `docs(adr-0002): incremental migration via watermark + ON CONFLICT`

Verify `pnpm typecheck && pnpm test` before each commit.

### 4. Research each Tier 1 entity against Wrightegaarden

For each of the 14 types:
1. Sample first 50 + last 50 records filtered by workspace lookup
2. Compute field coverage, types, sample values
3. Write `mappings/<entity>.json` (redacted samples)
4. Write `mappings/.local/<entity>.sidecar.json` (raw PII, gitignored)
5. Write `~/dev/second-brain-v2/wiki/migration/bubble-shapes/<entity>.md`
   narrative
6. Log to `~/dev/strike-mcp/history/decisions.jsonl` per field

Environment for research:
```bash
STRIKE_WORKSPACE_SLUG=wrightegaarden
STRIKE_HISTORY_DIR=~/dev/strike-mcp/history
```

Expected new mapping files beyond existing ones:
`company.json`, `employment_profile.json`, `employment_contract.json`,
`employee_type.json`, `record.json`, `swaprecord.json`.

### 5. Review mappings and set target_table

Per entity, in dependency order:

```
workspace → company → location → department → team
  → user → profile → employment_profile → employment_contract → employee_type
  → invitation → shift → shift_satellite → swaprecord → record
```

Each review session runs:
```bash
STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/review_mapping.ts --entity=<name>
```

Every decision (target_table_set, field_approved, field_dropped with
reason, field_renamed, field_review_deferred, mapping_committed) lands in
`decisions.jsonl` via the integration built in commits a2c65fc / 880c77a.

**Hard blockers to resolve during review:**
- `🗓️record` has NO direct v3 target table yet — a migration is needed in
  `smartout.ai/supabase/migrations/` to create `shift_time_entry` with
  `kind` enum. Open question: block this plan on that migration, or
  generate strike-mcp staging SQL that creates the table too.
- `⏱️employment_profile` + `⏱️employment_contract` — one v3 table or two?
  Decide during review by reading both mappings side by side.
- `user` vs `profile` — v3 splits into `user_identity` (auth) + `profile`
  (HR). Bubble's `user` must become `user_identity`, and `profile` stays
  as `profile`. Employment fields must NOT land in `profile` — they go on
  `employment_contract`.

### 6. Generate SQL + verify against local Supabase

Per entity, in the same dependency order, emit SQL:

```bash
STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/migrate_entity.ts \
  --entity=workspace --workspace=1683059156689x546199168715701950
```

Then bundle and verify:

```bash
pnpm tsx scripts/bundle_migration.ts --slug=wrightegaarden
pnpm tsx scripts/preview_sql.ts --slug=wrightegaarden
```

Apply to a freshly-booted local Supabase:

```bash
# in smartout.ai
supabase db reset     # clean slate
psql "$LOCAL_SUPABASE_URL" -f ~/dev/strike-mcp/supabase/migration-staging/wrightegaarden/bundled.sql
```

Verification queries per entity:
- `SELECT count(*) FROM workspace WHERE slug = 'wrightegaarden'` → 1
- `SELECT count(*) FROM location WHERE workspace_id = '<uuid>'` → matches
  Bubble inspect count
- `SELECT count(*) FROM schedule_shift WHERE workspace_id = '<uuid>'` →
  matches Bubble shift count
- `SELECT kind, count(*) FROM shift_time_entry ... GROUP BY kind` →
  workTime/break/meal distribution matches sample
- `SELECT count(*) FROM shift_time_entry WHERE shift_id NOT IN
  (SELECT id FROM schedule_shift)` → 0 (FK integrity)

Document results in
`docs/superpowers/notes/wrightegaarden-phase3c-results.md`.

## Acceptance Criteria

- [ ] `src/entities.ts` lists exactly the 14 Tier 1 types with correct
  emojis and workspaceFieldKey display names
- [ ] ADR-0002 committed with watermark + ON CONFLICT design
- [ ] All 14 mappings have `target_table: <string>` and
  `needs_review: false` on every field
- [ ] `history/decisions.jsonl` contains at least 14 `mapping_committed`
  entries for workspace=`wrightegaarden`
- [ ] Bundled SQL applies cleanly to a fresh local Supabase
- [ ] Row counts in Supabase match Bubble inspect counts for every
  Tier 1 entity
- [ ] No FK violations across Tier 1 entities
- [ ] `🗓️record` rows split correctly by `kind` (workTime/break/meal)
- [ ] `pnpm turbo typecheck` clean in strike-mcp

## Out of scope for this plan

- Tier 2 migration (handbook tree, training, controllist, task) — follow-up
- Tier 3 framework rebuild from K1a — separate initiative
- Strøm Mat & Bar migration — follow-up using this as template
- Production Supabase cutover — only local verification here

## Risks

| Risk | Mitigation |
|---|---|
| v3 schema missing `shift_time_entry` table for `🗓️record` | Block step 6 on landing the migration in smartout.ai first; or emit `CREATE TABLE` in the bundle as a fallback |
| Multiple workspace-link fields on same type (e.g. `controllist`) | Pick the one of type `custom.workspace` (confirmed via meta `.type`) — ignore display-name heuristics alone |
| Bubble `version-test` drift mid-plan | Record meta schema_hash at step 4 and recheck at step 6; abort if drift detected |
| `user` vs `user_info`/`user_data`/`user_ai`/`user🔑access` fragmentation | Merge into `user_identity` + `profile` during transform; capture merge strategy in decision log |
| Deterministic UUIDv5 collisions across workspaces | Per-entity namespace already salts with entity name; verify uniqueness in step 6 SQL preview |

## Commands reference

```bash
# Environment
cd ~/dev/strike-mcp
set -a && source .env.local && set +a
export STRIKE_WORKSPACE_SLUG=wrightegaarden

# Research one entity
pnpm tsx scripts/run_discovery.ts --entity=record --workspace=1683059156689x546199168715701950

# Review
pnpm tsx scripts/review_mapping.ts --entity=record

# Migrate + bundle + preview
pnpm tsx scripts/migrate_entity.ts --entity=record --workspace=1683059156689x546199168715701950
pnpm tsx scripts/bundle_migration.ts --slug=wrightegaarden
pnpm tsx scripts/preview_sql.ts --slug=wrightegaarden

# Apply (local Supabase only)
psql "$LOCAL_SUPABASE_URL" -f supabase/migration-staging/wrightegaarden/bundled.sql
```
