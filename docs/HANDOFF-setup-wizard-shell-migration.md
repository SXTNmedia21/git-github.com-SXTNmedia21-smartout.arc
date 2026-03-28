---
title: "Handoff — setup-wizard-shell-migration"
feature: setup-wizard-shell-migration
branch: feat/setup-wizard-shell-migration
closed: 2026-03-28
module: dashboard
---

# Handoff — setup-wizard-shell-migration

## Summary

Migrated `/dashboard/setup` from a 665-line legacy `WorkspaceSetupWizard` to `AnimatedWizardShell` + `dashboardSetupWizard` definition, matching the pattern used by `/join` and `/onboarding`. Also fixed shared wizard infrastructure: `loadState` was declared on `WizardDefinition` but never called by `useWizardState` — now wired for all 3 wizards.

## What Was Done

- [x] Wire `loadState` into `useWizardState` (shared infra — benefits /join, /onboarding, /dashboard/setup)
- [x] Add `onStepLeave` callback to `WizardStepDef` type
- [x] Implement `loadState` for setup wizard (queries company, company_details, opening_hours, social_media)
- [x] Implement `onComplete` with all business logic (flag update, invitations, K1b ingestion, redirect)
- [x] Add `sendTeamInvitations` with idempotent DB-check logic
- [x] Create `SetupStepHeader` component (title, subtitle, explanation, BotsTip)
- [x] Add brand panel messages for all 9 steps (i18n, nb + en)
- [x] Update all 9 adapters to render `SetupStepHeader` with botssonTip
- [x] Swap `page.tsx` to trivial shell with escape hatch
- [x] Compute `_initialStepIndex` from module completion status
- [x] Fix `handleBack` to await `rawBack()` (latent async bug)
- [x] Fix Norwegian i18n characters (å/ø/æ)
- [x] Delete legacy `WorkspaceSetupWizard.tsx` (-665 lines)

## Decisions Made

| Decision                                                               | Reason                                                                                            | Impact                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Keep per-route pages (not /wizard/[id])                                | Auth boundaries (public/auth/auth+workspace), TypeScript generics, layout trees                   | All 3 wizards stay as separate pages with shared shell |
| definition.onComplete = business logic, useWizardTelemetry = telemetry | Prevents double-emit, establishes clear contract                                                  | All future wizards must follow this pattern            |
| Wire loadState into useWizardState                                     | Was dead code across all 3 wizards — type declared but never called                               | /join and /onboarding loadState now actually runs      |
| Preserve BotsTip via SetupStepHeader (not WalkAi)                      | BotsTip contains regulatory content (tariffs, Mattilsynet) — WalkAi is DOM tags, not visible help | Each adapter renders inline guidance                   |
| Team invitations idempotent via DB check                               | Cleaner than state flag — works on step leave AND completion without mutation                     | No \_invitationsSent flag needed                       |

## Learnings

| Learning                                                                                      | Context                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optional properties in TS types can be dead code systemically                                 | `loadState?` was defined on WizardDefinition and implemented by 3 wizards, but `useWizardState` never called it. TypeScript doesn't warn. Always grep for call sites.                        |
| Migration specs should be written backward (from old behavior) not forward (desired behavior) | We missed step headers, BotsTip, skip behavior, and smart initial step because the spec described the new system without mapping the old system's side effects. Council caught all of these. |
| Council catches infrastructure blind spots                                                    | Steward found loadState was dead, Frontend found header regression, Agent Coord caught BotsTip = regulatory. No single agent would have caught all of these.                                 |

## Known Issues / Debt

- Hardcoded `stepIndex` and `totalSteps={9}` in adapters — fragile if steps are reordered/added
- `useEffect` empty deps `[]` in useWizardState may trigger ESLint exhaustive-deps (functionally safe via ref guard)
- K1b knowledge drifts after wizard — no re-ingestion trigger on dashboard CRUD for policies/protocols/handbook
- Escape hatch navigates to /dashboard which redirects back if `setup_guide_completed` is false — user must use DashboardShell session dismiss

## Next Steps

- Test the full wizard flow visually (all 9 steps + completion)
- Verify brand panel renders correctly with `theme: "light"`
- Consider adding `stepIndex` / `totalSteps` to `WizardStepProps` to eliminate hardcoded values
- Track K1b re-ingestion triggers as separate feature
