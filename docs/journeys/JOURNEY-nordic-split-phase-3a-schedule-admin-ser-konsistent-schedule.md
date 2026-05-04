---
title: "Journey — Schedule cluster konsistent med Nordic Split"
feature: nordic-split-phase-3a-schedule
journey: admin-ser-konsistent-schedule
status: verified
verified_at: 2026-04-23
e2e_test: null
created: 2026-04-23
updated: 2026-04-23
verification_notes: |
  Grep gate: 0 zinc/gray/slate in all 3 schedule files (post-commit).
  Typecheck: 0 errors (pnpm --filter web typecheck, full monorepo).
  Lint: 0 errors, 6 warnings (all pre-existing).
  Migration: 162 refs → 0; -125 lines; ~77 ternaries collapsed, 7 preserved
    for brand signals (orange/rose/blue/emerald shift statuses), all tagged
    "// Nordic Split: Phase 2.5 candidate."
  Print-media classes also migrated to tokens (flagged as low-confidence —
    paper output may need re-verification).
  Visual QA: deferred to pre-merge gate.
module: Dashboard
tags: [journey, design-system, nordic-split, schedule]
---

# Journey: Schedule-klynge konsistent med Nordic Split

**Role:** admin / employee

**Precondition:**
- Admin eller employee er innlogget
- Schedule-data er seeded
- Phase 1 + Phase 2 tokens aktive (DashboardShell + organization klynge)

## Happy Path

1. Admin navigerer til `/dashboard/schedule`
   → Daily briefing + shift grid + calendar header renderer med Nordic Split paletten
   → Warm OKLCH, ingen zinc-kjølig tone
2. Admin bytter light ↔ dark
   → Tokens håndterer automatisk via `.dark` scope
3. Employee navigerer til `/dashboard/my-schedule`
   → MyWeekView renderer konsistent med schedule-admin view
   → Status badges (trainee/active/inactive) + shift-cards + time indicators bruker tokens

**Postcondition:**
- 3 schedule-filer bruker kun semantiske tokens
- Visuell identitet konsistent med organization klynge (Phase 2)

## Error Paths

- **Scenario:** Kontrast-brudd i daily-briefing etter mapping
  → Mitigering: følg WCAG AA 4.5:1 minimum; verifiser
- **Scenario:** Shift color-coding (brand signals) reagerer feil
  → Mitigering: preserve alle `bg-emerald-*`/`bg-amber-*`/`bg-rose-*` brand signals; Phase 2.5 scope

## Verification

- [ ] 0 zinc/gray/slate i alle 3 filer
- [ ] Typecheck grønt
- [ ] Visuell QA deferred til pre-merge
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when code-level gates pass. Visual deferred.**
