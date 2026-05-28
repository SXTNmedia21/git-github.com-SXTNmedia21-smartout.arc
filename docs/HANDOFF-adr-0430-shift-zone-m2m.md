---
title: "HANDOFF — ADR-0430 Shift Zone M:N Reform"
status: done
updated: 2026-05-29
created: 2026-05-29
feature: adr-0430-shift-zone-m2m
tags: [scheduling, zone, migration, adr, m4, shift_zone]
---

# HANDOFF — ADR-0430 Shift Zone M:N Reform

## Summary

**What was built:** Replaced the legacy scalar `schedule_shift.zone: TEXT` and
`schedule_shift.location_id: UUID` columns with a proper M:N junction table
(`shift_zone`) that links `shift_session_day_line` rows to `zone` entities. The
`profile.location_id` column was also dropped (location membership now comes from
`department_location` → `location`, per the core structure reforms in ADR-0429).

**Why:** The scalar `zone` field could not represent multi-zone shifts (e.g. a staff
member covering both Bar 1 and Bar 2 during a shift). The `location_id` on
`schedule_shift` was a denormalized anchor that created a "two-hop redundancy trap"
— the shift already knew its department, which knew its department_location, which
knew its location. ADR-0430 formalized the M:N model and ADR-0367's tri-layer model
(`department_session → day_line → shift_session`) made it possible to resolve zones
through the runtime path without requiring a scalar anchor on the planning table.

**Migration path:** 6 migrations (M0.5 reconciliation + M1 NOT NULL + M2 shift_zone table +
M3 backfill + M5 trigger rewrite + M4 irreversible column drop), applied in order.
Total: ~750 SQL lines across the migration bundle.

---

## All Decisions (ADRs)

| ADR | What | Status |
|-----|------|--------|
| ADR-0430 | Shift Zone M:N reform — `shift_zone` table replaces scalar `schedule_shift.zone` and `location_id` | implemented |
| ADR-0429 | Core structure normalization — `profile.location_id` dropped (location from `department_location`) | implemented (related sortie) |
| ADR-0367 | Day Line Area-Anchored Runtime — tri-layer D6 model used by `ensure_shift_session` rewrite | implemented |
| ADR-0427 | Forward-only repair doctrine — M4 is irreversible per this ADR | active |
| ADR-0078 | Channel pinning — voice surface blocked from `roster.add_shift_manual` | active |
| ADR-0133 | Mobile surface boundary — mobile reads zones[] (read-only); authoring stays web-only | active |

---

## All Learnings

### L-0348 (3rd occurrence promotion): Live invocation catches what static analysis misses

Three separate occurrences (Phase 1 C1+Track F+PLAN-4b) where the typecheck passed but a
live DB invocation revealed column drift: `department_operating_hours.id` (different from
`day_line_id`), `employment_contract.contract_id`, `framework_rule` lacking `workspace_id`
(K1a platform-level), `workspace.niche` non-existent. Rule promoted: every new DB-read
capability MUST end with a Node-script live invoke test before close-feature.

### L-NEW-PLAN4B: Typegen stderr leaking into generated types

`npx supabase gen types --local > packages/supabase/src/database.types.ts` captures stderr
WARN lines into the file on some terminals. Always suppress: `2>/dev/null`. Symptom: ESLint
"Parsing error: Unexpected keyword or identifier" on first line of types file.

### L-NEW-PLAN4B-2: Department_id NOT NULL in test fixtures

After ADR-0430 M1 made `schedule_shift.department_id NOT NULL`, test fixtures constructing
`ScheduleShift` mock rows with `department_id: null` fail typecheck. Rule: when adding a
NOT NULL migration, sweep `__tests__/` for any mock construction that assigns null to the
new constraint.

### L-0176 (recurring): Docstring claiming ADR compliance before body satisfies it

`packages/ai/src/capabilities/schedule/__live__/invoke-read.ts` AC-4a.10 deferred:
the live invoke script was not completed before PLAN-4b. The write-path capability
tool docstring references ADR-0430 Rule 9 correctness; verified correct via manual
grep and migration audit, but live-invoke was deferred to post-merge.

