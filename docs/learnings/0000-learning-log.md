---
title: Learning Log
status: in_progress
updated: 2026-03-28
created: 2026-03-26
module: schedule
tags: [learnings]
---

# Learning Log — mal-modus-schedule

| #   | Date       | Learning                                                                                                                | Impact                                                                               |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | 2026-03-26 | session_task PK is `id` not `session_task_id` — confirmed from database.types.ts                                        | Avoided broken FK joins in task query                                                |
| 2   | 2026-03-26 | TS strict mode rejects `parts[0]![0]` on string arrays — need optional chaining `parts[0]?.[0]`                         | Fixed TS2532 in MalGhostTag getInitials                                              |
| 3   | 2026-03-26 | schedule_shift.template_shift_id added by our migration must be included in ALL test fixtures                           | Fixed mobile typecheck failure in shift-phase.test.ts                                |
| 4   | 2026-03-26 | Bridge component returning null can be changed to render dialog alongside children without breaking side-effect pattern | Enabled AgentConfirmationDialog rendering in bridge                                  |
| 5   | 2026-03-28 | Drift councils must truth-sync key doc claims against runtime before prioritization                                     | Avoided false P0 urgency and aligned roadmap to real blockers                        |
| 6   | 2026-03-28 | Live ops feed must normalize mixed human/agent/system events before first-screen rendering                              | Prevented noisy timeline and authority confusion in cockpit V1                       |
| 7   | 2026-03-28 | Temporal shift lock must be DB-canonical across web/voice/MCP channels                                                  | Prevented bypass risk from service-role and side-channel writes                      |
| 8   | 2026-03-28 | Absence approval flow is a missing prerequisite — status field exists but no transition logic, no UI, no hooks          | Any absence-triggered workflow (smart-cover, payroll, guardian) will fail without it |
| 25  | 2026-04-07 | Stage Engine WebSockets (`/ws/:sessionId`, `/guardian/ws`) + in-process guardian-bus are structural Vercel Fluid Compute blockers | Future Vercel migration of stage-engine requires WS→SSE refactor + guardian-bus externalization first. shift-mcp is the only clean-migration candidate. See learning 0025. |

module: dashboard
tags: [learnings]

---

# Learning Log — admin-daily-loop

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |
