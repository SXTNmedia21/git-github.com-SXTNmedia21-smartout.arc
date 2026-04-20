---
name: smartout-nordic-split
description: |
  AUTHORITATIVE guide for Smartout's "Nordic Split" design system. MUST be loaded before any UI, styling, component, animation, theme, farge-, eller design-arbeid.

  Triggers (English): UI, component, styling, design, theme, dark mode, light mode, color, colors, Tailwind, shadcn, Geist, Instrument Serif, OKLCH, orb, glassmorphism, animation, framer-motion, spring physics, dashboard layout, page layout, CSS variable, zinc, slate, gray, hardcoded color.

  Triggers (Norwegian): farge, farger, komponent, design, tema, mørk modus, lys modus, knapp, dashboard, skjerm, layout, style, stil, utseende.

  Triggers (files/paths): apps/web/src/app/dashboard/**, apps/web/src/components/**, apps/web/src/app/**/page.tsx, packages/design-tokens/**, globals.css, tokens.ts, tokens.css, native.ts, components.json, DashboardShell.tsx.

  Triggers (keywords from spec): Ren og Varm, Nordic Split, warm OKLCH, hue 40-60, CSS variable, bg-background, text-foreground, border-border, bg-muted, focus-ring.

  ALWAYS load when editing .tsx/.css in apps/web/ or apps/mobile/ that touches visual output.
tools: Read, Glob
---

# Last synced: 2026-04-06

# Nordic Split Design System

This skill is the AUTHORITATIVE source for Smartout's visual identity. Read `docs/design/ren-og-varm-styleguide.html` for the full interactive reference. This skill encodes the non-negotiable rules.

## Colors — OKLCH Warm Palette

All colors use OKLCH with warm hue range 40-60 (brand orange at hue 40, surfaces at hue 50-60). Use CSS variables, NEVER hardcoded values.

| Variable                | Purpose            | Rule                                |
| ----------------------- | ------------------ | ----------------------------------- |
| `bg-background`         | Page background    | Always use, never `bg-zinc-950`     |
| `text-foreground`       | Primary text       | Always use, never `text-zinc-100`   |
| `border-border`         | Borders            | Always use, never `border-zinc-800` |
| `bg-muted`              | Secondary surfaces | Warm tone                           |
| `text-muted-foreground` | Secondary text     | Warm tone                           |

**Source of truth:** `packages/design-tokens/src/tokens.ts` → `tokens.css` (web) → `native.ts` (mobile)

## Fonts

| Font             | Usage      | Class          |
| ---------------- | ---------- | -------------- |
| Instrument Serif | Headings   | `font-heading` |
| Geist Sans       | Body text  | default        |
| Geist Mono       | Data, code | `font-mono`    |

No other fonts. No variation. No "interesting" font choices.

## Motion — Spring Physics

**These are the CORRECT values. Generic animation skills (framer-motion-animator) use wrong defaults.**

| Parameter | Range | Feel                |
| --------- | ----- | ------------------- |
| stiffness | 30-45 | Slow, organic       |
| damping   | 20-24 | Gentle deceleration |
| mass      | 2-2.5 | Heavy, lava-lamp    |

**Timing rules:**

- Min 250ms exit animations
- Min 500ms entrance animations
- Never abrupt transitions
- Spring physics preferred over duration-based

**Framer Motion example:**

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
/>
```

## Glassmorphism Recipe

1. Background: `bg-background/80` (80% opacity)
2. Backdrop blur: `backdrop-blur-xl`
3. Border: 1px gradient border (light edge on top-left)
4. Noise: subtle noise overlay texture
5. No heavy drop shadows — use subtle glow

## Orb Construction

- Use `radial-gradient`, NOT blur blobs
- Generator: `docs/design/orb-generator.html` (sliders, presets, CSS export)
- Orbs are ambient, never interactive
- Multiple gradient layers for depth

## The 40% Reduction Principle

Strip borders, boxes, and containers. Replace with:

- Space (generous padding/margin)
- Light (subtle gradients, glow)
- Typography hierarchy (size/weight contrast)

## Tailwind v4

- CSS-based config in `globals.css` — NO `tailwind.config.ts`
- Root `package.json` has Tailwind v3 — that's for Remotion only
- Use CSS variable classes only

## Icons

Lucide React only. No emojis in UI. No other icon libraries.

## Component Library

- shadcn/ui (new-york style)
- Add: `cd apps/web && npx shadcn@latest add <component>`
- Config: `apps/web/components.json`

## Reference Files

- Interactive styleguide: `docs/design/ren-og-varm-styleguide.html`
- Orb generator: `docs/design/orb-generator.html`
- Design tokens: `packages/design-tokens/src/tokens.ts`
- Design docs: `docs/design/` (README + colors, typography, motion, components, mobile, patterns)
