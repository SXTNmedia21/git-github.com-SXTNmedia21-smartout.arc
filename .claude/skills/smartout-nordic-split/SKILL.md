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

## Motion Token Audit (Debt Status)

Motion tokens are exported from `packages/design-tokens/src/tokens.ts`. Inline magic numbers fragment the system. Add a new token rather than hardcoding a new value.

### Tokens available

| Token | Value | Use for |
|------|-------|---------|
| `motion.spring` | `{ stiffness: 35, damping: 22, mass: 2.2 }` | Default content swap, tab transition, drawer slide |
| `motion.springSnappy` | `{ stiffness: 45, damping: 24, mass: 2 }` | Button press, badge pop, snappy feedback |
| `motion.springGentle` | `{ stiffness: 30, damping: 20, mass: 2.5 }` | Ambient drift, orb breathing |
| `motion.enterMs` | `500` | Enter animations (page mount, drawer open) |
| `motion.exitMs` | `250` | Exit animations (skeleton fade, drawer close) |
| `motion.easingArray` | `[0.25, 0.1, 0.25, 1]` | Standard cubic-bezier for fades |
| `motion.easingExpoArray` | `[0.16, 1, 0.3, 1]` | Expo-out for entrances |

### Import pattern

```ts
import { motion as motionTokens } from "@smartout/design-tokens";
// alias to avoid collision with framer-motion's `motion`
```

### Audit grep commands

```bash
# Hardcoded spring physics
grep -rn "stiffness:\|damping:" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "motionTokens\."

# Hardcoded fade durations and ease arrays
grep -rn "duration: 0\.\|ease: \[" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "motionTokens\."

# Tailwind duration utilities inside framer-motion props
grep -rn 'transition={.*duration-' apps/web/src --include="*.tsx" --include="*.ts"
```

Every hit becomes a `motionTokens.*` migration.

### Surfaces that always need audit

- Drawers (slide springs)
- Dialogs / popups (fade + scale)
- Buttons (press feedback)
- Toasts / sonner overrides
- Badges with motion (StatusBadge family)
- Tab and stage swaps (`AnimatePresence` regions)
- Skeleton ↔ content crossfades
- Bell / notification glow loops
- Wizard step transitions

### Current debt (snapshot 2026-04-28)

| File | Pattern | Status |
|------|---------|--------|
| `apps/web/src/components/day/WebDayControl.tsx` | spring + fade + tab swap | ✅ migrated 2026-04-28 |
| `apps/web/src/components/day/AddShiftDialog.tsx` | spring 35/22/2.2 (×2) | open |
| `apps/web/src/components/dashboard/ReconciliationView.tsx` | spring 300/30 + duration 0.18 easeInOut | open |
| `apps/web/src/components/dashboard/interactive/PrepActionCards.tsx` | spring 40/22 + duration 0.15 | open |
| `apps/web/src/components/dashboard/interactive/InteractiveDashboard.tsx` | spring 40/22 + duration 0.25 | open |
| `apps/web/src/components/dashboard/interactive/KpiPillGrid.tsx` | spring 250/22 | open |
| `apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx` | spring 40/22 | open |
| `apps/web/src/components/dashboard/interactive/OnDutyStrip.tsx` | spring 40/22 | open |
| `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx` | panelSpring + swapSpring locals + 0.2 / 0.15 | open |
| `apps/web/src/components/dashboard/entity-drawer/tabs/cascade-task/CascadeTaskTab.tsx` | duration 0.35 + local ease array | open |
| `apps/web/src/components/dashboard/NotificationBell.tsx` | local SPRING constant + 5 inline durations | open |
| `apps/web/src/components/dashboard/GlobalCallAlert.tsx` | OVERLAY_SPRING 40/24/2 + duration 0.2 | open |
| `apps/web/src/components/ui/PaymentStatusBadge.tsx` | inline 35/22 | open |
| `apps/web/src/components/ui/DispatchStatusBadge.tsx` | inline 35/22 | open |
| `apps/web/src/components/wizard/AnimatedWizardShell.tsx` | EASE local + 6 inline durations/eases | open |

Total open: ~30 sites across 14 files. Plan a `motion-token-sweep` sortie that closes these one tier at a time (Tier 0 shared primitives first — drawers, badges, bell, wizard).

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

## Task Manager Prototype — North-Star Design Language (2026-05-22)

> Pontus directive: the Task Manager prototype `docs/modules/task-manager/taskmanager-DESIGNE/` is the **north-star** for application surface design. Patterns below are extracted from `styles.css` + `components/*.jsx` and are CANONICAL for new dashboard/admin surfaces. **Port these recipes — do not redesign.**
> **HARD RULE:** the prototype's mockup uses HEX, but Smartout does NOT — every color is an OKLCH CSS-variable token (ADR-0366 bans OKLCH literals in code; ADR-0361 bans hardcoded color classes). Add the token to `packages/design-tokens/src/tokens.ts` and reference by name — NEVER a hex or raw OKLCH literal in a `.tsx`/`.css`. The OKLCH values below are the canonical token definitions.

