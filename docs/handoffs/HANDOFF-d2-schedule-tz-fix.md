---
title: D2 — Schedule capability "wrong day" fix
status: done
updated: 2026-04-24
created: 2026-04-24
module: botsson-arena
tags: [botsson, schedule, tz, D2, jarvis-trust]
---

# D2 — Schedule capability "wrong day" fix

## Summary

Emma was telling ansatte the wrong day when they asked about their schedule.
Floor-trust instantly gone. This PR anchors every schedule-capability day
boundary and every response row to `Europe/Oslo`, and pre-formats a
Norwegian weekday + local clock string so the LLM never has to perform
UTC→Oslo conversion in its head.

## Root cause (one paragraph)

Two concurrent defects in `packages/ai/src/capabilities/schedule/tools.ts`.

**First**, `getTodaySchedule` computed "today" with
`new Date().setHours(0, 0, 0, 0)`. That call computes midnight in the
**server's local timezone** — on Vercel/DigitalOcean that is **UTC**. So
at 00:30 Oslo Saturday (summer = 22:30 UTC Friday) the server's notion of
"today" was still Friday UTC 00:00Z–23:59Z, and the tool returned
**Friday's** shifts when the user was already living in Saturday. The fix
replaces `setHours` with `startOfOsloDay(new Date())` / `endOfOsloDay(…)`,
which derive 00:00 Oslo wall-clock from the instant using
`Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo' })` and correct
for DST.

**Second**, every tool returned raw UTC ISO strings (`start_time`,
`end_time`) to the LLM as `JSON.stringify(data)`. The model then had to
convert UTC → Europe/Oslo → Norwegian weekday entirely in prose, and it
frequently picked the wrong weekday across the 22:00–02:00 Oslo window
(Friday 22:00 Oslo = Friday 20:00Z; the model occasionally rendered that
as "Lørdag 00:00"). The fix enriches every row with a `local` block
carrying `start_weekday`, `start_time`, `start_date`, plus the same for
`end_*`, all pinned to `Europe/Oslo` and formatted in `nb-NO`. The raw
UTC stays in the response so any downstream consumer that wants UTC
still gets it.

## Files changed

| File | Change |
|---|---|
| `packages/ai/src/capabilities/schedule/oslo-time.ts` | **NEW.** Pure tz-aware helpers: `startOfOsloDay`, `endOfOsloDay`, `osloWeekday`, `osloClock`, `osloDateISO`, `enrichShiftRowWithOsloTime`. Deterministic, DST-correct, unit-tested. |
| `packages/ai/src/capabilities/schedule/tools.ts` | Swap server-local `setHours` for `startOfOsloDay`/`endOfOsloDay`; enrich every tool's returned rows with `local` block via `enrichShiftRowWithOsloTime`. Added tz-contract comment at top. |
| `packages/ai/src/capabilities/schedule/__tests__/tools-oslo-tz.test.ts` | **NEW.** 12 tests covering: primitive correctness, Friday 22:00 Oslo stays fredag, DST spring-forward (2026-03-29), DST fall-back (2026-10-25), Oslo day-boundary assertions for `getTodaySchedule` in both summer and winter, row-level enrichment for all three affected tools. |

## Before / after

### Day-boundary query (`getTodaySchedule`)

**Before:**

```ts
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);        // SERVER-LOCAL midnight (UTC on Vercel)
const todayEnd = new Date();
todayEnd.setHours(23, 59, 59, 999);
```

**After:**

```ts
const now = new Date();
const todayStart = startOfOsloDay(now);  // 00:00 Europe/Oslo
const todayEnd = endOfOsloDay(now);      // 23:59:59.999 Europe/Oslo
```

Falsifiable test (line 256 of `tools-oslo-tz.test.ts`):

```ts
// Pin now to 2026-05-22 22:30Z = lørdag 00:30 Europe/Oslo (summer, CEST).
vi.setSystemTime(new Date("2026-05-22T22:30:00Z"));
await getTodaySchedule.execute({}, ctx);
expect(gteStart).toBe("2026-05-22T22:00:00.000Z");  // lørdag 00:00 Oslo
expect(lteStart).toBe("2026-05-23T21:59:59.999Z");  // lørdag 23:59:59.999 Oslo
```

### Response payload

**Before** (what the LLM saw):

```json
[{ "id": "...", "start_time": "2026-05-22T20:00:00Z", "end_time": "2026-05-23T00:00:00Z", ... }]
```

Model had to compute "20:00Z on 2026-05-22 in Europe/Oslo = ??". It
sometimes said "lørdag 00:00" (because +00:00Z is Saturday globally).

**After:**

