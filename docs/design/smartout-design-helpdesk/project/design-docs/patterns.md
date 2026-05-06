---
title: "Nordic Split — Patterns"
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [nordic-split, design, patterns]
---

# Patterns

These are the recurring compositional patterns that define the Nordic Split experience. Follow them exactly — they are the personality of the system.

---

## The Nordic Split Panel

The signature layout. A dark brand panel split against a clean light form panel.

**Structure:**

- Brand panel (left): panel bg (`oklch(0.18 0.03 50)`), 2 ambient orbs, spring-animated text content
- Form panel (right): `bg-background`, centered form, `max-width: 360px`

**Panel states and flex ratios:**

| State           | Brand flex | Form flex | Notes                               |
| --------------- | ---------- | --------- | ----------------------------------- |
| Login (default) | 1          | 1         | Equal split                         |
| Signup          | 0.6        | 1         | Brand narrows                       |
| Logging-in      | 3          | 1         | Brand expands wide, overlay darkens |
| Navigating      | —          | —         | Panels swap via translateX          |

**Transitions:**

- Flex changes: 1200ms `cubic-bezier(.22,.68,.35,1)` — slow, weighty, deliberate
- Text exit: 300ms
- Text entrance: 500ms with spring
- Panel swap (navigate): translateX, both panels move simultaneously

---

## Ambient Glow

The living background of the brand panel. Two orbs track the mouse with parallax delay.

- Orb 1: larger, slower (0.8s delay), glow warm color
- Orb 2: smaller, faster (0.6s delay), glow deep color
- Both drift autonomously when mouse is away
- Implementation: absolute positioned divs with radial-gradient background + `transform: translate()` driven by mouse position
- See `docs/design/orb-generator.html` for visual design tool

---

## Wizard Progress Indicator

Used in onboarding and multi-step flows.

- Steps displayed in a horizontal row
- Completed step: green check icon, muted label
- Active step: brand color dot/icon, brand label, subtle ring glow (`ring-2 ring-brand/30`)
- Pending step: muted border dot, muted label
- Connector line between steps: muted, fills to brand as steps complete

---

## Brand Panel Content Variations

The brand panel carries contextual copy that changes with the flow state. 4 defined states:

1. **Welcome** — Product headline + one-line value prop
2. **Signup** — Social proof or feature highlight
3. **Logging-in** — Reassuring transition message, animated
4. **Navigation** — Contextual workspace/page headline

Progress dots below copy indicate which state is active (4 dots, brand fills the active one).

---

## Login Gate

For routes requiring auth when accessed directly.

- Fixed overlay, full screen
- Centered card: `max-width: 400px`, `bg-card`, `rounded-2xl`, 32px padding
- Content: logo, headline, email input, CTA button
- No decorative elements — clean, focused, urgent

---

## Responsive Behavior

| Breakpoint  | Behavior                                                          |
| ----------- | ----------------------------------------------------------------- |
| Below 768px | Multi-column grids → 1 column                                     |
| Below 768px | Nordic Split panels → stack vertically (brand on top, form below) |
| Below 768px | Phone frame mockups → max-width 320px                             |
| 768px+      | Full split layout, side-by-side panels                            |

Panel stacking on mobile: brand panel collapses to a header bar (logo + brand color, no orbs), form panel takes full screen below.

---

## Rules

- The Nordic Split Panel is used only for auth and onboarding flows — not dashboard pages
- Orbs require `pointer-events: none` and `position: absolute` with `overflow: hidden` on the parent
- Never skip the ambient glow in brand panels — it is the heartbeat of the design
- Wizard progress must always show the full step count — no "step 2 of ?" ambiguity
- Login gate must never show behind the main layout — it replaces the page, not overlays it
