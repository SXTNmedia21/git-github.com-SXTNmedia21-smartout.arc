---
title: E2E Seed Preconditions
status: in_progress
updated: 2026-05-24
created: 2026-05-24
module: e2e
tags: [e2e, seed, preconditions, env]
---

# E2E Seed Preconditions

Documents which seed gaps block which test suites. Each ENV block identifies the missing data,
the affected suites, and the minimal fix required to unblock.

---

## ENV-2: admin app tests skip (10/11 avstemming, skips in kartotek/orders)

**Suite:** `apps/e2e/admin/`
**Affected specs:** `admin/avstemming.spec.ts` (10/11 tests skip), `admin/kartotek.spec.ts` (8/8 pass — no block here), `admin/orders.spec.ts` (5/5 pass — no block here)
**Blocks:** `admin/avstemming.spec.ts` requires an `accountant`-role user with a valid `platform_admin`-scoped session. The seed (`supabase/seed.sql`) provides only `admin@smartout.local` (godmode) and employee-tier users. No accountant-email or accountant-grant row exists.

**Fix:** Add an accountant user to `supabase/seed.sql`:

1. Insert a `auth.users` row with email `accountant@smartout.local` and bcrypt password (`password123`), role `authenticated`.
2. Insert a matching `user_identity` row with `is_godmode = false`.
3. Add an `accountant_grant` row (or equivalent platform-admin grant) linking that user to the accountant scope.
4. Update `apps/e2e/helpers/auth.ts` to export `loginAsAccountant(page)` using `accountant@smartout.local` / `password123`.
5. Remove `test.skip(true, "M8: needs deployed env + accountant seed")` guards in `admin/avstemming.spec.ts` once the helper is in place.

---

## ENV-3: payroll-phase-5 skip-all (6/6)

**Suite:** `apps/e2e/payroll-phase-5/`
**Affected specs:** `payroll-phase-5/reveal.spec.ts` (6/6 skipped)
**Blocks:** All tests call `test.skip(...)` at spec level. They require:

- A seeded `employee_payroll_profile` row with populated `personnummer` (hashed/masked) and `bank_account` columns for a known profile UUID.
- The existing `apps/e2e/helpers/seed.ts` helpers do NOT seed PII columns (`personnummer`, `bank_account`, `tax_card`).
- No `payroll-phase-5` seed helper exists.

**Fix:**

1. Add a `seedPayrollProfile(workspaceId, profileId)` function to `apps/e2e/helpers/seed.ts` that inserts an `employee_payroll_profile` row with: test personnummer (`12345678901`), test bank account (`12345678903`), and a percentage tax card (`20`).
2. Export `PAYROLL_PHASE5_PROFILE_ID` constant from a `apps/e2e/payroll-phase-5/fixtures.ts` file, populated from the seed helper.
3. Update `payroll-phase-5/reveal.spec.ts` to call `seedPayrollProfile` in `beforeAll` and remove all `test.skip` guards.
4. Add teardown: delete the seeded row in `afterAll` using the service-role client.

---

## ENV-4: governance-training-mvp (2 fail + 7 DNR)

**Suite:** `apps/e2e/governance-training-mvp/`
**Affected specs:** `engine-dispatch.spec.ts` (1 fail), `observer-request.spec.ts` (1 fail + 7 DNR)
**Blocks two distinct issues:**

### ENV-4a: `dispatch_engine_action` RPC missing from schema cache

`engine-dispatch.spec.ts` calls `supabase.rpc("dispatch_engine_action", ...)` and receives `PGRST202: Could not find the function public.dispatch_engine_action`. This indicates the local Supabase instance has not been reset and migrated to the latest state. The function is defined in a migration but the schema cache is stale or the migration was never applied locally.

**Fix:** Run `npx supabase db reset` (from repo root) to apply all pending migrations and flush the PostgREST schema cache. Re-run the suite after reset.

### ENV-4b: `admin profile not found in seeded workspace`

`observer-request.spec.ts` fixture `resolveFixture()` queries `profile` for an `owner`-role row in the seeded workspace, then throws `"admin profile not found in seeded workspace"`. This blocks the happy-path POST 201 test, causing 7 downstream tests to DNR.

The seeded workspace (`seed.sql`) does include an admin profile; the fixture queries by `workspace_id` but the local DB may be in a reset-pending state (stale data), or the query filter (`role = 'owner'`) does not match the seed's role assignment.

**Fix:**

1. Run `npx supabase db reset` to ensure seed is applied cleanly.
2. If the issue persists after reset, verify that `seed.sql` inserts a profile row with `role = 'owner'` (not just `role = 'admin'`) for the default workspace, or update the `resolveFixture` query to match the actual seeded role column value.

---

## BUG-16 reference: contracts-compliance auth mismatch

**Suite:** `apps/e2e/tests/contracts-compliance/`
**Affected specs:** `journey-a-singular-bypass.spec.ts`, `journey-d-pdf-gate-bypass.spec.ts`
**Issue:** Specs hardcode `anna@strommatabar.local` / `testpassword123` but `supabase/seed.sql` seeds `anna@smartout.local` / `password123` (bcrypt). Auth via `signInWithPassword` fails with auth error.

**Fix:** Update the spec constants to match seed credentials:

- `EMPLOYEE_EMAIL = "anna@smartout.local"`
- `EMPLOYEE_PASSWORD = "password123"`

Or alternatively add `anna@strommatabar.local` / `testpassword123` to `seed.sql`. The seed path is simpler to keep the spec isolated from the standard fixture users.
