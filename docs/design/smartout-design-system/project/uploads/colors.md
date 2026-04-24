---
title: "Nordic Split — Colors"
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [nordic-split, design, colors]
---

# Colors

Source of truth: `packages/design-tokens/src/tokens.ts` — exact OKLCH values live there.

---

## Core Palette

| Role          | OKLCH               | Notes                                  |
| ------------- | ------------------- | -------------------------------------- |
| Light base    | oklch(0.97 0.01 55) | Warm cream, NOT cold white — hue 50-60 |
| Dark base     | oklch(0.12 0.02 50) | Warm dark, NOT cold black              |
| Brand orange  | oklch(0.65 0.22 40) | #f97316 — primary CTA, active states   |
| Panel surface | oklch(0.18 0.03 50) | The Nordic Split dark panel            |
| Glow warm     | oklch(0.45 0.18 40) | Orb inner, focus rings                 |
| Glow deep     | oklch(0.35 0.14 35) | Orb outer, ambient shadows             |

---

## Semantic Colors

| Semantic | OKLCH hue   | Usage                         |
| -------- | ----------- | ----------------------------- |
| Success  | 145 (green) | Completed, approved, online   |
| Warning  | 85 (amber)  | Pending, draft, attention     |
| Error    | 27 (red)    | Destructive, invalid, failed  |
| Info     | 250 (blue)  | Informational, neutral status |

---

## Domain Colors

**Department type:**

- Kitchen — warm red/orange
- Floor — warm teal
- Bar — amber
- Event — purple
- Storage — slate

**Profile status:**

- Trainee — info blue (in progress)
- Active — success green
- Inactive — muted
- Offboarding — warning amber

**Priority:** brand orange (high) → amber (medium) → muted (low)

---

## Rules — Non-Negotiable

1. **ALWAYS use CSS variable classes.** `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`.
2. **NEVER use utility color classes.** No `bg-zinc-*`, `text-gray-*`, `bg-slate-*`. Zero exceptions.
3. **All OKLCH neutrals use warm hue range 45-60.** Never hue 200+ for neutrals (that's cold/blue).
4. **Dark mode is warm dark**, not a simple inversion. oklch(0.12 0.02 50) — there is chroma, not just lightness.
5. **Opacity for semantic backgrounds.** Status badge backgrounds: semantic color at 10% opacity, text at full.

---

## CSS Variable Reference

CSS variables are defined in `packages/design-tokens/src/tokens.css` and consumed via Tailwind's `bg-*` / `text-*` / `border-*` mappings. Never read raw hex from the style guide and hardcode it — always go through the token system.
