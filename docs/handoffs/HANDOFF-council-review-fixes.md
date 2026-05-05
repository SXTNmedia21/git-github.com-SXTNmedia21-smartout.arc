---
title: "Handoff — council-review-fixes"
feature: council-review-fixes
branch: feat/council-review-fixes
closed: 2026-04-06
module: cross-cutting
---

# Handoff — council-review-fixes

## Summary

Fixed 9 issues (from 19 validated findings) identified by System Council review of two merged branches (feat/mobile-production-readiness and feat/production-gaps-tier1). These branches were built without proper Smartout skills/commands, resulting in destructive migrations, missing telemetry, type safety gaps, hardcoded text/colors, and PII logging.

## What Was Done

- [x] ISSUE-12: Corrective idempotent migration for shift_clock_config (no more DROP TABLE CASCADE)
- [x] ISSUE-13: Corrective idempotent migration for shift_note (no more DROP TABLE CASCADE)
- [x] ISSUE-17: Restored missing UPDATE RLS policy on shift_note (regression fix)
- [x] ISSUE-2: Added engine_event emit to sendMessage agent tool (telemetry contract)
- [x] ISSUE-8: Typed supabaseAdmin as SupabaseClient in AgentToolContext (removed 12 unsafe casts)
- [x] ISSUE-7: Resolved as side-effect of ISSUE-8 fix
- [x] ISSUE-14: Replaced 3 hardcoded Norwegian strings in ActivityView with t() calls
- [x] ISSUE-15: Replaced hardcoded indigo-500/orange-400 with semantic tokens (bg-primary/10, bg-destructive)
- [x] ISSUE-16: Translated 2 English strings in nb/dashboard.json cockpit section
- [x] ISSUE-9: Removed profileId from push token console.log

## Decisions Made

| Decision                                                            | Reason                                                                                                                                               | Impact                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Corrective migrations instead of editing existing ones              | Existing migrations are immutable history; corrective migrations ensure correct state regardless of prior sequence                                   | Pattern for all future migration fixes              |
| supabaseAdmin typed as SupabaseClient, not SupabaseClient<Database> | Generic SupabaseClient is sufficient since table names are strings anyway; full generic typing would require database.types.ts import in packages/ai | All agent tool files lose their unsafe casts        |
| ISSUE-1 (agent RLS bypass) left as tracked debt                     | Systemic pattern across all agent tools — requires architecture-level fix, not per-tool patch                                                        | Needs ADR + roadmap item for Q2 agent auth refactor |
| ISSUE-3 (FAB tap/longpress) deferred                                | Incomplete mobile feature — fix when voice vs text mode is actually implemented                                                                      | Mobile team decides when to differentiate           |
| ISSUE-4 (mock data) deferred                                        | Requires payroll hooks that don't exist yet                                                                                                          | Fix when real data is available                     |

## Learnings

| Learning                                                                           | Context                                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| DROP TABLE CASCADE in migrations is invisible data loss                            | CREATE TABLE IF NOT EXISTS silently ignores FK differences — a corrective migration is needed to add ON DELETE CASCADE after the fact |
| `unknown` typing on shared context fields disables type checking for all consumers | 12 unsafe `as SupabaseClient` casts across 3 files — single fix in types.ts removed them all                                          |
| Branches built without skills systematically violate conventions                   | Both branches had hardcoded text, missing emit(), type safety gaps — the skills prevent these by design                               |
| Council validation catches "by design" false positives                             | getShiftDetail showing all shifts was flagged as security issue but is correct for hospitality (shared work tool)                     |
| Supervisor's direct file verification catches severity inflation                   | ISSUE-9 was flagged as HIGH PII risk, but profileId is a UUID in device-local logs — correctly downgraded to LOW                      |

## Known Issues / Debt

- ISSUE-1: Agent tools bypass RLS via supabaseAdmin — systemic pattern, needs architecture ADR
- ISSUE-3: FAB tap/longpress handlers are identical — deferred to mobile feature work
- ISSUE-4: Me screen has hardcoded mock financial data — deferred to payroll hooks
- ISSUE-5/6: Mobile screens have hardcoded Norwegian text — deferred to mobile i18n batch
- ISSUE-18: governance.spec.ts E2E test is effectively a no-op — deferred to E2E batch
- Pre-existing: packages/ai has 27 type errors in src/tools/season/ (tsconfig/zod issues, unrelated to this branch)

## Next Steps

- Write Migration Safety ADR (no DROP TABLE CASCADE, all DDL idempotent)
- Track ISSUE-1 for Q2 agent auth architecture review
- Mobile i18n batch for ISSUE-5/6
- Rewrite governance.spec.ts (ISSUE-18)
