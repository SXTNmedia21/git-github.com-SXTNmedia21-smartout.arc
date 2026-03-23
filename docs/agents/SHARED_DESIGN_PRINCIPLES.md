---
title: "Shared Design Principles — Web & Mobile"
status: active
updated: 2026-04-18
created: 2026-04-18
module: design
tags: [agent, design-system, frontend-design, mobile-design, shared]
---

# Shared Design Principles — Web & Mobile

> **Canonical reference for both `frontend-designer` and `mobile-designer` agents.**
> Both agents MUST read this file before starting work. Platform-specific rules live in their own INSTRUCTION.md files — this file covers what is universal.

---

## 1. Design Identity: "Ren och Varm" (Clean & Warm)

Smartout's visual identity across all platforms:

- **Premium, not corporate** — Every interface should feel intentional, not generated. The bar is Linear, Vercel, Stripe — never generic B2B software.
- **Warm neutrals, not cold grays** — Tint grays warm (zinc) or contextual (department colors). Dead gray (#808080) is banned.
- **Editorial typography** — Type creates hierarchy before color or borders. Large titles carry confidence. Body text is readable under pressure.
- **Space as design element** — Generous padding is deliberate. Whitespace creates focus and calm. Remove borders before adding more.
- **Depth through subtlety** — Shadows, not hard borders. Gradients, not flat blocks. Blur and opacity, not outline and fill.
- **Brand orange as accent** — `brandOrange: #e85c0d` is the shared accent across both platforms. Used for active states, primary CTAs, and attention draws.

## 2. Shared Design Tokens

Both platforms consume from `@smartout/design-tokens`:

| Token   | Web (CSS)                            | Mobile (Native)                               |
| ------- | ------------------------------------ | --------------------------------------------- |
| Colors  | `@smartout/design-tokens` → CSS vars | `@smartout/design-tokens/native` → hex values |
| Radius  | CSS `var(--radius-*)`                | `nativeTheme.radius.*`                        |
| Spacing | CSS `var(--spacing-*)`               | `nativeTheme.spacing.*`                       |

**The design-tokens package is the single source of truth.** When a value changes, it must change in the package — never overridden locally.

### Color Semantics (Universal)

| Role                                | Token                  | Usage   |
| ----------------------------------- | ---------------------- | ------- |
| `background`                        | Page/screen background |         |
| `foreground`                        | Primary text           |         |
| `card` / `cardForeground`           | Elevated container     |         |
| `primary` / `primaryForeground`     | Primary actions        |         |
| `secondary` / `secondaryForeground` | Secondary actions      |         |
| `muted` / `mutedForeground`         | Disabled, hints        |         |
| `border`                            | Dividers (subtle!)     |         |
| `destructive`                       | Dangerous actions      | Red     |
| `success`                           | Positive states        | Green   |
| `warning`                           | Caution states         | Amber   |
| `info`                              | Informational          | Blue    |
| `brandOrange`                       | Brand accent           | #e85c0d |

### Department Colors (Universal)

| Department | Color  | Hex     |
| ---------- | ------ | ------- |
| Kitchen    | Orange | #e85c0d |
| Floor      | Teal   | #14b8a6 |
| Bar        | Purple | #8b5cf6 |
| Event      | Amber  | #d97706 |
| Storage    | Gray   | #6b7280 |

### Status Colors (Universal)

| Status      | Color | Hex     |
| ----------- | ----- | ------- |
| Trainee     | Blue  | #3b82f6 |
| Active      | Green | #22c55e |
| Inactive    | Gray  | #6b7280 |
| Offboarding | Amber | #d97706 |

## 3. Shared Interaction Principles

These apply regardless of platform implementation:

### Feedback is mandatory

- Every user action gets immediate visual feedback
- Web: hover states, focus rings, micro-animations (Framer Motion)
- Mobile: pressed states (opacity + scale), haptic feedback
- Both: loading spinners/skeletons, success/error toasts

### Progressive disclosure

- Show only what's relevant to the current context
- Collapse complexity behind expandable sections, sheets, or modals
- The primary action is always visible without scrolling
- Secondary actions available but not competing for attention

### Error states are first-class

- Never show a raw error message or blank screen
- Every query-driven component has: loading → data → empty → error states
- Error states include a recovery action (retry, go back, contact support)
- Empty states include guidance (what this area shows, how to populate it)

### Accessibility is non-negotiable

- Keyboard/screen-reader support (web) and VoiceOver/TalkBack support (mobile)
- Color contrast ratios: 4.5:1 body, 3:1 large text
- Interactive elements: visible focus (web), 44pt hit targets (mobile)
- Semantic roles on all interactive elements

## 4. Shared Component Naming

When the same concept exists on both platforms, use consistent naming:

| Concept            | Web Component       | Mobile Component                                  |
| ------------------ | ------------------- | ------------------------------------------------- |
| Elevated container | `<Card>` (shadcn)   | `<Card>` (`components/ui/Card.tsx`)               |
| Action trigger     | `<Button>` (shadcn) | `<Button>` (`components/ui/Button.tsx`)           |
| Text input         | `<Input>` (shadcn)  | `<Input>` (`components/ui/Input.tsx`)             |
| Status indicator   | `<Badge>` (shadcn)  | `<Badge>` (`components/ui/Badge.tsx`)             |
| Modal sheet        | `<Sheet>` (shadcn)  | `<BottomSheet>` (`components/ui/BottomSheet.tsx`) |
| No data display    | Custom empty state  | `<EmptyState>` (`components/ui/EmptyState.tsx`)   |
| Profile image      | Avatar (shadcn)     | `<Avatar>` (`components/common/Avatar.tsx`)       |
| Signal/metric card | `<SignalCard>`      | _(not yet built)_                                 |

New components should follow this naming convention. If you build something on one platform, check if the sibling needs it too.

## 5. Shared Anti-Patterns

Bugs and patterns that have burned us. Both agents must avoid these:

| Anti-Pattern                                   | Impact                                          | Rule                                                    |
| ---------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| `queryData ?? []` in dependency arrays         | Infinite re-render (new array ref every render) | `useMemo(() => data ?? [], [data])`                     |
| Zustand selector returning new object          | Infinite re-render                              | Use `useShallow` on both platforms                      |
| Hardcoded color values                         | Breaks dark/light mode                          | Always use theme tokens                                 |
| Mutation without `emit()`                      | Lost telemetry, broken audit trail              | Every mutation fires `emit()`                           |
| Cross-component state sync via context setters | Render loops                                    | Use refs for values that don't need consumer re-renders |
| `any` type                                     | Type safety hole                                | `unknown` + type guards                                 |

## 6. Learning Loop Integration

Both agents operate a hypothesis → measure → reflect → solidify loop. The key difference is platform-specific metrics, but the **process** is identical.

### Cross-Platform Experiment Protocol

When an experiment on one platform produces a broadly applicable insight:

1. **Tag it** `cross-platform: true` in the hypothesis ledger
2. **Add a reference** in the other platform's hypothesis file
3. **Evaluate separately** — what works on mobile may not work on web (and vice versa)
4. **Shared wins go here** — proven cross-platform patterns are added to section 5 of this document

### Metric Alignment

| Metric                                | Web Source   | Mobile Source | Shared?                      |
| ------------------------------------- | ------------ | ------------- | ---------------------------- |
| `time_to_first_interaction_ms`        | PostHog      | PostHog       | Yes                          |
| `rage_click_count` / `rage_tap_count` | PostHog      | PostHog       | Same concept, different name |
| `task_completion_rate`                | engine_event | engine_event  | Yes                          |
| `validation_error_count`              | engine_event | engine_event  | Yes                          |
| `stall_duration_ms`                   | PostHog      | PostHog       | Yes                          |
| `session_duration_ms`                 | PostHog      | PostHog       | Yes                          |

### Reflection Sync

After either agent completes a reflection:

- If the learning is cross-platform: update this file's anti-patterns or principles
- If the learning is platform-specific: keep it in the platform's own docs
- Monthly: both agents review this file for staleness

## 7. Agent Communication Protocol

The two agents don't run simultaneously, but they communicate through files:

| File                                            | Owner        | Purpose                                 |
| ----------------------------------------------- | ------------ | --------------------------------------- |
| `docs/agents/SHARED_DESIGN_PRINCIPLES.md`       | Both         | Universal rules, shared learnings       |
| `docs/agents/frontend-design/INSTRUCTION.md`    | Web agent    | Web-specific directives                 |
| `docs/agents/mobile-design/INSTRUCTION.md`      | Mobile agent | Mobile-specific directives              |
| `docs/agents/frontend-design/LEARNING_LOOP.md`  | Web agent    | Web experiment framework                |
| `docs/agents/mobile-design/LEARNING_LOOP.md`    | Mobile agent | Mobile experiment framework             |
| `docs/agents/mobile-design/hypotheses.md`       | Mobile agent | Mobile experiment ledger                |
| `docs/designprofiler/hypotheses.md`             | Web agent    | Web experiment ledger _(to be created)_ |
| `docs/agents/mobile-design/decisions.md`        | Mobile agent | Mobile UI decisions                     |
| `docs/agents/mobile-design/component-ledger.md` | Mobile agent | Mobile component registry               |
| `docs/designprofiler/smartout-modern-dark.md`   | Web agent    | Web aesthetic profile                   |

### Before Starting Work (Both Agents)

```
1. Read this file (SHARED_DESIGN_PRINCIPLES.md)
2. Read your platform's INSTRUCTION.md
3. Read your platform's hypotheses / decisions files
4. Check the other platform's recent decisions for cross-platform tags
5. Begin work
```

---

## Changelog

| Date       | Change                                                                                          | Agent  |
| ---------- | ----------------------------------------------------------------------------------------------- | ------ |
| 2026-04-18 | Initial version — unified principles, token reference, anti-patterns, learning loop integration | Claude |
