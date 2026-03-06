---
title: Learning Log
status: in_progress
updated: 2026-04-10
created: 2026-03-04
module: operations
tags: [learnings]
---

# Learning Log — journey-package-skills

| #   | Date       | Learning                                                                                    | Impact                                                                 |
| --- | ---------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | 2026-03-06 | Engine-architect dry runs catch ~12 gaps per mission on first pass                          | Skills must include verification steps, not just generation            |
| 2   | 2026-03-06 | Guardian integration is already wired — mission authors only need journey_step_id on stages | Simplifies mission authoring; no manual event wiring needed            |
| 3   | 2026-03-06 | Triage gate prevents over-engineering: pure UI journeys don't need AI missions              | Saves effort; stub Mission.md with not-applicable status is sufficient |
| 4   | 2026-03-06 | SQL seed templates drift from skill templates — must align after each skill update          | Added N2 fix process; always diff skill vs template after changes      |

---

# Learning Log — season-creation-wizard

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |

module: governance
tags: [learnings]

---

# Learning Log — governance-admin-ui

updated: 2026-03-06
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
