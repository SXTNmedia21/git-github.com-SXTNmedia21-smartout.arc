---
title: "S1.2 Sub-Sortie Brief — journey_version table + status enum 0a/0b/0c"
status: approved
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [sub-sortie, m1, migrations, enum-lifecycle]
---

# S1.2 — journey_version table + `journey_version_status` enum lifecycle

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.2
> **Predecessor:** S1.1 (merged `05b827b1`)
> **Blocks:** S1.3 (authority seed cannot verify capability→journey mapping without this table)
> **Trust-Gate Unblock closed:** #2 (enum lifecycle migration)
> **Binding ADR:** 0172 (enum lifecycle, 0a/0b/0c pattern per L-0075)

---

## Goal

Create the `journey_version` table (fresh — does not exist today) and introduce the new `journey_version_status` enum via the L-0075 0a/0b/0c atomicity pattern. Resolves the ADR-0172 collision: the pre-existing `journey_status` enum already has a `ready_test` value used by unrelated `journey` table, so we cannot `ALTER TYPE journey_status ADD VALUE` — a separate enum is required.

## Why 4 migrations, not 1

L-0075 (enum 0a/0b/0c atomicity): introducing a new enum that a real table uses is not a single-migration operation. Widening → backfill → tightening is three discrete steps, each rollback-safe. Combined with the table creation that hosts the column, this sub-sortie ships 4 cohesive migrations:

1. **Create `journey_version` table** with `status` column typed as `text` (not enum yet). This sidesteps L-0075 entirely — the enum doesn't exist at table birth, so there's no widen-from-enum problem.
2. **Introduce `journey_version_status` enum type** with the full value list. No column type change yet.
3. **Backfill any rows** + flip the column type from `text` to `journey_version_status` using `USING status::journey_version_status`.
4. **Tighten: add NOT NULL + default** on the `status` column.

This resolves Supervisor's "migration 1 status column type disambiguation" concern (Gate A advisory A-3): migration 1 is explicit-`text`, migration 2 introduces the enum as a new type (no column touched), migration 3 flips the column type in-place, migration 4 adds constraints.

## Scope — exactly what lands

### M1 Migration sequence (timestamps must be strictly > `20260515160000`)

| Timestamp | File | Content |
|---|---|---|
| `20260516000000` | `journey_version_table.sql` | `CREATE TABLE journey_version` with all columns. `status text NOT NULL DEFAULT 'draft'`. Plus `workspace_id` FK, `journey_id` FK (if `journey` table exists — verify first), RLS (JWT + API key), `created_at`/`updated_at` triggers, UUID PK. |
| `20260516000100` | `journey_version_status_0a_widen.sql` | `CREATE TYPE journey_version_status AS ENUM (...)`. Values per ADR-0172: `draft`, `ready_test`, `testing`, `ready_publish`, `published`, `archived` (6 states). Do NOT touch `journey_version.status` column yet. |
| `20260516000200` | `journey_version_status_0b_enum.sql` | Backfill validation: all `journey_version.status` values are in the enum domain (via sentinel `SELECT` that raises on mismatch). Then `ALTER TABLE journey_version ALTER COLUMN status TYPE journey_version_status USING status::journey_version_status`. Drop the text default temporarily; re-add after tighten. |
| `20260516000300` | `journey_version_status_0c_tighten.sql` | `ALTER TABLE journey_version ALTER COLUMN status SET NOT NULL` (already NOT NULL from migration 1 but re-assert is idempotent). `ALTER TABLE journey_version ALTER COLUMN status SET DEFAULT 'draft'::journey_version_status`. |

> **Verify migration tip before writing:** `ls -1 supabase/migrations/ | tail -5` should show `20260515160000` as latest. If ANY newer migration has landed on campaign since S1.1, adjust base timestamps to be strictly greater than whatever is latest, maintaining the 4-step sequence with `000000`/`000100`/`000200`/`000300` spacing.

### Table schema requirements (migration 1)

Required columns per project CLAUDE.md hard-rules + ADR-0172:

