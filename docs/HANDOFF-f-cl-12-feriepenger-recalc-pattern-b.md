---
title: "Handoff — f-cl-12-feriepenger-recalc-pattern-b"
status: done
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [handoff, payroll, feriepenger, f-cl-12, f-cl-17, adr-0293, pattern-b]
---

# Handoff — F-CL-12 Feriepenger Recalc Pattern B

> Branch: `feat/payroll-f-cl-12-feriepenger-recalc-pattern-b` | Base: `campaign/payroll` | Closed: 2026-05-16

## What Was Built

ADR-0293 Pattern B `computeFeriepengerBasis` recalc wired into 3 agent-invoked payroll capability tools. Closes F-CL-12 (HIGH, audit 2026-05-13) and F-CL-17 (misattribution).

**Modified files:**
- `packages/ai/src/capabilities/payroll/tools.ts` — Pattern B recalc + F-CL-17 fix in 3 tools
- `packages/ai/src/capabilities/payroll/__tests__/addManualSupplement-feriepenger.test.ts` — 5 vitest tests
- `packages/ai/src/capabilities/payroll/__tests__/deleteManualSupplement-feriepenger.test.ts` — 5 vitest tests + F-CL-17 regression
- `packages/ai/src/capabilities/payroll/__tests__/overrideCalculationLine-feriepenger.test.ts` — 5 vitest tests
- `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md` — F-CL-12 + F-CL-17 moved to Closed
- `docs/journeys/JOURNEY-f-cl-12-feriepenger-recalc-pattern-b.md` — status: verified

## Decisions Made

### D1 — Follow F-CL-13 shape exactly (callGateAction, not gatedMutation)

F-CL-13 (commit `58d40f500`) wired the same helper into `exportPeriod` using `callGateAction`. Payroll tools universally use this pattern (documented in file header: "gate-then-update is the established payroll convention"). `gatedMutation` is the SS-4 target per ADR-0204 but SS-4 migration of payroll's `gate.ts` is not done (G13 open). Used `callGateAction` to match F-CL-13 exactly.

### D2 — Emit only the 7 registered fields in `payroll.feriepenger_basis_computed`

Initially added `trigger`, `supplement_id`, `gate_evaluation_id` to the emit data for traceability. `SmartoutEvent` type-checks against the registry, which only allows 7 fields: `workspace_id`, `period_id`, `profile_id`, `basis_amount`, `pct_applied`, `base_pay_total`, `channel`. Removed the extras to match the registered shape. Gate correlation is carried by `gate_evaluation_id` in the separate `payroll.manual_supplement_added/deleted` emit that already fires before the recalc.

### D3 — Sequential awaits instead of Promise.all for Pattern B DB calls

PostgrestBuilder type doesn't overlap cleanly with `Promise<{data: T | null}>`. Used `as any` one-hop cast + sequential awaits to avoid TS2352 errors that appeared with `Promise.all` cast chains. This is the same approach used in the existing payroll tools (e.g. the `change_proposal` insert block in `overrideCalculationLine`).

### D4 — F-CL-17 fix scope: shift row now fetches employee_id

`deleteManualSupplement` verified the shift's period status by fetching `shift.start_time` but never fetched `shift.employee_id`. Consequently, `target_profile_id` in the `payroll.manual_supplement_deleted` emit defaulted to `ctx.profileId` (the admin actor). Fixed by extending the shift select to `"start_time, employee_id"`. `deletePeriodId` lifted to outer scope (was block-scoped inside `if (shift) {}`) to make it available for Pattern B recalc after the delete.

### D5 — Emit feriepenger_basis_computed even for open periods with no calculation row

For open periods that have not yet had a payroll calculation run, `base_pay` from the `calculation` table will be null. We still emit with `basis_amount = 0`. Rationale: the supplement-add event still happened and the accountant needs a signal that the basis needs manual review once the calculation runs. This matches the intent of ADR-0295 (per-period basis tracking) and ADR-0293 (recalc on every mutation).

### D6 — No recalc when shift has no employee_id (addManualSupplement)

The outer `if (period?.id && shift.employee_id)` guard means no `payroll.feriepenger_basis_computed` is emitted when the shift lacks an employee_id. This is acceptable: if we can't attribute the basis to a profile, emitting would produce a corrupt telemetry row. The supplement INSERT still succeeds. Test case documents this behavior.

## Learnings

### L1 — tsc strict array index access requires non-null assertion

`array[0].property` fails TS2532 even after `expect(array).toHaveLength(1)`. TypeScript cannot infer non-emptiness from assertion calls. Pattern: use `array[0]!.property` when the preceding test assertion guarantees non-emptiness. Found during `pnpm turbo typecheck` (not caught by vitest because vitest doesn't typecheck).

### L2 — PostgrestBuilder cast trap: two-hop via any

`supabase.schema('payroll').from('X')...maybeSingle() as Promise<{data: T|null}>` fails TS2352 "neither type sufficiently overlaps". The PostgrestBuilder return type is `PostgrestMaybeSingleResponse<Row>` which doesn't have enough overlap for direct cast. Pattern: `as { data: T | null }` works via any-hop because `any` breaks the overlap check requirement. Document this when the next team member hits it.

### L3 — ESLint disables must precede the specific line (not the closing brace)

`// eslint-disable-next-line @typescript-eslint/no-explicit-any` placed before `} as any` fails because the `as any` is on the `}` line. The disable must appear before the line containing the `any` expression, not before the closing delimiter. When the `any` is on a separate `: any =` line, placing the disable before that line works.

### L4 — Prelint (lintstaged ESLint) fails commits; pre-push (tsc) catches different errors

The commit pre-commit hook runs eslint+prettier (lintstaged). The pre-push hook runs tsc. TS2532 (array index access) only surfaces at pre-push time, not pre-commit. Plan tests that will be committed to run `pnpm --filter @smartout/ai typecheck` before committing to avoid the round-trip.

## Commit Trail

| SHA | Subject |
|-----|---------|
| `a05c07dd2` | docs(f-cl-12): plan + journey for Pattern B recalc on 3 capability tools |
| `12c9f4ab8` | feat(payroll): wire Pattern B feriepenger recalc into 3 capability tools (F-CL-12) |
| `31ef5bc4a` | test(payroll): add 3 vitest suites for F-CL-12 Pattern B feriepenger recalc |
| `678f522e5` | docs(payroll): close F-CL-12 + F-CL-17 in audit synthesis (2026-05-13) |
| `5b7a08a1b` | fix(payroll): add non-null assertion on array index access in F-CL-12 tests |
| `9dd0b9e49` | docs(payroll): mark all 3 F-CL-12 journeys as verified |

## Test Results

```
Test Files  3 passed (3)
     Tests  15 passed (15)
  addManualSupplement-feriepenger.test.ts        5 tests
  deleteManualSupplement-feriepenger.test.ts     5 tests (incl. F-CL-17 regression)
  overrideCalculationLine-feriepenger.test.ts    5 tests
```

pnpm turbo typecheck: 52/52 Tasks successful.

## Known Issues / Debt

None introduced by this sortie. Pre-existing open items:

- **G13** — SS-4 migration of payroll's `gate.ts` to `gatedMutation` not done. When SS-4 lands, the 3 tools here should be migrated to `gatedMutation`. Pattern B recalc block moves inside the `execute` callback of `gatedMutation`.
- **ADR-0293 Pattern A** — async recalc via pg_notify / worker is not implemented. Pattern B is the sync-chain approach (immediate recompute on capability path). Pattern A deferred per campaign scope.
- `payroll.feriepenger_basis_computed` registry shape has 7 fields — no `trigger` or `gate_evaluation_id` for traceability. If cross-event correlation becomes important, extend the registry type (requires telemetry dist rebuild).

## Next Steps

- S1 (parallel): lønnsslipp → lønnsgrunnlag label sweep (8 hits / 6 files)
- S2 (parallel): mobile lønnsgrunnlag UX polish
- Both S1 + S2 can start after S3 is merged to `campaign/payroll`.
