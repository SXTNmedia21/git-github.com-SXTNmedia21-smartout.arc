---
title: "Journey — 3 baseline mobile L-0083 sites remediated"
feature: audit-fmo-l0083-enforcement
journey: three-baseline-sites-remediated
status: verified
verified_at: 2026-05-14
e2e_test: null
created: 2026-05-13
updated: 2026-05-14
module: mobile
tags: [journey, remediation, baseline]
---

# Journey: F-MO-01/02/03 baseline sites all use fail-fast pattern

**Role:** auditor running grep

**Precondition:** Remediation complete.

## Happy Path

1. `grep -rEn '\?\? ""' apps/mobile/src/ | grep -iE 'workspace_id|profile_id|actor_id|user_id|entity_id'`
   → exactly 1 hit, on `apps/mobile/src/hooks/queries/use-eligible-swap-shifts.ts:71`
   where the fallback is on `display_name` (display string), not an identifier.
2. F-MO-01 (`ShiftClockView`): early-returns on null `currentTimeEntry`,
   `profile.profile_id` gates the TaskFeed render; `useSupplements` widened
   to accept null and gated internally.
3. F-MO-02 (`use-training-data`): passes `profile?.workspace_id ?? null` to
   the training hooks (training keys + hook params now accept `string | null`,
   query is gated on `!!workspaceId`).
4. F-MO-03 (`use-swap-requests`): `SwapRequest.workspace_id` widened to
   `string | null`; row mapping preserves null. F-MO-04 (sibling, opportunistic)
   in `SwapRequestSheet` now guards on `selectedShift.employee_id` and alerts
   the user instead of submitting forged identity.
5. Synthesis F-MO-01/02/03 → CLOSED.

**Postcondition:** No silent corruption path to activity_trail.

## Verification

- [x] grep returns 0 hits on identifier-column `?? ""` in `apps/mobile/src/`
      (only remaining `?? ""` is on `display_name`, which is display-only).
- [x] 3 baseline files no longer carry the trap pattern.
- [x] Synthesis annotated at
      `docs/audits/2026-05-13-adr-contract-validation/05-mobile-surface.md`
      and `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md`.

**Verified 2026-05-14.**
