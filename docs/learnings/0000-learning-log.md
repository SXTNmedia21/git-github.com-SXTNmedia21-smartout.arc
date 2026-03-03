---
title: Learning Log
status: done
updated: 2026-03-06
created: 2026-03-03
module: season-planning
tags: [learnings]
---

# Learning Log — operation

| #   | Date       | Learning                                                                                                                          | Impact                               |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | 2026-03-05 | `LOCATION_TYPE_CONFIG` lacks `border` property — had to add optional `border` or adjust type when using for badges in detail view | low — quick fix                      |
| 2   | 2026-03-05 | EntityDetailLayout works for both organization entities AND people — breadcrumbs + tabs pattern is universal for detail pages     | high — reuse for future detail pages |
status: done
updated: 2026-03-06
created: 2026-03-02
module: comms
tags: [learnings]
---

# Learning Log — communications-finish

| #   | Date       | Learning                                                                                                   | Impact                                   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | 2026-03-04 | SendGrid signed event webhooks use ECDSA P-256 (not HMAC) — need Web Crypto API                            | Edge Function implementation pattern     |
| 2   | 2026-03-04 | SendGrid `dynamicTemplateData` is per-message, not per-batch — must loop                                   | Changed batch sending approach           |
| 3   | 2026-03-04 | Tiptap `onUpdate` fires on every keystroke — debounce for AI correction                                    | UX smoothness for AI feature             |
| 4   | 2026-03-04 | Supabase `increment_communication_counter()` function needed for atomic counter updates in webhook handler | Data consistency for engagement tracking |
| #   | Date       | Learning                                                                                                                                                                                                                                                    | Impact                                                            |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | 2026-03-06 | `getDay()` returns local timezone weekday but `toISOString()` returns UTC date — in CET, midnight local is previous day UTC. Must use `getUTCDay()` + `setUTCDate()` + `"T00:00:00Z"` suffix consistently.                                                  | Fixed calculation engine bug where weekdays mismatched dates      |
| 2   | 2026-03-06 | TS strict mode with `noUncheckedIndexedAccess`: `Array.reduce()` without initial value makes `previousValue` possibly undefined. Fix: provide explicit initial value with narrowing guard (`const first = arr[0]; if (!first) return; reduce(..., first)`). | Fixed 5 typecheck errors in SeasonOverviewTab                     |
| 3   | 2026-03-06 | `npx supabase gen types typescript --local` leaks stderr ("Connecting to db 5432") into stdout when redirected. Must strip first line manually after generation.                                                                                            | Prevented broken database.types.ts                                |
| 4   | 2026-03-06 | vitest config only includes `src/**/__tests__/**/*.test.ts` — tests outside `__tests__/` dirs are silently ignored.                                                                                                                                         | Placed test file correctly on first attempt after checking config |
