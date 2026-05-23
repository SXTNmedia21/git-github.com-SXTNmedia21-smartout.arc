---
title: "Scheduling — User Flows"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scheduling
mirror: verified
last_verified: 2026-05-23
tags: [scheduling, journeys, user-flows, schedule, shift, swap, marketplace]
---

# Scheduling — User Flows

> Index of ~20 journeys grouped by surface. Cross-link to journey files.
> User Manual references (3 langs) are listed separately — do not absorb.

## Admin / Manager Schedule Surface

Core planning flows for managers building and publishing the schedule.

| Journey | File | Scope |
|---|---|---|
| Admin sees consistent schedule UI | [JOURNEY-nordic-split-phase-3a-schedule-admin-ser-konsistent-schedule.md](../../journeys/JOURNEY-nordic-split-phase-3a-schedule-admin-ser-konsistent-schedule.md) | Design-system consistency sweep |
| Admin schedule view | [JOURNEY-schedule-admin-view.md](../../journeys/JOURNEY-schedule-admin-view.md) | Manager: Ansatt/Jobb/Team grid, publish, day-ops |
| Schedule UI | [JOURNEY-schedule-ui.md](../../journeys/JOURNEY-schedule-ui.md) | Base schedule grid interaction |
| Schedule v2 | [JOURNEY-schedule-v2.md](../../journeys/JOURNEY-schedule-v2.md) | V2 schedule rebuild flow |
| Schedule DB persistence | [JOURNEY-schedule-db-persistence.md](../../journeys/JOURNEY-schedule-db-persistence.md) | TanStack Query persistence (ADR-0047) |
| Schedule page polish tier 1 | [JOURNEY-schedule-page-polish-tier1.md](../../journeys/JOURNEY-schedule-page-polish-tier1.md) | UI polish pass |
| Mal-modus (template mode) | [JOURNEY-mal-modus-schedule.md](../../journeys/JOURNEY-mal-modus-schedule.md) | Save/load day templates; `schedule_template_shift` |
| Schedule card density | [JOURNEY-schedule-card-density.md](../../journeys/JOURNEY-schedule-card-density.md) | Shift card density setting (ADR-0364) |
| Schedule card density PLAN | [JOURNEY-schedule-card-density-PLAN.md](../../journeys/JOURNEY-schedule-card-density-PLAN.md) | Planning doc for density persistence |

## Employee My-Schedule Surface

Employee reads their own upcoming shifts.

| Journey | File | Scope |
|---|---|---|
| Scheduler — web (employee schedule view) | [JOURNEY-scheduler-web.md](../../journeys/JOURNEY-scheduler-web.md) | Employee reads schedule on web |
| Scheduler — mobile | [JOURNEY-scheduler-mobile.md](../../journeys/JOURNEY-scheduler-mobile.md) | Employee reads schedule on mobile |
| Mobile shifts overview | [JOURNEY-mobile-shifts-overview.md](../../journeys/JOURNEY-mobile-shifts-overview.md) | Mobile shift hub absorption |
| Mobile phase 3f home absorption shift hub | [JOURNEY-mobile-phase-3f-home-absorption-shift-hub-shell-deleted.md](../../journeys/JOURNEY-mobile-phase-3f-home-absorption-shift-hub-shell-deleted.md) | Home screen shift hub shell |

## Solver / Scheduler (AI-Assisted Planning)

Manager proposes, reviews, and accepts/rejects a solver-generated schedule.

| Journey | File | Scope |
|---|---|---|
| World-best WFM greedy scheduler | [JOURNEY-world-best-wfm-scheduler-greedy.md](../../journeys/JOURNEY-world-best-wfm-scheduler-greedy.md) | ADR-0307/0309: propose_plan → bundle → accept |

## Shift Swap

Bilateral employee shift trade, manager-approved.

| Journey | File | Scope |
|---|---|---|
| (no dedicated swap journey — see handoff) | [HANDOFF-scheduler-web.md](../../HANDOFF-scheduler-web.md) | Swap flow documented in handoff |

## Marketplace (Open Shifts)

Manager posts open/unstaffed shift; employee claims from mobile; manager approves.

| Journey | File | Scope |
|---|---|---|
| World-best WFM shift marketplace | [JOURNEY-world-best-wfm-shift-marketplace.md](../../journeys/JOURNEY-world-best-wfm-shift-marketplace.md) | ADR-0306: post_open → claim → approve |

## Botsson Integration

Botsson reads shift data, creates shifts via proposal pipeline, and surfaces schedule in chat/voice.

| Journey | File | Scope |
|---|---|---|
| Botsson fase-4 proposal pipeline — accept creates shift | [JOURNEY-botsson-fase-4-proposal-pipeline-accept-creates-shift.md](../../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-accept-creates-shift.md) | Botsson proposes shift assignment; manager accepts |
| Botsson fase-4 proposal pipeline — voice propose shift | [JOURNEY-botsson-fase-4-proposal-pipeline-voice-propose-shift.md](../../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-voice-propose-shift.md) | Voice-mode proposal (ADR-0288 own-vs-others gate) |
| Domain-chat ownership — schedule active | [JOURNEY-domain-chat-ownership-e2e-schedule-active.md](../../journeys/JOURNEY-domain-chat-ownership-e2e-schedule-active.md) | DomainChatOwnership surface on schedule page |

## Shift Clock (EDGE — belongs day-session)

Punch-in/out is plan execution, not plan authoring. Listed here for cross-reference only.

| Journey | File | Owner |
|---|---|---|
| Shift clock | [JOURNEY-shift-clock.md](../../journeys/JOURNEY-shift-clock.md) | **day-session domain** — EDGE reference only |

## Day-Session Shift Tasks (EDGE)

Session tasks per shift — scheduling produces the shift; procedure-engine generates tasks.

| Journey | File | Owner |
|---|---|---|
| Day-line shift tasks | (plan: `docs/superpowers/plans/2026-05-21-dayline-shift-tasks.md`) | day-session / procedure-engine — EDGE |

## User Manual References (do not absorb)

User-facing guides in 3 languages. Reference only — not scheduling domain documentation.

| Path | Language |
|---|---|
| `docs/User Manual/en/02-*plan*.md` | English |
| `docs/User Manual/nb/02-*plan*.md` | Norwegian Bokmål |
| `docs/User Manual/sv/03-*plan*.md` | Swedish |

## Completed Handoffs (evidence of shipped work)

| Handoff | Scope |
|---|---|
| [HANDOFF-schedule-admin-view.md](../../HANDOFF-schedule-admin-view.md) | Admin schedule grid + persistence |
| [HANDOFF-schedule-page-polish-tier1.md](../../HANDOFF-schedule-page-polish-tier1.md) | Page polish |
| [HANDOFF-scheduler-greedy.md](../../HANDOFF-scheduler-greedy.md) | Greedy solver V1 (ADR-0307/0309) |
| [HANDOFF-scheduler-mobile.md](../../HANDOFF-scheduler-mobile.md) | Mobile scheduler surface |
| [HANDOFF-scheduler-web.md](../../HANDOFF-scheduler-web.md) | Web scheduler (swap flow) |
| [HANDOFF-shift-marketplace.md](../../HANDOFF-shift-marketplace.md) | Marketplace capability + table |
| [HANDOFF-d2-schedule-tz-fix.md](../../HANDOFF-d2-schedule-tz-fix.md) | D2 timezone fix |
