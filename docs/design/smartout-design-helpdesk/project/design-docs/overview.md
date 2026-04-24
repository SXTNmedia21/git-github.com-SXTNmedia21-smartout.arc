---
title: "Nordic Split — Design System Overview"
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [nordic-split, design]
---

# Nordic Split Design System

**Nordic Split** is the visual language of Smartout. Elegant Nordic cleanness meets warm glowing tones — white space, spring motion elegance, and impact. Like a lava lamp meets Scandinavian minimalism.

The name comes from the signature two-panel layout: a dark brand panel alive with ambient orbs, split against a clean light form surface.

---

## Source of Truth Map

| What                                        | Where                                                                |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Visual reference (interactive, 25 sections) | `docs/design/ren-og-varm-styleguide.html` (live: design.smartout.ai) |
| Code tokens (colors, type, motion, radii)   | `packages/design-tokens/src/tokens.ts`                               |
| CSS variables (web)                         | `packages/design-tokens/src/tokens.css`                              |
| Mobile tokens (React Native)                | `packages/design-tokens/src/native.ts`                               |
| Orb generator (design tool)                 | `docs/design/orb-generator.html`                                     |

---

## Sub-Documents

| File            | Covers                                                           |
| --------------- | ---------------------------------------------------------------- |
| `colors.md`     | Palette, OKLCH, semantic, domain colors, CSS var rules           |
| `typography.md` | Fonts, type scale, weights, spacing, icons                       |
| `motion.md`     | Spring physics, easing curves, animations, orbs                  |
| `components.md` | Cards, inputs, badges, buttons, glass, loading                   |
| `mobile.md`     | Phone frame, tab bar, FAB, chat, shift card, payroll             |
| `patterns.md`   | Nordic Split panel, wizard, login gate, ambient glow, responsive |

---

## For AI Agents

**Before any UI work:**

1. Read `docs/design/ren-og-varm-styleguide.html` — it is the visual ground truth
2. Import tokens from `@smartout/design-tokens`, never hardcode values
3. Use CSS variable classes (`bg-background`, `text-foreground`, `border-border`) — never utility colors (`bg-zinc-950`, `text-gray-100`)
4. Lucide React for all icons — no emojis in UI, no other icon libraries
5. Motion: spring physics via Framer Motion, never CSS transitions for entrance/exit
