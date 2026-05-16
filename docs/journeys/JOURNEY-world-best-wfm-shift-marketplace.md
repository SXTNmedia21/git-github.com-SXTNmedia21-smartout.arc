---
title: Journey — Open-Shift Marketplace V1 (web)
feature: shift-marketplace
status: verified
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [journey, marketplace, shift_offer, wfm]
---

# Journey — Open-Shift Marketplace V1 (web)

## Summary

V1 ships 5 capability tools (`post_open`, `claim`, `approve_claim`, `cancel_offer`, `list_open_offers`) + a pull-poll BFF (`/api/mobile/marketplace/open-offers`, 30 s refetch) + a web manager UI at `/dashboard/schedule/marketplace` (Tabs + glassmorphism + motionTokens) built on the PHASE 1 foundation schema (`schedule_shift_offer` table, eligibility helper, 5 telemetry events). Mobile claim list (Task 4) and the full E2E spec P-marketplace-full-flow (Task 5) are deferred to the follow-on sortie. G3 ADR-0306 registers `list_open_offers` as the 5th tool with its channel/gate matrix, and the G3 follow-on ADR-0321 covers swap↔marketplace V2 convergence and multi-stage approval via `engine_authority_pipeline`.

---

## Journey 1: Manager Posts an Open Shift (web, Compose verb)

**ADR refs:** ADR-0133 (Compose = web only), ADR-0288 (chat-only voice restriction on mutation tools), ADR-0306 §post_open

**Precondition:**
- Caller has `manager` (or higher) role in the workspace.
- A `schedule_shift` row exists with `shift_id` to be offered.
- The shift has no current assignee OR manager explicitly wants to open it.

**Happy path:**

1. Manager navigates to `/dashboard/schedule/marketplace`.
2. Manager selects a shift and clicks **"Post offer"** (or issues via chat — chat channel OK, voice blocked per ADR-0288).
3. Browser calls BFF → `/api/marketplace/action` with `{ tool: "post_open", shift_id, expires_at? }`.
4. BFF resolves `workspace_id` and `actor_id` from JWT; calls `shift_marketplace` capability tool `post_open` via stage-engine.
5. Capability runs single `mutateWithGate` → INSERT `schedule_shift_offer` row: `status='open'`, `poster_profile_id=auth.profileId`, `expires_at` (optional).
6. `emit({ event: "shift_offer.posted", ... })` fires exactly once.
7. UI refetches `list_open_offers`; offer card appears in **Åpne** tab.

**Postcondition:** `schedule_shift_offer` row exists with `status='open'`; `shift_offer.posted` event in `activity_trail` and `engine_event`.

**Error paths:**
- Caller is `employee` role → 403 from gate, UI shows error toast.
- `shift_id` not found in workspace → 404, UI shows "Skiftet finnes ikke".
- Offer already exists for this shift in `open` or `claimed` state → gate rejects duplicate, UI shows "Tilbud allerede aktivt".

---

## Journey 2: Employee Claims an Open Offer

**ADR refs:** ADR-0133 (Approve = mobile-allowed), ADR-0288 (chat-only voice restriction), ADR-0306 §claim

**Note:** Mobile claim UI (Task 4) is deferred to follow-on sortie. Web claim is available via chat or direct BFF call.

**Precondition:**
- Caller has `employee` (or higher) role.
- A `schedule_shift_offer` row exists with `status='open'`.
- Employee has not already claimed another offer for the same time window.

**Happy path:**

1. Employee opens the marketplace (chat or, in follow-on sortie, mobile list).
2. Employee selects an offer and initiates claim.
3. BFF pre-loads eligibility context: caller's `profile`, target `schedule_shift`, applicable `framework_rules`, existing `schedule_absences`, and overlapping `existing_shifts`.
4. BFF calls `eligibilityFor` helper (pure TS, no DB write) → returns `{ eligible: true }`.
5. Capability `claim` runs single `mutateWithGate` → UPDATE `schedule_shift_offer.status = 'claimed'`, `claimed_by_profile_id = auth.profileId`.
6. `emit({ event: "shift_offer.claimed", ... })` fires exactly once.
7. Manager sees offer move to **Krav i kø** tab on next refetch.

**Postcondition:** `schedule_shift_offer.status = 'claimed'`; `shift_offer.claimed` event emitted.

**Error paths:**
- Employee has a shift that overlaps the target → `eligibilityFor` returns blocker code `overlap`; UI shows translated message "Du har skift som overlapper".
- Working hours would exceed Arbeidsmiljøloven threshold → blocker code `aml_hours`; UI shows "Arbeidstid overskrider lovkravet".
- Missing competence requirement defined in framework rules → blocker code `competence`; UI shows "Du mangler nødvendig kompetanse".
- Offer `status` is not `open` (already claimed or cancelled) → gate rejects; UI shows "Tilbudet er ikke lenger tilgjengelig".

