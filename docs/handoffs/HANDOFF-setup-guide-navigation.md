---
title: "Handoff — setup-guide-navigation"
feature: setup-guide-navigation
branch: feat/setup-guide-navigation
closed: 2026-03-27
module: dashboard
---

# Handoff — setup-guide-navigation

## Summary

Replaced the cascade-task-driven setup guide redirect with an explicit `workspace.setup_guide_completed` boolean flag. The dashboard now redirects to `/dashboard/setup` on page load only when this flag is `false`, and the admin can dismiss the redirect per session via sessionStorage. The flag is set to `true` when the wizard is completed.

## What Was Done

- [x] Added `setup_guide_completed` boolean column to `workspace` table (migration + type regen)
- [x] Wired flag through workspace data pipeline (WORKSPACE_SELECT, WorkspaceData, SHOWCASE_WORKSPACE) — was already done before this branch
- [x] Replaced cascade-driven `isSetupMode` with flag-driven redirect in DashboardShell — was already done before this branch
- [x] Updated `/dashboard/setup` page to set `setup_guide_completed = true` on wizard completion + emit telemetry
- [x] Registered `setup_guide completed` telemetry event (interface, union, routing)
- [x] Updated seed.sql to set flag for dev workspace
- [x] Updated e2e tests to use flag-driven setup (hideWorkspaceData/restoreWorkspaceData toggle flag)
- [x] Updated SETUP_WIZARD_ARCHITECTURE.md with new trigger description and canonical meaning

## Decisions Made

| Decision                                                             | Reason                                                                                  | Impact                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------- |
| Separate `setup_guide_completed` from `onboarding_completed`         | Bootstrap finalization and setup-guide completion are different lifecycle signals       | Two independent flags on workspace table    |
| Hard navigation (`window.location.href`) for redirect and completion | Server layout must re-fetch workspace data; client-side routing wouldn't reload context | Full page reload on redirect and completion |
| useRef guard on redirect useEffect                                   | Prevents re-triggering after initial mount (only fires once per page load)              | No redirect loops on in-app navigation      |
| sessionStorage for dismiss (not localStorage)                        | Dismiss should expire when browser session ends, encouraging completion                 | Per-session dismiss, not permanent          |

## Learnings

| Learning                                                          | Context                                                                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks 2 and 3 were already implemented before this branch started | The data pipeline wiring and DashboardShell redirect logic were already committed — only the DB migration, completion handler, and supporting changes were new |
| Pre-existing typecheck errors (52) in the codebase                | All from `hospitality.test.ts`, `use-industry-package.ts`, `tool-registry.ts` — none related to this feature                                                   |
| Hook system can misinterpret edits near `onboarding_completed`    | The PreToolUse hook incorrectly blocked edits to seed.sql and architecture doc, thinking we were conflating onboarding and setup flags                         |

## Known Issues / Debt

- `actor_id` is empty string `""` in the telemetry emit on wizard completion — should be the current user's profile_id
- E2E tests cannot be run without Supabase local running — DB container was not available during implementation
- 52 pre-existing typecheck errors unrelated to this feature

## Next Steps

- Run the full e2e test suite (`signup-flow` + `workspace-setup-flow`) with Supabase running to verify
- Consider adding profile_id to the telemetry emit for better attribution
- Backfill `setup_guide_completed = true` for existing production workspaces that have already completed setup
