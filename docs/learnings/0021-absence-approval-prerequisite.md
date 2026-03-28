---
title: Absence Approval is a Prerequisite for Absence-Triggered Workflows
status: done
updated: 2026-03-28
created: 2026-03-28
module: scheduling
tags: [absence, smart-cover, prerequisite, council-learning]
---

# Learning 0021: Absence Approval is a Prerequisite for Absence-Triggered Workflows

## Discovery

During the Smart Cover council session (2026-03-28), the Supervisor agent identified that the entire proposed workflow depends on absence approval — but no approval mechanism exists in the codebase.

- `schedule_absence` table has `status` enum (`pending | approved | rejected`)
- No `useApproveAbsence` or `useRejectAbsence` mutation hook exists
- No admin UI for reviewing pending absences
- No telemetry event for `absence approved` or `absence rejected`
- Mobile app creates absences as `pending` but nothing transitions them

## Impact

Any feature that triggers on "approved absence" will hit this same wall:

- Smart Cover (vikar flow)
- Payroll absence tracking
- Guardian signals for coverage gaps
- Manager dashboards showing absence impact

## Resolution

Absence approval flow must be built as a separate, blocking ticket before Smart Cover or any other absence-triggered automation. Scope: mutations, admin UI, telemetry events, Event Engine trigger on status change.

## Applies To

Always verify the upstream trigger exists before designing downstream automation. Don't assume a status field means the transition is implemented.
