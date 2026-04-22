---
title: "Handoff — S1.2 journey_version table + enum 0a/0b/0c"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [handoff, s1-2, m1, migrations, enum-lifecycle, adr-0172]
---

# HANDOFF — S1.2 journey_version Table + Enum Lifecycle

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.2
> **Branch:** `feat/journey-engine-journey-s1-2-enum-lifecycle` (based on `campaign/journey-engine`, tip `f6be5ca1`)
> **Brief:** `docs/superpowers/plans/2026-04-22-s1-2-journey-version-enum.md`
> **Predecessor:** S1.1 (merged `05b827b1`)
> **Trust-Gate Unblock closed:** #2 (enum lifecycle migration per ADR-0172)

## Summary

S1.2 creates the `journey_version` table (the canonical store for versioned JourneyIR payloads) and introduces the new `journey_version_status` enum via the L-0075 0a/0b/0c atomicity pattern. Shipping four rollback-safe migrations instead of one:

1. Create the table with `status text NOT NULL DEFAULT 'draft'` — no enum yet.
2. `CREATE TYPE journey_version_status` with six values — no column touched.
3. Validate backfill, drop text default, flip column type to enum.
4. Re-assert `NOT NULL`, set enum-typed default.

The sub-sortie is schema-only. No authority rows, no capabilities, no telemetry call-sites — those land in S1.3 and S1.4 respectively.

### What changed

**Migrations (4 new files in `supabase/migrations/`):**

- `20260516000000_journey_version_table.sql` — table, trigger, indexes (2), RLS (6 policies), comments.
- `20260516000100_journey_version_status_0a_widen.sql` — `journey_version_status` enum type with 6 values.
- `20260516000200_journey_version_status_0b_enum.sql` — backfill-validation `DO $$` block, drop text default, `ALTER COLUMN status TYPE … USING …::journey_version_status`.
- `20260516000300_journey_version_status_0c_tighten.sql` — re-assert `NOT NULL`, set enum-typed default `'draft'::journey_version_status`.

**Generated types (1 file):**

- `packages/supabase/src/database.types.ts` — regenerated via `npx supabase gen types typescript --local`. `journey_version` row type + `journey_version_status` enum both appear. Typecheck passes across all 33 workspace packages.

**Docs:**

- `docs/HANDOFF-journey-s1-2-enum-lifecycle.md` (this file).
- `docs/journeys/JOURNEY-journey-s1-2-enum-lifecycle.md`.
- `docs/decisions/0000-decision-log.md` — ADR-0172 landing note.

### What did NOT change (out of scope — per brief)

- `engine_authority_config` seed — S1.3.
- `packages/ai/src/capabilities/journey/` skeletons — S1.4.
- `journey_status` enum — untouched (ADR-0172 hard prohibition).
- `journey_event`, `engine_missions` — untouched.
- No Edge Functions added.

## Decisions (new this sub-sortie)

### D1. Table-first-with-text, not widen-existing-enum-column

**Context.** Two design paths existed for the `status` column:

a) Create the table with `status public.journey_version_status NOT NULL DEFAULT 'draft'` in a single migration that also `CREATE TYPE`s the enum.
b) Create the table with `status text NOT NULL DEFAULT 'draft'`, then in later migrations introduce the enum and flip the column type.

Path (a) compresses four migrations into one but bundles three distinct invariants (type creation + column type + constraint) into one change-set. Path (b) is the L-0075 0a/0b/0c pattern: each migration is independently rollback-safe and debuggable.

**Decision.** Path (b). The brief explicitly requires the 0a/0b/0c pattern even on a fresh table, for three reasons:

1. **Doctrine consistency.** L-0075 is written as "the pattern" — making fresh tables exempt breeds special cases. Future enum additions (e.g., adding `cancelled` to `journey_version_status`) can reuse this same 4-step shape without retrofitting.
2. **Rollback granularity.** If migration 3 (the flip) fails on a teammate's branch, the rollback is `DROP TYPE` + revert — the table stays intact. Bundled into one migration, any failure leaves nothing to inspect.
3. **Council traceability.** Supervisor's Gate A A-3 concern ("migration 1 status column type disambiguation") directly maps to separating type creation from column flip. Satisfying the advisory gives us a cleaner council audit trail for the v1.7.0 spec.

**Consequence.** 4 migration files, not 1. Each has a rollback comment block and a risk level in its header. Migration 3 includes a `DO $$` validation block that raises if a row is not in the enum domain — belt-and-braces for future backfill scenarios.

### D2. Separate enum `journey_version_status`, not widening `journey_status`

**Context.** The pre-existing `journey_status` enum (from `20260301140000_journey_system.sql`) already has a `ready_test` label — but for a different semantic (dev-tracking lifecycle of the parent `journey` row, not version lifecycle of a specific IR snapshot). Reusing `journey_status` would collide on meaning; widening it would conflate two concerns.

**Decision.** Create a brand-new enum `journey_version_status` with its own 6-value domain. This is literally what ADR-0172 mandates; mentioned here for the handoff-as-audit-trail.

