---
title: "Shared Design Principles — Web & Mobile"
status: active
updated: 2026-03-26
created: 2026-04-18
module: design
tags: [agent, design-system, frontend-design, mobile-design, shared]
---

# Shared Design Principles — Web & Mobile

> **Canonical reference for both `frontend-designer` and `mobile-designer` agents.**
> Both agents MUST read this file before starting work. Platform-specific rules live in their own INSTRUCTION.md files — this file covers what is universal.

---

## 1. Design System Source of Truth

**`docs/design/` is the single source of truth for all visual decisions.** Both agents read from there.

| File                                      | Covers                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| `docs/design/README.md`                   | Overview, source map, agent instructions              |
| `docs/design/ren-og-varm-styleguide.html` | Interactive visual reference (25 sections)            |
| `docs/design/colors.md`                   | Palette, OKLCH, semantic/domain colors, CSS var rules |
| `docs/design/typography.md`               | Fonts, type scale, weights, spacing, icons            |
| `docs/design/motion.md`                   | Spring physics, easing, orbs, noise, animations       |
| `docs/design/components.md`               | Cards, inputs, badges, buttons, glass, loading        |
| `docs/design/patterns.md`                 | Nordic Split panel, wizard, login gate, ambient glow  |
| `docs/design/mobile.md`                   | Phone frame, tab bar, FAB, chat, shift card           |

**Token source of truth:** `packages/design-tokens/src/tokens.ts` → `tokens.css` (web) → `native.ts` (mobile)

Never duplicate values from these files in agent instructions. Read them directly.

## 2. Design Identity: "Nordic Split" (Clean & Warm)

Smartout's visual identity across all platforms. Full details in `docs/design/README.md`.

- **Premium, not corporate** — Every interface should feel intentional, not generated. The bar is Linear, Vercel, Stripe.
- **Warm neutrals, not cold grays** — All neutrals carry warm hue 50-60. Dead gray is banned. See `docs/design/colors.md`.
- **Editorial typography** — Type creates hierarchy before color or borders. See `docs/design/typography.md`.
- **Space as design element** — Generous padding is deliberate. Whitespace creates focus and calm.
- **Depth through subtlety** — Shadows, not hard borders. Gradients, not flat blocks. Blur and opacity, not outline and fill.
- **Brand orange as accent** — Primary CTA, active states, attention draws. See `docs/design/colors.md`.

## 3. Shared Design Tokens

Both platforms consume from `@smartout/design-tokens`:

| Token   | Web (CSS)                            | Mobile (Native)                               |
| ------- | ------------------------------------ | --------------------------------------------- |
| Colors  | `@smartout/design-tokens` → CSS vars | `@smartout/design-tokens/native` → hex values |
| Radius  | CSS `var(--radius-*)`                | `nativeTheme.radius.*`                        |
| Spacing | CSS `var(--spacing-*)`               | `nativeTheme.spacing.*`                       |

**The design-tokens package is the single source of truth.** When a value changes, it must change in the package — never overridden locally.

### Color Semantics (Universal)

See `docs/design/colors.md` for full palette. Key semantic roles:

| Role                                           | Usage                        |
| ---------------------------------------------- | ---------------------------- |
| `background` / `foreground`                    | Page/screen bg, primary text |
| `card` / `cardForeground`                      | Elevated container           |
| `primary` / `primaryForeground`                | Primary actions              |
| `muted` / `mutedForeground`                    | Disabled, hints              |
| `border`                                       | Dividers (subtle!)           |
| `destructive` / `success` / `warning` / `info` | Semantic states              |
| `brandOrange`                                  | Brand accent                 |

### Department Colors (Universal)

| Department | Color  |
| ---------- | ------ |
| Kitchen    | Orange |
| Floor      | Teal   |
| Bar        | Purple |
| Event      | Amber  |
| Storage    | Gray   |

### Status Colors (Universal)

| Status      | Color |
| ----------- | ----- |
| Trainee     | Blue  |
| Active      | Green |
| Inactive    | Gray  |
| Offboarding | Amber |

## 4. Shared Interaction Principles

### Feedback is mandatory

- Every user action gets immediate visual feedback
- Web: hover states, focus rings, micro-animations (Framer Motion)
- Mobile: pressed states (opacity + scale), haptic feedback
- Both: loading spinners/skeletons, success/error toasts

### Progressive disclosure

- Show only what's relevant to the current context
- Collapse complexity behind expandable sections, sheets, or modals
- Primary action always visible without scrolling

### Error states are first-class

- Never show raw error messages or blank screens
- Every query-driven component has: loading → data → empty → error states
- Error states include a recovery action
- Empty states include guidance