---

## Journey 3: Manager Approves a Claim

**ADR refs:** ADR-0133 (Approve = mobile-allowed), ADR-0099 (one gate per write), ADR-0134 (one emit per logical event), ADR-0306 §approve_claim

**Precondition:**
- Caller has `manager` (or higher) role.
- `schedule_shift_offer.status = 'claimed'`.

**Happy path:**

1. Manager opens `/dashboard/schedule/marketplace` → **Krav i kø** tab.
2. Manager clicks **Godkjenn** on an offer card.
3. BFF calls capability `approve_claim` with `{ offer_id }`.
4. Capability runs a SINGLE `mutateWithGate` that wraps a transactional sequence:
   - SELECT `schedule_shift_offer` FOR UPDATE (locks row).
   - UPDATE `schedule_shift.employee_id = offer.claimed_by_profile_id`.
   - UPDATE `schedule_shift_offer.status = 'approved'`.
5. `emit({ event: "shift_offer.approved", ... })` fires ONCE after the transaction commits.
6. Offer moves to **Godkjent** tab; shift now shows assigned employee.

**Postcondition:** `schedule_shift.employee_id` updated to claimant; `schedule_shift_offer.status = 'approved'`; `shift_offer.approved` emitted once.

**Error paths:**
- `shift_id` in the offer is stale (shift deleted) → UPDATE finds 0 rows; gate detects no-op and returns 409 (known debt — row-count check deferred, see HANDOFF known issues).
- Offer `status` is not `claimed` at lock time (race condition) → 409 "Kravet er ikke lenger aktivt".
- Caller is not manager → 403.

---

## Journey 4: Manager or Poster Cancels an Offer

**ADR refs:** ADR-0306 §cancel_offer + §51 (both channels OK for cancel)

**Precondition:**
- Caller is the original poster OR has `manager` role.
- `schedule_shift_offer.status ∈ {open, claimed}`.

**Happy path:**

1. Poster or manager selects the offer (web UI or chat).
2. BFF calls capability `cancel_offer` with `{ offer_id, cancel_reason }`.
3. Capability runs single `mutateWithGate` → UPDATE `schedule_shift_offer.status = 'cancelled'`, `cancel_reason = <reason>`.
4. `emit({ event: "shift_offer.cancelled", ... })` fires once.
5. Offer disappears from active tabs.

**Postcondition:** `schedule_shift_offer.status = 'cancelled'`; `cancel_reason` set; `shift_offer.cancelled` emitted.

**Error paths:**
- Offer already `approved` or `cancelled` → gate rejects; UI shows "Tilbudet kan ikke avlyses i nåværende tilstand".
- Caller is neither poster nor manager → 403.

---

## Journey 5: Read Open-Offer Inbox (`list_open_offers`)

**ADR refs:** ADR-0306 G3 amendment (5th tool; no gate, read-only; voice OK)

**Precondition:**
- Caller is authenticated in the workspace (any role).

**Happy path:**

1. Employee or manager opens marketplace list (web or voice).
2. BFF calls capability `list_open_offers` (no `mutateWithGate` — read-only).
3. Capability returns `schedule_shift_offer` rows with `status='open'` for the caller's workspace, filtered by eligibility if caller is employee role.
4. Web UI renders offer cards in **Åpne** tab.
5. For pull-poll: TanStack Query refetches every 30 seconds while tab is focused.

**Postcondition:** No DB writes; no event emitted. Returns up to 50 offers ordered by `expires_at ASC NULLS LAST`.

**Error paths:**
- No open offers → empty state returned (not an error); UI shows glassmorphism "Ingen åpne tilbud".

---

## Cross-Cutting Notes

| Tool | Channel | Gate | Voice |
|---|---|---|---|
| `post_open` | chat + web | mutateWithGate | blocked (ADR-0288) |
| `claim` | chat + web + mobile | mutateWithGate | blocked (ADR-0288) |
| `approve_claim` | chat + web + mobile | mutateWithGate | blocked (ADR-0288) |
| `cancel_offer` | chat + web + mobile | mutateWithGate | blocked (ADR-0288) |
| `list_open_offers` | all | none (read) | allowed |

G3 ADR-0306 amendment registers `list_open_offers` as the 5th tool in the channel/gate matrix above.
All mutation tools resolve `workspace_id` and `actor_id` server-side from JWT — no client-supplied identity per ADR-0151.
`approve_claim` wraps two UPDATEs in a single `mutateWithGate` call per ADR-0099 (one gate per write transaction).
Each tool emits exactly once per logical event per ADR-0134.
