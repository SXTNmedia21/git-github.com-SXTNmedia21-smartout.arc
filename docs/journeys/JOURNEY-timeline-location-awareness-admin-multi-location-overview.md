---
title: "Journey — Admin/owner sees all day-lines across locations and pivots between them"
feature: timeline-location-awareness
journey: admin-multi-location-overview
status: draft
created: 2026-05-17
updated: 2026-05-17
module: MODULE_COMMUNICATION
tags: [journey, timeline, admin, owner, multi-location, scope-filter, dashboard]
---

# Journey: Admin pivots across all locations for the day

**Role:** admin | owner

**Precondition:**
- Admin/owner logged in on Dagslinjen for any business date.
- Workspace has ≥2 locations.
- All `day_line` rows for the day are visible (no RLS filter for admin/owner).

## Happy Path

1. Admin opens Dagslinjen → System fetches all `day_line` rows for the date → User sees a vertical stack: one strip per `(location, dept|team)` pair, sorted by location then dept then open-time.
2. Strip stack header shows count badges: "3 lokasjoner · 5 avdelinger · 2 team · 12 dagslinjer".
3. Admin clicks `ScopeFilterPopover` → switches to "Lokasjon" tab → picks "Restaurant" → URL updates to `?scope=location:<id>` → strip stack filters to lines at that location only → other lines fade out.
4. Admin clicks a slot at `15:00` on Restaurant > Kjøkken line → `SlotPicker` opens at click, anchored to the rect (see anchor journey) → Admin can add hooks/tasks/notes for the scoped line.
5. Admin clears the filter via "Vis alle" → Stack re-expands to all 12 lines.
6. Admin clicks a strip header time chip on a different line → `OpenCloseEditPopover` opens → Admin edits opening without restriction (no dept-restriction gate for owner/admin per ADR-0287).
7. Admin switches business date via `TimelineTopBar` → Stack reloads for the new date; filter scope persists across date change.

**Postcondition:** Admin can see every line, pivot by location/dept/team/shift, edit any line, and add events to any line — bounded only by `engine_authority_config` for write actions.

## Error Paths

- **Workspace has zero locations** → Stack empty-state "Ingen lokasjoner — opprett under Innstillinger → Lokasjoner" + CTA.
- **Locations exist but no day_lines for today** → Stack empty-state "Ingen dagslinjer i dag — opprett ny" + bulk-create CTA "Kopier i går".
- **Scope filter yields zero matches** → "Ingen dagslinjer for `<location.name>`" + "Vis alle" reset button.
- **Concurrent edit by another admin** → 409 from server → toast "Linjen ble oppdatert av en annen — last på nytt" + auto-refetch.

## Bulk operations (out of scope for v1)

- "Kopier i går" → copies all of yesterday's day_lines with same opens/closes (v2).
- "Bruk standard-rutiner" → bulk-attach standard routines per location (v2).
- Locked dates (post-reconciliation) shown read-only with subdued styling (v1 — already part of edit-opening journey).

## Verification

- [ ] Admin/owner query returns ALL `day_line` rows for the workspace + date (no RLS restriction).
- [ ] `ScopeFilterPopover` Lokasjon tab filters strip stack in-place.
- [ ] Stack header count badges update on filter changes.
- [ ] Date navigation persists filter scope via URL param.
- [ ] E2E: admin sees N lines, filters to 1 location, edits a strip in scope, clears filter, edits a strip outside prior scope.

**Mark `status: verified` when implementation lands.**

---

## Related

- Cascade: full **D6** authoring + **D1**/**D2** read for stacking; admin/owner bypass dept-restriction in `engine_authority_config`.
- ADR ref: ADR-0287 (gate_action mandatory on mutation capability tools — role hierarchy resolution lives in `engine_authority_config`), ADR-0133 (admin overview lives on web, not mobile — authoring stays web).
- Touches: `apps/web/src/components/day/tabs/TimelineTab.tsx` (multi-line stack),
  `apps/web/src/app/dashboard/_hooks/use-day-lines.ts` (new — fetches all lines for date),
  `apps/web/src/components/day/ScopeFilterPopover.tsx` (already has Lokasjon tab — wire to filter stack).
