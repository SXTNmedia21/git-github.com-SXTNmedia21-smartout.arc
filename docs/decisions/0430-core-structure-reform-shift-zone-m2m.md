---
title: "Core Structure Reform Phase 2 — Shift × Zone × Location M:N (Option Y)"
id: ADR_0430
status: reserved
layer: decision
created: 2026-05-27
updated: 2026-05-27
---

# ADR-0430: Core Structure Reform Phase 2 — Shift × Zone × Location M:N (Option Y)

> **Status: RESERVED.** Slot is held for the shift × zone × location M:N reform lifted from the Dagslinjen prototype-parity sortie on 2026-05-27. Council Phase 5 synthesis from that day produced 8 implementation conditions; this slot will be filled when the implementation sortie kicks off. Until then, this file is a placeholder so the slot is not double-claimed.

## Context (preview)

ADR-0367 v1.1 established the D6 tri-layer model: `department_session → day_line → shift_session`, with `shift_session_day_line` as the M:N junction between shift_session and day_line. Council on 2026-05-27 identified that `schedule_shift` (D2 planning) still carries direct `location_id` + free-text `zone` columns, and that `profile.location_id` exists as an over-binding. Proposed reform: drop direct columns, introduce `shift_zone` as sub-area refinement *subordinate* to `shift_session_day_line` (Option Y), with CHECK constraint enforcing `zone.location_id = day_line.location_id`.

## Council verdict (2026-05-27)

**4/4 reviewers converged on Option Y.** APPROVE WITH CHANGES with 8 conditions:

1. Option Y junction model: `shift_zone` subordinate to `shift_session_day_line`; CHECK constraint `zone.location_id = day_line.location_id`; FK back to `shift_session_day_line` composite (not just `shift_session_id` alone).
2. Migration ordering (timestamps strictly > `20260716200100`):
   - M1: backfill historic `schedule_shift.department_id` from position; ADD NOT NULL constraint
   - M2: CREATE TABLE shift_zone + RLS (mirror `department_location` 5-policy pattern + workspace_id trigger) + CHECK constraint
   - M3: backfill `shift_zone` from existing `shift_session_day_line` (default zone per location if needed)
   - M4: code-rewrite sortie completes → DROP COLUMN `schedule_shift.location_id`, `schedule_shift.zone`, `profile.location_id`
3. READ-rewrite first sortie (12 sites, 4 files): switch capabilities `schedule/tools.ts:{80,253,324,414}` + `communication/briefing.ts:{37,52}` from direct `location:location_id(name)` embed to `shift_session.location_id` single-hop scalar (no LLM prompt template changes).
4. WRITE-rewrite: `timeline-template/tools.ts:288` (text-zone → shift_zone insert) + `scheduler/tools.ts:541-561,587-610` (extend `gatedMutation` for atomic shift_zone insert) + `add-shift-action.ts:288-313` (CLOSE G4 — wrap in `gatedMutation`; extend for `zone_ids[]` validation).
5. Mobile rewrite: `apps/mobile/.../RoutineReviewForm.tsx`, `use-shift-session.ts:71`, `use-routine-extract.ts:41` — replace `profile.location_id` direct read with `profile → department → department_location → location` path.
6. Telemetry contract (HARD BLOCKER): if new events `shift_zone.assigned` / `shift_zone.removed` shipped → registry entry + emit() call-site SAME commit. Alternative: ride existing `roster.add_shift_manual` event with `metadata.zone_ids[]`. ADR text must pick one explicitly.
7. Forgery defense (ADR-0151): server-side validation in `add-shift-action.ts` before `zone_ids[]` insert — verify each `zone_id` belongs to a `zone.location_id` in `department_location` for resolved dept_id.
8. L-0064 cleanup: post-M1, remove the five L-0064 comment markers (RosterTab.tsx, use-roster.ts, use-shift-day-stats.ts, add-shift-action.ts ×2, use-day-timeline-events.ts).

## Reservation notes

- ADR number 0430 is reserved as of 2026-05-27.
- Status will transition `reserved → proposed → accepted` when the implementation sortie kicks off and the full ADR is drafted.
- Council reference: `docs/audits/2026-05-27-core-structure-reform-index/INDEX.md` + Track K council session (this conversation, 2026-05-27).

---

> When ready to draft fully: fill Context · Decision Drivers · Considered Options · Decision Outcome · Rules & Consequences sections per template. Status becomes `proposed` at draft-time; `accepted` after council re-confirmation.
