---
title: "Bootstrap Domain — E2E Coverage"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: bootstrap
last_verified: 2026-05-23
mirror: mixed
tags: [bootstrap, e2e, testing, playwright]
---

# Bootstrap — E2E Coverage

> Test matrix. Verified by grepping `apps/e2e/tests/` and related test directories.

---

## Verified: Existing Test Files Touching Bootstrap/Onboarding/Setup

Grep anchor: `find /home/sxtnl/dev/smartout.ai/apps/e2e -name "*.spec.ts"` + `ls apps/e2e/tests/`

| File | Path | What it covers |
|------|------|----------------|
| `cascade-bootstrap.spec.ts` | `apps/e2e/tests/` | Bootstrap-cascade EF flow (verified by filename) |
| `dashboard-setup-wizard-deep.spec.ts` | `apps/e2e/tests/` | `/dashboard/setup` wizard deep flow |
| `employee-onboarding-wizard.spec.ts` | `apps/e2e/tests/` | Employee onboarding wizard (separate domain) |
| `join-to-onboarding.spec.ts` | `apps/e2e/tests/` | Join flow → onboarding transition |
| `journey-help-tour-onboarding.spec.ts` | `apps/e2e/tests/` | Help tour within onboarding |
| `journey-onboarding-step-contract.spec.ts` | `apps/e2e/tests/` | Contract step in onboarding journey |
| `journey-signup-onboarding.spec.ts` | `apps/e2e/tests/` | Signup → onboarding journey |
| `journey-workspace-setup.spec.ts` | `apps/e2e/tests/` | Workspace setup journey |
| `onboarding-harness-e2e.spec.ts` | `apps/e2e/tests/` | Onboarding harness integration |
| `onboarding-wizard-deep.spec.ts` | `apps/e2e/tests/` | Onboarding wizard deep flow |
| `onboarding.spec.ts` | `apps/e2e/tests/` | Core onboarding spec |
| `website-setup-wizard-deep.spec.ts` | `apps/e2e/tests/` | Website (landing) setup wizard |
| `workspace-setup-flow.spec.ts` | `apps/e2e/tests/` | Workspace setup full flow |

**Protocol tests touching onboarding:**
- `apps/e2e/protocols/P-001-admin-onboarding.ts` — Admin onboarding protocol (verified filename)

---

## Coverage Matrix

| Flow | Test file | Coverage | Notes |
|------|----------|----------|-------|
| Bootstrap-cascade EF (11 steps) | `cascade-bootstrap.spec.ts` | 🟡 partial | File exists; depth unknown without reading content |
| Voice onboarding mission | Not found | 🔴 gap | No voice E2E test for `onboarding-interview` mission |
| Finalize-workspace → bootstrap-cascade chain | `workspace-setup-flow.spec.ts`, `onboarding.spec.ts` | 🟡 partial | Coverage depends on test depth |
| Admin setup wizard (9 steps) | `dashboard-setup-wizard-deep.spec.ts` | 🟡 partial | Deep spec exists |
| workspace.onboarding_completed flag set | `join-to-onboarding.spec.ts`, `journey-signup-onboarding.spec.ts` | 🟡 partial | Flag-setting likely covered in journey |
| workspace.setup_guide_completed flag | `dashboard-setup-wizard-deep.spec.ts` | 🟡 partial | Likely tested in wizard completion |

---

## Gaps (not covered)

| Gap | What is missing | Priority |
|-----|----------------|----------|
| **E1: Voice onboarding mission E2E** | No Playwright or integration test for the 30-min `onboarding-interview` voice mission. All tools (triggerScrape, updateBusiness, finalizeOnboarding) are untested end-to-end. | HIGH — mission is live in production |
| **E2: bootstrap-cascade resume E2E** | No test verifying idempotent resume when `workspace_bootstrap_run.status = 'partial'` + re-run completes remaining steps. | HIGH — resume logic is complex |
| **E3: Bootstrap coordinator E2E** | Aspirational — requires Phase 2 (coordinator) to exist before test can be written. | Aspirational |
| **E4: Week-1 progressive UI E2E** | Aspirational — requires Phase 4 (week-1 UI) to exist. | Aspirational |
| **E5: Critical gate closure E2E** | Aspirational — requires Phase 1 (readiness table) + Phase 2 (coordinator). | Aspirational |
| **E6: Mattilsynet + alcohol-labor seed verification** | No E2E verifying the Mattilsynet (75 inserts) and alcohol-labor (36 inserts) seed routines are correctly created post-bootstrap. | MEDIUM |

---

## Notes

- E2E tests for bootstrap are among the most complex in the system — they require a real Supabase instance, a workspace to bootstrap, and auth. WSL2 OOM issues have historically blocked local E2E runs (see MEMORY.md 2026-05-23 onboarding wizard E2E context).
- The `apps/e2e/protocols/P-001-admin-onboarding.ts` file is a protocol (Playwright protocol wrapper), not a spec — it may be consumed by other spec files.
- Voice E2E would require LiveKit + Ultravox/Realtime LLM mock — significantly more complex than browser Playwright tests.
