---
title: "User Journeys — mal-modus-schedule"
status: done
created: 2026-03-26
updated: 2026-03-26
module: schedule
tags: [schedule, template, mal-modus, ghost-shifts, journeys]
---

# User Journeys — mal-modus-schedule

## Journey: Manager Views Template-Based Schedule

**Precondition:** Manager is logged in, has a workspace with at least one department and one schedule template configured.

1. Manager navigates to `/dashboard/schedule`
2. Manager clicks "Mal" tab in the layout mode switcher → System switches to mal-modus view
3. System renders `MalGrid` with:
   - `MalCommandBar` showing department selector, week navigation, task toggle
   - `MalTemplateBar` showing template chips and daily stats (slots/hours/cost)
   - CSS Grid with days as rows, template shifts as columns
   - Each cell shows assigned employees as `MalEmployeeTag` components
   - Empty slots show "+ Tilordne" placeholders (visible on hover)
4. Manager uses week navigation (← Uke N →) to browse different weeks
5. System recalculates grid data for the new week

**Postcondition:** Manager sees full template-based weekly schedule with assignments and stats.

**Error paths:**

- No templates exist for department → `MalEmptyState` with "Ingen maler for denne avdelingen" message
- Data loading fails → Error message "Kunne ikke laste vaktplan" with muted styling
- Department has no shifts for the week → Grid renders with all empty slot placeholders

---

## Journey: Manager Fills Week From Template

**Precondition:** Manager is in mal-modus with an active template selected.

1. Manager clicks "Fyll fra mal" button in the action bar
2. System creates `schedule_shift` rows for each empty slot in the template (status: `created`)
3. Toast: "Vakter fylt fra mal"
4. Grid refreshes — empty slots now show unassigned shift placeholders
5. Manager clicks "Publiser uke {N}" to publish all shifts
6. System updates all `created`/`assigned` shifts to `published`
7. Toast: "Uke publisert"

**Postcondition:** All template slots have shifts, employees see published shifts.

**Error paths:**

- Fill fails → Toast: "Kunne ikke fylle fra mal", shifts remain unchanged
- Publish fails → Toast: "Kunne ikke publisere", status unchanged

---

## Journey: Manager Resets Week

**Precondition:** Manager is in mal-modus with published shifts.

1. Manager clicks "Tilbakestill uke" (destructive red text)
2. System updates all shifts for the week to `unpublished`
3. Toast: "Uke tilbakestilt"

**Postcondition:** All shifts reverted to unpublished state.

**Error paths:**

- Reset fails → Toast: "Kunne ikke tilbakestille"

---

## Journey: Emma Creates Ghost Shifts via Voice

**Precondition:** Manager is in mal-modus with Emma voice assistant active. Ghost mode is enabled.

1. Manager says: "Emma, legg til Erik som kokk på tirsdag"
2. Emma's `createShift` voice tool triggers with employee name, role, and day
3. Voice tool resolves employee by fuzzy name match
4. Voice tool calls `requestConfirmation("Legg til Erik Olsen som Kokk", "Tirsdag 08:00–16:00. Forslaget vises som spøkelsesvakt i rutenettet.")`
5. `AgentConfirmationDialog` renders — shadcn AlertDialog with title, description, Godkjenn/Avslå buttons
6. Manager clicks "Godkjenn" → Promise resolves `true`
7. Voice tool calls `addProposal()` with `employeeName` and (optional) `templateShiftId`
8. Ghost tag (`MalGhostTag`) appears in the correct MalGrid cell:
   - Dashed border, desaturated oklch colors, subtle 3s pulse animation
   - Shows employee initials + name
9. Manager hovers ghost tag → approve (green checkmark) and reject (red X) buttons appear

**Postcondition:** Ghost shift proposal visible in grid, awaiting final approval.

**Error paths:**

- Manager clicks "Avslå" in confirmation dialog → Promise resolves `false`, no proposal created, Emma responds "Avslått av leder."
- Employee name not found → Voice tool returns error message to Emma
- Employee name ambiguous → Voice tool returns closest matches

---

## Journey: Manager Approves Individual Ghost Shift

**Precondition:** One or more ghost shifts visible in MalGrid.

1. Manager hovers a `MalGhostTag` in a grid cell
2. Approve (✓) and reject (✕) buttons appear
3. Manager clicks ✓ → `approveProposal(id)` fires
4. System creates real `schedule_shift` via the context's `createShift` mutation
5. Ghost tag disappears, replaced by a solid `MalEmployeeTag`
6. Empty slot count adjusts (one fewer empty slot)

**Postcondition:** Real shift created, ghost tag removed.

**Error paths:**

- Manager clicks ✕ → Proposal removed from context, ghost tag disappears, no shift created
- createShift mutation fails → Proposal remains in context (retry possible)

---

## Journey: Manager Bulk Approves/Rejects All Ghost Shifts

**Precondition:** Multiple ghost shifts visible in MalGrid (e.g., after Emma fills a week).

1. System shows bulk action bar above the standard action bar: "{N} forslag venter"
2. Manager clicks "Godkjenn alle forslag ({N})"
3. System iterates all proposals, creates real shifts for each
4. Toast: "{N} forslag godkjent"
5. All ghost tags replaced by solid employee tags

**Postcondition:** All proposals converted to real shifts.

**Error paths:**

- Manager clicks "Forkast alle" → All proposals removed, no shifts created
- Partial failure during bulk approve → Successfully created shifts persist, failed ones may remain as proposals
- Approve all fails entirely → Toast: "Kunne ikke godkjenne alle forslag"

---

## Journey: Manager Switches Templates

**Precondition:** Department has multiple templates.

1. Manager clicks a template chip in `MalTemplateBar`
2. URL updates with `?template={id}` (survives page refresh)
3. Grid reloads with new template's shift columns
4. Stats update: plasser/dag, timer/dag, kostnad/dag

**Postcondition:** Grid shows the selected template's structure.

**Error paths:**

- Template has no shifts defined → Grid shows column headers but all cells empty