### Scales — ALREADY in `packages/design-tokens/src/tokens.ts` (reuse, never inline)

| Scale | Export | Note |
|-------|--------|------|
| **Spacing** | `spacing` (page/section/card/element/tight) | ✅ exists, matches proto |
| **Radius** | `radius` (base/sm/md/lg/xl/full) | ✅ exists. **`card`=16px is the proto signature — add `radius.card`** |
| **Shadow** | `shadows` (sm/md/lg/glow.orange/glow.blue) | ✅ exists. Orange glow = signature CTA |

- **Density toggle:** `[data-density="compact"]` shrinks card/element spacing. Layouts must survive both.
- **App shell:** CSS grid `248px 1fr` (sidebar + main). Sidebar sticky, full-height, `sidebar` token surface.
- **Font feature settings:** `"ss01", "cv11"` on body; `.mono` uses `tabular-nums`.

### Semantic palettes — what EXISTS vs what is NEW

**Department identity** — ✅ ALREADY `department` export (`kitchen/floor/bar/event/storage` + `kjokken/sal` aliases, OKLCH). Reuse it. Do NOT invent new dept values.
**Priority** — ✅ ALREADY `priority` export (`urgent/high/normal/low`). Proto's "kritisk" = `urgent`. Render via `PriorityDot` (solid dot, color only — no emoji in product; proto emoji are mock-only).
**Tidslinjen phase tint** — ✅ ALREADY `phase` export (prep/service/winddown) — use for timeline bands.

**NEW tokens this prototype requires (added 2026-05-22):**
- **`taskStatus`** — task lifecycle (distinct from profile `status`): todo · inprogress · awaiting · overdue · done.
- **`taskOrigin`** — where a task came from, fg+bg pair, rendered as 9px uppercase badge (letter-spacing 2px, `radius.sm`):
  | origin | label | tone |
  |--------|-------|------|
  | session | **Rutine** | blue |
  | adhoc | **Ad-hoc** | violet |
  | protocol | **Protokoll** | teal |
  | deviation | **Avviks-oppfølging** | red |

### Core component recipes

- **TaskCard:** `--card` bg, 1px `--border`, `--r-card` (16), grid `auto auto minmax(0,1fr) auto` (toggle · origin · body · assignee), 14px gap, transition border-color/transform/shadow. Hover → `--sh-hover`. Elements: status-toggle, OriginBadge, title, deadline (HH:MM + relative text), folder chip, location, subtask progress X/Y, manual icon, evidence icon, Avatar.
- **Chip:** pill (`--r-full`), 6×12 padding, 12.5px/500, transparent + 1px border + `--muted`; active state fills. Used for filters (Alle/Tildelt meg/Kritisk/Pågår/Ferdig) + metadata.
- **Btn-primary:** `--orange` bg, white text, **`--sh-glow`** (orange-tinted glow is the signature CTA treatment).
- **Day-meter:** progress bar + text ("3 av 12 fullført · 3 må løses før 12:00") — the Min dag completion summary.
- **KPI-strip:** 4-col grid in one `--card`/`--r-card` container, dividers between, no gap.
- **Drawer:** backdrop + slide-in panel; header-row (origin + status + priority-tinted bg + title + chip row), sections (linked manual · subtasks · evidence capture · activity feed), footer actions. Slide via `motion.spring` (35/22/2.2).
- **Builder-block** (Manualskaper): per-block confidence dot (high/med/low = green/yellow/red), inline editor per type (text/callout/image/video/checklist/evidence), Botsson action menu. Publish gated on 0 low-confidence blocks.
- **Guide-step** (Manual-guide, mobile): one-screen-per-step, progress bar, eyebrow + "Steg N av M", interactive checklist + evidence capture. Execution surface, not editor.
- **Avatar:** circle, user color bg, white initials, size×0.4 font, optional 2px `--bg` border for stacking.

### Origin/status/priority taxonomy is shared with the Task Manager module

These map 1:1 to the 4 task sources + `session_task_status` enum. See `docs/modules/task-manager/MODULE_TASK_MANAGER.md`. UI taxonomy and DB taxonomy must stay aligned — a new origin/status in one requires the other.

## Reference Files

- **North-star prototype:** `docs/modules/task-manager/taskmanager-DESIGNE/` (styles.css + components/*.jsx) — port, do not redesign
- Interactive styleguide: `docs/design/ren-og-varm-styleguide.html`
- Orb generator: `docs/design/orb-generator.html`
- Design tokens: `packages/design-tokens/src/tokens.ts`
- Design docs: `docs/design/` (README + colors, typography, motion, components, mobile, patterns)
