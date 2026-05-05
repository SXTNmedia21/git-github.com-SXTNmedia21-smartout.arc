---
title: "Plan — addsheet-server-action-migration"
status: draft
updated: 2026-05-04
created: 2026-05-04
module: web
tags: [plan, server-action, adr-0114, deviation, day-info, migration]
---

# Plan — addsheet-server-action-migration

> Branch: `feat/mobile-addsheet-server-action-migration` | Worktree: `~/dev/smartout.ai-mobile-wt-5` | Base: `campaign/mobile`

## Trigger

AddSheet BFF-wrap audit 2026-05-04: TWO ADR-0114 violations.
- `useCreateDeviation` (apps/web/src/app/dashboard/hms/_hooks/use-create-deviation.ts:12-71) is client-side `useMutation`, not Server Action.
- `useCreateDayInfo` (apps/web/src/app/dashboard/schedule/_hooks/use-day-info.ts:113-155) same.

Both bypass authority gate. Both emit telemetry client-side without await — unreliable. Mobile direct-insert paths exist for both, also bypassing gate.

## Goal

Migrate both web paths from client-side `useMutation` to Server Action. Add BFF wrap for mobile. Authority seed for both capabilities. Replace existing client-hook callers with Server Action calls (preserve `useMutation` shape via React 19 `useTransition` + `useActionState`).

## Hard constraints

- ADR-0114, ADR-0099, ADR-0134, ADR-0151
- Migration timestamps > current repo tip
- Client-side hooks may stay as thin wrappers around Server Actions (preserves call-site ergonomics)
- Mobile sync handlers must route to BFF, not direct supabase insert

## Phases

### Phase 1 — Deviation
- `apps/web/src/app/dashboard/_actions/report-deviation-action.ts`
- Migration: seed `hms.report_deviation_manual` capability
- Refactor `useCreateDeviation` hook to invoke Server Action
- BFF route `/api/mobile/deviations/report`
- Update `actionMap.report_deviation` to call BFF (not direct supabase)

### Phase 2 — Day Info
- `apps/web/src/app/dashboard/_actions/create-day-info-action.ts`
- Migration: seed `schedule.add_day_info_manual` capability
- Refactor `useCreateDayInfo` hook
- BFF route `/api/mobile/day-info/create`
- Update `actionMap.create_day_info` to call BFF

### Phase 3 — Tests + ADRs + review

## Acceptance
- [ ] No client-side `useMutation` invokes `supabase.from(...).insert(...)` for these tables
- [ ] Both Server Actions emit telemetry server-side with await
- [ ] Both authority seeds applied
- [ ] BFF routes Bearer-auth + JWT-derive workspace
- [ ] HANDOFF
