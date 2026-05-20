---
title: "Journey — p0-e2e-followup"
status: done
updated: 2026-05-19
created: 2026-05-19
module: Mobile
tags: [journey, e2e, mobile, p0]
---

# Journey — p0-e2e-followup

## Journey: Reviewer validates P0 fixes via E2E specs

**Precondition:**
- `feat/mobile-p0-fix-sweep` has been merged into `campaign/mobile`
- Supabase Local is running (`npx supabase start`)
- Next.js dev server is running on port 3060
- `apps/e2e/.env.local` has `SUPABASE_SERVICE_ROLE_KEY` + `E2E_EMAIL` + `E2E_PASSWORD`

**Steps:**

1. Reviewer merges `feat/mobile-p0-fix-sweep` into `campaign/mobile`.
   → System: fast-forward or merge commit on `campaign/mobile`.
   → Reviewer sees: clean merge, no conflicts.

2. Reviewer navigates to worktree `~/dev/smartout.ai-mobile-wt-3` and runs:
   ```
   pnpm exec playwright test tests/sortie-p0-fix-sweep-task-complete-source.spec.ts
   ```
   → System: seeds department_session + session_task, calls POST /api/mobile/tasks/[id]/complete with source=session/personal/day_ad_hoc.
   → Reviewer sees: 6 tests PASS (was: T1/T2/T3 return 405 pre-fix, T4/T5/T6 return 405 instead of 422).

3. Reviewer runs:
   ```
   pnpm exec playwright test tests/sortie-p0-fix-sweep-task-created-canonical.spec.ts
   ```
   → System: seeds department_session, POSTs to /api/mobile/tasks, polls activity_trail + engine_event.
   → Reviewer sees: 4 tests PASS (was: T2/T3/T4 time out because "session_task.created" event never satisfies "task created" assertion).

4. Reviewer runs:
   ```
   pnpm exec playwright test tests/sortie-p0-fix-sweep-shift-chat-banner.spec.ts
   ```
   → System: loads spec, sees test.skip annotations.
   → Reviewer sees: 3 tests SKIPPED with infra-blocker message. Reports gap `p0-c-shift-chat-banner-mobile-pwa-e2e`.

5. Reviewer runs:
   ```
   pnpm exec playwright test tests/sortie-p0-fix-sweep-payroll-lonnsgrunnlag.spec.ts
   ```
   → System: loads spec, sees test.skip annotations.
   → Reviewer sees: 3 tests SKIPPED with infra-blocker message. Reports gap `p0-d-payroll-lonnsgrunnlag-mobile-pwa-e2e`.

**Postcondition:**
- P0-A + P0-B: confirmed green post-merge.
- P0-C + P0-D: documented SKIPPED with actionable gap IDs for follow-up.

**Error paths:**

- T1/T2/T3 return 405 → `feat/mobile-p0-fix-sweep` not merged; POST route absent.
- T2 in canonical spec times out → `"task created"` event not emitted; check `addTaskAction` + `createSession.execute` emit call.
- T3 in canonical spec fails → `engine_event` routing not wired for `"task created"` in `packages/telemetry/src/registry.ts`.
- T4 fails with wrong entity_id → `complete.execute` not passing the task id as `entity_id` in the emit call.
- All tests skip with "Supabase local not reachable" → `SUPABASE_SERVICE_ROLE_KEY` missing from `.env.local`.

---

## Journey: Contributor unblocks P0-C shift-chat-banner spec

**Precondition:** P0-C banner fix is merged. Contributor wants to make the skipped spec executable.

**Steps:**

1. Contributor opens `apps/mobile/src/features/shift/punch-clock.tsx` (or equivalent component).
   → Add `testID="shift-chat-tab-area"` to the View wrapping the chat tab content.

2. Contributor creates `apps/e2e/helpers/mobile-punch-clock-harness.ts` with a `navigateToPunchClockChatTab(page)` function that:
   - Signs in via `signIn(page)` from `tests/mobile-pwa/_helpers.ts`
   - Clocks in to an active shift (or seeds a clocked-in time_entry)
   - Navigates to the punch-clock view and clicks the chat tab

3. Contributor creates `apps/e2e/tests/mobile-pwa/p0c-shift-chat-banner.spec.ts` with the assertions from the comment block in `sortie-p0-fix-sweep-shift-chat-banner.spec.ts`.

4. Contributor removes the `test.skip` stubs from `sortie-p0-fix-sweep-shift-chat-banner.spec.ts` or leaves them as documentation (prefer leave — they document what was blocked and when).

**Postcondition:** CI runs the banner assertions on every mobile-pwa suite run.

---

## Journey: Contributor unblocks P0-D payroll-lønnsgrunnlag spec (unit test path)

**Precondition:** P0-D rename fix is merged.

**Steps:**

1. Contributor creates `apps/mobile/src/__tests__/payroll-strings.test.ts`:
   ```ts
   import { STRINGS } from '@/constants/strings';
   describe('payroll strings use lønnsgrunnlag, not lønnsslipp', () => {
     it('empty state copy', () => {
       expect(STRINGS.payroll.emptyState).toMatch(/lønnsgrunnlag/i);
       expect(STRINGS.payroll.emptyState).not.toContain('lønnsslipp');
     });
     it('load error copy', () => {
       expect(STRINGS.payroll.loadErrorPayslip).toMatch(/lønnsgrunnlag/i);
       expect(STRINGS.payroll.loadErrorPayslip).not.toContain('lønnsslipp');
     });
   });
   ```

2. Contributor runs `pnpm --filter @smartout/mobile test` and verifies 2 assertions pass.

**Postcondition:** String contract enforced at unit test level; Playwright infra investment deferred.
