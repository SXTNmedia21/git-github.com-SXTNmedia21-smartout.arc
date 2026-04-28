---
title: "Nordic Split — Components"
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [nordic-split, design, components]
---

# Components

All components are built on shadcn/ui (new-york style) with Nordic Split overrides. Add new components with `cd apps/web && npx shadcn@latest add <component>`, then apply these patterns.

---

## Cards

**Base card:**

- Background: `bg-card`
- Border: `border border-border`
- Radius: `rounded-2xl` (16px)
- Padding: 24px
- Transition: `transition-all duration-300 cubic-bezier(0.25, 0.1, 0.25, 1)`

**Hover state:**

- Transform: `translateY(-2px)`
- Shadow: `0 8px 24px -6px rgba(0,0,0,0.15)`

**KPI card** — extends base:

- `relative overflow-hidden`
- Glow pseudo-element: `120px × 120px`, `blur: 40px`, brand orange at 15% opacity → 35% on hover
- Animate the glow opacity on hover, not size

**Task / Shift / Protocol cards** — extend base:

- 4px left accent bar in status color
- Accent color maps to domain color (see colors.md)

**Hover card** — warm border glow:

- On hover: `border-color` → `oklch(0.85 0.04 55)` (warm, subtle)
- 300ms transition

---

## Glassmorphism

**Dark surfaces (panels, overlays):**

- Background: `rgba(255,255,255,0.06)` / `bg-white/[0.06]`
- Backdrop blur: `backdrop-blur-[20px]`
- Border: `border border-white/10`

**Light surfaces (modals, drawers on light bg):**

- Background: `bg-card/70`
- Backdrop blur: `backdrop-blur-[20px]`
- Shadow: subtle — `0 4px 24px rgba(0,0,0,0.06)`

---

## Inputs

- Radius: `rounded-xl` (12px)
- Border: `border-border` (uses `inBrd` token in dark)
- Focus: brand ring — `ring-2 ring-brand/30` + `border-brand`
- Dark mode autofill: override browser yellow with `bg-input` using `-webkit-autofill` CSS hack — dark inputs must stay dark when populated

---

## Radio Buttons

- Size: 20px dot
- Selection animation: scale pop — `cubic-bezier(.34, 1.56, .64, 1)` (slight overshoot)
- Active: brand orange fill with white inner dot

---

## Badges

- Shape: `rounded-full`
- Padding: `2px 8px`
- Background: semantic color at 10% opacity (`bg-success/10`)
- Text: semantic color at full opacity (`text-success`)
- Uppercase 9px variant for status labels (see typography.md)

---

## Loading States

**Skeleton:**

- Shape: `rounded-md`
- Shimmer animation: 1.8s linear infinite
- Gradient: left-to-right, muted → slightly lighter → muted

**Spinner:** use Lucide `Loader2` with `animate-spin`

---

## Buttons

- Active/press: `scale(0.96)` — immediate, snappy (150ms)
- Brand button shadow: `0 2px 12px rgba(249,115,22,0.25)`
- Hover: shadow intensifies, never color change alone
- Disabled: `opacity-50 cursor-not-allowed`, no hover effect

---

## Rules

- Never create one-off card variants — extend the base patterns above
- Never add `transition-all` to cards — specify `transform, box-shadow, border-color`
- Glassmorphism is for panels and overlays only — not regular cards
- Shadows use `rgba`, never Tailwind shadow utilities (they don't match the warm system)
