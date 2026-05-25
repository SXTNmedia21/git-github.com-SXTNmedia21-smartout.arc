---
title: Restaurant Week Simulation — Index
status: in_progress
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [simulation, journey-verification, gaps, bugs, restaurant]
---

# Restaurant Week Simulation — Index

> Autonomous full-week walk-through of Smartout in a busy 18-employee Oslo bistro ("Bella Vista").
> Goal: produce comprehensive Gaps + Bugs sheet by tracing every journey day-by-day, role-by-role,
> across web + mobile surfaces. NEW findings only — dedup vs `docs/test-runs/2026-05-23-journey-sweep/BUGS.md`.

## Personas

| Role | Name | Smartout role | Notes |
|------|------|--------------|-------|
| Owner | Pontus | owner / admin | Reviews payroll, contracts, billing, governance |
| Daily manager | Erik | manager | Schedule, deviations, helpdesk, announcements |
| Trainer / sous | Anna | manager | Onboarding new hires |
| New hire | Maria | employee (trainee) | Started Monday — onboarding wizard, contract, first shift |
| Veterans | Lars, Sofia, Kim, +12 | employee (active) | Clock-in, day-line, tasks |
| Off-prem helpdesk | (Smartout SLA flow) | system | Helpdesk SLA escalation |

## Week schedule (simulated)

| Day | Focus | Lead agent |
|-----|-------|-----------|
| Mon 2026-05-25 | Workspace bootstrap, Maria onboarding (wizard → contract → first shift seed) | A1 Owner-Setup |
| Tue 2026-05-26 | Schedule planning, shift assignment, season check | A2 Manager-Schedule |
| Wed 2026-05-27 | Day-line execution, slot tasks, announcements | A3 Employee-Execution + A4 Comms |
| Thu 2026-05-28 | Sick call → deviation → manager reschedule + helpdesk query | A2 + A4 |
| Fri 2026-05-29 | Busy service: clock-in/out, settlement, deviation | A3 |
| Sat 2026-05-30 | Tip distribution, end-of-day, tasks, training protocol | A3 |
| Sun 2026-05-31 | Period close, payroll calc, contract review, billing | A5 Period-Close |

## Files in this run

- `INDEX.md` — this file
- `SIMULATION-PLAN.md` — day-by-day expected journey walkthrough
- `GAPS.md` — feature gaps (missing surfaces, unimplemented flows, UX holes)
- `BUGS.md` — code bugs (broken behavior, regressions, errors)
- `findings/agent-{1..5}-*.md` — raw per-agent findings (before synthesis)
- `SYNTHESIS.md` — consolidated gaps + bugs + fast-wins

## Synthesis pass

Once all 5 agents report → opus synthesizer merges into `GAPS.md` + `BUGS.md` + `SYNTHESIS.md`,
deduping against existing `docs/test-runs/2026-05-23-journey-sweep/BUGS.md`.

## Closure

`/close-feature` after synthesis complete. Suggest `/promote-preview` to Pontus.
