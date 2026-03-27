---
title: "Journey — Production Gaps Tier 1"
status: done
updated: 2026-03-27
created: 2026-03-27
module: dashboard
tags: [journey, production-gaps, i18n, migrations]
---

# User Journeys — Production Gaps Tier 1

## Journey 1: Developer runs migrations reliably

**Precondition:** Developer has Supabase Local running. Migrations exist from multiple branches that may have been merged in different order than their timestamp filenames suggest.

1. Developer runs `npx supabase db reset` or applies migrations sequentially
2. Migration `20260324100001_shift_clock_mobile_fixes.sql` runs first (by timestamp) and creates `shift_clock_config`, `shift_note` tables + grants timesheet schema permissions conditionally
3. Migration `20260418100001_timesheet_schema.sql` (renamed from `20260324090000`) runs in correct order, creating the timesheet schema
4. Migration `20260422500000_shift_clock_config.sql` runs — `DROP TABLE IF EXISTS ... CASCADE` ensures a clean re-create with correct FK constraints (ON DELETE CASCADE) and RLS policies, regardless of whether the table was already created by an earlier migration
5. Migration `20260422500100_shift_note.sql` runs — same DROP+CREATE pattern ensures correct constraints
6. Migration `20260422500400_alter_manual_supplement_claims.sql` runs — `IF NOT EXISTS` check on enum prevents duplicate type errors

**Postcondition:** All migrations complete without errors regardless of execution order. Tables have correct ON DELETE CASCADE constraints and clean RLS policies.

**Error paths:**

- Timesheet schema doesn't exist when `20260324100001` runs — conditional `DO $$ ... IF EXISTS` block skips timesheet grants/alters gracefully
- Table already exists from earlier migration — DROP CASCADE removes it cleanly before re-creation
- Enum already exists — `IF NOT EXISTS` guard prevents duplicate_object error

---

## Journey 2: Admin views ActivityView heatmap

**Precondition:** Admin is logged into the dashboard. The ActivityView heatmap currently uses mock/demo data (not yet wired to `activity_trail`).

1. Admin opens the dashboard → System renders ActivityView with heatmap visualization
2. System displays a visible amber warning banner: "Aktivitetsdata vises som demo. Kobles til ekte data snart." (nb) / "Activity data shown as demo. Real data coming soon." (en)
3. Admin sees heatmap data for locations, departments, teams, or employees → Admin understands this is demo data, not live activity
4. Admin can still interact with tabs and time range controls to explore the visualization

**Postcondition:** Admin is informed that heatmap data is demo/mock. No confusion about data authenticity.

**Error paths:**

- i18n key missing → Falls back to key string `activityDemoWarning`
- Locale is `en` but key only in `nb` → Fallback chain resolves to Norwegian translation

---

## Journey 3: Developer manages i18n without stub languages

**Precondition:** Developer is working with the i18n system. Previously 8 locales were listed (nb, en, sv, da, pl, ar, so, fi) but only nb and en had actual translations.

1. Developer checks `packages/i18n/src/config.ts` → `supportedLocales` is `["nb", "en"]` — only languages with real translations
2. Developer uses `createTranslator("en", "dashboard")` → System looks up English key first
3. If English key is missing → System falls back to Norwegian (`nb`) automatically via the fallback chain in `translate.ts`
4. If Norwegian key is also missing → System returns the raw key string as final fallback
5. RTL_LOCALES is empty (Arabic removed with stub languages) — no RTL layout edge cases

**Postcondition:** i18n system only advertises languages that have actual translations. Missing keys in `en` gracefully fall back to `nb` instead of showing raw key strings.

**Error paths:**

- Key exists in neither `en` nor `nb` → Raw key string returned (developer sees it in UI and knows to add translation)
- Nested key (e.g. `setup.title`) missing in `en` → Fallback resolves nested lookup in `nb`
