---
title: Scheduler Mobile — User Journeys
status: done
updated: 2026-05-14
created: 2026-05-14
feature: scheduler-mobile
module: scheduler
tags: [scheduler, mobile, bundle, change-proposal, e2e]
---

# Journeys: Scheduler Mobile (V1)

Three journeys: mobile bundle accept, E2E S10 (web propose + web accept), E2E S11 (mobile bundle accept).

---

## Journey 1: Manager — Mobile Bundle Accept (ADR-0309 V1)

**Precondition:**
- Manager is authenticated on mobile (PWA or native).
- A pending `change_proposal` with `kind='scheduler_bundle'` and `status='pending'` exists for the workspace.
- The proposal was created via the scheduler capability (greedy solver) and contains `proposed_shifts` in `changes` JSONB.

**Happy path:**

1. Manager navigates to `(shifts)/proposed-plan` on mobile.
   - System loads pending proposal from BFF GET `/api/scheduler/proposals?status=pending`.
   - BundleCard renders showing: date range, shift count, gap count, objective score.
   - ReadOnlyShiftList renders flat rows (employee name + role + time). NO toggles, NO checkboxes.
   - BundleActionBar shows two buttons at bottom: "Avslå alle" (left) + "Godta alle" (right, primary).

2. Manager taps "Godta alle".
   - `getProfileContext()` resolves `workspaceId` + `profileId` server-side. Fail-fast on missing identity (L-0177).
   - BFF POST `/api/scheduler/accept-bundle` is called with `change_proposal_id` only (no identity in body, ADR-0151).
   - BFF calls `acceptProposal.execute()` from `@smartout/ai/capabilities/scheduler`.
   - Capability: `gate_action` RPC evaluated. If denied → 403 response.
   - Atomic DB transaction: N `schedule_shift` rows inserted + `change_proposal.status` → `'applied'`.
   - ONE `scheduler.proposal.accepted` emit (never per-shift, ADR-0134 + ADR-0309).
   - Success screen: CheckCircle2 icon + "Vaktplanen er godtatt."
   - TanStack query `['scheduler', 'proposals', 'pending']` invalidated.

**Postcondition:**
- `change_proposal.status = 'applied'`.
- N `schedule_shift` rows exist with `trigger_entity_type='change_proposal'` + `trigger_entity_id=<proposal_id>`.
- ONE `scheduler.proposal.accepted` event in `activity_trail`.

**Error paths:**
- BFF returns 401 → "Ikke innlogget." alert.
- BFF returns 403 → "Ikke tillatt: <reason>" alert.
- BFF returns 500 → "Kunne ikke godta: <message>" alert.
- `getProfileContext()` throws (missing identity) → mutation fails, alert shown.
- No proposals pending → empty state "Ingen ventende forslag." rendered, no action bar.

---

## Journey 2: Manager — Mobile Bundle Reject

**Precondition:** Same as Journey 1 — pending proposal exists.

**Happy path:**

1. Manager navigates to `(shifts)/proposed-plan` on mobile.
   - BundleCard + ReadOnlyShiftList + BundleActionBar render as in Journey 1.

2. Manager taps "Avslå alle".
   - Confirmation `Alert.alert("Avslå forslag", "Er du sikker...")` is shown with Avbryt / Avslå buttons.

3. Manager confirms "Avslå".
   - `getProfileContext()` resolves identity. Fail-fast.
   - BFF POST `/api/scheduler/reject-bundle` called.
   - DB: `change_proposal.status` → `'rejected'`. No shifts inserted.
   - ONE `scheduler.proposal.rejected` emit.
   - Rejected state: XCircle icon + "Forslaget er avslått."

**Postcondition:**
- `change_proposal.status = 'rejected'`.
- No `schedule_shift` rows created.
- ONE `scheduler.proposal.rejected` event in `activity_trail`.

**Error paths:** Same as Journey 1.

---

## Journey 3: E2E S10 — Scheduler Propose + Web Accept

**Protocol slug:** `S10` — registered in `apps/e2e/protocols/index.ts` as `P_SCHEDULER_PROPOSE_ACCEPT`.

**Precondition:**
- Workspace seeded with employees, department, season budget, no pending scheduler proposals.
- Manager profile active.

**Steps:**

1. Manager navigates to `/dashboard`. System loads.
2. Manager opens Botsson chat and sends "foreslå vaktplan for uke 24".
3. System: scheduler capability runs greedy solver. ONE `change_proposal` row created (`kind='scheduler_bundle'`, `status='pending'`). `changes.proposed_shifts` contains N entries.
4. System: ONE `scheduler.proposal.proposed` event emitted to `activity_trail`.
5. Manager navigates to `/dashboard/schedule/proposed-plan`. BundleCard visible (`testid="scheduler-bundle-card"`).
6. Manager clicks "Godta alle" (`testid="scheduler-accept-all-btn"`). System: atomic insert.
7. Success shown (`testid="scheduler-accept-success"`).
8. DB: N `schedule_shift` rows with `trigger_entity_type='change_proposal'`, `trigger_entity_id` populated (L-0255). `change_proposal.status='applied'`.
9. System: ONE `scheduler.proposal.accepted` event in `activity_trail` (never per-shift).

**Postcondition:** Same as Journey 1.

---

## Journey 4: E2E S11 — Scheduler Mobile Bundle Accept

**Protocol slug:** `S11` — registered in `apps/e2e/protocols/index.ts` as `P_SCHEDULER_MOBILE_BUNDLE`.

**Precondition:** Pending `scheduler_bundle` proposal exists (seeded or from S10 steps 1–3).

**Steps:**

1. Manager navigates to `/(shifts)/proposed-plan` on mobile PWA.
2. BundleCard renders (`testid="scheduler-bundle-card"`).
3. ReadOnlyShiftList renders (`testid="scheduler-shift-list"`). No toggle or checkbox elements (ADR-0309 V1 invariant).
4. Manager taps "Godta alle" (`testid="scheduler-accept-all-btn"`).
5. No confirmation alert for Accept (only for Reject). Wait for success (`testid="scheduler-accept-success"`).
6. DB: `change_proposal.status='applied'`. N `schedule_shift` rows with `trigger_entity_type='change_proposal'`.
7. ONE `scheduler.proposal.accepted` event in `activity_trail`.

**Postcondition:** Identical DB state to S10 — validating mobile path produces same result as web path.
