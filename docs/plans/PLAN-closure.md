---
title: "Plan — Campaign daily-operation closure"
status: in_progress
updated: 2026-04-23
created: 2026-04-23
module: daily-operation
tags: [plan, closure, invariant-13, m2, m4]
---

# Plan — Campaign daily-operation closure

> Branch: `feat/daily-operation-closure` | Worktree: `/home/sxtnl/dev/smartout.ai-daily-operation-wt-2` | Base: `campaign/daily-operation` | Module: daily-operation | Started: 2026-04-23

## Goal

Close all remaining functional + test + doc debt in `campaign/daily-operation` so the campaign can be milestone-merged to `development`. Six items in one sub-sortie.

## Tasks

### Bølge 1 — uavhengige filer (parallell dispatch)

- [ ] **Item 1 — RosterTab "Legg til vakt" CTA** (apps/web/src/components/day/tabs/RosterTab.tsx)
- [ ] **Item 2 — TasksTab "Legg til oppgave" CTA** (apps/web/src/components/day/tabs/TasksTab.tsx)
- [ ] **Item 4 — M2 admin-override DB write** (TODO-M2-F in mobile reconciliation)

### Bølge 2 — sekvensiell

- [ ] **Item 3 — 0c watchdog-demotion cron** (Edge Function)

### Bølge 3 — doc + test (parallell)

- [ ] **Item 5 — E2E sweep** (Playwright)
- [ ] **Item 6 — ADR-bump 0187/0188/0189/0190** (proposed → accepted)

## Combined migration

One migration seeds all three new C4 rows:
- `roster.add_shift_manual`
- `task.add_task_manual`
- `signoff.admin_override`

Covered by existing `authority-seed-parity` CI gate.

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Lint passes (no zinc/gray/hex per Nordic Split)
- [ ] pgTAP passes
- [ ] Playwright E2E green
- [ ] All 6 items in single PR
- [ ] Decision log updated (ADRs bumped)
- [ ] HANDOFF-closure.md written
- [ ] JOURNEY-closure.md written
- [ ] Campaign roadmap status updated to "ready to merge"

## Journeys

### J-CLOSURE-1 — Admin legger til vakt manuelt
RosterTab empty/non-empty → "+ Legg til vakt" → dialog → Server Action → schedule_shift (source_type='manual_admin') + activity_trail (manual=true).

### J-CLOSURE-2 — Admin legger til oppgave manuelt
Samme mønster mot `session_task`.

### J-CLOSURE-3 — Admin overrider preflight (M2 mobil)
Wizard preflight blocker → "Overstyr" → reason → activity_trail (override=true) → wizard fortsetter.

### J-CLOSURE-4 — Watchdog demoterer stale pending_signoff
`pending_signoff` > 24t → cron → status=`missed` → emit + activity_trail.
