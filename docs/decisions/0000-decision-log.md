---
title: Decision Log
status: in_progress
updated: 2026-03-06
created: 2026-03-03
module: season-planning
tags: [decisions]
---

# Decision Log — operation

| #   | Date       | Decision                                                                                       | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-06 | Reuse settings/useOperatingHours hook for season hour derivation instead of creating duplicate | Accepted |
| 2   | 2026-03-06 | Create season_budget table separate from existing workspace_budget (strategic vs operational)  | Accepted |
| 3   | 2026-03-06 | Use UTC-only date arithmetic in calculation engine to prevent timezone bugs                    | Accepted |
| 4   | 2026-03-06 | Follow established (supabase.from as Function) cast pattern for new table hooks                | Accepted |
