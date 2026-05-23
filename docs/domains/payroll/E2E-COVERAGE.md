---
title: "Payroll — E2E Coverage"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: payroll
tags: [domain, payroll, e2e, testing, coverage]
---

# Payroll — E2E Coverage

> Test = proof of built. A flow without a test is `mirror: aspirational` until proven. Verified by grepping `apps/e2e/` + `packages/payroll-calculate/__tests__/` + `apps/mobile/src/lib/__tests__/`.

## Test files inventory (verified)

| File | Type | What it covers |
|---|---|---|
| `apps/e2e/tests/payroll-harness-e2e.spec.ts` | Playwright E2E | Full harness integration test (period create → calc → lock) |
| `apps/e2e/tests/payroll-phase-3-aggregate-export.spec.ts` | Playwright E2E | Phase 3: aggregate CSV export flow |
| `apps/e2e/tests/payroll-phase-4-pdf-bundle.spec.ts` | Playwright E2E | Phase 4: PDF bundle generation + download |
| `apps/e2e/tests/sortie-p0-fix-sweep-payroll-lonnsgrunnlag.spec.ts` | Playwright E2E | P0 fix sweep: lønnsgrunnlag signed URL + employee view |
| `apps/e2e/payroll-phase-5/reveal.spec.ts` | Playwright E2E | Phase 5: PII reveal (personal number + bank account) |
| `apps/e2e/helpers/payroll-locked-period-seed.ts` | Helper | Seed helper for locked-period test setup |
| `apps/e2e/playwright.payroll.config.ts` | Config | Dedicated Playwright config for payroll tests |
| `apps/e2e/snapshots/payroll-harness-1778569034784.json` | Snapshot | Harness snapshot baseline |
| `packages/payroll-calculate/__tests__/interpret-shift.test.ts` | Vitest unit | `interpretShift` — shift classification correctness |
| `packages/payroll-calculate/__tests__/evaluate-supplements.test.ts` | Vitest unit | `evaluateSupplements` — DSL rule eval |
| `packages/payroll-calculate/__tests__/snapshot-cost.test.ts` | Vitest unit | `snapshotCost` — tariff lookup + cost derivation |
| `packages/payroll-calculate/__tests__/aggregate-period.test.ts` | Vitest unit | `aggregatePeriod` — period aggregation |
| `packages/payroll-calculate/__tests__/deviation-checks.test.ts` | Vitest unit | W01–W12 deviation checks |
| `packages/payroll-calculate/__tests__/seniority-resolver.test.ts` | Vitest unit | Ansiennitet step resolution |
| `packages/payroll-calculate/__tests__/overtime-mode-banked.test.ts` | Vitest unit | OT banked mode |
| `packages/payroll-calculate/__tests__/overtime-mode-paid-out.test.ts` | Vitest unit | OT paid-out mode |
| `packages/payroll-calculate/__tests__/golden-month/` | Vitest golden | 12 employees × 1 month × ~600 shifts — cents-exact reference |
| `packages/payroll-calculate/__tests__/may-2026-simulation/` | Vitest simulation | May 2026 scenario run |
| `packages/ai/src/capabilities/payroll/__tests__/update-payroll-profile.test.ts` | Vitest unit | `update_payroll_profile` capability tool |
| `apps/mobile/src/lib/__tests__/payroll-calc.test.ts` | Jest unit | Mobile-side `payroll-calc.ts` client preview calc |
| `apps/web/src/app/api/payroll/__tests__/payroll-period-locked-handler.test.ts` | Vitest unit | Period-locked Edge Function handler |
| `apps/web/src/app/dashboard/settings/__tests__/payroll-schemas.test.ts` | Vitest unit | Settings page Zod schemas |
| `apps/web/src/app/dashboard/settings/__tests__/payroll-category-mappings.test.ts` | Vitest unit | Category mapping helpers |

## Coverage matrix

