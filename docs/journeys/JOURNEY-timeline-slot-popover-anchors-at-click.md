---
title: "Journey — Slot add-menu opens at the clicked time, not at the strip wrapper"
feature: timeline-slot-popover-anchor
journey: anchors-at-click
status: draft
created: 2026-05-17
updated: 2026-05-17
module: MODULE_COMMUNICATION
tags: [journey, timeline, slot-picker, popover, dagslinjen]
---

# Journey: Manager add-menu anchors at the clicked slot

**Role:** manager (also admin, owner — anyone with `canEdit`)

**Precondition:**
- Manager logged in, on Oversikt → Dagslinjen tab (`TimelineTab`).
- Active `department_session` for the day so `editable=true` is propagated to `DayTimelineStrip`.
- Browser viewport wide enough that the strip spans most of the screen (anchor-bug surfaces hardest with wide strips).

## Happy Path

1. Manager hovers a time-axis hit-zone (e.g. `14:15`) → System renders the orange guide-line on `DayTimelineStrip` → User sees the vertical guide aligned with the slot.
2. Manager clicks `14:15` → System fires `onSlotClick("14:15", DOMRect)` from the hit-zone button → `TimelineTab.handleSlotClick` stores the rect in `anchorRect` state and opens `SlotPicker`.
3. System renders an invisible `position: fixed` 1×1 `<span>` at `(rect.left + rect.width/2, rect.top)` and hands it to `SlotPicker` as the `anchor` prop → `Popover` mounts `PopoverContent` next to that anchor.
4. System opens `SlotPicker` with `side="bottom" align="center" sideOffset=6 collisionPadding=12` → User sees the 3-lane add-menu (PRODUKSJON / BEMANNING / FRI TEKST) appear directly under the clicked time, centered on the cursor.
5. Manager picks an action (Hook / Oppgave / Notat / Avvik / Vakt / Fri tekst) → System closes the popover, clears `anchorRect`, and opens the corresponding dialog/sheet prefilled with the slot time.

**Postcondition:** The add-menu opened at the click position (within ±half the popover width) on every slot from session start to session close. No clicks land on the strip wrapper's left edge or stretch the menu to span the strip.

## Error Paths

- **Click near right viewport edge** → Radix collision detection (`collisionPadding=12`) flips/shifts `PopoverContent` so it stays fully on-screen. User sees the menu shifted left of the click, not clipped.
- **Click near bottom viewport edge** → `PopoverContent` flips to `side="top"` automatically. User sees the menu above the click.
- **Employee role (read-only)** → `canEdit=false`; `handleSlotClick` short-circuits before `setSlotPicker`. No popover opens.
- **Strip scrolls between click and render** → `position: fixed` anchor follows viewport coordinates, not strip-relative coordinates, so brief scroll-during-click does not displace the menu from the click point.
- **Popover dismissed (Esc / click-outside)** → `onOpenChange(false)` fires, `anchorRect` clears, next click starts fresh.

## Verification

- [ ] Implementation matches the steps above (DayTimelineStrip passes rect; TimelineTab stores rect; SlotPicker uses `PopoverAnchor`).
- [ ] E2E test exists and passes — clicks at `06:00`, `12:00`, `23:45` and asserts `slot-picker-popover` is rendered within ±20px of the clicked hit-zone's center X.
- [ ] Manually tested on wide screen (1920px+) — menu opens under cursor, not at strip's left edge.
- [ ] Manually tested with viewport collision — click at far-right slot keeps menu fully visible.

**Mark `status: verified` in frontmatter when all four boxes are checked.**

---

## Related

- Supersedes the implicit "anchored to cursor" claim in
  `JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot.md:23` — that journey
  was written aspirationally before the anchor was wired. This journey is the
  closure of that gap.
- Touches: `apps/web/src/components/day/DayTimelineStrip.tsx`,
  `apps/web/src/components/day/SlotPicker.tsx`,
  `apps/web/src/components/day/tabs/TimelineTab.tsx`.
- ADR ref: ADR-0334 (timeline templates / slot picker scope).
