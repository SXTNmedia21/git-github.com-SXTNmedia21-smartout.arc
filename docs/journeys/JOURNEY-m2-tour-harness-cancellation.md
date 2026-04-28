---
title: "Journey — User presses ESC or off-target click → highlights clear, telemetry cancelled"
feature: m2-tour-harness
journey: cancellation
status: draft
verified_at: null
e2e_test: null
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [journey, help, tour, cancellation, accessibility]
---

# Journey: Tour cancellation (ESC or off-target click)

**Role:** any (employee, manager, admin, owner)

**Precondition:** Active highlight overlay rendered on `/dashboard/help` (tour invoked seconds ago).

## Happy Path A — ESC

1. User presses ESC key.
2. `useHelpTour` keydown handler catches ESC.
3. All active highlights removed from DOM (overlay unmounts).
4. Client emits `help.tour_cancelled` with `{ trigger: "esc", step_count: <current step count> }`.

## Happy Path B — Off-target click

1. User clicks anywhere outside the highlight overlay (on a non-anchor element).
2. `useHelpTour` document-level click handler detects target ≠ overlay AND target ≠ current anchor.
3. Same as A: highlights removed, `help.tour_cancelled` emit with `{ trigger: "off_target_click", ... }`.

**Postcondition:** Page returns to non-highlighted state. Telemetry row written. Step counter resets.

## Error Paths

- **Scenario:** Click ON the highlighted anchor → NOT a cancel. User is acting on the highlighted target — keep highlight (or auto-dismiss after action). Default: keep highlight, let auto-dismiss timer fire.
- **Scenario:** ESC pressed when no active highlight → no-op. No emit. (Only emit cancel if there is something to cancel.)

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
