---
title: "JOURNEY — Manager scrubs through dates with TopBar stepper"
status: done
created: 2026-05-24
updated: 2026-05-24
feature: p11-oppgaver-page
module: day-session
tags: [journey, oppgaver, date-navigation]
---

# Manager scrubs through dates with TopBar stepper

**Precondition:** Manager on `/dashboard/oppgaver`. Page loaded with today's data.

## Happy path

1. Manager clicks ◀ (chevron-left) in TopBar → `setDateISO((d) => shiftDate(d, -1))` runs → date label updates ("Fre 23. mai 2026") → telemetry emits `oppgaver.date_changed { from_date, to_date, triggered_by: "ui" }`.
2. System re-runs 3 hooks with new `dateISO` → fresh TanStack query for `day_line`/`session_task` (15s staleTime) → chart re-renders with yesterday's data → NowLine no longer present (date ≠ today).
3. Manager clicks ▶ (chevron-right) twice → date returns to today → forwards to tomorrow → `pinOppgaverContextAction` debounce (800ms) fires once after last click → emits `oppgaver.context_pinned`.

**Postcondition:** Manager navigated 3 dates. 2 `date_changed` events landed (one per nav). 1 `context_pinned` event (debounced). Botsson knows manager is on tomorrow.

## Error paths

- **Hook fetch fails for target date:** Chart shows empty bands + error state; manager can step back to recover.
- **Network offline:** TanStack retries 3x with backoff; UI shows stale data from cache.
