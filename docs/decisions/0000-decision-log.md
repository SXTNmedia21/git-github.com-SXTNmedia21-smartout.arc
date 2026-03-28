---
title: Decision Log
status: in_progress
updated: 2026-03-27
created: 2026-03-27
module: dashboard
tags: [decisions]
---

# Decision Log — setup-guide-navigation

| #   | Date | Decision | Status |
| --- | ---- | -------- | ------ |

# Decision Log — entity-drawer

| #   | Date       | Decision                                                                              | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-27 | Separate EntityDrawerProvider from DashboardContext to avoid 170+ consumer re-renders | accepted |
| 2   | 2026-03-27 | Use department_operating_hours (not workspace_operating_hours) in DepartmentDetailTab | accepted |
| 3   | 2026-03-27 | Pin state persists in localStorage, preserved across route changes                    | accepted |

# Decision Log — setup-wizard-shell-migration

| #   | Date       | Decision                                                                              | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-28 | Keep per-route pages (not dynamic /wizard/[id]) — auth boundaries prevent unification | accepted |
| 2   | 2026-03-28 | definition.onComplete owns ALL business logic; useWizardTelemetry owns ALL telemetry  | accepted |
| 3   | 2026-03-28 | loadState wired into useWizardState (was dead code across all 3 wizards)              | accepted |
| 4   | 2026-03-28 | BotsTip regulatory content preserved via SetupStepHeader (not dropped for WalkAi)     | accepted |
| 5   | 2026-03-28 | Team invitations idempotent via DB check (not state flag)                             | accepted |
