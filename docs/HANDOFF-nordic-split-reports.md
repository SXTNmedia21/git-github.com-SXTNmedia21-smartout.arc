---
title: "Handoff — nordic-split-reports"
feature: nordic-split-reports
branch: feat/helpdesk-nordic-split-reports
closed: 2026-04-23
module: Dashboard
tags: [handoff, design-system, nordic-split, reports]
---

# Handoff — nordic-split-reports (Phase 3b)

## Summary

Phase 3b of Nordic Split migration. Reports cluster: 5 files, 121 refs → 0. Sub-sortie of `campaign/helpdesk`. Follows Phase 1 (99 refs), Phase 2 (442 refs), Phase 3a (162 refs). Option C hybrid collapse strategy from Phase 1 council applied 5th time — zero deviations.

## Journey

| Journey | Status |
|---------|--------|
| admin-ser-konsistent-reports | verified |

## Migration Stats

| File | Zinc refs | Ternaries collapsed | Preserved | Line Δ |
|---|---|---|---|---|
| `OverviewDeepInsights.tsx` | 36 → 0 | 17 | 5 (indigo heatmap + emerald trend) | −8 |
| `PeopleSection.tsx` | 28 → 0 | 13 | 2 (StatusBadge + status dot) | −4 |
| `TrainingSection.tsx` | 21 → 0 | 12 | 5 (MiniKpi color ramp, Kritisk red, overdue red, bar colors, emerald strip) | −8 |
| `StaffingSection.tsx` | 19 → 0 | 11 | 5 (shiftTypes inline, CHART_COLORS, orange icon, red badge, chart grey hex) | −4 |
| `OverviewSection.tsx` | 17 → 0 | 10 | 6 (COLOR_MAP ramp, amber icon, directional arrows, MiniStat colors) | −12 |
| **Total** | **121 → 0** | **63** | **~23** | **−36** |

## Decisions

- **Chart colors preserved** — `CHART_COLORS.blue/emerald/amber`, `shiftTypes[i].color`, and explicit hex values like `#3f3f46`/`#e4e4e7` for chart backgrounds are data-visualization semantics, not surface chrome. Phase 2.5 semantic token work needed before these can graduate.
- **Asymmetric `tab-active` preserved in OverviewDeepInsights** — light uses `bg-card shadow-sm` (shadow affordance only meaningful in light), dark uses `bg-accent`. Semantically different; ternary retained.

## Known Issues / Debt

- **~23 preserved ternaries** tagged for Phase 2.5 token work (brand ramps, status badges, heatmap intensities).
- **Chart background hex fallbacks** in StaffingSection need semantic `chart-grid` token (Phase 2.5).

## Next Steps

1. Merge to `campaign/helpdesk`.
2. **Phase 3c**: long tail — landing/public `page.tsx` (63), EmployeeDashboard (44), TeamMembersSheet (28), scrape (36), ChapterReader (20), remaining ~100 files with <20 refs each (~492 refs total).
3. **Phase 2.5** (council): brand-signal semantic tokens + chart tokens + oklch cleanup.

## Commits

```
6230acc8  refactor(design-tokens): migrate reports cluster to Nordic Split tokens
2e43b3ee  docs(nordic-split-reports): declare journey
```

## Gates

- ✅ Journey verified
- ✅ Grep: 0 zinc/gray/slate across 5 files
- ✅ Typecheck: 0 errors
- ✅ Lint: 0 errors, 1 warning (pre-existing)
- ✅ Scope: 5 reports files + 2 docs; 0 mobile; 0 channel logic
- ⏳ Visual QA: deferred
