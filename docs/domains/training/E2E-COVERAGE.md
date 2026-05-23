---
title: Training Domain — E2E Coverage
status: done
updated: 2026-05-23
created: 2026-05-23
domain: training
tags: [training, e2e, testing, playwright, coverage]
mirror: verified
last_verified: 2026-05-23
---

# Training Domain — E2E Coverage

Code wins. Verified by `find /home/sxtnl/dev/smartout.ai/apps/e2e -name "*training*"`.

## Existing tests

| File | What it covers | Status |
|---|---|---|
| `apps/e2e/governance-training-mvp/engine-dispatch.spec.ts` | Governance + procedure-engine dispatch (engine-dispatch spec — tests the event-engine processing of training-related events). Shared with procedure-engine domain. | ✅ Exists |
| `apps/e2e/governance-training-mvp/observer-request.spec.ts` | Four-eyes observer request flow (ADR-0105). Shared with procedure-engine domain. | ✅ Exists |
| `apps/e2e/tests/training-harness-e2e.spec.ts` | Training harness integration test. | ✅ Exists |
| `apps/e2e/helpers/training-harness.ts` | Test helpers for training flows (helper, not a spec). | ✅ Exists |
| `apps/e2e/tests/mobile/05-training-page.spec.ts` | Mobile training page smoke test. | ✅ Exists |

## Coverage matrix

| Flow | Covered by | Status |
|---|---|---|
| F1 — Auto-assign on profile creation | No dedicated spec | 🔴 Missing |
| F2 — Employee: procedure step completion | `training-harness-e2e.spec.ts` (partial?) | 🟡 Partial |
| F2 — Employee: knowledge test submit + pass | No dedicated spec | 🔴 Missing |
| F2 — Employee: confirmation sign | No dedicated spec | 🔴 Missing |
| F2 — Full protocol → completed flow | No dedicated spec | 🔴 Missing |
| F3 — Admin: people/training readiness matrix load | No dedicated spec | 🔴 Missing |
| F3 — Admin: department filter interaction | No dedicated spec | 🔴 Missing |
| F4 — HMS training page render | No dedicated spec | 🔴 Missing |
| F5 — Mobile training list + readiness % | `05-training-page.spec.ts` (smoke) | 🟡 Partial |
| F6 — AI capability: get_my_training_status | No dedicated spec | 🔴 Missing |
| F7 — Profession-training bootstrap at I1 | No dedicated spec | 🔴 Missing |
| Observer request flow | `observer-request.spec.ts` | ✅ Covered |
| Engine dispatch for training events | `engine-dispatch.spec.ts` | ✅ Covered |

## Gap summary

- 5 of 9 training-specific flows have zero or only smoke-level coverage
- Critical missing: full F2 flow (step → test → confirmation → protocol completed)
- Critical missing: F1 auto-assign trigger E2E
- Mobile: only smoke test, no completion flow coverage

## Recommended next specs

Priority order:

1. `apps/e2e/tests/training-completion-flow.spec.ts` — F2 full cycle (seed assignment → complete all steps → submit test → sign → verify `status = completed`)
2. `apps/e2e/tests/training-auto-assign.spec.ts` — F1 (create profile → verify assignments created by trigger)
3. `apps/e2e/tests/people-training-matrix.spec.ts` — F3 (admin views workforce readiness matrix, department filter works)
4. `apps/e2e/tests/training-ai-capability.spec.ts` — F6 (chat query → capability tools return correct data)
