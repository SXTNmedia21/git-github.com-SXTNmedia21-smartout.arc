---
title: "PLAN-2 — mobile zones[] M:N embed (reader-only)"
status: in_progress
updated: 2026-05-29
created: 2026-05-29
module: day-session
tags: [adr-0430, adr-0133, mobile, zones]
---

# PLAN-2 — mobile zones[] embed

**Files:** `apps/mobile/src/hooks/queries/use-my-shifts.ts` (`useMyShifts` :94, `useMyShiftsWithDept` :168)
+ consumers `ShiftCard` / `BeforeShiftView.tsx` / `ShiftClockView`. ADR-0133: mobile = READER only (no authoring).

**Problem:** both queries `select('*')` / dept-embed but never read zone assignments. Post-M4 zones live in `shift_zone`
(M:N via session). Mobile reader should show which zone(s) a shift covers.

**Fix:**
1. Add a zones embed to both queries via the session path. shift_zone is keyed by shift_session, so:
   ```ts
   .select(`*, shift_session:shift_session(shift_zone(zone:zone_id(zone_id, name)))`)
   ```
   (verify the embed resolves; shift_session has FK to schedule_shift. If PGRST201/ambiguous, pin FK names or use a
   second query keyed by schedule_shift_id → flatten.)
2. Map to `zones: { zone_id: string; name: string }[]` on the returned row type (`ScheduleShift & { zones: ... }`
   and `ShiftWithDept`). De-dup zone_ids across day_lines.
3. **ADR-0133 parity:** the zones-resolution logic + types go in `packages/data/src/day-session/` (new
   `shift-zones.ts` or extend the existing `use-shift-session.ts` types), exported from `packages/data` index. Mobile
   `use-my-shifts.ts` imports the type + the flatten helper from `@smartout/data`. Keep the app-dep injection pattern
   the existing day-session hooks use (caller passes supabase client). ADR-0112 not applicable (no new tool/enum).
4. Propagate `zones[]` to the readers: `ShiftCard` (zone chips), `BeforeShiftView.tsx`, `ShiftClockView` — display
   only, no mutation. Use Nordic Split tokens (no OKLCH literals — ADR-0366).

**Acceptance:** mobile shift cards show zone name(s); `pnpm turbo typecheck --filter=./apps/mobile --filter=./packages/data`
green. No authoring affordance added (reader-only). zones logic lives in packages/data.

**Commit:** `feat(mobile): shift zones[] readback via shift_zone embed (ADR-0430/0133)`.
