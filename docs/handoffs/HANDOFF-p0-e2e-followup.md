---
title: "Handoff — p0-e2e-followup"
status: done
updated: 2026-05-19
created: 2026-05-19
module: Mobile
tags: [handoff, e2e, mobile, p0]
---

# Handoff — p0-e2e-followup

## Summary

Added 4 Playwright E2E spec files covering the P0 fixes from `feat/mobile-p0-fix-sweep`. Two specs are fully executable (P0-A + P0-B); two are SKIPPED pending mobile UI rendering infrastructure (P0-C + P0-D).

**Important:** All 4 specs assert post-fix behavior. They will FAIL on `campaign/mobile` (current state — fixes not merged) and PASS after `feat/mobile-p0-fix-sweep` merges.

## Files Produced

| File | Status | P0 |
|------|--------|----|
| `apps/e2e/tests/sortie-p0-fix-sweep-task-complete-source.spec.ts` | Executable — 6 tests | P0-A |
| `apps/e2e/tests/sortie-p0-fix-sweep-task-created-canonical.spec.ts` | Executable — 4 tests | P0-B |
| `apps/e2e/tests/sortie-p0-fix-sweep-shift-chat-banner.spec.ts` | SKIPPED — 3 test stubs | P0-C |
| `apps/e2e/tests/sortie-p0-fix-sweep-payroll-lonnsgrunnlag.spec.ts` | SKIPPED — 3 test stubs | P0-D |

## Decisions

### D1: Test the BFF pipe, not the mobile hook (P0-B)

P0-B fixes `useCreateTask` (React hook) to emit `"task created"` instead of `"session_task.created"`. The correct test level for an API E2E spec is the BFF pipe (`POST /api/mobile/tasks` → `addTaskAction` → `createSession.execute`). The hook delegates to `enqueue()` → SyncWorker → BFF. The BFF pipe is what writes to DB and emits telemetry. Testing the hook directly would require mocking the sync queue — not appropriate for an E2E spec.

### D2: SKIP P0-C + P0-D — no mobile UI rendering infra (not a bypass)

The Playwright suite in `apps/e2e/` operates against the web app (port 3060). The mobile-pwa project (`tests/mobile-pwa/`) can test Expo Web but requires authenticated shift context to reach the punch-clock chat tab (P0-C) and payroll screen (P0-D). Neither a clock-in helper nor payroll navigation helper exist. Skipping with full documentation is the correct call — the alternative would be fabricating a fake test that does not actually verify the fix.

### D3: Use `test.skip(true, ...)` not `test.todo`

`test.todo` in Playwright does not accept a skip reason message visible in test reports. `test.skip(true, reason)` records the reason in the report and blocks CI if accidentally un-skipped without meeting the precondition. Consistent with existing pattern in `personal-harness-e2e.spec.ts` (N2 test).

## Learnings

### L1: commitlint rejects digits in scope — `e2e` fails `scope-case: kebab-case`

`@commitlint/config-conventional` with `scope-case: [2, "always", "kebab-case"]` rejects ANY digit in the scope, not just uppercase. `test(e2e):` fails. Use a word-only scope like `mobile-bff` or `mobile-ui`. Documented in `.claude/agent-memory/botsson-harness-builder/commitlint-kebab-trap.md` — this is a known trap.

### L2: Pre-existing typecheck errors in `apps/e2e/` are unrelated to new specs

`pnpm --filter e2e typecheck` fails with 40+ pre-existing errors in `generators/`, `runners/`, `protocols/`, and `komm-nyheter/` — all from missing `@smartout/journey-ir` dist and `@smartout/ai/capabilities/communication/publish-announcement` module. Zero errors from the new spec files. Verified by checking that `grep "sortie-p0"` returns empty in tsc output.

## Known Issues / Debt

### P0-C: Shift-chat banner not testable without mobile-pwa navigator

**Tracking gap:** `p0-c-shift-chat-banner-mobile-pwa-e2e`

Required to unlock:
1. Add `data-testid="shift-chat-tab-area"` to `punch-clock.tsx` chat tab container (2-line diff).
2. Build a mobile-pwa helper that clocks in to an active shift and navigates to the punch-clock view.
3. Move test assertions to `apps/e2e/tests/mobile-pwa/p0c-shift-chat-banner.spec.ts`.

### P0-D: Payroll lønnsgrunnlag not testable without mobile-pwa payroll navigator

**Tracking gap:** `p0-d-payroll-lonnsgrunnlag-mobile-pwa-e2e`

Lowest-cost alternative (no Playwright infra needed):
- Add unit test in `apps/mobile/src/__tests__/payroll-strings.test.ts`
- Import `STRINGS` from `@/constants/strings`
- Assert `.not.toContain('lønnsslipp')` on all payroll string keys

Required for full Playwright coverage:
1. Add `data-testid="payroll-screen"` + `data-testid="payroll-empty-state"` to mobile payroll screen.
2. Build mobile-pwa navigation helper for `/payroll` route.
3. Move assertions to `apps/e2e/tests/mobile-pwa/p0d-payroll-lonnsgrunnlag.spec.ts`.

## Next Steps

1. Merge `feat/mobile-p0-fix-sweep` into `campaign/mobile`.
2. Run P0-A + P0-B specs against the merged branch — they should pass.
3. For P0-C/P0-D: choose either unit-test path (fast, `apps/mobile/src/__tests__/`) or Playwright path (requires infra investment above).
