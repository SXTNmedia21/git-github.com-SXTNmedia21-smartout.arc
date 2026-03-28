---
title: TacticalView Polish — Rensa & Höj
status: approved
updated: 2026-03-20
created: 2026-03-20
module: dashboard
tags: [dashboard, tactical-view, redesign, polish]
---

# TacticalView Polish — Rensa & Höj

## Problem

The admin dashboard TacticalView feels **generic/flat** and **visually cluttered**:

- 2 of 4 SignalCards are placeholders ("Soon") — signals unfinished product
- Weekly staffing chart takes 2/3 of screen for 7 bars — disproportionate
- "Upcoming Events" placeholder with dashed border = visual noise
- Hardcoded colors (`bg-[#0c0c0e]`, `border-zinc-800`) instead of CSS variables
- Right sidebar (1/3 width) feels empty and deprioritized

## Design Goals

- **Control** — "I own the situation"
- **Clarity** — "I understand in 3 seconds"
- **Pride** — "This tool matches our ambition level"

Approach: Polish, not rebuild. Keep what works, remove what doesn't deliver.

## Changes

### Remove

| Element                      | File                             | Why                       |
| ---------------------------- | -------------------------------- | ------------------------- |
| SignalCard "Cost of Sales %" | TacticalView.tsx:106-113         | Placeholder, no data      |
| SignalCard "Absence (MTD)"   | TacticalView.tsx:114-121         | Placeholder, no data      |
| "Upcoming Events" card       | TacticalView.tsx:317-347         | Placeholder, visual noise |
| Right sidebar column         | TacticalView.tsx:244-348         | Empty after removals      |
| Hardcoded colors             | TacticalView.tsx, SignalCard.tsx | Use CSS variables         |

### Upgrade: SignalCards (2 remaining, 50/50 width)

**Staffing Coverage card:**

- Keep: large percentage, status indicator (emerald/orange/red)
- Add: 7-day sparkline under the number (weekly trend miniature)
- Add: "X gaps today" as secondary text
- Width: 50% (was 25%)

**Training Readiness card:**

- Keep: large percentage, completed/total count, trend arrow
- Add: mini progress bar under the number
- Add: "X pending" as actionable secondary text
- Width: 50% (was 25%)

Cards become **wider, not taller** — more breathing room, more information density per card.

### Upgrade: Weekly Staffing (full width, compact grid)

Current: 2/3 width, 7 horizontal bars stacked vertically.

New design:

- **Full width** (sidebar removed)
- **7-column grid** (one per day) instead of stacked rows
- Each column: day label top, fill percentage (colored), gap count bottom
- Color coding preserved: emerald (≥100%), orange (80-99%), red (<80%)
- Click-to-open-day interaction preserved
- Week navigator (prev/next/today) preserved in header

### Upgrade: Training & Compliance (inline alert)

Instead of a sidebar card:

- **Inline strip** below the weekly grid
- Only shows when `pending > 0`
- Format: `⚠ X pending protocols · Y% readiness · View all →`
- When all clear: no strip shown (clean dashboard)

### CSS Variable Migration

Replace all hardcoded colors with design system tokens:

| Hardcoded                  | CSS Variable              |
| -------------------------- | ------------------------- |
| `bg-[#0c0c0e]`             | `bg-card`                 |
| `border-zinc-800`          | `border-border`           |
| `text-zinc-100`            | `text-foreground`         |
| `text-zinc-400`            | `text-muted-foreground`   |
| `bg-zinc-900`              | `bg-muted`                |
| `bg-zinc-800/50`           | `bg-muted/50`             |
| `hover:bg-white/5`         | `hover:bg-accent`         |
| `hover:bg-zinc-50`         | `hover:bg-accent`         |
| `isDark ? X : Y` ternaries | Single CSS variable class |

This eliminates the `isDark` prop threading through the component tree.

## Resulting Layout

```
┌─ Signal Cards (2, 50/50) ───────────────────────────────────┐
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ STAFFING COVERAGE       │ │ TRAINING READINESS          │ │
│ │ 87%  ▁▂▅▇▇▅▃ (sparkline)│ │ 92%  ████████░░ (12/13)   │ │
│ │ 3 gaps today            │ │ 1 pending protocol          │ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─ Weekly Staffing (full width, compact grid) ────────────────┐
│ ◄  Week 12  ►  [Today]                                      │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐                │
│ │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │                │
│ │ 95% │100% │ 87% │ 72% │ 90% │100% │  —  │                │
│ │  1  │  ✓  │  2  │  4  │  1  │  ✓  │     │ (gap count)   │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┘                │
└─────────────────────────────────────────────────────────────┘

┌─ Training Alert (inline, only if pending > 0) ──────────────┐
│ ⚠ 3 pending protocols · 92% readiness · View all →         │
└─────────────────────────────────────────────────────────────┘
```

## Files to Modify

1. `apps/web/src/components/dashboard/TacticalView.tsx` — main changes
2. `apps/web/src/components/dashboard/SignalCard.tsx` — add sparkline/progress bar, remove isDark prop
3. `apps/web/src/components/dashboard/ActionStrip.tsx` — CSS variable migration (if isDark used)

## What NOT to Change

- ActionStrip (works well, different concern)
- DashboardShell (layout shell is fine)
- AdminDashboard view router (works)
- Data hooks (no data model changes)
- Other views (Strategic, Reconciliation, Activity)

## Success Criteria

- [ ] 0 placeholder cards visible
- [ ] 0 hardcoded color values in TacticalView/SignalCard
- [ ] Weekly overview uses full width
- [ ] Training alert only shows when actionable
- [ ] `isDark` prop eliminated from SignalCard (uses CSS vars)
- [ ] Typecheck passes
