---
title: N-D Journey Engine E2E Seed Helpers
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [e2e, playwright, fixtures, journey-engine, follow-up]
---

# N-D — Journey Engine E2E Seed Helpers

Scope: unskip J1–J4, J7, J8, J11 Playwright tests in
`apps/e2e/tests/journey-engine.spec.ts` by adding fixture helpers.
No capability, BFF, or UI code modified — strict N-D scope.

## Summary

Sub-sortie N-D ships two new helpers + a rewire of the journey-engine spec
so seven previously describe-level-skipped tests are now listed by
Playwright and run under appropriate conditions.

Before N-D: `pnpm -F e2e exec playwright test tests/journey-engine.spec.ts --list`
showed 4 runnable tests + 7 describe-level `test.skip(true, ...)` forever-skips.

After N-D: 11 tests listed, 0 forever-skips. Remaining skips are all
conditional on env vars with clear messaging.

## Files shipped

| File | LOC | Purpose |
|------|-----|---------|
| `apps/e2e/helpers/journey-seed.ts` | 464 | journey / journey_version / engine_state / engine_authority_config fixtures |
| `apps/e2e/helpers/admin-login.ts` | 124 | platform-admin godmode login wrapper with identity return shape |
| `apps/e2e/tests/journey-engine.spec.ts` | +184 / −54 | unskip + wire helpers into J1–J4, J7, J8, J11 |

## Fixture helpers (`journey-seed.ts`)

- `seedParentJourney(opts?)` — minimal `journey` row so the admin form
  dropdown has a parent to pick. Uses `admin@smartout.local` as creator.
- `seedDraftJourneyVersion(opts?)` — `journey_version` row in `draft`;
  creates parent on-demand when `journeyId` is not supplied.
- `seedPublishedJourneyVersion(opts?)` — seed + update to `published`.
- `seedActiveRun({ journeyVersionId, stepCount })` — creates an
  `engine_process` row (idempotent, id `e2e_journey_run`), an `engine_state`
  row with status `active`, and N `engine_state_step` rows. Returns
  `{ run_id, step_keys }` for the Fjernkontroll subscription filter.
- `seedDisabledAuthority({ capability })` — flips
  `engine_authority_config.level = 'disabled'` for the given capability.
  Falls back to insert when the seed row is missing (older DB).
- `restoreAuthority({ capability, level })` — counterpart to
  `seedDisabledAuthority`; restores `autonomous` / `suggest` per ADR-0176
  defaults.
- `cleanupJourneyFixtures(ids)` — reverse-FK teardown. Tolerant to
  missing rows; errors logged, not thrown, so `afterAll` always completes.

## Admin login helper (`admin-login.ts`)

- `loginAsPlatformAdmin(page)` — form-logs in as `admin@smartout.local`
  (via existing `helpers/auth.ts::loginAsAdmin`), then:
  1. Resolves `user_id` / `profile_id` / `workspace_id` via service-role.
  2. Asserts `user_identity.is_godmode = true` — fails loud when
     `supabase/seed.sql` step 8 has regressed, rather than silently
     redirecting to `/dashboard`.
- Returns `{ user_id, profile_id, workspace_id, email }` for test assertions.

## Test wiring

| Test | Gate | Status post-N-D |
|------|------|-----------------|
| J1 create version | seed parent journey | runs live; asserts redirect off `/new` |
| J2 edit version | seed draft version | runs live; asserts `/versions/:id` loads |
| J3 status transition | seed draft version | runs live; asserts edit surface — full transition UI owned by N-B |
| J4 test-run page | seed draft version | runs live; asserts `/versions/:id/run` loads |
| J6 BFF 401 / CVE | (no new fixture) | already unskipped pre-N-D; unchanged |
| J7 Fjernkontroll stuck | seed run + env var | skipped unless `J7_J8_FJERNKONTROLL_UI_READY=1` — page needs `?run=<runId>` param (future sub-sortie) |
| J8 Fjernkontroll completed | seed run + env var | same as J7 |
| J9 stuck-detector auth | `WATCHDOG_CRON_SECRET` | unchanged |
| J10 stuck-detector anon | `SUPABASE_ANON_KEY` | unchanged |
| J11 run_guided dual-gate | seed disabled authority | runs live; asserts 403 with `capability_disabled` |

