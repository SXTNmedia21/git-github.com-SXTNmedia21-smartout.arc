---
title: Decision Log
status: in_progress
updated: 2026-03-26
created: 2026-03-26
module: onboarding
tags: [decisions]
---

# Decision Log — onboarding-cleanup

| #   | Date       | Decision                                                                                                                                                        | Status   |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-26 | Delete showcase/ (dead code, 44 files, 2000+ lines)                                                                                                             | accepted |
| 2   | 2026-03-26 | Server-side re-entry guard in layout.tsx (not middleware) to avoid DB query on every request                                                                    | accepted |
| 3   | 2026-03-26 | Zod schemas for Botsson tools in dedicated file (tool-schemas.ts) rather than inline                                                                            | accepted |
| 4   | 2026-03-26 | brandPanel i18n via key resolution in renderBrandPanel (no WizardShell type change needed)                                                                      | accepted |
| 5   | 2026-03-26 | Unified redirect via lib/redirect.ts using NEXT_PUBLIC_ROOT_DOMAIN env var                                                                                      | accepted |
| 6   | 2026-03-26 | Easing constants added to design-tokens (easingExpo + array variants)                                                                                           | accepted |
| 7   | 2026-03-26 | Design system renamed "Ren og Varm" → "Nordic Split" in CLAUDE.md + landing page; filename ren-og-varm-styleguide.html retained to avoid broken path references | accepted |
| 8   | 2026-03-26 | tokens.css dark mode corrected to warm OKLCH (hue 50-60); tokens.ts and tokens.css must always be updated together                                              | accepted |
| #   | Date       | Decision                                                                                                                                                        | Status   |
| --- | ---------- | --------------------------------------------------------------------------------------------                                                                    | -------- |
| 1   | 2026-03-26 | Delete showcase/ (dead code, 44 files, 2000+ lines)                                                                                                             | accepted |
| 2   | 2026-03-26 | Server-side re-entry guard in layout.tsx (not middleware) to avoid DB query on every request                                                                    | accepted |
| 3   | 2026-03-26 | Zod schemas for Botsson tools in dedicated file (tool-schemas.ts) rather than inline                                                                            | accepted |
| 4   | 2026-03-26 | brandPanel i18n via key resolution in renderBrandPanel (no WizardShell type change needed)                                                                      | accepted |
| 5   | 2026-03-26 | Unified redirect via lib/redirect.ts using NEXT_PUBLIC_ROOT_DOMAIN env var                                                                                      | accepted |
| 6   | 2026-03-26 | Easing constants added to design-tokens (easingExpo + array variants)                                                                                           | accepted |

## nordic-split-design-sync

| #   | Date       | Decision                                                                                                                                                        | Status   |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 7   | 2026-03-26 | Design system renamed "Ren og Varm" → "Nordic Split" in CLAUDE.md + landing page; filename ren-og-varm-styleguide.html retained to avoid broken path references | accepted |
| 8   | 2026-03-26 | tokens.css dark mode corrected to warm OKLCH (hue 50-60); tokens.ts and tokens.css must always be updated together                                              | accepted |

| #   | Date       | Decision                                                                                                                | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-26 | Use LocationPopover (not DepartmentPopover) for mal-modus — codebase already uses LocationPopover pattern               | accepted |
| 2   | 2026-03-26 | Two-step task query instead of PostgREST join — avoids unreliable implicit join with nullable FKs                       | accepted |
| 3   | 2026-03-26 | Manual getISOWeek instead of date-fns — avoids adding dependency for one function                                       | accepted |
| 4   | 2026-03-26 | Hardcoded 230 NOK/hr for cost display — display-only estimate, TODO: fetch from season_budget                           | accepted |
| 5   | 2026-03-26 | Promise-based confirmation dialog in AgentProposalsContext — not a separate hook, keeps state co-located with proposals | accepted |
| 6   | 2026-03-26 | Ghost tags use desaturated oklch variants of employee tag colors — visually distinct but same color family              | accepted |
| 7   | 2026-03-26 | templateShiftId optional on ShiftProposalCreate — backward compatible with daily grid proposals                         | accepted |

updated: 2026-03-27
created: 2026-03-26
module: dashboard
tags: [decisions]

---

# Decision Log — cascade-task-surface

| #   | Date       | Decision                                                                                                                      | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-26 | No i18n for Phase 1 dashboard components — existing dashboard uses hardcoded Norwegian, keep consistent                       | accepted |
| 2   | 2026-03-26 | DepartmentBreakdown uses own query instead of modifying useOperationsData — avoids breaking existing aggregated data contract | accepted |
| 3   | 2026-03-26 | DailyStatusBar Phase 1 only shows reconciliation live data — schedule publish + stress level require Phase 3 wiring           | accepted |

## mobile-production-readiness

| #   | Date       | Decision                                                                                                               | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| 8   | 2026-03-26 | Authority default `read_only` (not `suggest`) — align agent-router with tool-selector for v1.0 employee-only release   | accepted |
| 9   | 2026-03-26 | Net-new schedule capability tools — existing tools/schedule/definitions.ts are Ultravox client-side, not wrappable     | accepted |
| 10  | 2026-03-26 | Deep link map in shared @smartout/notifications package — single source of truth for backend + mobile                  | accepted |
| 11  | 2026-03-26 | FAB tap=voice, long-press=text — voice as primary mobile interaction, QuickActions moved to hub priority cards         | accepted |
| 12  | 2026-03-26 | Per-workspace authority in v1.0 — per-role authority deferred to v1.1 (requires engine_authority_config schema change) | accepted |

## onboarding-review

| #    | Date       | Decision                                                                                                                                       | Status   |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 13   | 2026-03-27 | Kill showcase/ — delete entire `apps/web/src/app/onboarding/showcase/` directory (~44 files, ~2000 lines). Step-based wizard is the only path. | accepted |
| 14   | 2026-03-27 | Add `emit()` to workspace finalization in `wizard-definition.ts:onComplete()` — most critical mutation has zero telemetry                      | accepted |
| 15   | 2026-03-27 | Fix or remove `saveMemory` tool — silently fails 401 during onboarding because user has no account yet                                         | accepted |
| 16   | 2026-03-27 | Add server-side finalization guard — Zod validation on minimum required data + idempotency on workspace creation                               | accepted |
| 17   | 2026-03-27 | Add Zod validation on all 14 Botsson voice tool parameters — align with `@smartout/ai` convention                                              | accepted |
| 18   | 2026-03-27 | Unify redirect to `/dashboard/setup` per SETUP_WIZARD_ARCHITECTURE.md — WizardContext redirect to `/dashboard` was wrong                       | accepted |
| 0062 | 2026-03-27 | Industry Intelligence Consolidation — 3 copies to 1 canonical source in packages/ai/src/industry/, types in packages/types, I1 bootstrap scope | accepted |
| #    | Date       | Decision                                                                                                                                       | Status   |
| ---  | ----       | --------                                                                                                                                       | ------   |
