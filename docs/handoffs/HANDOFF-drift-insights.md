---
title: "Handoff — drift-insights"
feature: drift-insights
branch: feat/drift-insights
closed: 2026-03-28
module: hms
---

# Handoff — drift-insights

## Summary

Added operational insight metrics to the HMS drift page via a new `DriftInsightStrip` component. Extended the i18n system to support 3-level nested translation keys. Fixed a production bug in the deviation push notification trigger. Seeded operations pipeline data for local development.

## What Was Done

- [x] `useDriftInsights` hook — composes department sessions + deviations + overdue task count
- [x] `DriftInsightStrip` component — 4 metric cells (sessions, tasks, deviations, overdue) with semantic color variants
- [x] i18n 3-level nesting — `Messages` type extended, `resolve()` function handles up to 3 dot-separated segments
- [x] Trigger bugfix — `trigger_push_deviation_reported()` referenced `id` instead of `profile_id` on profile table
- [x] Seed script — `supabase/seed-operations-pipeline.sql` with 4 sessions, 23 tasks, 8 shifts, 2 deviations, hourly budgets
- [x] Council review — 3-agent review (steward, supervisor, frontend) caught interpolation bug, hardcoded colors, decision log issue
- [x] Interpolation fix — standardized all dashboard.json to single-brace `{key}` matching mobile.json and translate.ts regex
- [x] Color fix — replaced hardcoded `yellow-500` with semantic `warning` token

## Decisions Made

| Decision                                         | Reason                                                         | Impact                               |
| ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------ |
| Single-brace `{key}` for i18n interpolation      | Matches existing mobile.json convention and translate.ts regex | All dashboard.json keys updated      |
| 3-level nesting in Messages type                 | Needed for `hms.drift_insights.*` pattern                      | Enables deeper i18n key organization |
| Semantic color tokens (`warning`, `destructive`) | CLAUDE.md prohibits hardcoded colors                           | Consistent with OKLCH design system  |
| Read-only D6 consumer pattern                    | DriftInsightStrip only reads cascade data, no mutations        | No telemetry emit needed             |

## Learnings

| Learning                                                       | Context                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| i18n interpolation syntax divergence fails silently            | `{{count}}` in JSON + `{count}` regex = literal `{{count}}` rendered. No runtime error. Need lint rule or test.              |
| Shared index files must not be overwritten by feature branches | Decision log was replaced with empty branch-specific version. Other branches' ADR entries would be lost on merge.            |
| `trigger_push_deviation_reported()` had wrong column reference | Profile table PK is `profile_id`, not `id`. Bug was dormant until first deviation insert in workspace with managers.         |
| Seed data requires trigger awareness                           | `trg_push_deviation_reported` trigger fails on INSERT. Must disable specific trigger (not ALL — system triggers block that). |

## Known Issues / Debt

- **Responsive**: `DriftInsightStrip` uses fixed `grid-cols-4` — breaks on mobile. Needs `grid-cols-2 md:grid-cols-4`.
- **Loading skeleton**: No skeleton state while data loads (just spinner).
- **Motion**: No entrance animation. Design system mandates spring physics (stiffness 30-45, damping 20-24).
- **Accessibility**: Missing aria-labels on metric cells and variant badges.
- **MetricCell extraction**: Currently inlined in DriftInsightStrip. Should be shared component if reused.
- **Other `{{key}}` in codebase**: Only dashboard.json was fixed. Check all `.json` i18n files for consistency.

## Next Steps

- Fix responsive grid (small PR)
- Add loading skeleton + entrance animation
- Extract MetricCell to shared dashboard component
- Add lint rule or unit test for i18n interpolation syntax consistency
- Continue HMS Phase 2: task completion flow, session sign-off, deviation form
