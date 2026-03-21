---
title: "Mobile UI Decisions"
status: active
updated: 2026-04-18
created: 2026-04-18
module: ai
tags: [agent, mobile, decisions, design-system]
---

# Mobile UI Decisions

Structural UI decisions made by the mobile-designer agent. Read before starting new work.

<!-- Template:

### DEC-MOB-XXX: [Title]

| Field | Value |
|-------|-------|
| Date | YYYY-MM-DD |
| Context | What prompted this decision? |
| Decision | What was decided? |
| Reason | Why this approach over alternatives? |
| Cross-Platform | true / false |

-->

### DEC-MOB-001: createStyles over raw StyleSheet

| Field          | Value                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date           | 2026-04-18                                                                                                                                                                |
| Context        | Need consistent theme-aware styling across all components                                                                                                                 |
| Decision       | All components use `createStyles((theme) => ({...}))` from `@/theme` — never `StyleSheet.create` directly                                                                 |
| Reason         | Handles dark/light mode automatically, caches per color scheme, provides type-safe theme access. Consistent with the theme system built during Phase 4 of the mobile app. |
| Cross-Platform | false (web uses Tailwind classes)                                                                                                                                         |

### DEC-MOB-002: Haptics on every primary action

| Field          | Value                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Date           | 2026-04-18                                                                                                                                     |
| Context        | Shift workers use the app in noisy environments, often can't hear audio feedback                                                               |
| Decision       | Every button press, punch action, and confirmation triggers `Haptics.impactAsync`. Light for standard, Heavy for destructive.                  |
| Reason         | Tactile feedback is the only reliable feedback channel when a user is in a loud kitchen with wet hands. Visual feedback alone is insufficient. |
| Cross-Platform | false (web has no haptics equivalent)                                                                                                          |

### DEC-MOB-003: useShallow for all Zustand object selectors

| Field          | Value                                                                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date           | 2026-04-18                                                                                                                                                                                                                                   |
| Context        | Infinite re-render loop caused by `useShiftPhase` Zustand selector creating new objects every render                                                                                                                                         |
| Decision       | Any Zustand selector that returns `{ ...fields }` must use `useShallow` wrapper                                                                                                                                                              |
| Reason         | Without `useShallow`, `(s) => ({ a: s.a, b: s.b })` creates a new object reference on every render, triggering infinite re-render loops when combined with useEffect dependencies. Proven by the shift-phase infinite loop bug (2026-04-18). |
| Cross-Platform | true (same pattern applies to web Zustand stores)                                                                                                                                                                                            |

### DEC-MOB-004: retry: 1 on TanStack Query hooks

| Field          | Value                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date           | 2026-04-18                                                                                                                                                                       |
| Context        | Default retry (3) on failing queries caused render storms when combined with Zustand store updates                                                                               |
| Decision       | Mobile query hooks use `retry: 1` to prevent retry storms. Especially critical for queries targeting tables in wrong schemas.                                                    |
| Reason         | time_entry query targets `public` schema but table is in `timesheet` schema. Each retry triggers re-render → Zustand update → more re-renders. Single retry limits blast radius. |
| Cross-Platform | true (same risk exists in web TanStack Query hooks)                                                                                                                              |
