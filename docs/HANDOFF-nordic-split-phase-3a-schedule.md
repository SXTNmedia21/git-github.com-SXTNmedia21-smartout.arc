---
title: "Handoff — nordic-split-phase-3a-schedule"
feature: nordic-split-phase-3a-schedule
branch: feat/helpdesk-nordic-split-phase-3a-schedule
closed: 2026-04-23
module: Dashboard
tags: [handoff, design-system, nordic-split, schedule]
---

# Handoff — nordic-split-phase-3a-schedule

## Summary

Phase 3a of the Nordic Split token migration. Migrated the schedule cluster — 3 files, 162 refs → 0. Follows Phase 1 (shell + palette, 99 refs) + Phase 2 (organization klynge, 442 refs). Option C hybrid collapse strategy inherited from Phase 1 council; applied 1:1. Net −125 lines.

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| admin-ser-konsistent-schedule | verified | none (visual QA deferred to pre-merge gate) |

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Migrate print-media classes (`print:text-gray-*`, `print:bg-white`, etc.) | Strict mapping table applied to all zinc/gray/slate refs including media-prefixed variants | Paper output uses token palette (warm near-white background, warm near-black foreground); may need visual QA vs raw white if print legibility is critical |
| Preserve 7 brand-signal ternaries | Shift status colors (orange active, rose alert, blue in-progress, emerald complete, "I dag" highlight) are semantic brand signals, not neutral surfaces | Consistent with Phase 1/2 deferral pattern; Phase 2.5 target |

No new ADRs — strategy inherited.

## Learnings

| Learning | Context |
|----------|---------|
| Print-media classes need explicit scope decision | Implementer flagged as low-confidence — token-based print output renders warm near-white (`--background` 0.99 OKLCH) which may differ from raw `bg-white` legibility on paper. Log for next phase planning. |
| `useContext(DashboardContext)` can be removed entirely when `isDark` was its sole consumer | 4 components in schedule/page.tsx had their entire context subscription removed after ternary collapse — cleaner than `_isDark` prefix when hook had no other purpose. |

## Known Issues / Debt

- **7 preserved ternaries** tagged `Phase 2.5 candidate`:
  - daily-briefing: TabButton orange, MessageCard rose alert, task orange highlight, task blue in-progress
  - schedule/page: ListGridContent shift-time orange
  - MyWeekView: today-card orange, "I dag" button orange
- **Print-media migration**: low-confidence — verify paper output legibility in future QA
- **8 `_isDark` prefixed params** — standard Phase 2 pattern; expected

## Next Steps

1. Merge to `campaign/helpdesk` via `close-feature.sh`.
2. **Phase 3b** (next): reports cluster — 5 files, 121 refs (OverviewDeepInsights + PeopleSection + TrainingSection + StaffingSection + OverviewSection).
3. **Phase 3c** (after 3b): landing/public `page.tsx` (63) + EmployeeDashboard (44) + scrape (36) + long tail (~492 refs across remaining files).
4. **Phase 2.5** (council required): brand-signal semantic tokens + `--card-elevated` + oklch cleanup.

## Migration Stats

| File | Zinc refs | Ternaries collapsed | Preserved | Line Δ |
|---|---|---|---|---|
| `daily-briefing.tsx` | 85 → 0 | ~35 | 4 | −35 |
| `schedule/page.tsx` | 50 → 0 | ~30 | 1 | −41 |
| `MyWeekView.tsx` | 27 → 0 | ~12 | 2 | −50 |
| **Total** | **162 → 0** | **~77** | **7** | **−125** |

## Commits

```
e41bcd20  refactor(design-tokens): migrate schedule cluster to Nordic Split tokens
85cb6e1d  docs(nordic-split-phase-3a-schedule): fill plan with full scope
de6a0f68  docs(nordic-split-phase-3a-schedule): declare plan + journey + spec
```

## Gates

- ✅ Journey `admin-ser-konsistent-schedule` verified
- ✅ Grep: 0 zinc/gray/slate across all 3 files
- ✅ Typecheck: 0 errors
- ✅ Lint: 0 errors, 6 warnings (pre-existing)
- ✅ Scope: only 3 schedule files + 3 docs; 0 mobile files; 0 channel/chat logic
- ⏳ Visual QA: deferred (incl. print-media verification)
