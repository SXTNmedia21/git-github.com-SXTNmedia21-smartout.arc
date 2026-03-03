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

updated: 2026-03-12
created: 2026-02-27
module: meta
tags: [learnings, index]

---

# Learning Log

> Master index of all learning records. Updated when new learnings are created.

| #    | File                                             | Subject                                              | Date       |
| ---- | ------------------------------------------------ | ---------------------------------------------------- | ---------- |
| 0001 | 0001-turbopack-x-forwarded-host.md               | Turbopack x-forwarded-host in development            | 2026-02-28 |
| 0002 | 0002-middleware-cookie-preservation.md           | Middleware must copy cookies to redirect responses   | 2026-02-28 |
| 0003 | 0003-optimistic-locking-supabase.md              | Optimistic locking pattern for Supabase              | 2026-02-28 |
| 0004 | 0004-webhook-status-regression.md                | Webhook status regression guard pattern              | 2026-02-28 |
| 0005 | 0005-github-repo-name-vs-local-dir.md            | GitHub repo name differs from local directory name   | 2026-02-28 |
| 0006 | 0006-docuseal-webhook-verification.md            | DocuSeal plain shared secret for webhooks            | 2026-02-28 |
| 0007 | 0007-performance-governance-warn-to-fail.md      | Warn-to-fail governance scales better than hard-fail | 2026-02-28 |
| 0008 | 0008-vercel-x-forwarded-host-400.md              | Vercel always sets x-forwarded-host                  | 2026-02-28 |
| 0009 | 0009-vercelignore-depth-matching.md              | .vercelignore patterns match at any depth            | 2026-02-28 |
| 0010 | 0010-vercel-turborepo-root-directory.md          | Vercel Turborepo root directory is app dir           | 2026-02-28 |
| 0011 | 0011-framer-motion-landing-animation-patterns.md | Framer Motion landing page animation patterns        | 2026-02-28 |
| 0012 | 0012-mcp-sdk-package-structure.md                | MCP SDK single package with deep imports             | 2026-03-01 |
| 0013 | 0013-ultravox-http-tool-parameters.md            | Ultravox HTTP tools use staticParameters             | 2026-03-01 |
| 0014 | 0014-supabase-gen-types-stdout-noise.md          | Supabase gen types prints debug line to stdout       | 2026-03-01 |
| 0016 | 0016-season-type-enum-mismatch.md                | Season type enum mismatch (frontend vs DB)           | 2026-03-03 |
| 0017 | 0017-progressive-save-pattern.md                 | Progressive save pattern with debounce + JSONB       | 2026-03-03 |

## Feature-Specific Learning Logs

Feature-level learnings are logged in the WORKLOG for each feature branch. See `docs/worklogs/WORKLOG-*.md` for per-feature learnings.
module: ai
tags: [learnings]

---

# Learning Log — guardian

| #   | Date       | Learning                                                                                | Impact                                                              |
| --- | ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | 2026-03-14 | Browser WebSocket API cannot send custom headers — use query param for JWT auth         | All WS endpoints must use `?token=` pattern                         |
| 2   | 2026-03-14 | Emit guardian events at the action source, not at every call site — prevents duplicates | Check if called function already emits before adding new emit calls |