### Accessibility is non-negotiable

- Keyboard/screen-reader support (web) and VoiceOver/TalkBack (mobile)
- Color contrast: 4.5:1 body, 3:1 large text
- Interactive elements: visible focus (web), 44pt hit targets (mobile)
- Semantic roles on all interactive elements

## 5. Shared Anti-Patterns

Bugs and patterns that have burned us. Both agents must avoid these:

| Anti-Pattern                                   | Impact                             | Rule                                                    |
| ---------------------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| `queryData ?? []` in dependency arrays         | Infinite re-render (new array ref) | `useMemo(() => data ?? [], [data])`                     |
| Zustand selector returning new object          | Infinite re-render                 | Use `useShallow` on both platforms                      |
| Hardcoded color values                         | Breaks dark/light mode             | Always use theme tokens from `docs/design/colors.md`    |
| Mutation without `emit()`                      | Lost telemetry, broken audit trail | Every mutation fires `emit()`                           |
| Cross-component state sync via context setters | Render loops                       | Use refs for values that don't need consumer re-renders |
| `any` type                                     | Type safety hole                   | `unknown` + type guards                                 |
| `isDark` prop drilling                         | Couples theme to component tree    | CSS variables auto-switch                               |

## 6. Shared Component Naming

When the same concept exists on both platforms, use consistent naming:

| Concept            | Web Component       | Mobile Component |
| ------------------ | ------------------- | ---------------- |
| Elevated container | `<Card>` (shadcn)   | `<Card>`         |
| Action trigger     | `<Button>` (shadcn) | `<Button>`       |
| Text input         | `<Input>` (shadcn)  | `<Input>`        |
| Status indicator   | `<Badge>` (shadcn)  | `<Badge>`        |
| Modal sheet        | `<Sheet>` (shadcn)  | `<BottomSheet>`  |
| No data display    | Custom empty state  | `<EmptyState>`   |
| Profile image      | Avatar (shadcn)     | `<Avatar>`       |

## 7. Learning Loop Integration

Both agents operate a hypothesis → measure → reflect → solidify loop. The process is identical, metrics are platform-specific.

### Cross-Platform Experiment Protocol

When an experiment produces a broadly applicable insight:

1. **Tag it** `cross-platform: true` in the hypothesis ledger
2. **Add a reference** in the other platform's hypothesis file
3. **Evaluate separately** — what works on mobile may not work on web
4. **Shared wins go here** — proven cross-platform patterns added to section 5 above

### Metric Alignment

| Metric                                | Source       | Shared?                      |
| ------------------------------------- | ------------ | ---------------------------- |
| `time_to_first_interaction_ms`        | PostHog      | Yes                          |
| `rage_click_count` / `rage_tap_count` | PostHog      | Same concept, different name |
| `task_completion_rate`                | engine_event | Yes                          |
| `validation_error_count`              | engine_event | Yes                          |
| `stall_duration_ms`                   | PostHog      | Yes                          |

## 8. Agent Communication Protocol

The two agents communicate through files:

| File                                           | Owner        | Purpose                           |
| ---------------------------------------------- | ------------ | --------------------------------- |
| `docs/agents/SHARED_DESIGN_PRINCIPLES.md`      | Both         | Universal rules, shared learnings |
| `docs/agents/frontend-design/INSTRUCTION.md`   | Web agent    | Web-specific directives           |
| `docs/agents/mobile-design/INSTRUCTION.md`     | Mobile agent | Mobile-specific directives        |
| `docs/agents/frontend-design/LEARNING_LOOP.md` | Web agent    | Web experiment framework          |
| `docs/agents/mobile-design/LEARNING_LOOP.md`   | Mobile agent | Mobile experiment framework       |
| `docs/designprofiler/hypotheses.md`            | Web agent    | Web experiment ledger             |
| `docs/agents/mobile-design/hypotheses.md`      | Mobile agent | Mobile experiment ledger          |

### Before Starting Work (Both Agents)

```
1. Read docs/design/ files relevant to the task
2. Read this file (SHARED_DESIGN_PRINCIPLES.md)
3. Read your platform's INSTRUCTION.md
4. Read your platform's hypotheses / decisions files
5. Check the other platform's recent decisions for cross-platform tags
6. Begin work
```

---

## Changelog

| Date       | Change                                                                                                        | Agent  |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-18 | Initial version — unified principles, token reference, anti-patterns, learning loop                           | Claude |
| 2026-03-26 | Aligned to docs/design/ as single source of truth, removed duplicated token values, added isDark anti-pattern | Claude |
