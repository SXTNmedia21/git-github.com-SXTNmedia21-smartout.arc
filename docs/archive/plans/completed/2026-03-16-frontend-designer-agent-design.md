---
title: Frontend Designer Agent — Design Document
status: done
updated: 2026-03-16
created: 2026-03-16
module: ai
tags: [agent, frontend, design, animation, motion]
---

# Frontend Designer Agent — Design Document

## Purpose

A Claude Code agent (`.claude/agents/frontend-designer.md`) specialized in building professional frontend components for Smartout.ai. Knows the actual codebase patterns — not theoretical ideals — and matches them exactly. Produces components with Smartout's warm Scandinavian identity: strategic animation, glow orbs, orange accents, `isDark` ternary theming.

## Agent Identity

| Field | Value               |
| ----- | ------------------- |
| Name  | `frontend-designer` |
| Color | `magenta`           |
| Model | `inherit`           |
| Tools | Full access         |

## Design Personality: "The Smartout Feel"

**A confident bartender, not a bank.** Professional but warm. Scandinavian minimalism with personality.

Key visual signatures discovered from codebase audit:

- **Glow orbs** — absolute-positioned blurred color blobs behind cards (emerald/orange/red/blue mapped to status)
- **isDark prop drilling** — theme switching via JSX ternaries, NOT CSS variable classes
- **Orange gradient buttons** — `bg-gradient-to-r from-orange-600 to-rose-600`
- **Dark backgrounds** — `#0a0a0c` (header), `#0c0c0e` (sidebar), zinc-950 (main)
- **Minimal dividers** — `h-px bg-zinc-800/50`, not full borders
- **Strategic animation** — 90% of components use only CSS `transition-colors`, Motion reserved for high-impact moments

## Animation: Actual Codebase Patterns

| What                  | Reality                                               | NOT                       |
| --------------------- | ----------------------------------------------------- | ------------------------- |
| Hover on cards        | Color/bg change only                                  | No scale transforms       |
| Theme                 | isDark ternary in JSX                                 | Not CSS custom properties |
| framer-motion imports | Mixed: `framer-motion` AND `motion/react`             | Not exclusively one       |
| Dashboard motion      | Only StrategicView uses Motion heavily                | Not on every component    |
| Springs               | Layout animations only (`bounce: 0.2, duration: 0.6`) | Not on every interaction  |
| Loading               | `animate-pulse` divs, `Loader2 animate-spin`          | Not skeleton libraries    |

### Tier System (match actual usage)

| Tier        | Tools                                                                | Actual usage (%)                              |
| ----------- | -------------------------------------------------------------------- | --------------------------------------------- |
| 1 — CSS     | `transition-colors`, `animate-pulse`, `animate-ping`, `animate-spin` | 90%                                           |
| 2 — Motion  | `AnimatePresence`, `layoutId`, `useScroll`                           | 10% (StrategicView, onboarding, voice avatar) |
| 3 — Install | `@formkit/auto-animate`, Motion Primitives                           | 0% (available for new work)                   |
| 4 — Heavy   | GSAP                                                                 | 0% (landing page future)                      |

### Duration Reference (from code)

| Context                 | Duration   |
| ----------------------- | ---------- |
| Hover/color shift       | 150-300ms  |
| View/tab change         | 300-500ms  |
| Chart bars/parallax     | 800-1200ms |
| Breathing/loading loops | 2-3s       |

## Real Component Patterns

### Status Badge (3-level dark/light)

```tsx
isDark
  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
  : "border-emerald-200 bg-emerald-50 text-emerald-600";
```

### Glow Orb

```tsx
<div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
```

### Group Hover

```tsx
<div className="group">
  <div className="opacity-0 transition-opacity group-hover:opacity-100">
    {/* Actions appear on hover */}
  </div>
</div>
```

### Loading

```tsx
<div className="h-6 flex-1 animate-pulse rounded-lg bg-zinc-800/50" />
<Loader2 className="h-4 w-4 animate-spin text-white/60" />
```

## Architecture Patterns

- DashboardContext: 20+ state values (isDark, isAdminMode, activeView, sidebar, schedule settings)
- Heavy components: `next/dynamic` with `ssr: false`
- Data fetching: TanStack Query hooks in `_hooks/` directories
- Text: Norwegian ("Laster...", "I dag", "Uke", "Publiser")
- CVA for base UI variants, `cn()` for class composition

## UI Event Tracking

Documents interactive surfaces for Stage Engine agent interaction:

- Navigation targets, button handlers, color regimes
- Format: inline comments in components

## Decision

Approach A: Single agent with real codebase knowledge. Revised after deep pattern audit that revealed significant gaps between assumed and actual patterns.
