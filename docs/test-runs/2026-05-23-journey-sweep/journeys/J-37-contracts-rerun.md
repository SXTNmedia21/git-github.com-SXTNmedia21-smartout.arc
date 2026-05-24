---
title: J-37 Contracts (rerun) — real bugs after cascade-disambiguation
status: FAIL (real)
journey_docs: (same as J-33)
spec: apps/e2e/tests/contracts/
result_initial: 0 pass / 21 fail (cascade)
result_rerun: 4 pass / 17 fail / 4 skip / 1 dnr (real)
evidence: ../evidence/run-37-contracts-rerun.log
---

# J-37 Contracts — 4 PASS / 17 REAL FAIL

## Real bugs (post-cascade-rerun)

### BUG-12 (CRITICAL) — `employment_contract.employment_form` NOT NULL but seed helper doesn't set it
- 5 tests fail in `employee-contract-cancel.spec.ts` + `employee-contract-send.spec.ts` (`setup — seed draft contract`)
- Error: `null value in column "employment_form" of relation "employment_contract" violates not-null constraint`
- Hypothesis: recent migration added NOT NULL on `employment_form`, but `seedContract` / `seedDraftContract` helpers in `apps/e2e/helpers/contract-harness.ts` (or similar) not updated
- Action: trace seed helpers; add `employment_form: 'permanent_full_time'` (or correct enum default)

### BUG-13 — Multiple contract UI elements not visible
- 8 tests: bindings-tab matrix, cascade-drift drawer, composition-drawer (open + ESC), employee-contract-create CTA, preview-editor bundle, hub-redesign chip
- All `element(s) not found` after navigation succeeded
- Hypothesis: testids drift OR Layout doesn't mount expected components OR auth-routed user lands on different page
- Action: manual repro — navigate to `/dashboard/contracts` and inspect actual DOM vs expected testids

### BUG-14 — Page crashes on contract surfaces
- 3 tests: employee-contract-create (HTML edit step), hub-redesign initial nav, reverse-flow
- Chromium tabs crash with "Page crashed" — heavier than RAM-OOM cascade (these happened during a healthy rerun)
- Hypothesis: heavy bundles (DocuSeal embed iframe?) + RAM pressure peak inside chromium
- Action: re-run isolated with RAM > 6 Gi to disambiguate from real perf issue

## Action
- Fix BUG-12 first (mechanical seed update) — unblocks 5 tests
- Then investigate BUG-13 + BUG-14 in isolation
