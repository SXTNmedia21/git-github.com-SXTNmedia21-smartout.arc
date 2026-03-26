---
title: Learning Log
status: in_progress
updated: 2026-03-26
created: 2026-03-26
module: schedule
tags: [learnings]
---

# Learning Log — mal-modus-schedule

| #   | Date       | Learning                                                                                                                | Impact                                                |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | 2026-03-26 | session_task PK is `id` not `session_task_id` — confirmed from database.types.ts                                        | Avoided broken FK joins in task query                 |
| 2   | 2026-03-26 | TS strict mode rejects `parts[0]![0]` on string arrays — need optional chaining `parts[0]?.[0]`                         | Fixed TS2532 in MalGhostTag getInitials               |
| 3   | 2026-03-26 | schedule_shift.template_shift_id added by our migration must be included in ALL test fixtures                           | Fixed mobile typecheck failure in shift-phase.test.ts |
| 4   | 2026-03-26 | Bridge component returning null can be changed to render dialog alongside children without breaking side-effect pattern | Enabled AgentConfirmationDialog rendering in bridge   |

module: dashboard
tags: [learnings]

---

# Learning Log — admin-daily-loop

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |
