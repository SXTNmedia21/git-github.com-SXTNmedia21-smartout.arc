---
title: "Worklog — journey-engine"
status: done
updated: 2026-03-08
created: 2026-03-08
module: core
tags: [journey, engine, events, e2e]
---

# Worklog — journey-engine

> Branch: `feat/journey-engine` | Worktree: wt-2 | Started: 2026-03-08

## Status: ✅ Phase 1-3 Complete

## Done

### Phase 1 — Foundation (8 tasks)

- [x] Schema migrations: journey table FK to engine_process, journey_step overrides
- [x] engine_event.workspace_id nullable for pre-workspace events
- [x] Seed signup_onboarding process: 10 steps (8 wait + match_state + notification)
- [x] Seed workspace_setup process: 9 wizard wait_for_event steps
- [x] engine-dispatch upgrades: condition-match, entity filtering, match_state, state_step tracking
- [x] Telemetry: 5 new events (signup.completed, onboarding.step_completed, workspace.created, wizard.step_completed, wizard.completed)
- [x] condition-evaluator: match_state operator with stateContext
- [x] engine_state.workspace_id + engine_trigger.workspace_id nullable

### Phase 2 — Compile + Emit (8 tasks)

- [x] Pure compile function: CompileInput → CompileOutput (process + steps + trigger)
- [x] Compile server action for Journey Portal
- [x] emit("signup completed") in auth callback
- [x] emit("onboarding step_completed") in useOnboardingState
- [x] emit("workspace created") in finalize
- [x] emit("wizard step_completed") + emit("wizard completed") in WorkspaceSetupWizard
- [x] Compile button + runtime stats in journey detail view
- [x] database.types.ts regenerated

### Phase 3 — E2E + Verification (5 tasks)

- [x] E2E tests: 3 signup_onboarding + 3 workspace_setup (API-driven, no browser)
- [x] Journey reporter for Playwright
- [x] Bug fix: executeStep skips condition for wait_for_event (resumption-only)
- [x] Bug fix: engine_state_step tracking in resumption path
- [x] Bug fix: entity_id matching relaxed for non-entity-scoped events
- [x] All 6 E2E tests green ✓
- [x] Typecheck green: 19/19 packages ✓

### Phase 4 — Hardening (deferred)

- [ ] Error handling + retry logic
- [ ] Idle detection (stuck states)
- [ ] A/B test support

## Decisions

| Date       | Decision                                       | Reason                                                                       |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-03-08 | wait_for_event conditions are resumption-only  | Conditions on wait steps are meant for event matching, not initial execution |
| 2026-03-08 | Nullable workspace_id across engine tables     | Signup happens before workspace exists                                       |
| 2026-03-08 | match_state operator for cross-entity matching | workspace.created must find signup_onboarding state by user_identity_id      |
| 2026-03-08 | API-driven E2E tests                           | WSL2 lacks Chromium deps; fetch tests prove the engine chain without browser |
| 2026-03-08 | Relaxed entity_id matching                     | Non-entity-scoped events (wizard steps) must resume entity-scoped states     |

## Log

| Date       | Time  | Event                                              |
| ---------- | ----- | -------------------------------------------------- |
| 2026-03-08 | 20:37 | Feature started                                    |
| 2026-03-08 | 20:45 | Phase 1 migrations + seeds created                 |
| 2026-03-08 | 21:00 | Phase 1 engine-dispatch upgrades complete          |
| 2026-03-08 | 21:10 | Phase 2 compile function + emit instrumentation    |
| 2026-03-08 | 21:20 | Phase 3 E2E tests created                          |
| 2026-03-08 | 21:30 | Typecheck green 19/19                              |
| 2026-03-08 | 21:35 | Critical bug: wait_for_event steps skipped — fixed |
| 2026-03-08 | 21:40 | engine_state_step tracking in resumption — fixed   |
| 2026-03-08 | 21:45 | entity_id matching relaxed — fixed                 |
| 2026-03-08 | 21:50 | All 6 E2E tests green                              |
| 2026-03-08 | 21:55 | Phase 1-3 complete                                 |
