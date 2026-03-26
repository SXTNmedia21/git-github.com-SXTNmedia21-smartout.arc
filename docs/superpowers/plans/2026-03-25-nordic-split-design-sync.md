---
title: "Nordic Split Design System Sync"
status: draft
updated: 2026-03-25
created: 2026-03-25
module: design-tokens
tags: [design-system, tokens, sync, naming]
---

# Nordic Split Design System Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync all design token files, CSS, and documentation to match the Nordic Split styleguide — the single source of truth for Smartout's visual identity.

**Architecture:** Fix `tokens.ts` (warm OKLCH values), sync `tokens.css` dark mode, update `native.ts` hex conversions, rename "Ren og Varm" → "Nordic Split" in all references, add missing tokens (panel, glow, motion, typography).

**Tech Stack:** TypeScript, CSS, OKLCH color space

**Source of truth:** `docs/design/ren-og-varm-styleguide.html` (CSS variables on line 12-13)

---

## File Map

| Action    | File                                    | Responsibility                                                         |
| --------- | --------------------------------------- | ---------------------------------------------------------------------- |
| Modify    | `packages/design-tokens/src/tokens.ts`  | Fix light/dark surface colors, add panel/glow/motion/typography tokens |
| Modify    | `packages/design-tokens/src/tokens.css` | Sync dark mode values with tokens.ts                                   |
| Modify    | `packages/design-tokens/src/native.ts`  | Update hex conversions for warm colors                                 |
| Modify    | `CLAUDE.md`                             | Rename "Ren og Varm" → "Nordic Split"                                  |
| Modify    | `apps/landing/src/app/design/page.tsx`  | Update metadata title                                                  |
| No change | `apps/web/src/app/globals.css`          | Already has correct warm values                                        |
| No change | `apps/mobile/src/theme/`                | Derives from native.ts, auto-correct                                   |

---

### Task 1: Fix tokens.ts — Warm Surface Colors

**Files:**

- Modify: `packages/design-tokens/src/tokens.ts:1-5,30-64,66-101`

- [ ] **Step 1: Update file header**

Replace lines 1-5:

```typescript
// packages/design-tokens/src/tokens.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NORDIC SPLIT DESIGN SYSTEM — Single source of truth.
// Elegant Nordic cleanness. Warm glowing tones.
// White space. Spring motion. Impact.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- [ ] **Step 2: Fix light mode surface colors**

Replace the `light` export (lines 30-64) with warm values matching the styleguide:

```typescript
export const light = {
  background: "oklch(0.99 0.004 60)",
  foreground: "oklch(0.145 0.01 50)",
  card: "oklch(0.99 0.004 60)",
  cardForeground: "oklch(0.145 0.01 50)",
  popover: "oklch(0.99 0.004 60)",
  popoverForeground: "oklch(0.145 0.01 50)",
  primary: "oklch(0.205 0.01 50)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.965 0.005 58)",
  secondaryForeground: "oklch(0.205 0.01 50)",
  muted: "oklch(0.965 0.005 58)",
  mutedForeground: "oklch(0.52 0.01 52)",
  accent: "oklch(0.965 0.005 58)",
  accentForeground: "oklch(0.205 0.01 50)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.91 0.006 55)",
  input: "oklch(0.91 0.006 55)",
  ring: "oklch(0.65 0.22 40)",
  // Sidebar
  sidebar: "oklch(0.975 0.006 57)",
  sidebarForeground: "oklch(0.145 0.01 50)",
  sidebarPrimary: "oklch(0.205 0.01 50)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.955 0.008 56)",
  sidebarAccentForeground: "oklch(0.205 0.01 50)",
  sidebarBorder: "oklch(0.905 0.007 54)",
  sidebarRing: "oklch(0.708 0 0)",
  // Charts
  chart1: "oklch(0.646 0.222 41.116)",
  chart2: "oklch(0.6 0.118 184.704)",
  chart3: "oklch(0.398 0.07 227.392)",
  chart4: "oklch(0.828 0.189 84.429)",
  chart5: "oklch(0.769 0.188 70.08)",
} as const;
```

- [ ] **Step 3: Fix dark mode surface colors**

Replace the `dark` export (lines 67-101) — key change: background `0.12 0.015 50` (warm dark, not cold black):

```typescript
export const dark = {
  background: "oklch(0.12 0.015 50)",
  foreground: "oklch(0.95 0.005 55)",
  card: "oklch(0.16 0.02 50)",
  cardForeground: "oklch(0.95 0.005 55)",
  popover: "oklch(0.16 0.02 50)",
  popoverForeground: "oklch(0.95 0.005 55)",
  primary: "oklch(0.922 0 0)",
  primaryForeground: "oklch(0.205 0.01 50)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.95 0.005 55)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.6 0.01 52)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.95 0.005 55)",
  destructive: "oklch(0.704 0.191 22.216)",
  border: "oklch(1 0 0 / 8%)",
  input: "oklch(1 0 0 / 10%)",
  ring: "oklch(0.556 0 0)",
  // Sidebar
  sidebar: "oklch(0.16 0.02 50)",
  sidebarForeground: "oklch(0.95 0.005 55)",
  sidebarPrimary: "oklch(0.488 0.243 264.376)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.269 0 0)",
  sidebarAccentForeground: "oklch(0.95 0.005 55)",
  sidebarBorder: "oklch(1 0 0 / 8%)",
  sidebarRing: "oklch(0.556 0 0)",
  // Charts
  chart1: "oklch(0.488 0.243 264.376)",
  chart2: "oklch(0.696 0.17 162.48)",
  chart3: "oklch(0.769 0.188 70.08)",
  chart4: "oklch(0.627 0.265 303.9)",
  chart5: "oklch(0.645 0.246 16.439)",
} as const;
```

- [ ] **Step 4: Add missing token exports — panel, glow, motion, typography**

Append after the `wizard` export (after line 174):

```typescript
// ─── Panel & Glow (Nordic Split dark surfaces) ──────
export const panel = {
  surface: "oklch(0.18 0.03 50)",
  deep: "oklch(0.06 0.015 50)",
  glowWarm: "oklch(0.45 0.18 40)",
  glowDeep: "oklch(0.35 0.14 35)",
} as const;

