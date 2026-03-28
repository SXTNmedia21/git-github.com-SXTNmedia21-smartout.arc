---
title: "Handoff — production-gaps-tier1"
feature: production-gaps-tier1
branch: feat/production-gaps-tier1
closed: 2026-03-27
module: dashboard
---

# Handoff — Production Gaps Tier 1

## Summary

Four targeted fixes addressing production-readiness gaps discovered during integration testing. No new features — strictly hardening existing code for reliable deployment.

## What was built

### 1. Idempotent migrations (`fix(db)`)

- Made 6 migration files resilient to execution-order conflicts
- Renamed `20260324090000_timesheet_schema.sql` to `20260418100001_timesheet_schema.sql` to fix timestamp ordering (it was dated before the migration that references it)
- Wrapped timesheet schema grants in conditional `IF EXISTS` checks (schema created by a later migration)
- Changed `shift_clock_config` and `shift_note` migrations from `CREATE TABLE IF NOT EXISTS` to `DROP TABLE IF EXISTS CASCADE` + `CREATE TABLE` — ensures ON DELETE CASCADE constraints and RLS policies are always correct
- Removed redundant `20260424200000_shift_clock_cascade_fixes.sql` (its FK fixes are now baked into the canonical table definitions)
- Removed `20260326000001_fix_spokesperson_rls.sql` (already applied on development)

### 2. i18n fallback chain (`fix(i18n)`)

- Removed 6 stub languages (sv, da, pl, ar, so, fi) from `supportedLocales` — only nb and en remain
- Added Norwegian fallback in `createTranslator()`: if a key is missing in the requested locale, it tries `nb` before returning the raw key
- Cleared `RTL_LOCALES` (Arabic was the only RTL language and had no translations)

### 3. ActivityView demo warning (`fix(dashboard)`)

- Added amber warning banner to ActivityView heatmap component explaining data is demo/mock
- Added i18n keys `activityDemoWarning` in both nb and en
- Added TODO comment pointing to the real data source (`activity_trail` table) and what's needed to wire it

### 4. Governance E2E test (`test(e2e)`)

- Added `apps/e2e/tests/governance.spec.ts` with 2 tests: page load and content visibility
- Uses existing `loginAsAdmin` helper

## Decisions made

No architectural decisions — all changes are hardening of existing patterns.

## Learnings

- Migration ordering in Supabase is purely by filename timestamp. When branches create migrations with overlapping timestamps, `CREATE TABLE IF NOT EXISTS` silently succeeds but skips FK constraint updates. `DROP + CREATE` is safer for tables that may be partially created by earlier migrations.
- Stub languages with zero translations cause confusing UX — users see raw key strings. Better to ship only languages with actual coverage and add a fallback chain.

## Known issues / debt

- ActivityView heatmap still uses mock data — needs `useActivityHeatmap()` hook querying `activity_trail` grouped by entity + date
- i18n coverage for `en` is incomplete — many keys only exist in `nb` (the fallback chain masks this)
- E2E governance test is minimal (page load only) — needs journey-based tests once governance features are built out

## Next steps

- Wire ActivityView heatmap to real `activity_trail` data
- Audit `en` locale for missing translations now that fallback hides gaps
- Expand governance E2E tests as the module grows
