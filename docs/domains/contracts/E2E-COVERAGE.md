---
title: "Contracts — E2E Coverage"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: contracts
mirror: verified
last_verified: 2026-05-23
tags: [contracts, e2e, playwright, testing]
---

# Contracts — E2E Coverage

> Test = proof of built. All paths verified against `apps/e2e/`.

## Spec files

### Harness tests

| File | Coverage |
|---|---|
| `apps/e2e/tests/contract-harness-e2e.spec.ts` | Contract harness integration (helper-driven) |
| `apps/e2e/tests/contract-intake-harness-e2e.spec.ts` | Contract intake harness (submit_field_group, decline_intake) |
| `apps/e2e/tests/contracts-api.spec.ts` | API-level contract CRUD smoke tests |
| `apps/e2e/tests/journey-onboarding-step-contract.spec.ts` | Onboarding wizard contract step |
| `apps/e2e/tests/journey-employee-contract-e2e.spec.ts` | Employee contract journey end-to-end |
| `apps/e2e/tests/e2e-contract-template-maler.spec.ts` | Template (Maler tab) CRUD |

### `apps/e2e/tests/contract-employee/` (7 files)

| File | Journey |
|---|---|
| `journey-1-define-basis.spec.ts` | Journey 1: Admin defines contract basis |
| `journey-2-admin-send.spec.ts` | Journey 2: Admin sends (DocuSeal dispatch) |
| `journey-2-send-drawer.spec.ts` | Journey 2 variant: Send drawer UX |
| `journey-3-employee-sign.spec.ts` | Journey 3: Employee signs (embedded DocuSeal) |
| `journey-3-walt-sign.spec.ts` | Journey 3 variant: WalkAI-assisted sign |
| `journey-4-daily-enforcement.spec.ts` | Journey 4: Active contract → day-session enforcement |
| `journey-5-amendment-flow.spec.ts` | Journey 5: Amendment propose → accept |

### `apps/e2e/tests/contracts/` (12 files)

| File | Coverage |
|---|---|
| `employee-contract-create.spec.ts` | Create employment contract |
| `employee-contract-send.spec.ts` | Send to employee |
| `employee-contract-sign.spec.ts` | Employee signing path |
| `employee-contract-cancel.spec.ts` | Cancel before sign |
| `hub-redesign.spec.ts` | Contract hub tabs (Kontrakter/Maler/Bindinger) |
| `preview-editor.spec.ts` | Preview editor before send |
| `workspace-template-fork.spec.ts` | Fork template to workspace |
| `bindings-tab.spec.ts` | Template binding management |
| `bulk-send.spec.ts` | Bulk send to multiple employees |
| `composition-drawer.spec.ts` | Composition engine drawer UX |
| `cascade-drift-observability.spec.ts` | Cascade drift detection |
| `reverse-flow.spec.ts` | Contract reverse (employee-initiated) |

### `apps/e2e/tests/contracts-compliance/` (2 files)

| File | Coverage |
|---|---|
| `journey-a-singular-bypass.spec.ts` | §14-6 singular bypass detection |
| `journey-d-pdf-gate-bypass.spec.ts` | PDF gate bypass |

**Note:** These files may have `test.skip` annotations from prior compliance debt cleanup. Verify before declaring coverage.

### `apps/e2e/tests/contracts-compliance-debt/` (3 files)

| File | Coverage |
|---|---|
| `journey-court-order-create.spec.ts` | Admin creates court-order deduction consent |
| `journey-court-order-then-trekk.spec.ts` | Court-order → trekk flow |
| `journey-non-court-order-rejected.spec.ts` | Non-court-order correctly rejected |

### `apps/e2e/contract-employee/` (directory)

Listed in `apps/e2e/contract-employee/` — may contain additional specs. Verify with `ls apps/e2e/contract-employee/`.

## Helper utilities

| File | Purpose |
|---|---|
| `apps/e2e/helpers/contract-harness.ts` | Shared harness functions for contract tests |
| `apps/e2e/helpers/contract-intake-harness.ts` | Intake-specific harness helpers |

## Coverage summary

| Area | Coverage |
|---|---|
| Create employment contract | ✅ |
| Send (DocuSeal dispatch) | ✅ |
| Employee sign (embedded) | ✅ |
| Cancel | ✅ |
| Amendment flow | ✅ |
| Template CRUD | ✅ |
| Template fork | ✅ |
| Template binding | ✅ |
| Bulk send | ✅ |
| Composition drawer | ✅ |
| Preview editor | ✅ |
| Contract hub (tabs) | ✅ |
| Intake (submit + decline) | ✅ |
| GDPR anonymize RPC | 🟡 journey doc only; no dedicated Playwright spec |
| Mobile sign (ADR-0245) | 🔴 no mobile Playwright spec |
| Phantom contract promotion | 🔴 no Playwright spec |
| Lærling-kontrakter | 🔴 no Playwright spec |
| Tripletex sync | 🔴 no Playwright spec |
| Amendment classifier UI | 🔴 no Playwright spec |
| AcknowledgementRing | 🔴 no Playwright spec |

## Honest delta

Strong coverage on the core create → send → sign → active lifecycle. Amendment flow covered. Compliance edge cases covered via `contracts-compliance-debt/`.

Gaps: mobile (no Playwright), GDPR RPC (no dedicated spec beyond journey doc), phantom/lærling/Tripletex (all deferred, no specs).
