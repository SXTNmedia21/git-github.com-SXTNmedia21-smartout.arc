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

# Learning Log — unified-context-search

| #   | Date       | Learning                                                                                                   | Impact                                                                          |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | 2026-03-06 | Pre-existing type errors (service_config, leader_pulse) block pre-push hooks on all branches               | Must fix in feature branch or they block every push; svcTable() pattern works   |
| 2   | 2026-03-06 | sed replacements on multi-line `.from()` chains break when property access spans lines                     | Use Edit tool or helper function approach instead of sed for TS refactors       |
| 3   | 2026-03-06 | 4-wave parallel agent execution works cleanly when agents touch non-overlapping files                      | Can safely run 3 agents per wave on same worktree                               |
| 4   | 2026-03-06 | supabase.rpc() calls to new RPCs fail typecheck before types regen — cast via `(supabase.rpc as Function)` | Same pattern as .from() casts; grep for TODO to find all when migration applied |

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

updated: 2026-03-06
created: 2026-03-06
module: document
tags: [learnings]

---

# Learning Log — document-mode

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |
