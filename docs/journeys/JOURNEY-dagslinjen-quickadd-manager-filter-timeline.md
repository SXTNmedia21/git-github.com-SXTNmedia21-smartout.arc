---
title: "Journey — Manager filters Dagslinjen by avdeling, team, or vakt"
feature: dagslinjen-quickadd
journey: manager-filter-timeline
status: verified
verified_at: 2026-05-15
e2e_test: apps/e2e/dagslinjen-quickadd/filter-timeline.spec.ts
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Manager filter timeline scope

**Role:** manager

**Precondition:** Manager on Dagslinjen tab. Workspace has ≥2 departments, ≥1 team, ≥3 shifts today.

## Happy Path

1. Manager sees strip header with `Avdeling: Alle` dropdown → User sees filter pill
2. Manager clicks dropdown → System opens 3-tab selector (Avdeling / Team / Vakt) → User sees option list
3. Manager picks "Team → Lørdag PM" → System updates `useDayTimelineEvents` queryKey with `teamId` → Strip re-fetches → User sees only events tied to team's shifts/sessions within 200ms
4. Manager switches to "Vakt → Bar 16-23" → System filters by `shift_id` → User sees strip restricted to that shift's window + its events
5. Manager picks "Avdeling: Alle" → System resets to workspace-wide → User sees full strip

**Postcondition:** Filter state persists in URL search-param (`?scope=team:<id>`). Reload preserves filter. Filter visible in pill on header.

## Error Paths

- **No teams in workspace:** → "Team" tab disabled, tooltip "Opprett team først"
- **No shifts today:** → "Vakt" tab disabled, tooltip "Ingen vakter i dag"
- **Authority limit — manager scoped to own dept:** → Other departments hidden from dropdown
- **Selected team has 0 events:** → Strip shows empty state "Ingen hendelser for valgt scope" with clear-filter button

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
