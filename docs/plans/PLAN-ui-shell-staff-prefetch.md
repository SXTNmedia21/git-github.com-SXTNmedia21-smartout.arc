---
title: PLAN — ui-shell staff prefetch
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: mobile-schedule
tags: [mobile, scope-chips, ui-shell, adr-0266]
---

# PLAN — staff-prefetch (Ansatt-dropdown completeness)

## Problem

`apps/mobile/app/(app)/(shifts)/index.tsx` builds the Ansatt-dropdown staff list from the currently filtered `shifts` array (L394-410). When `scope.kind === "me"` (default), `useTeamShifts` returns only the logged-in user's own shifts → the dropdown contains a single entry.

Comment at L412-416 admits this and references "ADR-0266 backlog: pre-fetch all-staff". Result: user must click "Hele teamet" first before the "Ansatt ▾" picker is populated.

## Goal

Pre-fetch the full workspace staff list **independent of the current scope** so the Ansatt-dropdown always shows every team member.

## Constraints

- No new RLS surface; reuse `profile` table read filtered by JWT workspace_id.
- No N+1 queries; one fetch per workspace per week (staleTime).
- Keep `useTeamShifts` return shape unchanged; expose staff via a sibling hook OR new field on the same query.
- Must not break the existing dept-color fallback in `staff` mapping (Avatar color uses dept color when no per-profile color exists).

## Approach

Two viable shapes:

**Option A** — sibling hook `useTeamStaff(weekStart)`. Fetches `profile` rows where `workspace_id = jwt.workspace_id AND is_active = true`, then merges with active-week dept-color. Caller composes both hooks; ScopeChips reads from `useTeamStaff` regardless of `useTeamShifts` scope.

**Option B** — extend `useTeamShifts` to always fetch an `all`-scoped query in addition to the scoped one, then expose `{ shifts, staff }`. More queries per scope change; rejected.

**Decision: Option A.** Clean separation, single fetch per week, reusable.

## Steps

1. Create `apps/mobile/src/hooks/queries/use-team-staff.ts` returning `{ data: StaffShape[], isLoading, error }`. Query: `profile.select("profile_id, display_name, avatar_color, department:department_id(department_id, name, color)").eq("is_active", true)`. Map to `StaffShape` reusing the same first-name + initials logic from `use-team-shifts.ts:219-232`.
2. Update `apps/mobile/app/(app)/(shifts)/index.tsx`:
   - Replace `staff` useMemo (L394-410) with `const { data: staff } = useTeamStaff()`.
   - `staffById` keeps current shape.
   - Remove obsolete L412-416 comment.
3. Add unit test `apps/mobile/src/__tests__/use-team-staff.test.tsx` — mock supabase client, assert: returns all rows on success, empty array on error, queryKey stable.
4. Manual verify on http://localhost:8083 → scope=`me`, click "Ansatt ▾" → see all 9 seed employees.

## Decisions to register in 0000-decision-log.md

- ADR: "Ansatt-dropdown uses dedicated `useTeamStaff` hook, not scoped shift-derived staff list" (rationale: ADR-0266 backlog).

## Acceptance

- Falsifiable: from scope=`me`, opening Ansatt-dropdown shows ≥ 2 entries (assuming workspace has ≥ 2 active profiles).
- Typecheck green.
- Existing `apps/mobile/src/__tests__/calendar-detail-sheet.test.tsx` unchanged.

## Out of scope

- No new schema. No mutation of dept-color sourcing rules. No changes to `useTeamShifts` server query.

## Files expected to touch

- `apps/mobile/src/hooks/queries/use-team-staff.ts` (new)
- `apps/mobile/src/__tests__/use-team-staff.test.tsx` (new)
- `apps/mobile/app/(app)/(shifts)/index.tsx` (replace L394-416)
- `docs/decisions/0000-decision-log.md` (register ADR)
- `docs/journeys/JOURNEY-ui-shell-staff-prefetch.md`
- `docs/HANDOFF-ui-shell-staff-prefetch.md` (at closure)
