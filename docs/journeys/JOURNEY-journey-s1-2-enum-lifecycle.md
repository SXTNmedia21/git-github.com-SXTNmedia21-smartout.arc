---
title: "Journey — S1.2 journey_version + enum lifecycle"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey, s1-2, m1, admin-flow]
---

# JOURNEY — journey_version Table + Status Enum Lifecycle

> **Sub-sortie:** S1.2 · **Campaign:** journey-engine · **Milestone:** M1.
>
> This sub-sortie is schema-only: no UI, no API, no capability call-sites. The journeys below describe what operators can do DIRECTLY against the table once the migrations land — they set the shape that later sub-sorties (S1.4 capabilities, M4 authoring UI) will surface.

---

## Journey A: Platform admin creates a journey version

**Role:** platform admin (godmode or workspace admin).
**Surface (direct DB today; web authoring surface in M4):** `INSERT INTO public.journey_version`.
**Precondition:** a `journey` row exists for the workspace the admin is scoped to. The `journey_version_status` enum exists (post-0a migration).

1. Admin identifies a target `journey_id` (e.g. from an admin listing of `journey` rows).
2. Admin issues `INSERT INTO journey_version (workspace_id, journey_id)` omitting `status` and `version_number`.
   - → System uses defaults: `status = 'draft'::journey_version_status`, `version_number = 1`.
   - → System generates `journey_version_id` via `gen_random_uuid()`.
   - → System stamps `created_at = now()`, `updated_at = now()`.
   - → Admin sees one new row via `RETURNING *`: a draft version pinned to the journey.
3. Admin iterates by inserting a SECOND version: `INSERT … (workspace_id, journey_id, version_number=2)`.
   - → `uq_journey_version_number` (workspace_id, journey_id, version_number) enforces monotonic versioning — inserting two v1s with the same (workspace_id, journey_id) fails with `23505 unique_violation`.

**Postcondition:** `journey_version` has one or more rows for this `journey_id`, all in `draft` status, discoverable via the `idx_journey_version_journey_id` index.

**Error paths:**
- `journey_id` does not exist → FK violation `23503 foreign_key_violation` (`journey_version_journey_id_fkey`).
- `workspace_id` does not exist → FK violation `23503 foreign_key_violation` (`journey_version_workspace_id_fkey`).
- Duplicate `(workspace_id, journey_id, version_number)` → `23505 unique_violation` on `uq_journey_version_number`.
- Admin lacks workspace membership → RLS filters row out on SELECT; INSERT blocked by `jwt_insert_journey_version` policy.

---

## Journey B: Platform admin reads journey versions

**Role:** platform admin or workspace member.
**Surface:** `SELECT FROM public.journey_version`.
**Precondition:** rows exist in `journey_version`; reader has a JWT resolving to the workspace via `get_workspace_ids_for_user(auth.uid())`, OR is using an API key scoped to the workspace.

1. Reader issues `SELECT * FROM journey_version WHERE journey_id = $1 ORDER BY version_number DESC`.
   - → System returns rows filtered by `jwt_select_journey_version` (JWT) or `api_key_read_journey_version` (API key).
   - → Latest version appears first (index `idx_journey_version_journey_id` is `DESC`).
2. Reader filters by status: `SELECT * FROM journey_version WHERE workspace_id = $1 AND status = 'draft'`.
   - → `idx_journey_version_workspace_status` backs the lookup.

**Postcondition:** Reader sees exactly the rows scoped to their workspace membership / API key binding. Rows in other workspaces are invisible.

**Error paths:**
- No JWT and no API key → RLS returns zero rows (policy evaluates to `NULL` → row excluded).
- Cross-workspace read attempt → no rows returned (no error — RLS is silent).

---

## Journey C: Platform admin promotes a journey version through the lifecycle

**Role:** platform admin.
**Surface:** `UPDATE public.journey_version SET status = … WHERE journey_version_id = …`.
**Precondition:** a draft `journey_version` exists.

1. Draft → ready_test: `UPDATE journey_version SET status = 'ready_test' WHERE journey_version_id = $1`.
   - → System permits (RLS `jwt_update_journey_version` checks workspace membership).
   - → `updated_at` is refreshed by `set_journey_version_updated_at` trigger.
   - → Admin sees `ready_test` on subsequent SELECT.
2. ready_test → testing → ready_publish → published: same mechanism per transition.
   - → Enum type guarantees every transition stores a valid label.
3. Admin archives at end-of-life: `UPDATE journey_version SET status = 'archived' WHERE journey_version_id = $1`.
   - → System accepts; lifecycle terminates.

**Postcondition:** `status` reflects the desired lifecycle label; `updated_at` is strictly greater than the previous `updated_at`.

**Error paths:**
- Invalid label (typo, e.g. `'publishd'`) → `22P02 invalid_text_representation` — rejected by the enum type.
- UPDATE on a row in a different workspace → RLS `jwt_update_journey_version` filters the row out; `UPDATE` returns `0 rows`.
- Concurrent update race → last writer wins; no optimistic locking at this layer (M4 may add a `version` integer optimistic-concurrency column).

---

## Journey D: Dev operator rolls back migration 0b in a branch worktree

**Role:** dev (running `supabase db reset` on a worktree branch).
**Surface:** migration files + `npx supabase db reset`.
**Precondition:** a migration-3 (0b flip) has landed locally and the developer needs to unflip for testing.

1. Dev reads the ROLLBACK block in `20260516000200_journey_version_status_0b_enum.sql`:
   ```sql
   ALTER TABLE public.journey_version ALTER COLUMN status DROP DEFAULT;
   ALTER TABLE public.journey_version ALTER COLUMN status TYPE text USING status::text;
   ALTER TABLE public.journey_version ALTER COLUMN status SET DEFAULT 'draft';
   ```
2. Dev applies it manually via `psql` (not as a migration) — the rollback block is documented, not executed.
3. Dev re-runs migrations if/when the flip is desired again.

**Postcondition:** `journey_version.status` is back to `text`, the enum type may or may not still exist (0a rollback is a separate `DROP TYPE`).

**Error paths:**
- Dev forgets `DROP DEFAULT` first → `ALTER COLUMN TYPE` complains about the default value not castable. Fix: drop default, then alter type.
- Dev has data outside the enum domain in a later sub-sortie (unlikely for fresh table) → `ALTER COLUMN TYPE … USING status::text` is safe in this direction (enum → text); the reverse would need backfill validation which migration 3 already implements.

---

## Notes on scope

- Journeys above describe what the table enables. The actual admin authoring UI (forms, buttons, inline status transitions) is M4 work and not covered here.
- Runtime "agent-guided" journeys (`journey.run_guided`) are not about the `journey_version` table directly — they consume a published mission in `engine_missions`, which is populated by the `journey.publish_mission` capability (S1.4).
- Dev-run journeys (`journey.run_dev`, Playwright) also consume `journey_version.ir_json` via the IR package (M2).
