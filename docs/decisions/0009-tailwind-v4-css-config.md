---
title: "ADR-0009: Tailwind CSS v4 with CSS-Based Configuration"
id: ADR-0009
status: accepted
layer: decision
created: 2026-02-27
updated: 2026-02-27
---

# ADR-0009: Tailwind CSS v4 with CSS-Based Configuration

**Date:** 2026-02-27
**Status:** Accepted

## Context

The project started with Tailwind CSS v3 (JS-based `tailwind.config.ts`). During the rebuild, Tailwind v4 was released with a fundamentally different configuration approach — CSS-based with `@theme inline` instead of a JS config file.

## Decision

We use **Tailwind CSS v4** with CSS-based configuration in `apps/web/src/app/globals.css`. There is no `tailwind.config.ts` file.

### Theme Definition

Colors use OKLCH color space defined as CSS custom properties:

```css
@theme inline {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
  --color-primary: oklch(0.922 0 0);
  /* ... */
}
```

### Usage Rules

```tsx
// CORRECT — use CSS variable classes
className = "bg-background text-foreground border-border";

// WRONG — hardcoded values bypass theming and dark mode
className = "bg-zinc-950 text-zinc-100 border-zinc-800";
```

### Exception

Root `package.json` has `tailwindcss: ^3.4.13` as a devDependency. This is exclusively for Remotion (video generation) which does not support Tailwind v4 yet. App code always uses v4.

## Rationale

- Tailwind v4 is faster (no JS config parsing)
- OKLCH colors provide perceptually uniform color manipulation
- CSS variables enable runtime theme switching (dark/light mode) without class-based toggling
- shadcn/ui new-york style uses CSS variables natively

## Consequences

- Existing dashboard layout uses hardcoded zinc values (pre-v4 code) — refactor when touching
- Agents must use CSS variable classes, not hardcoded colors
- No `tailwind.config.ts` — theme changes go in `globals.css`