// ─── Motion (spring physics) ─────────────────────────
export const motion = {
  spring: { stiffness: 35, damping: 22, mass: 2.2 },
  springSnappy: { stiffness: 45, damping: 24, mass: 2 },
  springGentle: { stiffness: 30, damping: 20, mass: 2.5 },
  enterMs: 500,
  exitMs: 250,
  easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
} as const;

// ─── Typography ──────────────────────────────────────
export const typography = {
  heading: "'Instrument Serif', Georgia, serif",
  body: "'Geist Sans', system-ui, sans-serif",
  mono: "'Geist Mono', monospace",
} as const;
```

- [ ] **Step 5: Update index.ts to export new tokens**

Check `packages/design-tokens/src/index.ts` — it already does `export * from "./tokens"` so new exports are auto-included. No change needed.

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @smartout/design-tokens tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add packages/design-tokens/src/tokens.ts
git commit -m "fix(design-tokens): sync tokens.ts with Nordic Split styleguide

- Light mode: warm cream base (oklch hue 50-60)
- Dark mode: warm dark (0.12, not 0.145)
- Add panel, glow, motion, typography tokens

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Sync tokens.css Dark Mode

**Files:**

- Modify: `packages/design-tokens/src/tokens.css:102-144`

- [ ] **Step 1: Update dark mode CSS variables**

Replace `.dark` block (lines 102-144):

```css
.dark {
  /* Surface — Dark (warm) */
  --background: oklch(0.12 0.015 50);
  --foreground: oklch(0.95 0.005 55);
  --card: oklch(0.16 0.02 50);
  --card-foreground: oklch(0.95 0.005 55);
  --popover: oklch(0.16 0.02 50);
  --popover-foreground: oklch(0.95 0.005 55);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0.01 50);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.95 0.005 55);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.6 0.01 52);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.95 0.005 55);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 8%);
  --input: oklch(1 0 0 / 10%);
  --ring: oklch(0.556 0 0);

  /* Charts — Dark */
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);

  /* Scrollbar — Dark */
  --scrollbar-thumb: oklch(0.35 0 0);
  --scrollbar-thumb-hover: oklch(0.45 0 0);
  --scrollbar-track: transparent;

  /* Sidebar — Dark (warm) */
  --sidebar: oklch(0.16 0.02 50);
  --sidebar-foreground: oklch(0.95 0.005 55);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.95 0.005 55);
  --sidebar-border: oklch(1 0 0 / 8%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

- [ ] **Step 2: Add panel/glow CSS variables to :root**

Add before the scrollbar section (after line 94):

```css
/* Panel & Glow (Nordic Split) */
--panel: oklch(0.18 0.03 50);
--panel-deep: oklch(0.06 0.015 50);
--glow-warm: oklch(0.45 0.18 40);
--glow-deep: oklch(0.35 0.14 35);
```

- [ ] **Step 3: Commit**

```bash
git add packages/design-tokens/src/tokens.css
git commit -m "fix(design-tokens): sync tokens.css dark mode with Nordic Split

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Update native.ts Hex Conversions

**Files:**

- Modify: `packages/design-tokens/src/native.ts`

- [ ] **Step 1: Update native theme with warm hex values**

Replace entire file content:

```typescript
// packages/design-tokens/src/native.ts
// React Native theme — hex conversions of Nordic Split OKLCH tokens.
// Update these when tokens.ts changes.

export const nativeTheme = {
  light: {
    background: "#fdfcfa", // oklch(0.99 0.004 60) — warm cream
    foreground: "#1c1814", // oklch(0.145 0.01 50) — warm black
    card: "#fdfcfa",
    cardForeground: "#1c1814",
    primary: "#2a241e", // oklch(0.205 0.01 50)
    primaryForeground: "#fafafa",
    secondary: "#f5f3f0", // oklch(0.965 0.005 58)
    secondaryForeground: "#2a241e",
    muted: "#f5f3f0",
    mutedForeground: "#7a756e", // oklch(0.52 0.01 52)
    border: "#e8e5e1", // oklch(0.91 0.006 55)
    destructive: "#e7000b",
    success: "#11ad32",
    warning: "#c18200",
    info: "#2784d5",
    brandOrange: "#f97316",
    brandPurple: "#8b5cf6",
    brandCyan: "#06b6d4",
  },
  dark: {
    background: "#151210", // oklch(0.12 0.015 50) — warm dark
    foreground: "#f0eeeb", // oklch(0.95 0.005 55)
    card: "#1e1a15", // oklch(0.16 0.02 50)
    cardForeground: "#f0eeeb",
    primary: "#e5e5e5",
    primaryForeground: "#2a241e",
    secondary: "#262626",
    secondaryForeground: "#f0eeeb",
    muted: "#262626",
    mutedForeground: "#908a82", // oklch(0.6 0.01 52)
    border: "rgba(255,255,255,0.08)",
    destructive: "#ff6467",
    success: "#11ad32",
    warning: "#c18200",
    info: "#2784d5",
    brandOrange: "#f97316",
    brandPurple: "#a78bfa",
    brandCyan: "#22d3ee",
  },
  panel: {
    surface: "#1a1510", // oklch(0.18 0.03 50)
    deep: "#0d0a06", // oklch(0.06 0.015 50)
    glowWarm: "#7a3e14", // oklch(0.45 0.18 40)
    glowDeep: "#5c2a10", // oklch(0.35 0.14 35)
  },
  department: {
    kitchen: "#ee560c",
    floor: "#00ab93",
    bar: "#864ad2",
    event: "#c18200",
    storage: "#008388",
  },
  status: {
    trainee: "#2784d5",
    active: "#11ad32",
    inactive: "#717171",
    offboarding: "#c18200",
  },
  radius: { sm: 6, md: 8, lg: 10, xl: 14, full: 9999 },
  spacing: { page: 32, section: 24, card: 20, element: 12, tight: 8 },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add packages/design-tokens/src/native.ts
git commit -m "fix(design-tokens): update native.ts hex values for warm Nordic Split palette

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rename "Ren og Varm" → "Nordic Split" in References

**Files:**

- Modify: `CLAUDE.md:135`
- Modify: `apps/landing/src/app/design/page.tsx:4-5`

- [ ] **Step 1: Update CLAUDE.md**

Line 135 — change:

```
- **Design System: "Ren og Varm"** — `docs/design/ren-og-varm-styleguide.html` is the canonical visual reference. BEFORE building any UI component, read this file for colors, typography, animations, and patterns. Live at `design.smartout.ai`.
```

To:

```
- **Design System: "Nordic Split"** — `docs/design/ren-og-varm-styleguide.html` is the canonical visual reference. BEFORE building any UI component, read this file for colors, typography, animations, and patterns. Live at `design.smartout.ai`. Orb generator: `docs/design/orb-generator.html`.
```

- [ ] **Step 2: Update landing design page metadata**

In `apps/landing/src/app/design/page.tsx`, change lines 4-5:

```typescript
  title: "Nordic Split — Smartout Design System",
  description: "Smartout Design System — 25 sektioner. Light & Dark. Web & Mobile. Interaktiv.",
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md apps/landing/src/app/design/page.tsx
git commit -m "docs: rename design system 'Ren og Varm' → 'Nordic Split'

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verify Full Typecheck

- [ ] **Step 1: Run typecheck across monorepo**

Run: `pnpm turbo typecheck`
Expected: 0 errors

- [ ] **Step 2: Verify styleguide files are synced**

Run: `diff docs/design/ren-og-varm-styleguide.html apps/landing/public/styleguide.html`
Expected: identical (exit 0)

- [ ] **Step 3: Verify design page loads**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3055/design`
Expected: 200

---

### Not Touched (intentionally)

These files reference "Ren og Varm" in historical docs/specs. They are snapshots of past work and should NOT be updated — changing them would falsify history:

- `docs/DEEP-SYSTEM-DOCUMENTATION-2026-03-24.md`
- `docs/FULL-REPO-AUDIT-2026-03-24.md`
- `docs/superpowers/specs/2026-03-24-*.md`
- `docs/superpowers/plans/2026-03-24-*.md`
- `docs/superpowers/specs/2026-03-23-*.md`
- `docs/plans/completed/PLAN-signup.md`
- `packages/ui/src/wizard/WizardNavBar.tsx` (comment reference, not functional)
- `packages/ui/src/wizard/WizardTopBar.tsx` (comment reference, not functional)
