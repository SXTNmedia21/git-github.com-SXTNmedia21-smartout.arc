---
title: "Onboarding Wizard — E2E Coverage"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, e2e, testing, playwright, maestro]
mirror: verified
last_verified: 2026-05-23
---

# Onboarding Wizard — E2E Coverage

> Test = proof of built. A flow without a test is `mirror: aspirational` until proven.

## Coverage matrix

| # | Flow | Web E2E (Playwright) | Mobile E2E | Capability unit | Manual |
|---|---|---|---|---|---|
| 1 | Web — new employee completes 8-step wizard | `apps/e2e/tests/onboarding-wizard-deep.spec.ts` ✅ | — (web-only flow) | `save-availability.test.ts` (3 tests) + `save-consent.test.ts` (7 tests) | verified on feat branch |
| 2 | Mobile — new employee completes 8-step wizard | — (mobile-only flow) | 🟡 manual smoke only (Maestro not shipped) | same Server Action unit tests cover BFF-delegated path | manual verified |
| 3 | Dismiss mid-wizard → resume from home CTA | `apps/e2e/tests/onboarding-wizard-deep.spec.ts` ✅ (covers dismiss + resume cycle) | 🟡 manual only | — | verified |

## Unit tests

| File | Tests | What is covered |
|---|---|---|
| `apps/web/src/app/dashboard/_actions/save-availability.test.ts` | 3 | RRULE row construction, idempotent re-write, empty-set (no rows) path |
| `apps/web/src/app/dashboard/_actions/save-consent.test.ts` | 7 | handbook-only, gdpr-only, handbook+gdpr, handbook+gdpr+tariff, duplicate acceptance (two rows written), workspace_id server-derived (never from body), INSERT failure rollback |

## Playwright spec details

`apps/e2e/tests/onboarding-wizard-deep.spec.ts`:
- 8-step happy path on web (steps 1–8, all required fields filled)
- Step 2 resume after page refresh (cross-step state preservation via `employee_onboarding_state`)
- AvailabilityStep: select 2 unavailable days → verify RRULE rows via API
- ConsentStep: accept handbook + gdpr → verify `consent_acceptance` rows
- Dismiss at step 4 → home shows `CompleteProfileCard` → resume → complete

Related Playwright specs (pre-existing):
- `apps/e2e/tests/join-to-onboarding.spec.ts` — invite acceptance → redirect to wizard gate
- `apps/e2e/tests/onboarding.spec.ts` — baseline onboarding flow (pre-sortie state; may need update after gate wire)

## Gaps

| Gap | Severity | Roadmap phase |
|---|---|---|
| Maestro mobile E2E — 8-step happy path + dismiss-resume not automated | medium | Phase E |
| `onboarding.spec.ts` may need update after gate wire to avoid `return null` expectations | low | next cleanup pass |
| ConsentStep: PDF preview of handbook link not tested end-to-end (content gap) | low | — |
