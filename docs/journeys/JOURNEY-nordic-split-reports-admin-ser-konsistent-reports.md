---
title: "Journey — Reports cluster konsistent med Nordic Split"
feature: nordic-split-reports
journey: admin-ser-konsistent-reports
status: verified
verified_at: 2026-04-23
e2e_test: null
created: 2026-04-23
updated: 2026-04-23
verification_notes: |
  Grep gate: 0 zinc/gray/slate in all 5 reports files.
  Typecheck: 0 errors (pnpm --filter web typecheck, full monorepo).
  Lint: 0 errors, 1 warning (pre-existing).
  Migration: 121 refs → 0; -36 lines; ~63 ternaries collapsed, ~15 preserved
    (chart color ramps, status badges, heatmap intensity, asymmetric shadow).
  Visual QA: deferred to pre-merge gate.
module: Dashboard
tags: [journey, design-system, nordic-split, reports]
---

# Journey: Reports-klynge konsistent med Nordic Split

**Role:** admin

**Precondition:**
- Admin er innlogget
- Reports-data er tilgjengelig
- Phase 1–3a tokens aktive

## Happy Path

1. Admin navigerer til `/dashboard/reports`
   → OverviewSection + OverviewDeepInsights + PeopleSection + TrainingSection + StaffingSection renderer med Nordic Split paletten
2. Admin bytter light ↔ dark
   → Tokens håndterer automatisk

**Postcondition:**
- 5 reports-filer bruker kun semantiske tokens
- Visuell identitet konsistent med schedule + organization klyngene

## Error Paths

- **Scenario:** Chart/stats fargekoding reagerer feil
  → Mitigering: preserve alle brand signals (emerald/amber/rose/blue); Phase 2.5 scope

## Verification

- [ ] 0 zinc/gray/slate i alle 5 filer
- [ ] Typecheck grønt
- [ ] Lint 0 nye errors
- [ ] Scope: kun reports-filer endret
