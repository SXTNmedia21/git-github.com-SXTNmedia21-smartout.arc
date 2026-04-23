---
title: "Plan — followups (Sortie 4 of schedule-harness)"
status: in_progress
updated: 2026-04-24
created: 2026-04-24
module: schedule-harness
tags: [plan, followups, non-blockers]
---

# Plan — followups

> Branch: `feat/schedule-harness-followups` | Worktree: `/home/sxtnl/dev/smartout.ai-schedule-harness-wt-1` | Base: `campaign/schedule-harness` | Module: schedule-harness | Started: 2026-04-24

## Goal

Close 3 non-blocker follow-ups from Sorties 1+3. Housekeeping sortie.

## Tasks (parallel)

### Task P — Dual-gate naming ADR
New ADR documenting `signoff.admin_override` (BFF path) vs `reconciliation.wizard_submit_with_blocker` (Server Action path). Reserve next ADR number via `git log --all`. Documents defense-in-depth intent + which gate fires where. Register in decision log.

### Task Q — AvailabilitySidebar isError branch
Today the sidebar silently shows empty state on BFF failure. Add explicit `isError` branch with:
- Text: "Kunne ikke laste tilgjengelighet"
- Retry button (calls `refetch()`)
- Nordic Split tokens only

### Task R — Shared STATUS_TIER module
Extract duplicated `STATUS_TIER` + `STATUS_LABEL_NB` constants to `apps/web/src/lib/availability/status-tier.ts`. Import from AvailabilitySidebar + AddShiftDialog.

### Task S — Supervisor + close
10-gate review. Commit + PR.

## Acceptance

- [ ] Typecheck 35/35 PASS
- [ ] Nordic Split 0 hits on modified files
- [ ] ADR registered + status: proposed
- [ ] AvailabilitySidebar renders error state testable
- [ ] 0 duplicate STATUS_TIER in sidebar + dialog (import from shared)
