---
title: "Plan — addsheet-booking-stack"
status: draft
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [plan, mobile, booking, server-action, bff, addsheet, calendar]
---

# Plan — addsheet-booking-stack

> Branch: `feat/mobile-addsheet-booking-stack` | Worktree: `~/dev/smartout.ai-mobile-wt-4` | Base: `campaign/mobile`

## Trigger

AddSheet BFF-wrap audit 2026-05-04: booking-create has ZERO write-path. Table `schedule_day_booking` exists, but no Server Action, no telemetry event, no authority seed, no BFF, no mobile schema. Phase 3e AddSheet booking-branch CANNOT ship without this.

ADR-0267 (booking-PII access-control) MUST be honored — gjeste-kontaktinfo PII-gate per `profile.role`.

## Goal

Greenfield full-stack booking-create:
1. Web Server Action `add-booking-action.ts`
2. Authority seed `engine_authority_config` row (`schedule.add_booking_manual`, min_role=manager)
3. Telemetry event `"booking created"` registered (4-destination)
4. BFF route `/api/mobile/bookings/create` (Bearer-auth, ADR-0151 server-derive)
5. Mobile sync schema `createBookingSchema` + `actionMap.create_booking` (calls BFF, ikke direct insert)
6. Booking-PII gate per ADR-0267: `contact` field masked for `profile.role === 'employee'`

## Hard constraints

- ADR-0114, ADR-0099, ADR-0151, ADR-0134, ADR-0267
- ADR-0078 channel guard: `chat | system`, ikke voice (booking-PII)
- Migration timestamp > current repo tip (per smartout-database-guide L-0042)
- All booking writes MUST emit `"booking created"` with workspace_id + actor_id NonEmptyString brand

## Phases

### Phase 1 — Server Action + authority seed
- `apps/web/src/app/dashboard/_actions/add-booking-action.ts`
- Migration: `<TS>_seed_booking_authority.sql` — seed `schedule.add_booking_manual`
- Pattern: mirror `add-shift-action.ts` (ADR-0270), accept `actor?` + `channel?`

### Phase 2 — Telemetry + BFF
- Add `"booking created"` to `packages/telemetry/src/registry.ts`
- `apps/web/src/app/api/mobile/bookings/route.ts` — Bearer-auth + delegate to action
- ADR-0267 PII-gate: contact masked unless role allows

### Phase 3 — Mobile sync
- Add `createBookingSchema` to `apps/mobile/src/lib/sync/schemas.ts`
- Add `actionMap.create_booking` calling BFF (no direct supabase insert)
- (No existing mobile direct-insert to deprecate — greenfield)

### Phase 4 — Tests + ADR + review

## Acceptance
- [ ] `pnpm --filter web typecheck` grønn
- [ ] `pnpm --filter web test add-booking-action` grønn
- [ ] Migration applies clean
- [ ] ADR proposed referencing 0267 + 0270
- [ ] HANDOFF
