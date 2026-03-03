---
title: Learning Log
status: in_progress
updated: 2026-03-06
created: 2026-03-03
module: season-planning
tags: [learnings]
---

# Learning Log — operation

| #   | Date       | Learning                                                                                                                                                                                                                                                    | Impact                                                            |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | 2026-03-06 | `getDay()` returns local timezone weekday but `toISOString()` returns UTC date — in CET, midnight local is previous day UTC. Must use `getUTCDay()` + `setUTCDate()` + `"T00:00:00Z"` suffix consistently.                                                  | Fixed calculation engine bug where weekdays mismatched dates      |
| 2   | 2026-03-06 | TS strict mode with `noUncheckedIndexedAccess`: `Array.reduce()` without initial value makes `previousValue` possibly undefined. Fix: provide explicit initial value with narrowing guard (`const first = arr[0]; if (!first) return; reduce(..., first)`). | Fixed 5 typecheck errors in SeasonOverviewTab                     |
| 3   | 2026-03-06 | `npx supabase gen types typescript --local` leaks stderr ("Connecting to db 5432") into stdout when redirected. Must strip first line manually after generation.                                                                                            | Prevented broken database.types.ts                                |
| 4   | 2026-03-06 | vitest config only includes `src/**/__tests__/**/*.test.ts` — tests outside `__tests__/` dirs are silently ignored.                                                                                                                                         | Placed test file correctly on first attempt after checking config |
