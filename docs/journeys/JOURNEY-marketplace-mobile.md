---
title: Journey — Marketplace Mobile
status: done
updated: 2026-05-14
created: 2026-05-14
feature: marketplace-mobile
module: scheduler
tags: [journey, marketplace, mobile, claim, e2e, s9]
---

# Journey — Marketplace Mobile

Sub-sortie: `feat/world-best-wfm-marketplace-mobile`
Campaign: `campaign/world-best-wfm`
Closes: Task 4 (mobile claim list) + Task 5 (S9 E2E)

---

## Journey 1: Employee Claims Open Shift via Mobile

**Actor:** Employee (mobile PWA at localhost:8083 in dev; app.smartout.ai in prod)

**Precondition:**
- Employee is authenticated.
- A manager has posted an open shift offer (`schedule_shift_offer.status='open'`).
- Employee is in the same workspace.

### Happy Path

1. Employee navigates to the Shifts tab → taps "Vakt-markedsplass" or navigates directly to `(shifts)/marketplace`.
   - System: TanStack Query fetches `GET /api/mobile/marketplace/open-offers` (Bearer JWT).
   - System: BFF derives workspace_id + profile_id server-side from JWT (ADR-0151). Never from body.
   - Employee sees: Pull-to-refresh FlatList of OpenOffer cards — role, time (formatted), department badge, "Krev" button.

2. Employee taps "Krev" on an offer card.
   - System: Confirmation sheet slides up with role + date/time + note "Vakter tildeles etter godkjenning".

3. Employee taps "Bekreft" in the sheet.
   - System: `POST /api/mobile/marketplace/claim` with `{ offer_id }` and Bearer JWT.
   - System: BFF calls `gate_action` RPC (ADR-0099). On success: UPDATE `schedule_shift_offer.status='claimed'`.
   - System: emits `shift_offer.claimed` (ADR-0134, destinations: PostHog + Logger + activity_trail + engine_event).
   - Employee sees: Offer card immediately grays out ("Venter godkjenning") — optimistic update.
   - TanStack Query invalidates + refetches in background.

4. After manager approval: offer disappears from the list on next 30s poll or manual pull-to-refresh.

**Postcondition:**
- `schedule_shift_offer.status = 'claimed'`
- `claimed_by_profile_id = employee.profile_id`
- `activity_trail` row written via telemetry

### Error Paths

| Scenario | What the employee sees |
|----------|------------------------|
| `OFFER_NOT_OPEN` — another employee claimed first | Native Alert: "Dette tilbudet er ikke lenger tilgjengelig." |
| `AUTHORITY_DENIED` — gate_action rejected | Native Alert: "Du har ikke tillatelse til å krev denne vakten." |
| `SELF_CLAIM` — employee is poster | Native Alert: "Du kan ikke krev din egen vakt." |
| Network error | Native Alert: "Nettverksfeil. Sjekk tilkoblingen og prøv igjen." |
| Not authenticated | Alert: "Du er ikke innlogget. Logg inn på nytt." |
| Offer expired | Offer disappears on next poll; employee sees empty list or reduced list. |

### Constraints

- `workspace_id` + `profile_id` are NEVER sent from mobile — always derived server-side (ADR-0151).
- Voice is NOT available for claim action (ADR-0288: chat-only). Mobile surface = chat channel.
- Pull-poll V1 (30s interval, focus-only). Push fanout deferred to V2 per ADR-0306.

---

## Journey 2: S9 — Marketplace Full Flow (E2E)

**Actors:** Manager (web) + Employee (mobile)
**Protocol file:** `apps/e2e/protocols/p-marketplace-full-flow.ts`
**Registry key:** `"S9"` in `apps/e2e/protocols/index.ts`

**Precondition:**
- `schedule_shift` row with `employee_id=NULL` pre-seeded by test runner.
- Employee profile exists in same workspace.

### Steps

1. Manager authenticates to web dashboard (step 1).
2. Manager posts offer via Botsson chat (step 2) — capability tool `post_open`.
3. Runner asserts `schedule_shift_offer.status='open'` via `db_record` gate (step 3).
4. Employee authenticates on mobile PWA at localhost:8083 (step 4).
5. Employee opens `(shifts)/marketplace` — offer card visible (step 5).
6. Employee taps "Krev" → confirms → optimistic gray-out (step 6).
7. Runner asserts `schedule_shift_offer.status='claimed'` via `db_record` gate (step 7).
8. Manager opens `/dashboard/schedule/marketplace` — sees claim in queue (step 8).
9. Manager clicks Godkjenn on the claimed offer (step 9).
10. Runner asserts `schedule_shift_offer.status='approved'` via `db_record` gate (step 10).
11. Final `db_record` gate confirms `status='approved'` — S9 closed (step 11).

**Postcondition:**
- `schedule_shift.employee_id = claimer.profile_id`
- `schedule_shift_offer.status = 'approved'`
- 3 telemetry events emitted: `shift_offer.posted`, `shift_offer.claimed`, `shift_offer.approved`

**Telemetry assertions (advisory — not enforced by runner V1):**
- `shift_offer.posted` emitted by manager's chat tool call.
- `shift_offer.claimed` emitted by BFF claim route.
- `shift_offer.approved` emitted by web manager BFF action route.
