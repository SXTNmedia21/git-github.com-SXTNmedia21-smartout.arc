---
id: ADR-0271
title: "Booking-Create Full Stack (Server Action + BFF + Mobile Sync)"
status: proposed
date: 2026-05-24
tags: [booking, mobile, bff, server-action, pii, authority, telemetry]
module: mobile
---

# ADR-0271 — Booking-Create Full Stack

## Context

`schedule_day_booking` existed as a DB table (migration `20260301600003`) but had
zero write-path: no Server Action, no telemetry, no authority seed, no BFF route,
no mobile sync schema. Phase 3e AddSheet booking-branch (`feat/mobile-addsheet-
booking-stack`) required a full greenfield pipe from mobile through to persistence.

Two cross-cutting laws constrain every booking write:

1. **ADR-0267 (booking-PII access control):** `contact_person` is PII. Voice
   channel is forbidden. Employee role may not create bookings.
2. **ADR-0270 (mobile shift authoring via BFF):** mobile is a thin client;
   all mutations route through the web BFF. No direct Supabase inserts from
   the device.

## Decision

Build five components in this feature:

### 1. Server Action — `add-booking-action.ts`

`apps/web/src/app/dashboard/_actions/add-booking-action.ts`

- Zod InputSchema: `shiftDate` (DATE), `bookingTime` (TIME), `title`, `guestCount`,
  optional `contact` (PII), optional `notes`, optional `actor?` (pre-resolved per
  ADR-0151), `channel?: "chat" | "system"`.
- Auth: `actor` param when supplied by BFF; else `resolveCurrentProfile()` cookie
  path. Cross-workspace guard always runs regardless of path.
- Gate: `gateAction({ capability: "schedule.add_booking_manual", ... })` per ADR-0099.
  Returns 403-shaped error on denial.
- Insert: `schedule_day_booking` via admin client. `contact_person` stored verbatim;
  PII access at read time is enforced by RLS + BFF role check (ADR-0267).
- Emit: `"booking created"` with `workspace_id` + `actor_id` branded via `nonEmpty()`.
  Contact PII is NOT included in telemetry properties — only `has_contact: boolean`.
- Returns `{ ok: true, bookingId } | { ok: false, error }`.

### 2. Authority Seed — `20260524000100_seed_booking_authority.sql`

Seeds `engine_authority_config` for `schedule.add_booking_manual`:

| Field | Value |
|-------|-------|
| `level` | `confirm` |
| `min_role` | `manager` |
| `requires_four_eyes` | `false` |
| `observer_escalation_hours` | `24` |

Without this row, `gate_action()` default-allows (L-0107). Mirrors
`20260517100000_seed_roster_add_shift_authority.sql`.

### 3. Telemetry — `"booking created"` in `packages/telemetry/src/registry.ts`

Interface `BookingCreated extends BaseEvent` with `entity_type: "booking"`.
Contact PII excluded from properties by design (only `has_contact: boolean`).
Routes to all four destinations: `["posthog", "logger", "activity_trail", "engine_event"]`.
Dual-registered per L-0072 (interface + EVENT_ROUTING entry).

### 4. BFF Route — `apps/web/src/app/api/mobile/bookings/route.ts`

POST handler. Bearer auth via `supabase.auth.getUser()`. Workspace_id + profile_id
derived server-side from JWT profile row (ADR-0151). Delegates to `addBookingAction`
with `channel: "system"` (mobile BFF channel per ADR-0132). HTTP 200/401/403/422.

### 5. Mobile Sync Layer

- `createBookingSchema` in `schemas.ts`: validates payload at enqueue time (ADR-0134).
  `workspace_id` intentionally absent — BFF derives it (ADR-0151).
- `"create_booking"` in `types.ts` `WriteAction` union.
- `create_booking` handler in `action-map.ts`: fetches `supabase.auth.getSession()`
  for Bearer token, POSTs to `/api/mobile/bookings`. Never touches Supabase directly
  (ADR-0270). Throws on non-OK response for SyncWorker retry logic.
- `getBookingCreateUrl()` added to `web-api.ts`.

## Cross-reference

| ADR | Reason |
|-----|--------|
| ADR-0099 | gate_action() RPC as single authority gate |
| ADR-0114 | Server Actions as canonical mutation primitive |
| ADR-0134 | Telemetry contract — all mutations emit with non-empty IDs |
| ADR-0151 | profile_id + workspace_id server-derived, never from body |
| ADR-0267 | Booking-PII access control — voice forbidden, employee cannot create |
| ADR-0270 | Mobile mutation authoring via web BFF |
| ADR-0078 | Channel restriction for PII |
| ADR-0132 | Mobile thin client — AI/capability traffic through BFF |

## Alternatives Rejected

**Direct Supabase insert from mobile (action-map):** violates ADR-0270 and ADR-0151.
The `create_shift` action-map entry pre-dates ADR-0270 and is the "old path" pattern;
`create_booking` uses the correct BFF-delegate pattern.

**Including contact PII in telemetry properties:** rejected — ADR-0267 + GDPR.
`has_contact: boolean` provides analytics signal without transiting the data.

## Consequences

- Booking-create pipe is fully wired: mobile → BFF → Server Action → gate → DB → emit.
- Authority seed prevents default-allow bypass (L-0107).
- Telemetry event enables engine_event consumers to react to new bookings.
- Mobile offline queue can enqueue `create_booking` actions that drain when connectivity
  returns — BFF delegation is sync-safe.
