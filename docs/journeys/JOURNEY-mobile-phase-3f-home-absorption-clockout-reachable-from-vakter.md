---
title: "Journey — Clockout + reconciliation reachable from Vakter post (home) deletion"
feature: mobile-phase-3f-home-absorption
journey: clockout-reachable-from-vakter
status: draft
verified_at: null
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, clockout, reconciliation, vakter, adr-0268, deeplinks]
---

# Journey: Clockout + reconciliation reachable from Vakter post `(home)` deletion

**Role:** employee (clocks out + signs off reconciliation) — admin (audit observer)

**Precondition:**
- User has an active or just-ended shift
- ADR-0268 5-tab layout live; `(home)` route group deleted
- `reconciliation_pending_signoff` deeplink retargeted away from `(home)/clockout`
- `deep-links.ts` zero references to `(home)/`

## Happy Path

### Manual clockout

1. User finishes shift → System shows clockout affordance in Vakter tab (or Council-decided execute-verb surface)
2. User taps clockout → System renders clockout flow (timer confirm, hours, breaks, deviation prompt)
3. User confirms → System persists clockout via existing capability/Server Action; emit(`shift.clockout`) with `getProfileContext()` IDs (ADR-0134)
4. User redirected to phase-appropriate view (AfterShiftView content in target tab from sibling journey)

### Reconciliation push

5. Manager triggers period-reconciliation OR system schedules `reconciliation_pending_signoff` event → push notification sent
6. User taps notification → `resolveDeepLink('reconciliation_pending_signoff')` returns new target path (Council G2 decision: Vakter sub-screen OR dedicated reconciliation surface)
7. Reconciliation surface renders pending items → user reviews + signs off OR raises deviation
8. Signoff persists → push acknowledged → notification cleared

**Postcondition:**
- Clockout flow reachable from Vakter (or Council target) without traversing hidden `(home)` route
- `reconciliation_pending_signoff` deeplink resolves to non-`(home)` path
- All emit() preserved with ADR-0134 IDs
- Audit trail (activity_trail) unbroken for clockout + signoff events

## Error Paths

- **Scenario:** Push arrives while `(home)` deletion partially rolled out (cached client) → Hidden-route fallback (per Council G2) OR redirect shim handles old paths
- **Scenario:** Clockout requires Sign + acknowledge of unacked deviation → Vakter renders blocking modal; cannot proceed without acknowledgment (preserves cascade audit invariant)
- **Scenario:** Network offline during clockout → Offline queue accepts Zod-validated payload per ADR-0134; UI shows "Will sync when online"
- **Scenario:** Reconciliation surface receives invalid period → Empty state with "No pending items" message

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes for both clockout flow AND reconciliation push
- [ ] Manually tested clockout end-to-end on PWA `localhost:8083`
- [ ] Manually tested reconciliation push deeplink (manual trigger via test event or seed)
- [ ] `apps/mobile/app/(app)/(home)/clockout.tsx` confirmed deleted (or absorbed)
- [ ] `packages/notifications/src/deep-links.ts` `reconciliation_pending_signoff` no longer targets `(home)/`
- [ ] grep verifies zero references to `(home)/clockout` in `apps/mobile/`

**Mark `status: verified` in frontmatter when all seven boxes are checked.**
