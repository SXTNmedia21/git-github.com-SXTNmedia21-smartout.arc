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
**Blocks:** `admin/avstemming.spec.ts` requires an `accountant`-role user with a valid `platform_admin`-scoped session. The seed (`supabase/seed.sql`) provides only `admin@smartout.local` (godmode) and employee-tier users. No accountant-email or accountant-grant row existed.

**Status: seeded in `supabase/seed-admin.sql` (2026-05-24)**

Rows inserted:

- 1 × `auth.users` — `accountant@smartout.local` / `password123`, UUID `e0000000-0000-0000-0000-00000000000a`
- 1 × `auth.identities` — email provider identity for the accountant user
- 1 × `public.user_identity` — auto via trigger; explicit insert as fallback
- 1 × `public.company_member` — links accountant to Smartout AS (`a0000000-...-0000`) with role `member`
- 1 × `billing.accountant_company_grant` — `full_kartotek` scope, `grant_id = ac000000-...-0001`

Auth helper added: `loginAsAccountant(page, baseUrl?)` in `apps/e2e/helpers/auth.ts`.

**Remaining step:** Remove `test.skip(true, "M8: needs deployed env + accountant seed")` guards in
`admin/avstemming.spec.ts` after verifying the auth helper works against the admin app on port 3070.

---

## ENV-3: payroll-phase-5 skip-all (6/6)

**Suite:** `apps/e2e/payroll-phase-5/`
**Affected specs:** `payroll-phase-5/reveal.spec.ts` (6/6 skipped)
**Blocks:** All tests call `test.skip(...)` at spec level. They require a seeded employee with
`personal_number`, `bank_account`, and `tax_card_type` set, plus an active `employee_payroll_profile`
row, for a known profile UUID.

**Status: seeded in `supabase/seed-payroll.sql` (2026-05-24)**

Rows inserted / updated:

- UPDATE `public.profile` (Anna Olsen, `f0000000-...-0001`): `personal_number='12345678901'`, `bank_account='12345678903'`, `tax_card_type='percentage'`, `tax_percentage=20.00`, `tax_card_year=2026`
- 1 × `public.employee_payroll_profile` for Anna (defensive no-op — seed.sql already inserts it)
- 1 × `public.workspace` — Payroll E2E Workspace B (`b0000000-...-0000b1`)
- 1 × `public.profile` in Workspace B (`f0000000-...-0000b1`) for cross-workspace rejection test

Seed constants in `reveal.spec.ts` updated:

- `SEED_EMPLOYEE_ID = "f0000000-0000-0000-0000-000000000001"` (Anna Olsen, HQ)
- `SEED_WORKSPACE_B_PROFILE_ID = "f0000000-0000-0000-0000-0000000000b1"` (Workspace B)

**Remaining step:** Remove all `test.skip(...)` guards in `payroll-phase-5/reveal.spec.ts` after
verifying the complete-data route (`/dashboard/people/{id}/complete-data`) renders correctly and
the reveal API (`POST /api/payroll/reveal-pii`) is wired end-to-end.

---

## ENV-4: governance-training-mvp (2 fail + 7 DNR)

**Suite:** `apps/e2e/governance-training-mvp/`
**Affected specs:** `engine-dispatch.spec.ts` (1 fail), `observer-request.spec.ts` (1 fail + 7 DNR)
**Blocks two distinct issues:**

### ENV-4a: `dispatch_engine_action` RPC missing from schema cache

`engine-dispatch.spec.ts` calls `supabase.rpc("dispatch_engine_action", ...)` and receives
`PGRST202: Could not find the function public.dispatch_engine_action`. This indicates the local
Supabase instance has not been reset and migrated to the latest state.

**Status: outside seed scope — requires operator action**

**Fix:** Run `npx supabase db reset` (from repo root) to apply all pending migrations and flush
the PostgREST schema cache. Re-run the suite after reset. No SQL seed can fix a stale schema cache.

### ENV-4b: `admin profile not found in seeded workspace`

`observer-request.spec.ts` fixture `resolveFixture()` queries `profile` for a row matching
`user_id = adminUser.id` (admin@smartout.local) and `workspace_id` (first workspace from DB).
The error occurs when a billing demo workspace is inserted before HQ in heap order, causing
`.limit(1).single()` to return the wrong workspace.

**Status: seeded in `supabase/seed-governance.sql` (2026-05-24)**

Rows inserted:

- `public.workspace` HQ (`b0000000-...-0000`) — no-op if already exists (anchors heap order)
- `public.profile` admin (`f0000000-...-0000`) — no-op if already exists
- 3 × `public.engine_authority_config` — `observer_request.create/claim/approve`, level=confirm, min_role=manager (pre-seeds so spec's `upsert` is idempotent)

**Remaining step:** Run `npx supabase db reset` (ENV-4a) before running the governance suite.
After reset + seed, both engine-dispatch and observer-request should pass without further changes.

---

## BUG-16 reference: contracts-compliance auth mismatch

**Suite:** `apps/e2e/tests/contracts-compliance/`
**Affected specs:** `journey-a-singular-bypass.spec.ts`, `journey-d-pdf-gate-bypass.spec.ts`
**Issue:** Specs hardcode `anna@strommatabar.local` / `testpassword123` but `supabase/seed.sql` seeds `anna@smartout.local` / `password123` (bcrypt). Auth via `signInWithPassword` fails with auth error.
**Status:** open — not addressed by this PR (outside ENV-2/3/4 scope)

**Fix:** Update the spec constants to match seed credentials:

- `EMPLOYEE_EMAIL = "anna@smartout.local"`
- `EMPLOYEE_PASSWORD = "password123"`

Or alternatively add `anna@strommatabar.local` / `testpassword123` to `seed.sql`. The seed path is simpler to keep the spec isolated from the standard fixture users.
