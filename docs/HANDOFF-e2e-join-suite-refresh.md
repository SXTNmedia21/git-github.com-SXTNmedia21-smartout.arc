---
title: "Handoff — e2e-join-suite-refresh"
status: done
updated: 2026-05-18
created: 2026-05-18
module: e2e
tags: [handoff, e2e, join, playwright, testing]
---

# Handoff: E2E Join Suite Refresh (F3)

## What Was Built

Repaired 4 stale Playwright specs and wrote 3 new journey specs for the `/join` signup wizard.
This is a test-only sortie — no wizard source code was modified.

## Files Changed

**Repaired (4):**
- `apps/e2e/tests/join-wizard.spec.ts` — removed all `[data-botsson-id]`/`[data-botsson-type]` selectors; replaced with heading text + input ID locators; bumped timeouts to 25_000ms; Test 4 now asserts WizardNavBar Neste (not phantom step-local button); Test 7 rewrites full flow without phantom step IDs
- `apps/e2e/tests/join-e2e-flow.spec.ts` — `waitForStepHeading` helper drops `[data-botsson-type='wizard-step']` fallback
- `apps/e2e/tests/join-to-onboarding.spec.ts` — same `waitForStepHeading` fix
- `apps/e2e/tests/join-wizard-deep.spec.ts` — all `[data-botsson-id="join-*-step"]` + `[data-botsson-id="join-shell"]` replaced with heading assertions; `clickStepNext` always uses `.last()` (no phantom step-area scoping)

**New specs (3):**
- `apps/e2e/tests/join-journey-1-happy.spec.ts` — full wizard smoke test, redirects to /onboarding
- `apps/e2e/tests/join-journey-2-expired-session.spec.ts` — expired cookie → /login redirect + fresh visitor no-redirect
- `apps/e2e/tests/join-journey-3-long-idle.spec.ts` — 6-minute idle via `page.clock.fastForward`, submit must not 500

**Docs (3):**
- `docs/plans/PLAN-e2e-join-suite-refresh.md`
- `docs/journeys/JOURNEY-e2e-join-suite-refresh.md`
- `docs/HANDOFF-e2e-join-suite-refresh.md` (this file)

## Decisions Made

No new ADR required. This sortie is test infrastructure only. Key decisions:

1. **No `data-botsson-id` added to wizard components** — would require an ADR and wizard source changes. Test selectors use stable heading text (i18n keys) and HTML input IDs instead.
2. **Step 3 Neste always via WizardNavBar `.last()`** — Step 3 has no local Neste button. All specs now use `.last()` consistently across all steps to avoid ambiguity.
3. **Timeouts raised to 25_000ms** — TypewriterTextarea adds 50-800ms per field. 10_000ms was too tight for Step 3 heading appearance after navigation.
4. **Journey 2 uses `context.clearCookies`** — Playwright's built-in method, no custom cookie manipulation needed.
5. **Journey 3 uses `page.clock.fastForward("6:00")`** — simulates idle without actual waiting. Accepts either /onboarding or /login?return_to as valid outcomes per ADR-0358.

## Learnings

- WizardShell step containers never emitted `data-botsson-id` attributes — the D-agent selector plan pre-dated the final implementation. Future specs must use heading text or stable field IDs.
- `[data-botsson-type="wizard-step"]` was also phantom — scoped Neste lookups inside it always fell through to the `.last()` fallback anyway. The fallback is now the primary pattern.
- `page.clock.fastForward` format is `"MM:SS"` (string) — e.g. `"6:00"` for 6 minutes.

## Known Issues / Debt

- Journey 1 test creates a real Supabase user on each run (unique email) — needs a cleanup fixture or test-user teardown in CI. No current mechanism.
- Journey 2 "Sesjonen er utløpt" banner assertion: if the banner's text changes in i18n, the test will fail. Tied to `login.expiredSessionBanner` i18n key.
- Journey 3 `page.clock.fastForward` freezes `Date.now()` — if token rotation uses `setTimeout` internals, simulate may not trigger rotation. This tests the submit path without actual rotation stress.

## Next Steps

1. Track V (orchestrator): run `playwright test apps/e2e/tests/join-*.spec.ts` against dev environment
2. If Journey 1 creates orphan users: add `test.afterEach` cleanup via Supabase admin API
3. If Journey 2 banner text drifts: update regex in spec or extract to shared constant
4. Future sortie: add `data-testid` (not `data-botsson-id`) attributes to WizardShell step containers via ADR — would make selectors more robust without coupling to visual headings
