---
title: "Scheduling — E2E Coverage"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scheduling
mirror: verified
last_verified: 2026-05-23
tags: [scheduling, e2e, playwright, coverage, testing]
---

# Scheduling — E2E Coverage

> Test coverage map. "Verified" = spec file exists and is non-empty. "Missing" = no spec file.

## Spec Files

| File | Coverage | Status |
|---|---|---|
| `apps/e2e/schedule/density.spec.ts` | Schedule card density toggle + persistence (ADR-0364) | ✅ Exists |
| `apps/e2e/tests/shift-swap-harness-e2e.spec.ts` | Shift swap harness — integration tests via `helpers/shift-swap-harness.ts` | ✅ Exists |
| `apps/e2e/tests/shift-lifecycle-harness-e2e.spec.ts` | Shift lifecycle harness — publish/approve/interpret/settle | ✅ Exists |
| `apps/e2e/tests/schedule-harness-e2e.spec.ts` | Schedule harness — general schedule operations | ✅ Exists |
| `apps/e2e/tests/journey-shift-clock.spec.ts` | Shift clock punch-in/out journey (EDGE — day-session) | ✅ Exists |
| `apps/e2e/tests/journey-shift-temporal-lock.spec.ts` | Temporal lock enforcement — attempt edit after lock date | ✅ Exists |
| `apps/e2e/tests/journey-shift-session-spine.spec.ts` | `shift_session` spine (ADR-0367 runtime layer) | ✅ Exists |
| `apps/e2e/tests/sortie-1-mobile-shift-confirm.spec.ts` | Mobile shift confirm flow | ✅ Exists |
| `apps/e2e/tests/sortie-p0-fix-sweep-shift-chat-banner.spec.ts` | Shift chat banner fix (ADR-0238 DomainChatOwnership) | ✅ Exists |
| `apps/e2e/tests/daily-operation-roster-add-shift.spec.ts` | Roster — manual add shift (ADR-0189 Invariant #13) | ✅ Exists |
| `apps/e2e/tests/domain-chat-ownership/schedule-active.spec.ts` | DomainChatOwnership on schedule page | ✅ Exists |
| `apps/e2e/tests/mobile/03-workspace-select-to-shift-hub.spec.ts` | Mobile: workspace select → shift hub | ✅ Exists |
| `apps/e2e/tests/mobile-pwa/mobile-lands-on-shift-hub.spec.ts` | Mobile PWA: lands on shift hub | ✅ Exists |
| `apps/e2e/tests/botsson-recorder/schedule-wrong-day-replay.spec.ts` | Botsson recorder: schedule wrong-day replay | ✅ Exists |
| `apps/e2e/procedure-engine/journey-4-shift-location.spec.ts` | Procedure-engine shift location (EDGE) | ✅ Exists |
| `apps/e2e/db/triggers/shift-session-trigger.spec.ts` | `shift_session` trigger correctness | ✅ Exists |

## Helpers / Harnesses

| File | Purpose |
|---|---|
| `apps/e2e/helpers/schedule-harness.ts` | General schedule test helper (create, publish, verify) |
| `apps/e2e/helpers/shift-lifecycle-harness.ts` | Lifecycle helper — test each layer transition |
| `apps/e2e/helpers/shift-swap-harness.ts` | Swap flow helper — initiate, respond, approve |

## Protocol Files (non-spec, reference)

| File | Purpose |
|---|---|
| `apps/e2e/protocols/p-scheduler-propose-accept.ts` | Protocol: propose_plan → accept_proposal |
| `apps/e2e/protocols/p-scheduler-mobile-bundle.ts` | Protocol: mobile bundle review |
| `apps/e2e/scripts/schedule-perf-baseline.ts` | Performance baseline script |
| `apps/e2e/schedule/density.fixtures.ts` | Density test fixtures |

## Coverage Gaps (Missing Playwright Specs)

| Flow | Journey | Gap |
|---|---|---|
| Greedy solver full pipeline | JOURNEY-world-best-wfm-scheduler-greedy.md | 🔴 No end-to-end Playwright spec (only protocol file `p-scheduler-propose-accept.ts` — not a `.spec.ts`) |
| Marketplace full pipeline | JOURNEY-world-best-wfm-shift-marketplace.md | 🔴 No dedicated `.spec.ts` for post_open → claim → approve |
| Swap full pipeline (user-facing) | (handoff) | 🟡 Harness exists but no full journey spec covering all 3 phases |
| My-schedule employee view | JOURNEY-scheduler-web.md | 🔴 No Playwright spec for employee schedule read surface |
| Mobile shift-create BFF flow | ADR-0277 | 🔴 No spec; legacy direct insert not tested against BFF contract |
| Schedule mal-modus (template mode) | JOURNEY-mal-modus-schedule.md | 🔴 No spec |
| Solver V1 greedy quality check | ADR-0307 | 🔴 Vitest unit test (`greedy.test.ts`) exists; no Playwright system test |
| Mobile scheduler view | JOURNEY-scheduler-mobile.md | 🔴 No spec for employee my-schedule on mobile |

## Coverage Assessment

- **Strong:** Temporal lock, density persistence, shift clock (edge), shift lifecycle harness, schedule harness, domain-chat-ownership, roster-add-shift, shift session spine, mobile shift hub.
- **Weak:** Solver propose+accept, marketplace pipeline, swap full journey, employee my-schedule, mal-modus, mobile BFF authoring.
- **Delta:** ~7 missing specs for core scheduling workflows.