**Consequence.** Two enums co-exist (`journey_status`, `journey_version_status`). The campaign CLAUDE.md explicitly forbids `ALTER TYPE journey_status ADD VALUE` — we don't touch the sibling enum. `grep -R "journey_status ADD VALUE" supabase/migrations/` returns zero results (verified).

### D3. `created_by uuid` without FK

**Context.** The brief says `created_by uuid` with no FK "consistent with other create_by columns in repo". Verified against the existing `journey` table (`20260301140000_journey_system.sql` line 96 — `created_by uuid REFERENCES user_identity(user_id)`) — actually, the `journey` table DOES FK `created_by`.

**Decision.** Follow the brief literally: `created_by uuid` without FK. Rationale: the pre-existing sibling does FK, but newer tables in the repo (e.g., `season_goal.created_by` → `profile(profile_id)`, `planning_cycle.created_by` → `profile(profile_id)`) FK to `profile`, not `user_identity`. The brief defers the FK decision to avoid prejudging the journey-authoring actor model — `packages/ai/src/capabilities/journey/` (S1.4) has not yet defined whether `created_by` is a user or a profile. Adding the FK now risks a later backfill; adding it when S1.4 settles is cheap.

**Consequence.** `created_by` is a free-form UUID until S1.4. Risk: orphan references. Mitigation: write path in S1.4 must resolve `created_by` from an authenticated session (JWT or service actor) and will reject null.

### D4. RLS shape — per-op JWT + API-key-read + service-role

**Context.** Two RLS conventions exist in the repo: (a) compact (`FOR ALL USING (is_admin_in_workspace(...))` — `season_goal`) and (b) expanded per-op (`FOR SELECT / FOR INSERT / FOR UPDATE / FOR DELETE` — `planning_cycle`, `department_operating_hours`).

**Decision.** Use shape (b) — per-op JWT policies — plus API-key read-only plus a service-role catch-all. This matches the cascade-era tables (most recent convention) and makes it trivial to tighten individual ops later without ripping up a catch-all `FOR ALL`.

**Consequence.** Six policies on `journey_version`: four JWT (select/insert/update/delete), one API-key read, one service-role all. No `is_admin_in_workspace` gate — the brief does not require admin-only authoring, and the parent `journey` table already uses simple workspace-membership RLS (godmode + workspace_read). Narrowing to admin-only can be a later hardening pass when the authoring surface in M4 clarifies who may create versions.

## Learnings (new this sub-sortie)

### L-S1.2-a. `npx supabase gen types typescript --local` leaks stderr-like lines into stdout

**Symptom.** `npx supabase gen types typescript --local > database.types.ts` produced a file whose first 4 lines were `npm warn Unknown project config "public-hoist-pattern"`, `WARN: environment variable is unset: SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, and `Connecting to db 5432` before the actual `export type Json = …`. Typecheck then failed with 18 TS1005 / TS1434 errors in `@smartout/supabase`.

**Root cause.** Either the supabase CLI prints connection info to stdout, or npm's deprecation warning routes through stdout in this shell/pnpm config. stdout redirection inherited them.

**Fix.** `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts`. Redirecting stderr to `/dev/null` drops the noise. (Belt-and-braces: if supabase CLI is the one polluting stdout, a future pattern could be `| grep -vE "^(npm|WARN|Connecting)"` but stderr-redirect was sufficient today.)

**Worth logging.** Yes — first instinct on TS1005 was to blame my SQL. It was a tooling artefact. The type generation step in any future close-feature script for this repo should use `2>/dev/null` to avoid polluting the committed types file.

### L-S1.2-b. Fresh Supabase reset does seed `journey` rows

**Symptom.** Brief said "if `journey` table has zero rows, create one via INSERT first" — hedging for an empty seed. Actual `supabase db reset` left three `journey` rows seeded, so sanity INSERTs worked without extra setup.

**Worth logging.** Minor, but useful for future sub-sorties: the seed pipeline (`supabase/seed.sql` + any migration-embedded seeds) does populate `journey`. Future fresh-table sanity tests should verify what's seeded before creating bypass rows.

## Verification outputs (all 7 gates)

All run from `/home/sxtnl/dev/smartout.ai-journey-engine-wt-2` on branch `feat/journey-engine-journey-s1-2-enum-lifecycle`.

### Gate 1 — Migrations present, all timestamps strictly > `20260515160000`

```
$ ls -1 supabase/migrations/ | sort | tail -10
20260515140000_invitation_opened_at_and_partial_unique_pending.sql
20260515140100_track_invitation_opened_rpc.sql
20260515140200_get_invitation_by_token_add_workspace_slug.sql
20260515150000_channel_message_pii_columns.sql
20260515160000_channel_helpdesk_backfill.sql
20260516000000_journey_version_table.sql
20260516000100_journey_version_status_0a_widen.sql
20260516000200_journey_version_status_0b_enum.sql
20260516000300_journey_version_status_0c_tighten.sql
rollback
```

All four new migrations present; all `> 20260515160000`.

### Gate 2 — `grep -R "journey_status ADD VALUE" supabase/migrations/`

```
(no output — 0 matches)
```

### Gate 3 — `npx supabase db reset` — last 20 lines

```
Applying migration 20260516000000_journey_version_table.sql...
Applying migration 20260516000100_journey_version_status_0a_widen.sql...
Applying migration 20260516000200_journey_version_status_0b_enum.sql...
Applying migration 20260516000300_journey_version_status_0c_tighten.sql...
Seeding data from supabase/seed.sql...
[…push-dispatch notices elided…]
Restarting containers...
Bucket avatars already exists. Do you want to overwrite its properties? [Y/n]
Updating Storage bucket: avatars
Creating Storage bucket: settlements
Bucket setup-documents already exists. Do you want to overwrite its properties? [Y/n]
Updating Storage bucket: setup-documents
Bucket contract-attachments already exists. Do you want to overwrite its properties? [Y/n]
Updating Storage bucket: contract-attachments
Finished supabase db reset on branch main.
```

All 4 migrations applied cleanly; reset completed.

### Gate 4 — `npx supabase db diff --schema public --local`

```
Finished supabase db diff on branch main.

