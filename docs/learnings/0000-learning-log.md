---
title: Learning Log
status: in_progress
updated: 2026-04-10
created: 2026-03-06
module: meta
tags: [learnings]
---

# Learning Log

| #   | Date       | Learning                                                                                                     | Impact     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | 2026-04-09 | Long-lived missions (weeks/months) need nullable session expiry — default 1h expiry kills season sessions    | operations |
| 2   | 2026-04-09 | Calendar Guardian must query authoritative DB tables, not session collected_data (user-editable, incomplete) | operations |
| 3   | 2026-04-09 | `as unknown as` cast needed for SEASON_TOOLS array — SmartoutTool generic doesn't align with Vercel AI SDK   | ai         |
| 4   | 2026-04-09 | useWorkspaceOptional prevents crash when SeasonCard renders outside workspace context (e.g. loading states)  | dashboard  |
| 5   | 2026-04-09 | Phase-specific colors in dashboard cards are data-visualization, not theming — exempt from CSS variable rule | dashboard  |
