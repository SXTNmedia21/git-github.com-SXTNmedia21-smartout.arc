---
title: P11 Manager Timeline — design-token audit
status: done
created: 2026-05-24
updated: 2026-05-24
module: day-session
tags: [audit, design-tokens, nordic-split, p11]
---

# Token Audit — P11 Manager Timeline — 2026-05-24

## Counts

- Tokens needed (design source `timeline-chart.jsx` + `timeline-styles.css`): **92**
- Tokens available as CSS custom properties (`packages/design-tokens/src/*.css` + `apps/web/src/app/globals.css`): **317**
- CSS-var-format mismatch: **48**

## Verdict

**NO new design tokens needed.** All 48 "missing" CSS vars from the design prototype map to existing Smartout values via different conventions:

| Design prototype convention | Smartout convention | Resolution |
|------------------------------|---------------------|------------|
| `var(--space-card)` etc. | `spacing.card` TS export + Tailwind utilities | Use Tailwind class (`p-card`, `gap-element`) — translate at port time |
| `var(--fs-body)`, `--fs-hero`, etc. | Tailwind text utilities derived from `@theme` | Use Tailwind class (`text-body`, `text-hero`) — translate at port time |
| `var(--shadow-md)` etc. | `shadows.md` TS export | Use Tailwind class (`shadow-md`) — already standard |
| `var(--radius-card)` | `radius.card` TS export | Use Tailwind class (`rounded-card`) — translate at port time |
| `var(--dur-enter)`, `--ease-primary` | `motion.enterMs`, `motion.easingArray` TS exports | Use `import { motion as motionTokens } from "@smartout/design-tokens"` per Nordic Split skill rules — never inline keyframes |
| `var(--muted-fg)` | `muted-foreground` (shadcn rename) | Use Tailwind class (`text-muted-foreground`) |
| `var(--hour-h)` | Data attribute / inline style on chart | Domain-specific (chart pixel-per-minute math) — NOT a design token, keep as inline computed `style={{ "--hour-h": ... }}` |
| `var(--area-color)`, `--area-c`, `--area-h`, `--area-l`, `--routine-color` | Dynamic dept/phase colors via `areaColorVar()` helper | Programmatically computed in chart from `tokens.department.*` and `tokens.phase.*` TS exports — NOT static tokens, port as helper function |
| `var(--dept-*)` (kitchen/floor/bar/event/storage) | `department.*` TS export | Use existing `department.kitchen`, `department.floor`, etc. tokens via Tailwind classes or TS lookup |

## Implementation rule for Phase 3 chart port

When porting `timeline-chart.jsx` → React/Tailwind:

1. **Static colors:** replace `var(--<name>)` with matching Tailwind utility class (`bg-card`, `border-border`, etc.)
2. **Dynamic colors:** keep `areaColorVar()` helper, but import dept/phase color hex strings from `@smartout/design-tokens`
3. **Spacing/sizing:** use Tailwind utilities, never inline `style={{ padding: var(...) }}`
4. **Motion:** import `motion as motionTokens from "@smartout/design-tokens"`, NEVER inline spring values
5. **Typography:** use Tailwind text utilities (`text-body`, `text-caption`) from `@theme` directive in `globals.css`
6. **Chart-specific math values** (`--hour-h`, `--area-h`): keep as runtime-computed inline CSS custom properties on the chart root element — these are pixel calculations, NOT design tokens

## ADR-0366 conformance

Zero `oklch(...)` literals will land in `apps/web/src/app/dashboard/oppgaver/**`. All color references go through existing tokens. NO new color values introduced.

## ADR-0361 conformance

Zero hardcoded color classes (`zinc-*`, `gray-*`, `slate-*`) will land. All color references via semantic Nordic Split tokens.

## Files

- Needed: `/tmp/oppgaver-tokens-needed.txt` (92 entries)
- Available: `/tmp/oppgaver-tokens-available.txt` (317 entries)
- Diff: `/tmp/oppgaver-tokens-missing.txt` (48 entries, all CSS-var-format gap)

## Verified by

Orchestrator (Opus 4.7) — direct shell audit per plan Task 1.5.
