---
title: "Journey — Hub/landing konsistent med Nordic Split"
feature: nordic-split-hub
journey: admin-ser-konsistent-hub
status: verified
verified_at: 2026-04-23
e2e_test: null
created: 2026-04-23
updated: 2026-04-23
verification_notes: |
  Grep: 0 zinc/gray/slate across 5 files.
  Typecheck: 0 errors.
  Lint: 0 errors, 5 pre-existing warnings.
  Migration: 191 refs → 0; -254 lines; ~171 ternaries collapsed.
  Visual QA deferred — 4 low-confidence items flagged (page.tsx header flatten,
  Punch In invert, ROLE_COLORS.employee translucent parity, toggle knob tone).
module: Dashboard
tags: [journey, design-system, nordic-split]
---

# Journey: Hub/landing konsistent med Nordic Split

**Role:** admin + employee + visitor

**Precondition:** Phase 1–3b tokens aktive

## Happy Path

1. Visitor/admin ser landing page `/` → warm OKLCH paletten
2. Employee åpner EmployeeDashboard → tokens
3. Admin åpner TeamMembersSheet overlay → tokens
4. Admin bruker `/scrape` → tokens
5. Employee leser handbook ChapterReader → tokens

**Postcondition:** 5 filer bruker kun semantiske tokens

## Verification

- [ ] 0 zinc/gray/slate i alle 5 filer
- [ ] Typecheck grønt
- [ ] Lint 0 nye errors