## Decisions

- **Parent-journey slug auto-generates** — suffix by `Date.now()` +
  random to avoid collisions across parallel workers.
- **`engine_process` id is shared** — `e2e_journey_run` reused across
  tests (idempotent insert via pre-select). Cleanup skips it unless the
  id starts with `e2e_`, matching the allow-list.
- **J7/J8 kept behind env var** — the test-run page does not yet read
  `?run=<runId>` from the URL and pass it to Fjernkontroll. Running these
  tests without the page change would assert against a component that
  never subscribes. A future sub-sortie lands the URL param, then the
  env var gets flipped in `apps/e2e/.env.local`.
- **HQ workspace reused, not copied** — fixtures live inside the seeded
  HQ workspace (b0000000-0000-0000-0000-000000000000). Tests that would
  need isolated workspaces would pass `workspaceId` and add it to
  `cleanupJourneyFixtures.workspace_ids`. No J1–J11 test needs isolation.

## Learnings

- **`engine_event` columns vs Fjernkontroll filter** — the runtime UI
  filters on `entity_id=eq.<runId>` and reads `event_name` / `properties`
  from the payload row. The live `engine_event` table has columns
  `event_type`, `payload`, `workspace_id`, `fired_at`, `idempotency_key`
  only. This is an open inconsistency (not N-D's to fix) — noted so the
  follow-up sub-sortie is aware.
- **`user_identity.is_godmode` is the bouncer** — platform-admin routes
  redirect non-godmode users silently. Testing these routes without
  asserting `is_godmode` up front means failures appear as mysterious
  404s / dashboard redirects instead of clear "not authorised" errors.
  `loginAsPlatformAdmin` checks it to keep failure modes legible.
- **`test.skip(true, ...)` at describe scope vs inside each test** —
  describe-level forever-skips hide the test count. Moving the skips
  into beforeAll-driven conditionals keeps the count honest while still
  letting tests be gated on environmental prerequisites.

## Known debt / next steps

1. **J7/J8 URL-param sub-sortie** — the test-run page needs to accept
   `?run=<runId>` and forward to `<Fjernkontroll runId={...} />`. Once
   landed, flip `J7_J8_FJERNKONTROLL_UI_READY=1`.
2. **J3 transition UI assertion** — add `expect(page).toHaveText(...)`
   on the transition button + click assertion once sub-sortie N-B's
   status-transition UI ships.
3. **`engine_event` schema drift** — Fjernkontroll reads `event_name` /
   `properties` which do not exist as columns on `engine_event`. Either
   migrate the table or rewrite the realtime filter — escalation flag
   for the next campaign slot.

## Verification

- `pnpm -F e2e exec tsc -p tsconfig.json --noEmit` — baseline 29
  pre-existing errors, N-D changes add zero.
- `SKIP_WEB_SERVER=1 SUPABASE_SERVICE_ROLE_KEY=dummy npx playwright test tests/journey-engine.spec.ts --list`
  returns 11 tests.
- Live run (requires web server on 3062 + local Supabase + seed applied):
  J1, J2, J3, J4, J11 are expected to pass. J6, J9, J10 continue to work
  as before. J7/J8 skip with clear messaging until the URL-param change
  lands.

## Commits

1. `510d8748` — `test(tests): journey-seed helper for E2E (N-D)`
2. `fbbbedff` — `test(tests): admin-login helper for E2E (N-D)`
3. `edd94e18` — `test(tests): unskip J1-J4, J7, J8, J11 journey Playwright tests (N-D)`
