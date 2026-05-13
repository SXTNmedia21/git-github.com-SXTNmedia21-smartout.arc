---
title: "Journey — Mobile fails fast on missing identity"
feature: audit-fmo-l0083-enforcement
journey: mobile-fail-fast-on-missing-identity
status: verified
verified_at: 2026-05-14
e2e_test: null
created: 2026-05-13
updated: 2026-05-14
module: mobile
tags: [journey, fail-fast, getProfileContext]
---

# Journey: Mobile mutation with null workspace_id throws explicitly

**Role:** mobile mutation hook caller

**Precondition:** Remediation applied.

## Happy Path

1. Hook calls `getProfileContext()` from `apps/mobile/src/lib/profile-context.ts`.
2. If unauthenticated / missing profile / empty workspace_id, the helper throws:
   "Profile missing workspace_id" or "Profile identity fields are empty
   (ADR-0134 Invariant 2)".
3. Caller's `try`/`catch` (e.g. `use-recon-wizard`, `use-log-haccp`,
   `use-submit-supplement`, `use-punch.punchOut`) surfaces a user-facing error
   or skips the emit entirely.
4. No `emit()` call ever runs with `workspace_id: ""` or `actor_id: ""`.

**Postcondition:** activity_trail unpolluted. Routing intact.

## Verification

- [x] `getProfileContext()` throws on missing identity (existing fail-fast
      guard in `apps/mobile/src/lib/profile-context.ts`, unchanged).
- [x] `usePunch.punchOut` now throws when `active_time_entry.shift_id` is
      missing (was: `?? ""`, silently routed `entity_id`).
- [x] `useSupplements.claimSupplement` throws on null `shiftId`.
- [x] `useLogHaccp.logHaccp` skips the emit when `session_id` is null
      (the haccp_log row still enqueues; only telemetry is gated).
- [x] `useSubmitSupplement.submitSupplement` gates the emit on
      `supplementRuleId` presence — ad-hoc claims still write the row,
      but the registered emit is only fired for rule-bound claims.
- [x] `SwapRequestSheet` Alert-shows + early-returns when
      `selectedShift.employee_id` is null.
- [x] No `emit()` in any branch with empty-string fallback on identifier
      columns. Verified by `smartout/no-empty-string-identifier-fallback`
      ESLint rule firing at `error` severity on `apps/mobile/src/**`.
- [x] ADR-0134 Invariant 2 upheld (cross-checked against
      `packages/telemetry/src/registry.ts` events list — every mobile-emitted
      event in the registry has its `workspace_id` / `actor_id` /
      identifier-column data fields resolved before emit).

**Verified 2026-05-14.**
