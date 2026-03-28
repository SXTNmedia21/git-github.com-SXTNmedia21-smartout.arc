---
title: Decision Log
status: in_progress
updated: 2026-03-28
created: 2026-03-28
module: onboarding
tags: [decisions]
---

# Decision Log — profession-system

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

| #    | Date       | Decision                           | Status   | Module       | Notes                                                                  |
| ---- | ---------- | ---------------------------------- | -------- | ------------ | ---------------------------------------------------------------------- |
| 0059 | 2026-03-28 | Platform Admin Pipeline Separation | accepted | stage-engine | routeAdminMessage() separate from workspace-scoped routeAgentMessage() |