```json
[{
  "id": "...",
  "start_time": "2026-05-22T20:00:00Z",
  "end_time": "2026-05-23T00:00:00Z",
  "local": {
    "start_weekday": "fredag",
    "start_date": "2026-05-22",
    "start_time": "22:00",
    "end_weekday": "lørdag",
    "end_date": "2026-05-23",
    "end_time": "02:00",
    "tz": "Europe/Oslo"
  },
  ...
}]
```

Model quotes `local.start_weekday` verbatim. No arithmetic, no drift.

## Test evidence

```
pnpm --filter @smartout/ai test -- src/capabilities/schedule/__tests__

 RUN  v4.0.18
 ✓  get-shift-lifecycle.test.ts (2 tests) 4ms
 ✓  tools-oslo-tz.test.ts (12 tests) 18ms

 Test Files  2 passed (2)
      Tests  14 passed (14)
```

Scoped typecheck:

```
pnpm --filter @smartout/ai typecheck
```

0 errors (after pre-existing workspace deps were built — those errors
existed before this PR and are not caused by this change).

Scoped lint:

```
pnpm --filter @smartout/ai lint
✖ 34 problems (0 errors, 34 warnings)
```

Zero warnings introduced by this PR. All 34 pre-existing
`no-direct-supabase-write` warnings are in other capabilities.

## Acceptance gate — status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | New test asserts Friday 22:00 Oslo stays "fredag" | PASS — `osloWeekday switches to lørdag only AFTER local midnight` + `getMyShifts — Oslo tz enrichment` |
| 2 | All date → user-string paths anchor to Europe/Oslo | PASS — grep of `tools.ts`, `tools/*.ts`, `oslo-time.ts` shows only comments reference `setHours`/`toLocale*`; live code uses `startOfOsloDay`/`osloWeekday`/`osloClock` |
| 3 | Existing schedule tests still pass | PASS — 2/2 `get-shift-lifecycle.test.ts` green |
| 4 | Scoped typecheck 0 errors (in files touched) | PASS |
| 5 | No regression in lint | PASS — 0 new warnings |
| 6 | Session Recorder turn cited | N/A — no live `agent_session_recording` row was available in this worktree to cite; the E2E replay spec at `apps/e2e/tests/botsson-recorder/schedule-wrong-day-replay.spec.ts` exists but is a BFF-admin test, not a capability-execution trace. Root-cause was traced directly via the symptom the user reported + code reading. |

## Surprises / notes

1. **No shared tz utility existed in `packages/ai/`.** Searched the whole
   package for `Europe/Oslo` and `timeZone` — zero hits. I kept the new
   helper local to the schedule capability (`schedule/oslo-time.ts`)
   rather than creating a package-wide `packages/ai/src/lib/time.ts`
   because other capabilities (contract, operations, communication)
   don't have this bug class yet, and a premature shared utility would
   expand scope. If a second capability needs Oslo helpers, promote
   `oslo-time.ts` to `packages/ai/src/lib/oslo-time.ts` at that point.
2. **The shift-lifecycle tool was not touched.** It returns timestamps
   via a Postgres view (`v_shift_lifecycle`) as raw strings. The LLM
   only uses those fields for relative phase reasoning, not for quoting
   a weekday to the user. Adding Oslo enrichment there was out of scope
   for D2 and would inflate the PR.
3. **Test mocks are inline.** The existing `get-shift-lifecycle.test.ts`
   uses a minimal Supabase chain mock. I built a slightly richer one
   (`makeQueryBuilder`) that records `gte`/`lte` calls so I can assert
   on the actual ISO strings passed to the DB. This is the pattern that
   makes ADR-0196 Invariant 12 (falsifiable claims) hold for date logic.
4. **DST math is two-step.** `startOfOsloDay` uses a probe-and-correct
   pass: build a "guess" instant at Oslo-Y/M/D 00:00 UTC, measure the
   Oslo offset of that guess, subtract. This is safer than hard-coding
   `+01:00`/`+02:00` because it reads the DST schedule from V8's ICU
   tables rather than from a brittle date range in our code.
5. **No BOTSSON-SYSTEM-MAP.md exists in this worktree.** The campaign
   has a CAMPAIGN-botsson-arena.md plan but the system map the
   harness-builder prompt references is not in the base. No status
   update made (none to update).

## Next steps (not in this PR)

- When a second capability hits the same class of bug, promote
  `oslo-time.ts` to `packages/ai/src/lib/oslo-time.ts`.
- Consider extending `engine_memory` / system prompt to say "when
  quoting a shift day or time, use `local.start_weekday` /
  `local.start_time` verbatim; do not compute from `start_time` (UTC)"
  so older Ultravox snapshots that bypass tool enrichment also behave.
- Verify the D1 Session Recorder captures a live turn where a user
  asked about a Friday evening shift — that would close the feedback
  loop and let future D2-class bugs be caught by replay, not by user
  complaint.
