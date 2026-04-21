---
title: Handoff — Progressive Channel Phase 1A.1 Schema
status: done
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [handoff, helpdesk-channel, phase-1a1, schema]
---

# Handoff — Progressive Channel Phase 1A.1

## What was built and why

ADR-0165 (Progressive Channel Discriminator) revises the Phase 1 helpdesk architecture from `channel_type='desk'` subtype to a `helpdesk_enabled` flag on the channel primitive. Phase 1A.1 is the **additive schema foundation** — nullable columns, NOT VALID CHECK constraints, RLS narrowing — that prepares the ground for Phase 1A.2's backfill + UI cutover. No existing behavior changes in this phase. Every Phase 1 flow continues to work because the old CHECK stays active and `channel_type='desk'` rows are untouched.

## What shipped

### Schema migration `20260515135959_channel_progressive_flags.sql`

- ADD `channel.helpdesk_enabled boolean NOT NULL DEFAULT false`
- ADD `channel.privacy_mode channel_privacy_mode NULL` (new enum: `public` | `private_per_requester`)
- ADD CHECK `channel_helpdesk_requires_responsible` as NOT VALID (`NOT helpdesk_enabled OR responsible_profile_id IS NOT NULL`)
- ADD CHECK `channel_private_requires_helpdesk` as NOT VALID (`privacy_mode IS NULL OR helpdesk_enabled = true`)
- CREATE partial index `idx_channel_helpdesk_responsible` on `(responsible_profile_id, workspace_id) WHERE helpdesk_enabled = true` (prepares Phase 1A.2 Min kø aggregation)
- NARROW `channel_jwt_insert` RLS: `helpdesk_enabled=true` requires workspace admin via `is_admin_in_workspace(auth.uid(), workspace_id)`. Closes Council 2026-04-20 Supervisor F4 attack vector (rogue helpdesk creation via JWT).
- NARROW `channel_jwt_update` RLS: analogous guard on flipping `helpdesk_enabled=true` post-creation.

Rollback migration at `supabase/migrations/rollback/20260515135959_channel_progressive_flags_rollback.sql`.

### Test infrastructure — Zod-validated Supabase mock (L-0087 ship-block)

- NEW `packages/ai/src/capabilities/__tests__/supabase-mock.ts` — schema-validated replacement for the chainable-proxy mock. Throws on unknown columns with a clear table-qualified error.
- Ported `helpdesk_query/__tests__/tools.test.ts` from local echo-proxy to the shared stub. 14 preserved tests + 3 regression-guard tests (17 total, all passing).
- Regression guards explicitly test that:
  - `.select('engine_state')` with `created_at` (not a real column) throws
  - `.insert('channel')` with `engine_state_id` (the rejected FK) throws
  - `.insert('channel')` with new ADR-0165 columns succeeds

### Generated types

`packages/supabase/src/database.types.ts` regenerated from local Supabase. Now includes `helpdesk_enabled`, `privacy_mode`, and the `channel_privacy_mode` enum.

### Journey

`docs/journeys/JOURNEY-progressive-channel-schema.md` — three dev-facing flows (apply migration, replace mock, 48h soak).

## Decisions made (also registered in decision log)

- **ADR-0165** — Progressive Channel Discriminator. Amends ADR-0161 §Rules-Data-model §1. `helpdesk_enabled` becomes the read-time truth source. `channel_type='desk'` is deprecated-not-dropped. Accepted 2026-04-20 via Progressive Channel council.
- **ADR-0166** — PII public-mode redaction via soft-hold classifier. Amends ADR-0163. Ships with Phase 1A.2 (classifier + DB columns land there). Accepted 2026-04-20.

## Learnings discovered