| # | Flow | Web E2E | Mobile E2E | Capability unit | Manual test doc |
|---|---|---|---|---|---|
| P1-1 | Manager closes period | `payroll-harness-e2e.spec.ts` | MISSING | MISSING | `MANUAL-TEST-payroll-phase-1.md` |
| P1-2 | Manager drills profile during review | `payroll-harness-e2e.spec.ts` (partial) | MISSING | MISSING | `MANUAL-TEST-payroll-phase-1.md` |
| P1-3 | Admin adjusts time-bank balance | MISSING | MISSING | MISSING | `MANUAL-TEST-payroll-phase-1.md` |
| P1-4 | Admin configures workspace policy | `payroll-schemas.test.ts` (unit only) | MISSING | MISSING | `MANUAL-TEST-payroll-phase-1.md` |
| P1-5 | Admin sets overtime mode | `overtime-mode-*.test.ts` (unit) | MISSING | MISSING | `MANUAL-TEST-payroll-phase-1.md` |
| P2-1 | Manager adds manual supplement | MISSING | MISSING | MISSING | — |
| P2-2 | Manager deletes manual supplement | MISSING | MISSING | MISSING | — |
| P2-3 | Manager proposes line override | MISSING | MISSING | MISSING | — |
| P2-4 | Admin approves line override | MISSING | MISSING | MISSING | — |
| P2-5 | Tip distribution merges into payroll | MISSING | MISSING | MISSING | — |
| P3-1 | Admin exports aggregate CSV | `payroll-phase-3-aggregate-export.spec.ts` | n/a | MISSING | — |
| P3-2 | Admin exports audit CSV with provenance | `payroll-phase-3-aggregate-export.spec.ts` (partial) | n/a | MISSING | — |
| P3-3 | Admin exports unmasked CSV | `payroll-phase-3-aggregate-export.spec.ts` (partial) | n/a | MISSING | — |
| P3-4 | Locked-period-only export enforced | `payroll-phase-3-aggregate-export.spec.ts` | n/a | MISSING | — |
| P4-1 | Admin generates PDF bundle | `payroll-phase-4-pdf-bundle.spec.ts` | n/a | MISSING | — |
| P4-2 | Admin generates single employee PDF | `payroll-phase-4-pdf-bundle.spec.ts` | n/a | MISSING | — |
| P4-3 | Employee views own lønnsgrunnlag (mobile) | `sortie-p0-fix-sweep-payroll-lonnsgrunnlag.spec.ts` | MISSING | MISSING | — |
| P4-4 | PDF content matches CSV | `payroll-phase-4-pdf-bundle.spec.ts` | n/a | MISSING | — |
| P4-5 | Signed URL expiry rejects | `sortie-p0-fix-sweep-payroll-lonnsgrunnlag.spec.ts` | n/a | MISSING | — |
| P5-1 | Admin enters tax card manually | MISSING | n/a | MISSING | — |
| P5-2 | Admin reveals bank account | `payroll-phase-5/reveal.spec.ts` | n/a | MISSING | — |
| P5-3 | Admin reveals personal number | `payroll-phase-5/reveal.spec.ts` | n/a | MISSING | — |
| P5-4 | Cross-workspace reveal rejected | `payroll-phase-5/reveal.spec.ts` | n/a | MISSING | — |
| P5-5 | Employee self-reveals own PII | `payroll-phase-5/reveal.spec.ts` | n/a | MISSING | — |
| T1 | Admin configures tariff admin page | MISSING | n/a | MISSING | — |
| T2 | System sets up workspace tariff | MISSING | n/a | MISSING | — |
| T3 | Tariff BFF mobile read | MISSING | MISSING | MISSING | — |
| T4 | Mobile tariff read | MISSING | MISSING | MISSING | — |
| T5 | Tariff capability tools (3 tools) | MISSING | n/a | MISSING | — |

## Gaps in test coverage

| Priority | Gap | Severity | Notes |
|---|---|---|---|
| 1 | Tariff capability tools (Phase 7f) — zero automated tests | high | 3 tools shipped, delegation chain untested. Most complex new code. |
| 2 | Manual supplements + line override (Phase 2) | high | C4 flow untested. No E2E, no capability unit test. |
| 3 | Time-bank balance adjust + force payout | high | PII-adjacent and financial — no E2E. |
| 4 | Mobile payroll components | med | 9 components, 0 E2E tests. Only `payroll-calc.test.ts` unit. |
| 5 | Tax card entry (Phase 5-1) | med | Only reveal (personal number + bank account) has E2E. Tax card entry has no test. |
| 6 | Tip distribution merges into payroll | med | No E2E for tip distribution flow. |

## Calc engine coverage (strong)

The `packages/payroll-calculate/__tests__/` suite is comprehensive:
- 8 unit test files covering all major functions
- Golden-month reference with cents-exact expected output
- May-2026 simulation scenario

This is the domain's strongest test layer. Any change to calc engine MUST pass golden-month before merging.