No schema changes found
```

Schema matches migrations — zero drift.

### Gate 5 — `pnpm turbo typecheck` — last 10 lines

```
web:typecheck:
web:typecheck: > web@0.1.0 typecheck /home/sxtnl/dev/smartout.ai-journey-engine-wt-2/apps/web
web:typecheck: > tsc --noEmit
web:typecheck:

 Tasks:    33 successful, 33 total
Cached:    15 cached, 33 total
  Time:    1m58.303s

 WARNING  no output files found for task @smartout/supabase#build. Please check your `outputs` key in `turbo.json`
```

33 / 33 tasks successful. Zero type errors. The `no output files` warning is a turbo config note unrelated to this sub-sortie.

### Gate 6 — Sanity INSERTs via `psql`

```
--- TEST 1: INSERT status=draft ---
          journey_version_id          | status | version_number
--------------------------------------+--------+----------------
 e766db3f-a478-4137-be1d-f567f723fc2b | draft  |              1
(1 row)
INSERT 0 1

--- TEST 2: INSERT default status (omit) ---
          journey_version_id          | status | version_number
--------------------------------------+--------+----------------
 6968c5e0-011e-4320-96bf-e3e681531348 | draft  |              2
(1 row)
INSERT 0 1

--- TEST 3: INSERT status=bogus must fail ---
NOTICE:  SANITY OK: bogus rejected (invalid_text_representation)

--- Row count ---
 total
-------
     2

--- Enum labels ---
   enumlabel
---------------
 draft
 ready_test
 testing
 ready_publish
 published
 archived
(6 rows)
```

Positive paths (draft literal + default) succeed. Negative path (bogus) rejected with `invalid_text_representation` as expected. Enum has exactly 6 values in correct sort order.

### Gate 7 — Types regeneration

```
$ grep -c "journey_version" packages/supabase/src/database.types.ts
12
$ grep -c "journey_version_status" packages/supabase/src/database.types.ts
5
```

`journey_version` row type + `journey_version_status` enum both appear in the generated types. Typecheck (gate 5) validates they compile cleanly.

## Known issues / debt

- **`created_by` FK deferred** — see D3. Must be resolved when S1.4 settles the authoring-actor model.
- **JWT authoring policy is broad** — current RLS lets any workspace-member INSERT/UPDATE/DELETE `journey_version`. M4 authoring surface should narrow to admins/authors once that role shape settles.
- **`ir_json` is unstructured** — no schema validation at DB level. Shape will be defined by `packages/journey-ir` in M2; at that point a `CHECK` constraint or a validation trigger may be appropriate.
- **`updated_at` is `DEFAULT now()` only** — the BEFORE UPDATE trigger uses repo-standard `set_updated_at()`. No custom behaviour.

## Next steps

Per campaign roadmap, next sub-sortie is **S1.3 — `engine_authority_config` seed for 4 journey capabilities (ADR-0173, ADR-0176)**:

- Authority rows must be seeded via migration (not runtime), per ADR-0176.
- Four capabilities: `journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided`.
- Defaults per ADR-0173: first three `suggest`, last one `autonomous`.
- `read_only` + `gate_action` default-allow combo is BANNED (ADR-0176, L-0097) — every row must be explicit.
- Authority seed will reference `journey_version` (verified) and eventually the capability slugs (scaffolded in S1.4).

S1.3 can start immediately — this sub-sortie does not block it, since authority rows do not need capability code to exist, only the slug strings.

## Commits in this sub-sortie (newest → oldest)

- `fe8a83f5` — chore(database): regenerate types for journey_version + journey_version_status (S1.2)
- `e1bbaf70` — feat(database): journey_version table + journey_version_status enum via 0a/0b/0c (S1.2, ADR-0172)
