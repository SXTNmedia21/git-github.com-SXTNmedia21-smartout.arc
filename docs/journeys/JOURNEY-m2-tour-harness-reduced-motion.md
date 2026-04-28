---
title: "Journey — prefers-reduced-motion → instant scroll, static outline"
feature: m2-tour-harness
journey: reduced-motion
status: draft
verified_at: null
e2e_test: null
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [journey, help, tour, accessibility, reduced-motion]
---

# Journey: Tour respects prefers-reduced-motion

**Role:** any

**Precondition:** OS / browser sets `prefers-reduced-motion: reduce`. User on `/dashboard/help`.

## Happy Path

1. User invokes tour via chat ("vis meg panic-bar").
2. Agent invokes `ui.navigate_to({ target_id: "panic_bar" })`.
3. Hook detects `window.matchMedia("(prefers-reduced-motion: reduce)").matches === true`.
4. Calls `element.scrollIntoView({ behavior: "instant", block: "start" })` (NO smooth scroll).
5. Telemetry `help.tour_step_invoked` payload: `reduced_motion: true`.
6. Agent invokes `ui.highlight_element({ target_id: "panic_bar", label: "...", duration_ms: 5000 })`.
7. `TourHighlight` component renders outline WITHOUT animate-in (no fade, no scale, no flash). Static border immediately visible.
8. After 5000ms (or cancel), overlay unmounts (no fade-out animation either).

**Postcondition:** User saw panic bar identified, no looping or transitional animations played.

## Error Paths

- **Scenario:** Media query support absent (very old browser) → default to reduced-motion behavior (safe-fallback per WCAG).
- **Scenario:** User toggles reduced-motion mid-tour → next tool invocation respects new preference. Prior overlay unaffected (already rendered).

## Verification

- [ ] Implementation matches the steps above (no loops, no smooth scroll, telemetry flag set)
- [ ] E2E test exists and passes (Playwright `reducedMotion: 'reduce'` context)
- [ ] Manually tested end-to-end (set OS-level reduced-motion, run tour)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
