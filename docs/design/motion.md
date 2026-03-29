---
title: "Nordic Split — Motion"
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [nordic-split, design, motion]
---

# Motion

Source of truth: `packages/design-tokens/src/tokens.ts` — spring configs and easing values live there.

---

## Philosophy

Motion is never decorative noise. It communicates state, guides attention, and makes the system feel alive — not reactive. Every transition must feel organic and intentional.

- **Never abrupt.** Minimum 250ms exit, 500ms entrance.
- **Dreamlike and organic.** Spring physics, not linear easing.
- Use Framer Motion for all entrance/exit transitions.

---

## Spring Configs (Framer Motion)

| Name           | Config                                | Use                                  |
| -------------- | ------------------------------------- | ------------------------------------ |
| `panelSpring`  | stiffness: 35, damping: 22, mass: 2.2 | Nordic Split panel layout shifts     |
| `swapSpring`   | stiffness: 45, damping: 24, mass: 2   | Panel content swap, step transitions |
| `expandSpring` | stiffness: 30, damping: 20, mass: 2.5 | Expanding sections, wizard steps     |

These are the only spring presets. Do not invent new spring configs — adjust these if needed and update tokens.ts.

---

## Easing Curves

| Name    | Value                              | Use                                                 |
| ------- | ---------------------------------- | --------------------------------------------------- |
| Primary | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Step transitions, fade-ups, panel state changes     |
| Elastic | `cubic-bezier(0.22, 1, 0.36, 1)`   | Skeleton load-in, wizard step entrance, pop reveals |

---

## Standard Timings

| Animation                  | Duration                             |
| -------------------------- | ------------------------------------ |
| Stagger between list items | 60ms                                 |
| Panel text exit            | 300ms                                |
| Panel text entrance        | 500ms                                |
| Panel flex change          | 1200ms (cubic-bezier(.22,.68,.35,1)) |
| Button active feedback     | 150ms                                |
| Hover transitions          | 300ms                                |

---

## Named Animations

**Typewriter** — Character-by-character text fill. Used for BRREG auto-populated badges (company name, org number). Creates a sense of the system discovering information in real time.

**Punch** — `scale(0.88)` compress + burst back to 1 + expanding ring. Used for confirmations, step completions, point awards.

**Ambient glow** — Mouse-tracking warm orbs. 0.6–0.8s `cubic-bezier` delay so the orb _follows_ rather than snaps. Creates depth and life in dark panels.

---

## Orb System

Orbs are radial gradient blobs that drift autonomously and respond to mouse position. They are the signature ambient element of the Nordic Split panel.

- Composition: two overlapping radial gradients (warm glow + deep glow colors)
- Behavior: autonomous slow drift + mouse-tracking parallax with delay
- Morphing: subtle border-radius animation for organic shape
- **Design tool:** `docs/design/orb-generator.html` — use this to design orb configs before implementing

---

## Noise Overlay

A subtle fractal noise SVG overlay adds tactile depth without visual weight.

- `fractalNoise` baseFrequency: `0.8`
- Opacity: `0.025` (light mode) / `0.04` (dark mode)
- `mix-blend-mode: overlay`
- Applied as a fixed pseudo-element or SVG filter on panel surfaces

---

## Rules

- No CSS `transition` for entrance/exit — use Framer Motion `AnimatePresence`
- No `transition-all` — always specify the exact properties
- Hover states may use CSS transitions (simple, fast, no layout shift)
- Never animate layout-affecting properties (width, height) without spring physics