- **L-0085** — Dispatcher ENTITY_PK map is a hand-maintained ceiling. Capability-tool authors must verify the whitelist before proposing `update_entity` steps. This is WHY `upgradeChannelToHelpdesk` is a Server Action, not an engine_process step.
- **L-0086** — `channel_ai_policy` is half-wired (plumbing exists, listener doesn't). Phase 2 effort scope corrected from "wire UI" to "build listener."
- **L-0087** — Mock-surface trap expands linearly with additive migrations. This learning's ship-block enforcement is literally what closed the Phase 1A.1 test story.
- **L-0088** — Ontology change ≠ presentation change. The rejected `channel_message.engine_state_id` FK would have been pure UX denormalization dressed as schema.

## Known issues / debt

- **`channel_type='desk'` remains on legacy rows forever.** Intentional per ADR-0165 rule 7 (enum value `'standard'` doesn't exist; flag is the truth). Read paths consulting `channel_type = 'desk'` for helpdesk-ness are bugs after Phase 1A.2. Grep audit recommended at 1A.2 merge: `grep -rn "channel_type.*=.*'desk'" apps/ packages/` to find stale read paths.
- **Dual CHECK constraints active.** Both `channel_desk_requires_responsible` (old, validated) and `channel_helpdesk_requires_responsible` (new, NOT VALID) fire on INSERT/UPDATE. On current data this is fine (no collision possible since new flag is FALSE on all existing rows). Phase 1A.2 VALIDATE + DROP old.
- **Test mock TABLE_SCHEMAS is hand-maintained.** Future L-0087 recurrence if a PR adds a column and forgets to update the schema. Consider codegen from `database.types.ts` as a Phase 2+ polish.
- **Shift-lifecycle tests still use the old chainable mock.** Port to shared helper opportunistically. Not blocking.
- **`@smartout/ai` typecheck requires `@smartout/telemetry`, `@smartout/types`, `@smartout/utils` to be built first.** Pre-existing monorepo state issue; documented here so Phase 1A.2 doesn't get confused. Run `pnpm -r build` once in a fresh clone or after clean.

## Next steps

### Required before Phase 1A.2 starts

1. **48h staging soak** — deploy Phase 1A.1 migration to staging, verify no Phase 1 regressions (existing desk admin, ticket resolve, mobile queue all unchanged). This is time-based — Phase 1A.2 sub-sortie cannot open until 48h after staging apply.
2. **Review RLS narrowing** — confirm that any server-side upgrade path (Phase 1A.2's `upgradeChannelToHelpdesk` Server Action) uses service role, not JWT. If any code path tries to flip `helpdesk_enabled=true` via anon key from a non-admin session, it will hit the narrowed policy and fail.
3. **Audit `TABLE_SCHEMAS` for any test-side columns Phase 1A.2 introduces.** Likely safe — 1A.2 mostly consumes schema, doesn't add more columns.

### Phase 1A.2 scope (next sub-sortie)

Per `docs/superpowers/specs/2026-04-20-progressive-channel-design.md`:

- Backfill migration: `UPDATE channel SET helpdesk_enabled=true, privacy_mode='private_per_requester' WHERE channel_type='desk'` (with LIMIT 1 on any multi-row subquery per Supervisor F6)
- VALIDATE new CHECKs
- DROP old CHECK `channel_desk_requires_responsible`
- DELETE `apps/web/src/app/dashboard/komm/desks/*`
- ADD Skranke-tab to channel settings modal
- ADD Min kø sidebar section (web) + segment tabs (mobile)
- MIGRATE `apps/mobile/app/(app)/(queue)/*` → `(komm)/kø` + `(komm)/[channelId]`
- EXTRACT `ConversationBody` from mobile `(chat)/[id].tsx`
- 6 new Server Actions (see spec)
- 5 new telemetry events registered
- 7 E2E tests (see spec)
- ADR-0166 soft-hold PII classifier implementation (DB columns + regex rules + on-insert hook)

### Phase 1B scope (after 1A.2)

- Botsson-review-row UI slot in Min kø (no skeleton, render only when Phase 2 has data)
- Phase 1B is UI-only, ~3 days

### Phase 2 and Phase 3 remain BLOCKED on prereqs

- Phase 2: dispatcher ENTITY_PK extension, `channel_ai_policy` listener, hospitality domain taxonomy, intent-classifier domain filter
- Phase 3: downstream of Phase 2 (SLA + darkening orb)

## Verification performed

- `npx supabase migration up --local` applied cleanly
- docker-exec verified columns (`helpdesk_enabled` NOT NULL, `privacy_mode` nullable enum), constraints (3 CHECKs, 1 validated + 2 NOT VALID), policies (both narrowed with `is_admin_in_workspace` guard)
- `pnpm db:gen-types` regenerated `database.types.ts` with new columns + enum
- `pnpm --filter @smartout/ai test -- tools.test` → 17/17 helpdesk_query + 8/8 shift-lifecycle passing
- `pnpm --filter @smartout/ai typecheck` → passes
- `pnpm --filter @smartout/supabase typecheck` → passes
- Regression guards explicitly verify the L-0087 trap is closed

## References

- ADR-0165: `docs/decisions/0165-progressive-channel-discriminator.md`
- ADR-0166: `docs/decisions/0166-pii-public-mode-redaction.md`
- L-0085–L-0088: `docs/learnings/0085..0088-*.md`
- Spec: `docs/superpowers/specs/2026-04-20-progressive-channel-design.md`
- Council session: `docs/council/COUNCIL-LOG.md` (2026-04-20 Progressive Channel entry)
- Migration: `supabase/migrations/20260515135959_channel_progressive_flags.sql`
- Rollback: `supabase/migrations/rollback/20260515135959_channel_progressive_flags_rollback.sql`
- Mock helper: `packages/ai/src/capabilities/__tests__/supabase-mock.ts`
- Journey: `docs/journeys/JOURNEY-progressive-channel-schema.md`
