---
title: "Journey — All 5 Wave A E2E specs green"
feature: e2e-nyheter-stabilize
journey: all-specs-green
status: verified
verified_at: 2026-05-12
e2e_test: apps/e2e/komm-nyheter/journey-{1,2,3}-*.spec.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, e2e, playwright, test-infra]
---

# Journey: All 5 Wave A E2E specs green

**Role:** developer running pre-merge E2E verification

**Precondition:**
- Local Supabase running + seeded (`npx supabase db reset` clean — assumes Wave A's `2b728a9c6` seed migration fix in development branch)
- Web 3060 + landing 3056 dev servers running from worktree where Wave A code lives
- `apps/e2e/.env.local` present with local Supabase demo keys

## Happy Path

1. Developer runs `cd apps/e2e && pnpm exec playwright test komm-nyheter --reporter=list`
2. Playwright spawns + reuses existing web + landing dev servers via `reuseExistingServer: !CI`
3. Global setup runs (fixture provisioning + recorder C4 authority seed)
4. Each spec's `beforeEach`:
   - Resolves admin's workspace via `resolveAdminWorkspaceId()`
   - Seeds dept + profiles (Journey 2 + 3) into admin's workspace
5. Each test executes:
   - Journey 1: navigates to nyheter, publishes default-Alle announcement, asserts `notification_outbox` row with `priority=1, mode='work'`
   - Journey 2 test 1: publishes Bar-only targeted announcement, asserts `visibility_scope='targeted_members'` + `target_profile_ids` matches Bar dept
   - Journey 2 test 2: publishes Alle audience, asserts `visibility_scope='all_members'` + empty target_profile_ids
   - Journey 3 test 1: clicks Fest øverst, asserts `is_pinned=true` + `pinned_by` + `pinned_at` + activity_trail row
   - Journey 3 test 2: pre-pins via service role, clicks Løsne, asserts `is_pinned=false` + null fields + activity_trail unpinned row
6. `afterEach` cleans up seeded entities (targeted by id, not workspace-wide)
7. Reporter output: `5 passed (5)` (or `6 passed (6)` if Journey 2 still has 2 test cases)

**Postcondition:**
- Zero failed tests
- All seeded entities cleaned up (no leaked profiles, departments, messages, auth users)
- Reporter writes `playwright-report/index.html` clean

## Error Paths

- **Live execution reveals real Wave A code bug** (e.g. `channel.message.unpinned` activity_trail routing broken in production code, not just test fixture): HALT sortie. Document the real bug. Cut new sortie for the fix. Do NOT smuggle Wave A code changes into this stabilize sortie.
- **Test-infra fix surfaces additional pre-existing failures in OTHER spec dirs**: flag in HANDOFF, do not fix here.

## Verification

- [ ] `pnpm exec playwright test komm-nyheter --reporter=list` returns all-green
- [ ] HANDOFF documents what each of the 4 fixes was (timeout, workspace trace, RPC visibility, routing)
- [ ] No Wave A app code touched (git diff confirms)

**Mark `status: verified` when all three boxes are checked.**
