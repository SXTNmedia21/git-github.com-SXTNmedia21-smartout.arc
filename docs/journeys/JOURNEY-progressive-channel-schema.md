---
title: Journey — Progressive Channel Phase 1A.1 Schema
status: in_progress
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [journey, helpdesk-channel, phase-1a1, dev-facing, schema]
---

# Journey — Progressive Channel Phase 1A.1 Schema

> Dev-facing journeys. Phase 1A.1 is schema-only additive with no UX changes,
> so journeys are infrastructure-consumer flows: migration apply, mock replacement,
> and regression soak.
>
> End-user journeys (admin upgrading a channel, rep using Min kø, etc.) land with
> Phase 1A.2 UI cutover and are documented there.

---

## Journey: Dev applies Progressive Channel schema to local Supabase

**Precondition:** Supabase local is running (`npx supabase status` shows all services up). Latest committed migration is `20260515130400_helpdesk_rls_and_thread_enum.sql`.

1. Dev pulls `feat/helpdesk-progressive-channel-schema` branch into local worktree → sees new migration `20260515135959_channel_progressive_flags.sql`.
2. Dev runs `npx supabase migration up --local` → migration applies without error.
3. System adds to `public.channel`:
   - `helpdesk_enabled boolean NOT NULL DEFAULT false` (existing rows get `false`)
   - `privacy_mode channel_privacy_mode NULL` (existing rows get `NULL`)
   - CHECK `channel_helpdesk_requires_responsible` as NOT VALID
   - CHECK `channel_private_requires_helpdesk` as NOT VALID
   - Partial index `idx_channel_helpdesk_responsible` on `(responsible_profile_id, workspace_id) WHERE helpdesk_enabled = true`
4. System creates enum type `public.channel_privacy_mode` with values `'public'`, `'private_per_requester'`.
5. System narrows `channel_jwt_insert` and `channel_jwt_update` RLS policies: `helpdesk_enabled=true` requires workspace admin (via `is_admin_in_workspace(auth.uid(), workspace_id)`). Service role unaffected.
6. Dev regenerates types: `pnpm db:gen-types` → `packages/supabase/src/database.types.ts` now includes `helpdesk_enabled`, `privacy_mode`, `channel_privacy_mode` enum.
7. Dev verifies via docker exec: columns exist, enum has 2 values, 3 CHECKs present (old validated, two new NOT VALID), policies show narrowed WITH CHECK.

**Postcondition:** Local Supabase has Progressive Channel schema applied. All existing Phase 1 behaviors (desk creation via `openTicket`, ticket assignment, resolution) unchanged because:
- Old CHECK `channel_desk_requires_responsible` still active
- `channel_type='desk'` rows untouched (legacy enum value retained)
- New CHECKs are NOT VALID until Phase 1A.2 backfill

**Error paths:**
- Migration fails on a workspace where existing `channel_type='desk'` rows have `responsible_profile_id = NULL` → will fail at 1A.2 VALIDATE, not here. In 1A.1 the new CHECKs are NOT VALID so no row scan.
- JWT INSERT attempt with `helpdesk_enabled=true` via anon key from a non-admin user → rejected by narrowed RLS with standard Postgres permission error.
- Enum type creation fails if `channel_privacy_mode` somehow already exists → idempotent `CREATE TYPE` is not used; migration would fail loudly. Check for collision via `psql ... -c "SELECT * FROM pg_type WHERE typname='channel_privacy_mode'"` before re-applying.

---

## Journey: Dev replaces chainable-proxy Supabase mock with Zod-validated stub (L-0087 ship-block)

**Precondition:** Capability test files use the old echo-proxy mock at `packages/ai/src/capabilities/helpdesk_query/__tests__/tools.test.ts:24-56` (local `chainable()` helper). The mock returns any column name blindly — L-0081's trap.

1. Dev creates new shared helper at `packages/ai/src/capabilities/__tests__/supabase-mock.ts` exporting `mockSupabase(tables)` → returns a chainable stub that validates column names against per-table Zod schemas.
2. System's `.select('col1, col2, ...')` call validates each column against `TABLE_SCHEMAS[table]`. Unknown columns throw `supabase-mock: unknown column 'X' on table 'Y'. Known columns: ...`.
3. System's `.insert({...})` and `.update({...})` calls validate every key in the row shape. Unknown keys throw `supabase-mock: insert on 'Y' with unknown column 'X'`.
4. Dev ports `helpdesk_query/__tests__/tools.test.ts` to import `mockSupabase` from the shared helper. Removes local `chainable` and `mockSupabase` definitions.
5. Dev updates all 14 existing test cases to use the new API (particularly `channel: [first_call_result, second_call_result]` for multi-call tables).
6. Dev adds 3 new regression-guard tests in a new `describe("supabase-mock schema validation (L-0087 guard)", ...)` block:
   - Select with unknown column throws
   - Insert with unknown column throws
   - Insert with new ADR-0165 columns (`helpdesk_enabled`, `privacy_mode`) succeeds
