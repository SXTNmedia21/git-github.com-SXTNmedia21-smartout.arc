---
title: Decision Log
status: in_progress
updated: 2026-03-29
created: 2026-03-29
module: dashboard
tags: [decisions]
---

# Decision Log — interactive-dashboard

| #   | Date       | Decision                                                                                      | Status   |
| --- | ---------- | --------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-28 | `public` schema for profession tables (not `intelligence`) — follows existing K1a pattern     | accepted |
| 2   | 2026-03-28 | `authority_level` on profile, not position — stable per person, not per job slot              | accepted |
| 3   | 2026-03-28 | `profile_position` m2m — a person can have multiple positions (multi-fag)                     | accepted |
| 4   | 2026-03-28 | `is_regulated` removed from position — redundant with `legal_function` table                  | accepted |
| 5   | 2026-03-28 | Keep POSITION_MAP as @deprecated — 5 active consumers, remove in follow-up                    | accepted |
| 6   | 2026-03-28 | Skjenkeansvarlig has NULL profession_id — applies across all alcohol-serving professions      | accepted |
| 7   | 2026-03-28 | `profile_access.scope` validated by regex CHECK — format: domain.action                       | accepted |
| 8   | 2026-03-28 | All manage RLS policies require `is_admin_in_workspace()` — prevents employee self-assignment | accepted |

module: stage-engine
tags: [decisions]

---

# Decision Log — telegram-walkai-adapter

| #    | Date       | Decision                                                       | Status   | Module       | Notes                                                                                                                                                       |
| ---- | ---------- | -------------------------------------------------------------- | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0059 | 2026-03-28 | Platform Admin Pipeline Separation                             | accepted | stage-engine | routeAdminMessage() separate from workspace-scoped routeAgentMessage()                                                                                      |
| 0069 | 2026-03-28 | Session Execution Ownership: EF + Engine Side-Effects          | accepted | hms          | Edge Functions own execution, Engine owns side-effects (notifications, escalation). Hybrid model.                                                           |
| 0070 | 2026-03-28 | Emma-Wizard Bridge: tool-based agent control over wizard flows | accepted | onboarding   | Step-level useRegisterTools, ref-based implementations, callback context push, WalkAiProvider outside DashboardShell. Supersedes ADR-0049 for wizard tools. |
| #    | Date       | Decision                                                       | Status   | Module       | Notes                                                                                                                                                       |
| ---- | ---------- | -----------------------------------------------------          | -------- | ------------ | -------------------------------------------------------------------------------------------------                                                           |
| 0059 | 2026-03-28 | Platform Admin Pipeline Separation                             | accepted | stage-engine | routeAdminMessage() separate from workspace-scoped routeAgentMessage()                                                                                      |
| 0069 | 2026-03-28 | Session Execution Ownership: EF + Engine Side-Effects          | accepted | hms          | Edge Functions own execution, Engine owns side-effects (notifications, escalation). Hybrid model.                                                           |
