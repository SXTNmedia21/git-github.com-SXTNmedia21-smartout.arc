---
title: Decision Log
status: in_progress
updated: 2026-03-26
created: 2026-03-26
module: schedule
tags: [decisions]
---

# Decision Log — mal-modus-schedule

| #   | Date       | Decision                                                                                                                | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-26 | Use LocationPopover (not DepartmentPopover) for mal-modus — codebase already uses LocationPopover pattern               | accepted |
| 2   | 2026-03-26 | Two-step task query instead of PostgREST join — avoids unreliable implicit join with nullable FKs                       | accepted |
| 3   | 2026-03-26 | Manual getISOWeek instead of date-fns — avoids adding dependency for one function                                       | accepted |
| 4   | 2026-03-26 | Hardcoded 230 NOK/hr for cost display — display-only estimate, TODO: fetch from season_budget                           | accepted |
| 5   | 2026-03-26 | Promise-based confirmation dialog in AgentProposalsContext — not a separate hook, keeps state co-located with proposals | accepted |
| 6   | 2026-03-26 | Ghost tags use desaturated oklch variants of employee tag colors — visually distinct but same color family              | accepted |
| 7   | 2026-03-26 | templateShiftId optional on ShiftProposalCreate — backward compatible with daily grid proposals                         | accepted |
