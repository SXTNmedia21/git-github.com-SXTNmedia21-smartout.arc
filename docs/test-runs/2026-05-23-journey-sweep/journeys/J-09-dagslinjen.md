---
title: J-09 Dagslinjen Quickadd — slot/filter/note-fanout
status: FAIL
journey_docs:
  - JOURNEY-day-line-create.md
  - JOURNEY-day-line-attach-routine.md
  - JOURNEY-day-line-push.md
  - JOURNEY-day-line-employee-view-mobile.md (mobile, partial)
spec: apps/e2e/dagslinjen-quickadd/
result: 2 passed / 13 failed / 18 skipped
evidence: ../evidence/run-09-dagslinjen-quickadd.log
---

# J-09 Dagslinjen Quickadd — FAIL (13/33)

## Critical Findings

### ENV-1: WATCHDOG_CRON_SECRET missing
- 8 tests in `employee-receives-note.spec.ts` SKIPPED with explicit message: `"WATCHDOG_CRON_SECRET not set — all tests in this suite will be skipped. Set WATCHDOG_CRON_SECRET in apps/e2e/.env.local."`
- Fix: add `WATCHDOG_CRON_SECRET=local-dev-secret` to `apps/e2e/.env.local`

### BUG-5: note-fanout-scheduler auth guard returns wrong status
- Test: `note-fanout-scheduler auth guard › rejects request with wrong secret → 401`
- Real failure: expected 401, got something else (toBe(401) fails)
- Action: trace `/api/note-fanout-scheduler` route — check WATCHDOG_CRON_SECRET handling

### BUG-6: Slot quickadd click flow broken (4 timeouts)
- Tests: H1 Booking sheet, H2 Notat sheet, H3 Oppgave dialog, H4 Avvik dialog
- All 4 timeout on first click after "08:00" slot
- Hypothesis: popover anchor missing OR Z-index issue OR data-testid drift
- Real bug OR seed gap (no department_session for today → no slots)

### BUG-7: Filter timeline scope picker broken (3 fail / 1 pass)
- H1/H2/H3 fail (team picker, shift picker, reset)
- H4 (reload preserves) passes — read-from-URL works
- Hypothesis: 3-tab popover interaction broken after recent ui-shell merges

### Pass
- E4 (empty scope state) ✓
- H4 (URL preserves filter on reload) ✓

## Action
- Add WATCHDOG_CRON_SECRET to e2e .env.local → re-run employee-receives-note (8 tests)
- Investigate slot-quickadd popover (likely real recent regression)
- Investigate filter-timeline tab interaction
