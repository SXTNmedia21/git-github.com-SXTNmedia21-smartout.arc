---
title: "SMA-326 — isoWeek/isoYear datetime concat fix (W03 + W04 false-positive)"
status: draft
created: 2026-05-13
updated: 2026-05-13
module: payroll
tags: [bug, payroll, deviation-checks, W03, W04]
linear: https://linear.app/smartout/issue/SMA-326
---

# SMA-326 — isoWeek/isoYear datetime concat fix

## Bug

`packages/payroll-calculate/src/deviation-checks.ts:62-77` defines:

```ts
function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  // ...
}

function isoYear(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCFullYear();
}
```

Both expect `YYYY-MM-DD` input. Real callers (lines 174, 229, and W04 4-week rolling logic) pass full ISO datetime `shift.effective_start` (e.g. `"2026-04-07T06:00:00Z"`). Resulting concat `"2026-04-07T06:00:00ZT12:00:00Z"` is an invalid Date → `getTime()` returns NaN → `isoWeek` and `isoYear` both return NaN.

## Impact

1. **W03 weekly OT cap** (Aml. §10-6): all shifts across all weeks collapse into a single `${profile_id}:NaN:WNaN` bucket. Multi-week moderate hours sum into one bucket → false-positive W03 warnings on employees who have NOT exceeded 10h OT in any single week.
2. **W03 message text**: shows `"Overtid Xt i uke WNaN overstiger 10t grense"` instead of `"... i uke W14 ..."`.
3. **W04 4-week rolling OT cap**: same isoWeek helper used at line 229 → same NaN collision → false-positives and broken windowing.

## Why tests pass today

- `deviation-checks.test.ts` 35/35: W03 fixture is single-week — NaN bucketing doesn't change aggregation result.
- `may-2026-simulation.test.ts` 58/58: assertions don't check exact week-number text in deviation messages.

## Fix (≤10 LOC)

```ts
function isoWeek(dateStr: string): number {
  const datePart = dateStr.slice(0, 10); // tolerate both YYYY-MM-DD and full ISO datetime
  const d = new Date(datePart + "T12:00:00Z");
  // ... rest unchanged
}

function isoYear(dateStr: string): number {
  const datePart = dateStr.slice(0, 10);
  return new Date(datePart + "T12:00:00Z").getUTCFullYear();
}
```

## Risk

- **R1**: existing fixtures may encode the wrong W03 behavior — pre-flight needs to check no test asserts on `"WNaN"` literal
- **R2**: NaN may be persisted in production payroll snapshots / capability output — pre-flight grep DB schema + API surface
- **R3**: backfill needed if R2 fires

## Verification

- New regression test: 3 shifts × 3 different weeks, each <10h OT → W03 does NOT fire
- New regression test: W03 message contains real week number, not literal "WNaN"
- New regression test: W04 4-week rolling window aggregates per-week-key correctly

## Source

- Linear: [SMA-326](https://linear.app/smartout/issue/SMA-326)
- Surfaced via: `docs/simulations/SIMULATION-mid-restaurant-may-2026.md` (commit `504db9c28` on campaign/payroll, 2026-05-09)
- Repro confirmed 2026-05-13: `isoWeek("2026-04-07T06:00:00Z")` → NaN