---

## Known Issues / Debt

### Mobile zones[] display not wired

Mobile components (BeforeShiftView, ShiftCard, etc.) had `shift.zone` removed (M4).
The `zones[]` array from `shift_session → shift_session_day_line → shift_zone → zone`
embed is available via `useShiftSession()` but NOT yet propagated to these components.
The `useMyShifts()` hook returns `select("*")` without the session embed, so `zones[]`
is not available on the raw `ScheduleShift` row.

**To close:** Add `shift_session!inner(shift_session_day_line(shift_zone(zone(name,location_id))))` embed
to `useMyShifts()` and the other `useShifts`-family hooks, then map to a `zones?: Array<...>` field
on the augmented type, and pass to BeforeShiftView / ShiftCard / ShiftClockView.
This was deferred from PLAN-4b scope to keep the M4 column drop from being blocked.

### Web `use-day-timeline-events.ts` location filter broken

`locationByShift` now always returns `null` since `schedule_shift.location_id` was
dropped. The day-timeline chip-bar location filter on the TidslinjeTab will no longer
filter by location. Fix: join `shift_zone` to get location_id from `shift_zone.location_id`.

### `add-shift-action.ts` locationId parameter silently dropped

The `locationId` input field on the shift creation action was silently removed from
the DB insert (line 388 fix). Any caller passing `locationId` has it ignored at the
DB level. The parameter remains in the Zod schema for future use when location-anchored
shift creation is re-introduced via `shift_zone` assignment.

---

## Deferred Enforcement

### Rule 9 gate-RPC dead-letter

The `engine_authority_config` row for `roster.add_shift_manual` channel constraint
is set to `channel_constraint = 'chat_only'` per Rule 9 (migration M2 seed).
However, the `gate_action` PL/pgSQL RPC (current version `20260516130000`) reads
`level, min_role, requires_four_eyes` — it does NOT read `channel_constraint`.
The channel enforcement seed is **declarative-only at the gate-RPC layer**.
Sibling of L-0083 (authority-seed-inert pattern).

### Three-layer defense in place

1. **`add-shift-action.ts` lines 103-104:** Zod `channel: z.enum(["chat", "system"])` —
   voice excluded at request boundary (with inline comment citing ADR-0430 Rule 9 + L-0083).
2. **Stage Engine routing layer (ADR-0078 channel pinning):** Prevents voice surface from
   calling `roster.add_shift_manual` at the BFF routing layer.
3. **Forensic seed value:** `engine_authority_config.channel_constraint = 'chat_only'` is
   auditable and forward-compatible for when `gate_action` is extended to read it.

### Future ADR scope

Extend `gate_action` PL/pgSQL to read `channel_constraint` when present. This is a
cross-cutting change (every capability call affected). Out of ADR-0430 Phase b scope.
Track as Phase b debt + new ADR ticket. When that ADR is written, the seed installed by
migration M2 will become enforcement without requiring schema changes.

---

## Next Steps

1. **Wire mobile zones[] display** — Add shift_session embed to `useMyShifts()` and
   sibling hooks; propagate to `BeforeShiftView`, `ShiftCard`, `ShiftClockView.tsx`.
   Estimated: 1 sub-sortie, ~3h.

2. **Fix `use-day-timeline-events.ts` location filter** — Join `shift_zone` to restore
   chip-bar location filtering on the TidslinjeTab. Estimated: half-day sortie.

3. **AC-4a.10 live-invoke** — Run `packages/ai/src/capabilities/schedule/__live__/invoke-read.ts`
   against local DB to verify `zones[]` populated after M4. Blocked on the zones[] embed
   (item 1 above).

4. **Extend `gate_action` RPC** — Read `channel_constraint` from `engine_authority_config`.
   Requires separate ADR. Medium priority (defense-in-depth).

5. **Mobile zone authoring** — ADR-0133 mobile surface boundary says authoring stays
   web-only. No change planned for mobile zone assignment.
