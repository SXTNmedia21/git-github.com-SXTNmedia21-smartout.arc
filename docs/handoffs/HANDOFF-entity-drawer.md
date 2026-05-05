---
title: "Handoff — entity-drawer"
feature: entity-drawer
branch: feat/entity-drawer
closed: 2026-03-27
module: dashboard
---

# Handoff — entity-drawer

## Summary

Added a hybrid sheet/pin entity drawer to DashboardShell. Clicking cascade task rows now opens an inline context panel instead of navigating to a full page. Phase 1 supports cascade_task and department entity types. The drawer uses its own isolated context (separate from DashboardContext) to avoid re-rendering 170+ consumers.

## What Was Done

- [x] Registered 4 telemetry events (opened, closed, pinned, tab_switched)
- [x] Added 28 i18n keys (nb + en) for drawer UI
- [x] Created EntityDrawerContext with open/close/pin/tab state, localStorage persistence, route cleanup, mobile resize handler
- [x] Created EntityDrawer shell with sheet mode (overlay from right) and pinned mode (inline split-panel)
- [x] Created CascadeTaskTab showing task context, urgency, dimension, action button
- [x] Created DepartmentDetailTab showing status, manager, hours, employee count
- [x] Integrated EntityDrawerProvider into DashboardShell content area
- [x] Converted TodoTaskCard from full-page navigation to compact rows opening the drawer
- [x] Fixed council review blockers: actor_id, i18n, pin state, dead code

## Decisions Made

| Decision                                                           | Reason                                                                                                   | Impact                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Separate EntityDrawerProvider from DashboardContext                | DashboardContext has 28 fields and 170+ consumers; drawer state changes would re-render entire dashboard | New pattern: isolated context for UI panels that change frequently |
| Use department_operating_hours (not workspace_operating_hours)     | workspace_operating_hours table doesn't exist; CLAUDE.md mandates department_operating_hours             | Correct table for D1 dimension hours data                          |
| Pin state persists in localStorage, preserved across route changes | Pin is a layout preference, not per-page state; route change closes drawer but keeps pin mode            | Consistent UX: pinned users always get pinned mode                 |

## Learnings

| Learning                                                    | Context                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DashboardShell's 170+ consumers make adding state expensive | Any new state added to DashboardContext triggers re-renders across the entire dashboard. Future panels/overlays should follow the isolated provider pattern. |
| Plan referenced non-existent table                          | The implementation plan used workspace_operating_hours which doesn't exist. Always verify table names against database.types.ts before implementing.         |
| Council review caught 4 blocking issues in ~30 min          | actor_id audit trail corruption, hardcoded strings, pin/localStorage drift, and dead code were all caught by multi-agent review before merge.                |

## Known Issues / Debt

- 31 hardcoded color instances (white/[0.XX], oklch, orange-500) should be semantic CSS variables — logged for follow-up PR
- Inactive tab contrast (white/40) likely fails WCAG AA — needs bump to white/60 or text-muted-foreground
- Missing focus trap in sheet mode — keyboard users can tab behind the modal
- Touch targets 28px (pin/close buttons) — below 44px WCAG minimum
- Mobile width clamping incomplete — 380px on 375px viewport uses max-w-[90vw] fallback
- No aria-pressed on pin toggle button
- EntityType union has 7 values but only 2 have tab implementations (cascade_task, department)
- DepartmentDetailTab manager query is sequential after Promise.all (minor perf)

## Next Steps

- Follow-up PR: Replace hardcoded colors with CSS variable tokens (S1)
- Follow-up PR: Accessibility fixes — focus trap, touch targets, contrast, aria-pressed (S2-S6)
- Add more entity type tabs: profile, team, shift (Phase 2)
- Consider ADR for EntityDrawerProvider isolation pattern
- Consider agent-to-drawer bridge via ui_command WebSocket (when agent integration needed)
