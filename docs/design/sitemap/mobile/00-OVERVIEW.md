---
title: Mobile Sitemap — Overview
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, navigation, sitemap, adr-0133, adr-0268, adr-0287]
---

# Mobile Sitemap — Overview

## Stack

React Native + Expo Router (file-based, App Router style). Tab navigator at `/(app)` with a custom `TabBar` component and a center `AIFab`. Stack navigators inside each tab group.

## Actual Tab Bar (as of 2026-05-15)

| Slot | Tab name | Route group | Comment |
|------|----------|-------------|---------|
| 1 | Hjem | `(home)` | Landing screen. Was Kalender per ADR-0268 — superseded by comment in `_layout.tsx:32` |
| 2 | Vakter | `(shifts)` | Shift list + detail |
| 3 | FAB (center) | — | AIFab: tap → `/(app)/(home)`, swipe-L1 → AddSheet, swipe-L2 → AddSheet + BotssonSheet |
| 4 | Chat | `(chat)` | Channel list + Skranke (helpdesk) |
| 5 | Min Tid | `(me)` | Personal hub, payroll, contract |

Hidden routes (present but `href: null`): `(calendar)`, `(komm)`, `(queue)`, `journey`, `journey/[id]/guided`.

## ADR References

- **ADR-0133** — "Web composes, mobile executes." Mobile executes Approve/Execute/Witness verbs. Authoring screens (schedule editor, onboarding wizard, cost/billing, year-wheel) are web-only.
- **ADR-0268** — 5-tab canonical layout: Kalender · Vakter · FAB · Chat · Min Tid. Landing anchor was Calendar; overridden in code to `(home)` (drift documented in `08-gaps-and-broken.md`).
- **ADR-0287** — Gate action is mandatory on mutation capability tools (server-side; mobile sends thin requests via BFF).
- **ADR-0318** — Formally supersedes the 4-tab plan that was drafted 2026-05-03 before ADR-0268 was accepted.

## Key Architecture Principles

- **BFF only for mutations.** Mobile never calls capabilities or Supabase DB writes directly outside of auth and offline-queue mechanics. All AI traffic routes through `/api/emma/chat` → stage-engine.
- **Offline-first writes.** `enqueue()` from `apps/mobile/src/lib/sync/queue.ts` queues mutations; worker drains to BFF.
- **Telemetry invariants (ADR-0134).** `getProfileContext()` resolves `workspace_id` + `actor_id` before every `emit()`. Empty-string fallbacks are banned.
- **Two DuringShiftView variants.** V1 (default) and V2 (behind `EXPO_PUBLIC_DURING_SHIFT_V2=true` flag) coexist in `apps/mobile/src/components/home/`.

## What Works (verified route files exist)

All 56 route files listed in `01-route-inventory.md` have corresponding `.tsx` files on disk. Key working surfaces:

- Auth flow: welcome → verify → workspace-select → `/(app)/(home)`
- Home phase views: NoShift / BeforeShift / DuringShift / AfterShift
- Shifts list with ScopeChips + DayCrewCluster layout
- Shift detail with Detaljer / Oppgaver / Emma tabs
- Min Tid hub linking to payroll sub-stack
- Chat + Skranke merged tab
- Payroll sub-stack: all 8 registered screens have files (except `payroll-supplements` registration gap — see gaps doc)

## What is Broken / Incomplete

Full detail in `08-gaps-and-broken.md`. Summary:

- `payroll-supplements` registered in `payroll/_layout.tsx` but file is `supplements.tsx` — name mismatch causes 404 on navigation
- `ShiftClockView` (`apps/mobile/src/components/shift-clock/ShiftClockView.tsx`) is a complete punch-clock implementation with all sub-components, but `/(app)/(home)/punch-clock` is a parallel inline implementation using `useShiftClock` hook only — the component is unreachable orphan
- Shifts tab ("vakter laster ikke"): `useTeamShifts` queries `is_published=true` — if seed data has no published shifts, screen shows "Laster vakter…" forever in loading state, no explicit "empty" state when `!isLoading && !error && shifts.length === 0`
- `team/[id]` sub-screen not registered in `(home)/_layout.tsx` — navigation from `team.tsx` will fail
- `(calendar)` tab is hidden and layout comment still says "Stub for Phase 3f"
- Training screen has placeholder data; hooks not wired to `protocol_assignment` / `knowledge_test` tables