7. Dev runs `pnpm --filter @smartout/ai test -- tools.test` → all 17 tests pass (14 original + 3 new).
8. Dev runs `pnpm --filter @smartout/ai typecheck` → passes.

**Postcondition:** L-0087 trap closed for helpdesk_query tests. Any future migration adding a column must update `TABLE_SCHEMAS` in the same PR, or tests will throw loudly. Other capability tests (contract-intake, shift-lifecycle, etc.) can adopt the shared helper incrementally.

**Error paths:**
- Dev forgets to add a new column to `TABLE_SCHEMAS` after migration → tests referencing that column throw at runtime with a clear error naming the missing column. Dev adds the schema entry and re-runs.
- Dev uses a column-name string that's actually a Postgrest nested-relation form (e.g. `responsible:profile!fkey(profile_id, display_name)`) → the mock strips nested forms before validation, so the top-level column (here `responsible`) is checked, not the nested columns. If the top-level alias isn't in schema, throw. Trade-off: we don't validate nested-relation columns; acceptable because tests rarely mock them deeply.
- Terminal await without `.single()` / `.maybeSingle()` — the proxy's `.then` returns the same result via Promise resolution, preserving the existing terminal-await pattern.

---

## Journey: 48h staging soak verifies no Phase 1 regressions

**Precondition:** Phase 1A.1 merged to `campaign/helpdesk` and deployed to staging. Phase 1 helpdesk is live with existing desks (`channel_type='desk'` rows).

1. Existing admin opens `/dashboard/komm/desks` → sees existing desks listed, can still create new ones via old flow (which writes `channel_type='desk'` + `responsible_profile_id`).
2. Existing rep resolves tickets via Min kø (Phase 1 version using `/dashboard/komm/thread/[channelId]`) → `completed_at` stamped per L-0079 → `helpdesk.query.resolved` emitted → projection trigger fans to `channel_event`.
3. Mobile queue tab (`(queue)/index.tsx`) continues to work unchanged → reps read+reply+resolve without crashes.
4. `openTicket` capability tool (via Botsson chat) continues to work → creates `channel_type='query_thread'` + `engine_state(entity_id=thread.id)` unchanged.
5. At 48h mark: dev reviews:
   - Error rate on `helpdesk.*` capabilities (should be ≤ baseline)
   - RLS violation logs (should only show explicit rogue-helpdesk attempts, if any — those are the Supervisor F4 attack vector being successfully blocked)
   - Migration-applied state on staging DB (columns present, CHECKs NOT VALID, policies narrowed)
6. Soak passes → Phase 1A.2 sub-sortie unblocked.

**Postcondition:** Phase 1 behaviors unchanged. No data corruption. No user-facing regressions. Phase 1A.2 can proceed to backfill + UI cutover.

**Error paths:**
- Rep reports "I can't create a new desk" → investigate: likely RLS narrowing accidentally blocked legitimate admin path. Roll back via rollback migration (`supabase/migrations/rollback/20260515140000_*.sql`). Diagnose. Re-ship.
- Capability tool throws "unknown column 'privacy_mode' on channel" on read path → means somewhere on dev side the tool was updated to read the new column but staging hadn't applied the migration. Should not happen (Phase 1A.1 migration ships first) but diagnose migration order if it does.
- Unexpected row count on `pg_policy WHERE polname LIKE 'channel%'` → verify DROP POLICY + CREATE POLICY ran atomically. If not, run rollback and re-apply.

---

## Not in scope for Phase 1A.1

- Backfill `UPDATE channel SET helpdesk_enabled=true WHERE channel_type='desk'` — Phase 1A.2
- VALIDATE the new CHECKs — Phase 1A.2
- DROP old CHECK `channel_desk_requires_responsible` — Phase 1A.2
- DELETE `/dashboard/komm/desks` page — Phase 1A.2
- Min kø aggregation UI — Phase 1A.2
- Mobile route migration `(queue)` → `(komm)/kø` — Phase 1A.2
- ConversationBody extraction — Phase 1A.2
- Botsson review-row UI slot — Phase 1B
- Listener for `channel_ai_policy.text_participation='proactive'` — Phase 2
- Hospitality domain taxonomy — Phase 2
- SLA darkening orb via `engine_delayed_trigger` — Phase 3

---

## References

- ADR-0165 (Progressive Channel Discriminator)
- ADR-0166 (PII public-mode redaction — affects Phase 1A.2 application code, not 1A.1 schema)
- Migration: `supabase/migrations/20260515135959_channel_progressive_flags.sql`
- Rollback: `supabase/migrations/rollback/20260515135959_channel_progressive_flags_rollback.sql`
- Mock helper: `packages/ai/src/capabilities/__tests__/supabase-mock.ts`
- L-0087 ship-block evidence: 17 tests pass including 3 regression guards
- Spec: `docs/superpowers/specs/2026-04-20-progressive-channel-design.md`
