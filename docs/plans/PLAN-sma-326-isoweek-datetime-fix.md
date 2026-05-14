---
title: "Plan — sma-326-isoweek-datetime-fix"
feature: sma-326-isoweek-datetime-fix
spec: ../superpowers/specs/2026-05-13-sma-326-isoweek-datetime-fix.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: payroll
tags: [plan, payroll, deviation-checks, W03, W04]
---

# Plan — sma-326-isoweek-datetime-fix

> Branch: `feat/sma-326-isoweek-datetime-fix` | Worktree: `~/dev/smartout.ai-wt-4` | Module: payroll

**Spec:** [SMA-326 isoWeek/isoYear datetime concat fix](../superpowers/specs/2026-05-13-sma-326-isoweek-datetime-fix.md)
**Linear:** [SMA-326](https://linear.app/smartout/issue/SMA-326)

## Journeys (the contract)

- [JOURNEY-sma-326-isoweek-datetime-fix-w03-correct-weekly-aggregation](../journeys/JOURNEY-sma-326-isoweek-datetime-fix-w03-correct-weekly-aggregation.md) — W03 aggregates shifts per ISO week (not collapsed cross-week into one NaN bucket)
- [JOURNEY-sma-326-isoweek-datetime-fix-w03-message-contains-real-week-number](../journeys/JOURNEY-sma-326-isoweek-datetime-fix-w03-message-contains-real-week-number.md) — W03 deviation message contains correct ISO week number (e.g. "uke W14"), not "WNaN"
- [JOURNEY-sma-326-isoweek-datetime-fix-w04-rolling-window-aggregation](../journeys/JOURNEY-sma-326-isoweek-datetime-fix-w04-rolling-window-aggregation.md) — W04 4-week rolling OT cap uses correct week-keys (not NaN collisions)

## Goal

Fix `isoWeek` + `isoYear` in `packages/payroll-calculate/src/deviation-checks.ts` to tolerate full ISO datetime input. Eliminates false-positive W03 + W04 warnings and "WNaN" in deviation messages.

## Coordinator + agents (per Pontus 2026-05-13 directive)

This sortie is coordinated by lead agent (Opus). Implementation delegated:

| Track | Agent | Model | Phase |
|---|---|---|---|
| A. Pre-flight call-site mapping | Explore | haiku | Before code |
| B. Implement fix + 3 regression tests | botsson-harness-builder | sonnet | After Track A green |
| C. Code review | feature-dev:code-reviewer | sonnet | After Track B green |
| D. Linear ticket update | task-assistant | haiku | After Track C green |
| E. Closure | self (coordinator) | opus | Final |

## Tasks

- [ ] **T0 (Pre-flight)** — Explore agent maps all `isoWeek` + `isoYear` callers; classifies input shape (YYYY-MM-DD vs full ISODateTime); greps for "WNaN" or NaN-week persistence in DB/API surface
- [ ] **T1 (Implement)** — botsson-harness-builder applies 5-line fix (strip to first 10 chars); reruns 35/35 + 58/58 tests
- [ ] **T2 (Regression tests)** — botsson-harness-builder adds 3 new tests (one per journey)
- [ ] **T3 (Code review)** — code-reviewer second-pair on fix + tests
- [ ] **T4 (Ticket update)** — task-assistant posts SMA-326 comment with corrected diagnosis + closure plan
- [ ] **T5 (Closure)** — verify journeys, HANDOFF, close-feature.sh

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] `isoWeek("2026-04-07T06:00:00Z")` returns 14 (was NaN)
- [ ] `isoWeek("2026-04-07")` still returns 14 (backward-compat)
- [ ] `isoYear` analogously tolerant
- [ ] New test: 3 shifts across W14/W15/W16 each <10h OT → W03 does NOT fire
- [ ] New test: W03 message contains literal "uke W<N>" with real digit
- [ ] New test: W04 4-week rolling correctly windows per week
- [ ] Existing tests still pass: 35/35 deviation-checks + 58/58 simulation
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] SMA-326 Linear comment with corrected diagnosis posted
- [ ] Decision log update if scope expands beyond bug-fix

## Council escalation triggers

- R1: Pre-existing test breaks after fix → council on fixture truth
- R2: Pre-flight finds mixed YYYY-MM-DD + datetime callers → council on API contract
- R3: Pre-flight finds NaN persisted in DB/API → council on backfill scope
- T1/T3 disagreement on fix approach → council
- Scope grows >10 LOC → council on whether to split sortie
