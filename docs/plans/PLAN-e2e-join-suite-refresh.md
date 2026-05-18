---
title: "Plan — e2e-join-suite-refresh"
status: done
updated: 2026-05-18
created: 2026-05-18
module: e2e
tags: [plan, e2e, join, playwright, testing]
---

# Plan — e2e-join-suite-refresh

> Branch: `feat/e2e-join-suite-refresh` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: e2e | Started: 2026-05-18

## Goal

Repair 4 stale Playwright specs that referenced phantom `data-botsson-id` / `data-botsson-type` attributes
no longer emitted by WizardShell step containers, and write 3 new journey specs covering Journey 1 (happy path),
Journey 2 (expired session gate), and Journey 3 (long idle + submit) from ADR-0357 and ADR-0358.

## Background

D-Agent analysis surfaced 4 failure modes in existing specs:
1. Phantom `data-botsson-id="join-{step}-step"` selectors — never emitted by current WizardShell
2. `[data-botsson-type="wizard-step"]` used to scope Neste clicks — also phantom
3. Step 3 local Neste button assumed — Step 3 only has WizardNavBar (bottom)
4. Timeouts too short for TypewriterTextarea (adds 50-800ms per field on Step 3)

## Tasks

- [x] Repair `apps/e2e/tests/join-wizard.spec.ts` — remove all phantom selectors, switch to heading/input selectors, bump timeouts to 25_000, replace step-area Neste with `.last()` pattern, update Test 4 to verify WizardNavBar Neste (not phantom step-local button)
- [x] Repair `apps/e2e/tests/join-e2e-flow.spec.ts` — fix `waitForStepHeading` to drop `[data-botsson-type='wizard-step']` fallback
- [x] Repair `apps/e2e/tests/join-to-onboarding.spec.ts` — same `waitForStepHeading` fix
- [x] Repair `apps/e2e/tests/join-wizard-deep.spec.ts` — replace all `[data-botsson-id="join-*-step"]` + `[data-botsson-id="join-shell"]` with heading assertions; update `clickStepNext` to always use `.last()`
- [x] Write `apps/e2e/tests/join-journey-1-happy.spec.ts` — full wizard happy path smoke test
- [x] Write `apps/e2e/tests/join-journey-2-expired-session.spec.ts` — expired cookie gate + fresh visitor no-redirect
- [x] Write `apps/e2e/tests/join-journey-3-long-idle.spec.ts` — 6-minute idle simulation via `page.clock.fastForward`
- [x] Write docs (plan, journey, handoff)

## Acceptance Criteria

- [x] All 7 specs parse without TypeScript errors (`playwright test --list` exits 0)
- [x] No `data-botsson-id` / `data-botsson-type` selector remains in any `join-*.spec.ts`
- [x] Journey 2 cookie-injection pattern uses `context.clearCookies({ name: /^sb-/ })`
- [x] Journey 3 uses `page.clock.fastForward("6:00")` for idle simulation
- [ ] Suite green locally against running dev environment (Track V, orchestrator-driven)
- [x] Decision log updated (no new ADR required — test infrastructure only)
- [x] User journeys written

## Out of Scope

- Spec for /onboarding completion (separate sortie)
- Mobile e2e tests
- Adding `data-botsson-id` to wizard step components (requires ADR — out of scope for test-only sortie)
- Modifying wizard source code under `apps/web/src/app/join/` or `packages/ui/src/wizard/`
