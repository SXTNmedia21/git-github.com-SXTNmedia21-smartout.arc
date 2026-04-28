---
title: "Journey — Organization dialogs/helpers konsistent med Nordic Split"
feature: nordic-split-org-dialogs
journey: admin-ser-konsistent-org-tail
status: verified
verified_at: 2026-04-23
e2e_test: null
created: 2026-04-23
updated: 2026-04-23
verification_notes: |
  Grep: 0 zinc/gray/slate across all 12 files.
  Typecheck: 0 errors.
  Migration: ~120 refs → 0; -207 lines; ~107 ternaries collapsed.
  3 files prefixed _isDark; asymmetric orange-selected + ring-offset preserved.
  Visual QA deferred.
module: Dashboard
tags: [journey, design-system, nordic-split]
---

# Journey: Organization dialogs + helpers konsistent

**Role:** admin

**Precondition:** Phase 1–3c tokens aktive

## Happy Path

Admin åpner org-admin dialogs/sheets (Edit Asset/Department/Position/Team/Location, Create Zone/Asset, Move Position), navigerer entity-detail-layout, bruker org-tab-nav → alt renderer med Nordic Split-tokens konsistent med organization-tabs (Phase 2) og schedule/reports (3a/3b).

## Verification

- [ ] 0 zinc/gray/slate i alle 12 filer
- [ ] Typecheck 0 errors
- [ ] Lint 0 nye errors
