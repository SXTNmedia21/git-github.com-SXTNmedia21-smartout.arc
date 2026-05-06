---
title: "Handoff — absence-approval"
feature: absence-approval
branch: feat/absence-approval
closed: 2026-03-28
module: scheduling
---

# Handoff — absence-approval

## Summary

Implemented absence approval flow — the prerequisite for smart-cover (ADR-0067). Leaders can now approve or reject pending absence requests from the schedule day panel. Both actions emit telemetry events routed to the Event Engine, enabling downstream workflows to trigger on approved absences.

## What Was Done

- [x] Added `AbsenceApproved` + `AbsenceRejected` telemetry events to registry with engine_event routing
- [x] Added `useApproveAbsence` + `useRejectAbsence` mutation hooks with optimistic updates and .eq("status","pending") guard
- [x] Added `pendingAbsences` query key to schedule-keys.ts
- [x] Created `usePendingAbsences` query hook (workspace-wide, joins profile.display_name)
- [x] Created `PendingAbsenceList` component (admin-only, compact list with approve/reject actions, reject confirmation dialog)
- [x] Integrated into OversiktTab in schedule day control panel
- [x] Added i18n keys for nb and en (21 keys each including pluralization)
- [x] Council post-implementation review: fixed 2 hardcoded Norwegian strings

## Decisions Made

| Decision                                           | Reason                                                                          | Impact                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| No new DB tables                                   | Existing schedule_absence.status enum (pending/approved/rejected) is sufficient | Zero migration, zero schema change                                         |
| Client-side emit() for engine events               | Matches existing pattern in useCreateAbsence/useDeleteAbsence                   | MVP-acceptable; server-side trigger recommended for production smart-cover |
| .eq("status","pending") guard on mutations         | Prevents double-approval race condition at DB level                             | PostgreSQL MVCC ensures atomicity; second approver gets error              |
| Workspace-wide pending query (no dept filter)      | Admin needs full overview                                                       | May need dept filter for large workspaces later                            |
| "–" fallback instead of "Ukjent" for missing names | Locale-neutral, no i18n needed                                                  | Consistent with data display patterns                                      |

## Learnings

| Learning                                                      | Context                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Absence approval didn't exist despite status enum being ready | Learning-0021: Always verify upstream trigger exists before designing downstream automation |
| Toast messages in existing hooks use hardcoded Norwegian      | Pre-existing debt in use-absences.ts; new code follows same pattern for consistency         |
| Supabase FK join type requires `as unknown as` cast           | Standard workaround for generated types not resolving joins                                 |
| Council post-impl review caught 2 i18n violations in 5 min    | Post-implementation council reviews are high-value for catching compliance issues           |

## Known Issues / Debt

- Toast messages use hardcoded Norwegian (pre-existing pattern, not regression)
- formatDateRange hardcodes "nb-NO" locale (pre-existing pattern)
- emit() is client-side — tab closure may lose the event (MVP-acceptable)

## Next Steps

- **Smart Cover Ticket 2:** Create engine_process blueprint with trigger on "absence.approved", implement schedule_control handler for candidate resolution
- **Smart Cover Ticket 3:** Cover response UI (CoverRequestCard, CoverTrackerPanel, CoverStatusBadge)
- Consider migrating all toast messages in use-absences.ts to i18n keys
