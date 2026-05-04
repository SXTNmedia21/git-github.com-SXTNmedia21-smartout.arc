---
title: "Handoff — mobile-addsheet-booking-stack"
status: done
updated: 2026-05-24
created: 2026-05-24
module: mobile
tags: [handoff, mobile, booking, bff, pii, authority, server-action]
---

# Handoff — Mobile AddSheet Booking Stack

**Branch:** `feat/mobile-addsheet-booking-stack`
**Worktree:** `~/dev/smartout.ai-mobile-wt-4`
**Base:** `campaign/mobile`
**Commits:** 2 (plan + implementation)

---

## What Was Built

Greenfield write-path for `schedule_day_booking` — previously a table with zero mutation surface. The AddSheet "Booking" branch on mobile had no way to persist.

Five components shipped:

| Component | File | Purpose |
|-----------|------|---------|
| Server Action | `apps/web/src/app/dashboard/_actions/add-booking-action.ts` | Canonical mutation primitive (ADR-0114) with gate_action, cross-workspace guard, emit |
| Authority Seed | `supabase/migrations/20260524000100_seed_booking_authority.sql` | Seeds `schedule.add_booking_manual` (confirm, manager) for all existing workspaces |
| Telemetry | `packages/telemetry/src/registry.ts` | `BookingCreated` interface + `"booking created"` EVENT_ROUTING (4-destination, PII-clean) |
| BFF Route | `apps/web/src/app/api/mobile/bookings/route.ts` | Bearer-auth POST, server-derives workspace+profile (ADR-0151), delegates to action |
| Mobile Sync | `apps/mobile/src/lib/sync/schemas.ts` + `action-map.ts` + `types.ts` | `createBookingSchema`, `create_booking` handler, `WriteAction` union entry |

The PII read-gate (ADR-0267) was already implemented on the campaign/mobile base (commit `f88770b11`): `useCalendarItems` masks contact when `profile.role === 'employee'`, and `DetailSheet.tsx` hides the Ring button behind `contactRedacted`.

---

## Decisions Made

### ADR-0271 — Booking-Create Full Stack

Registered in `docs/decisions/0000-decision-log.md` line 47 and `docs/decisions/0271-booking-create-stack.md`.

Key choices:
- `level=confirm` (not `autonomous`) — booking creation is a deliberate manager action, not routine automation. Mirrors `roster.add_shift_manual` floor (ADR-0099 §4).
- `min_role=manager` — employees cannot trigger this path even if mobile BFF were misconfigured. Guest self-service would be a separate capability.
- `contact` excluded from telemetry properties entirely — only `has_contact: boolean` emitted. Prevents PII from appearing in PostHog, logger, or activity_trail properties.
- Voice channel blocked at Zod schema layer (`z.enum(["chat", "system"])`) — belt-and-suspenders over ADR-0078 channel guard.
- `actor?` param in InputSchema supports BFF and agent callers (ADR-0151 compliant) while cookie path works for direct web invocation.

---

## Known Issues / Debt

- **No unit test for `add-booking-action.ts`** — Gate 5 (recommended, non-blocking). The action pattern mirrors `add-shift-action.ts` which has coverage; a dedicated test would add `gateAction` mock + insert mock coverage.
- **No GET handler with role-filtered bookings in BFF** — read path goes through `useCalendarItems` hook + RLS on the Supabase client. If a dedicated `GET /api/mobile/bookings` is needed in future, it must replicate the `canSeeContact` role check server-side.
- **`npx tsc` failures in `packages/telemetry` and `packages/lovsen-contract`** — pre-existing on `campaign/mobile`, caused by `node_modules` not being installed in those package dirs (worktree shares no node_modules with main repo after worktree creation without `pnpm install`). Not introduced by this sortie. Root fix: run `pnpm install` from worktree root before typecheck.
- **authority seed only covers existing workspaces** — new workspaces created post-migration need the row inserted via I1 bootstrap. This is the standard pattern (mirrors `seed_roster_add_shift_authority.sql`) but the I1 bootstrap template must include `schedule.add_booking_manual` to be complete.

---

## Next Steps

1. Add `schedule.add_booking_manual` to the I1 workspace bootstrap seed so new workspaces get the authority row at creation time (not just via this migration's cross-join).
2. Write unit test for `add-booking-action.ts` (mock `gateAction` + `createAdminClient`, cover: success, gate denial, voice channel rejection, cross-workspace mismatch).
3. Consider server-side contact masking in a future `GET /api/mobile/bookings` if the calendar hook pattern is insufficient for direct-list use cases.
4. Merge `campaign/mobile` → `development` when all 4 sorties are merged and campaign milestone is ready.
