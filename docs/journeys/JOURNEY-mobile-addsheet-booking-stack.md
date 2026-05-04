---
title: "Journey — mobile-addsheet-booking-stack"
status: done
updated: 2026-05-24
created: 2026-05-24
module: mobile
tags: [journey, mobile, booking, bff, pii, authority, server-action]
---

# Journey — Mobile AddSheet Booking Stack

Covers the full booking-create write-path from mobile AddSheet through BFF to persistence,
with ADR-0267 PII gate enforcing role-based contact masking and ADR-0078 voice guard.

---

## Journey: Manager Creates a Booking via Mobile AddSheet

**Precondition:** User is authenticated on mobile with `role = 'manager'` or `role = 'admin'`. AddSheet is open. Network is available. `engine_authority_config` row exists for `schedule.add_booking_manual` (seeded by `20260524000100_seed_booking_authority.sql`).

1. Manager opens AddSheet on mobile and selects "Booking" branch.
2. Manager fills in: shift date (YYYY-MM-DD), booking time (HH:MM), title, guest count (≥1), optional contact person (PII), optional notes.
3. Manager taps "Opprett booking".
4. Mobile calls `actionMap.create_booking(payload)` → `createBookingSchema` validates payload at enqueue time (ADR-0134 Zod gate).
5. `action-map.ts` fetches `supabase.auth.getSession()` → extracts Bearer token.
6. Mobile sends `POST /api/mobile/bookings` with Bearer token + validated payload. `workspace_id` and `profile_id` are NOT sent in body (ADR-0151).
7. BFF route (`apps/web/src/app/api/mobile/bookings/route.ts`) verifies Bearer JWT via `supabase.auth.getUser()` → 401 if missing.
8. BFF derives `profile_id`, `workspace_id`, and `role` from `profile` table server-side (ADR-0151). Returns 403 if no active profile found.
9. BFF delegates to `addBookingAction` with `channel: "system"` (ADR-0132 mobile BFF channel).
10. `addBookingAction` runs cross-workspace guard: re-fetches caller profile row, verifies workspace membership. Returns error if mismatch.
11. `addBookingAction` calls `gateAction({ capability: "schedule.add_booking_manual", ... })`. Gate enforces `min_role=manager` and `level=confirm`. Employees blocked here.
12. On gate pass, action inserts into `schedule_day_booking` via admin client (scoped by `workspace_id`).
13. Action emits `"booking created"` via `emit()` with `workspace_id` (NonEmptyString) + `actor_id` (NonEmptyString). Contact PII is NOT in telemetry properties — only `has_contact: boolean`.
14. Emit routes to all four destinations: `posthog`, `logger`, `activity_trail`, `engine_event`.
15. BFF returns `{ ok: true, booking_id }` → HTTP 200.
16. Mobile sync layer receives success → AddSheet closes → calendar refreshes.
17. New booking appears in day view with title + time. Contact field visible to manager/admin; hidden for employee role (ADR-0267 read gate in `useCalendarItems`).

**Postcondition:** `schedule_day_booking` row inserted, `activity_trail` entry logged, `engine_event` queued. Manager sees booking in calendar.

**Error paths:**
- Unauthenticated request → 401 Unauthorized.
- No active profile for user → 403 Forbidden.
- Gate denial (employee, or no config row + default-allow prevents wrong path) → 403 with gate reason.
- Zod schema failure at BFF (missing required fields) → 422 with field errors.
- DB insert error → 422 with error message.
- Channel not in `["chat", "system"]` → rejected by Zod schema (z.enum on action). Belt-and-suspenders for future schema loosening.

---

## Journey: Employee Views Day with Bookings (PII Gate — Read)

**Precondition:** User is authenticated with `role = 'employee'`. Calendar day view has bookings with `contact_person` set.

1. Employee opens mobile calendar → `useCalendarItems` hook fires.
2. `useCalendarItems` loads `useMyProfile` → derives `canSeeContact = profile.role !== 'employee'`.
3. For each booking item: if `!canSeeContact`, `contact` is set to `null` and `contactRedacted = true` on the `CalendarItem`.
4. Default-deny applies when profile not yet loaded (`role === undefined`).
5. `DetailSheet.tsx` evaluates `contactRedacted` → hides "Ring" button for employee role.
6. Employee sees booking with title, time, guest count. Contact column is absent/masked.

**Postcondition:** PII never reaches employee-role UI. `contactRedacted` flag controls downstream UI rendering.

**Error paths:**
- Profile load failure → default-deny (contact hidden until profile resolves).
- RLS policy `jwt_read_schedule_day_booking` allows all workspace members to read rows, but `contact_person` column masking is enforced at application layer (BFF + hook).

---

## Journey: Manager Attempts Booking via Voice (Channel Guard)

**Precondition:** Stage-engine routes a voice-channel request to the booking capability.

1. Voice session triggers booking-create path with `channel: "voice"`.
2. `addBookingAction` InputSchema rejects `"voice"` at the Zod `z.enum(["chat", "system"])` level → parse failure → `{ ok: false, error: "Ugyldig input." }`.
3. No DB insert, no emit.

**Postcondition:** Booking PII never transits voice channel (ADR-0078 + ADR-0267).

---

## Journey: Authority Seed Bootstraps Correctly on Fresh Workspace

**Precondition:** New workspace created via I1 bootstrap. No `engine_authority_config` row yet for `schedule.add_booking_manual`.

1. Migration `20260524000100_seed_booking_authority.sql` runs during `supabase db push` or local `supabase start`.
2. PL/pgSQL block finds first godmode user via `user_identity.is_godmode`.
3. `INSERT INTO engine_authority_config ... ON CONFLICT DO NOTHING` seeds row for every existing workspace × capability.
4. If no godmode user exists (pre-bootstrap): `RAISE NOTICE` and graceful exit. Migration is idempotent — re-run after first admin is created.
5. Without this row, `gate_action()` would default-allow (L-0107). With it, `min_role=manager` is enforced.

**Postcondition:** Every existing workspace has `schedule.add_booking_manual` with `level=confirm, min_role=manager`. New workspaces receive the row via I1 bootstrap (separate concern).
