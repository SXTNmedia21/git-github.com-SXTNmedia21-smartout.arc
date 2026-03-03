---
title: Learning Log
status: in_progress
updated: 2026-03-14
created: 2026-03-03
module: onboarding
tags: [learnings]
---

# Learning Log — intelligence-pipeline-v2

| #   | Date       | Learning                                                                                                                                                                                             | Impact                                                     |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | 2026-03-14 | `workspace.contract_status` is a plain `text` column, NOT the `contract_status` enum (which is only used on `employment_contract`). Safe to use any string value like 'onboarding'.                  | Avoids migration pitfall — no need to ALTER ENUM           |
| 2   | 2026-03-14 | `season_type` enum values are: default, calendar, focus, cycle, custom. There is no 'standard' value. Always check `database.types.ts` enum arrays before using literal values in SQL.               | Caught a runtime bug during review                         |
| 3   | 2026-03-14 | `procedure` table has no `workspace_id` column — scoping goes through FK chain: procedure → protocol → policy → workspace. This is correct per the governance data model.                            | Important for understanding FK chains in governance tables |
| 4   | 2026-03-14 | `agent_profile` has a 1:1 relationship with workspace (`isOneToOne: true`), with a UNIQUE constraint on `workspace_id`. `ON CONFLICT (workspace_id) DO NOTHING` is safe for idempotent creation.     | Enables safe repeated calls to finalize                    |
| 5   | 2026-03-14 | Google Places API v1 (Text Search) uses `X-Goog-Api-Key` and `X-Goog-FieldMask` headers, not query params. Photo URLs need the API key appended as `?key=`.                                          | Different from legacy Places API patterns                  |
| 6   | 2026-03-14 | Brreg roller endpoint (`/enheter/{orgNr}/roller`) uses nested structure: `rollegrupper[].roller[].type.kode` with codes DAGL (daglig leder), LEDE (leder), INHA (innehaver). Priority order matters. | Critical for CEO name extraction                           |