- `journey_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `workspace_id uuid NOT NULL REFERENCES workspace(workspace_id)`
- `journey_id uuid NOT NULL REFERENCES journey(journey_id)` **IF** `journey` table exists — verify via `grep "CREATE TABLE journey" supabase/migrations/`. If it doesn't, `journey_id uuid NOT NULL` with no FK and document the deferred constraint in the migration header.
- `version_number int NOT NULL DEFAULT 1` — monotonic per `journey_id`
- `status text NOT NULL DEFAULT 'draft'` — enum flip happens in migration 3
- `ir_json jsonb` — placeholder for JourneyIR payload (package lands in M2; column exists now so the table is usable post-M2 without another migration)
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()` — with BEFORE UPDATE trigger `handle_updated_at()` (standard project pattern)
- `created_by uuid` (no FK — consistent with other create_by columns in repo)
- Unique constraint `(workspace_id, journey_id, version_number)`

### RLS policies (migration 1)

Both JWT and API key, per project hard-rule:

- `journey_version_workspace_jwt_select` — `current_workspace_id() = workspace_id`
- `journey_version_workspace_jwt_insert` — `current_workspace_id() = workspace_id`
- `journey_version_workspace_jwt_update` — `current_workspace_id() = workspace_id`
- `journey_version_workspace_jwt_delete` — `current_workspace_id() = workspace_id`
- `journey_version_api_key_*` — parallel set using `current_setting('app.workspace_id')::uuid = workspace_id` (verify pattern against existing tables like `engine_missions` or `journey_event`)

### Indexes (migration 1)

- `idx_journey_version_journey_id` on `(journey_id, version_number DESC)` — latest-version lookup
- `idx_journey_version_workspace_status` on `(workspace_id, status)` — admin filter

### Rollback paths (Supervisor Gate A concern A-1)

Each migration includes a `-- ROLLBACK:` comment block at the top with the inverse SQL. Not a separate file — documented intent. Example for migration 3:

```sql
-- ROLLBACK (for reference, not auto-executed):
--   ALTER TABLE journey_version ALTER COLUMN status TYPE text USING status::text;
--   ALTER TABLE journey_version ALTER COLUMN status SET DEFAULT 'draft';
```

This satisfies L-0075 rollback-documentation without adding `0d-rollback` migrations.

## Out of scope

- **DO NOT** seed `engine_authority_config` rows — that's S1.3.
- **DO NOT** create `packages/ai/src/capabilities/journey/` — that's S1.4.
- **DO NOT** alter `journey_status` enum in any way (ADR-0172 hard prohibition).
- **DO NOT** create `journey_event` table (it already exists from `20260301140000_journey_system.sql`).
- **DO NOT** touch the `engine_missions` table.
- **DO NOT** deploy anywhere — migrations land on campaign branch, pushed but not applied to preview/prod.

## Acceptance criteria (exit gates)

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] Local Supabase applies migrations cleanly: `npx supabase db reset` completes without error
- [ ] Generated types refresh: `npx supabase gen types typescript` shows `journey_version` table + `journey_version_status` enum
- [ ] `grep -R "journey_status ADD VALUE" supabase/migrations/` returns 0 results
- [ ] Migration timestamps are all > `20260515160000` (verify with `ls -1 supabase/migrations/ | sort | tail -8`)
- [ ] All 4 migrations have rollback comment blocks
- [ ] All 4 migrations have YAML-style header comment with: purpose, ADR reference, rollback, risk level
- [ ] Sanity test: `INSERT INTO journey_version (workspace_id, journey_id, status) VALUES (...)` with `status='draft'` succeeds; with `status='bogus'` fails post-migration-3
- [ ] Handoff at `docs/HANDOFF-journey-s1-2-enum.md` with decisions (especially migration-1 text-not-enum rationale) + learnings
- [ ] User journey doc at `docs/journeys/JOURNEY-journey-s1-2-enum.md` — admin creates a journey version, reads it, updates status, archives it
- [ ] Decision log entry: "ADR-0172 landed — `journey_version_status` enum introduced via 4-migration lifecycle (table-first with text, enum-introduce, column-flip, tighten)."

## Dispatch

Single build subagent implements and returns handoff. No Council re-review unless migrations collide with something on campaign that didn't exist at S1.1 time.
