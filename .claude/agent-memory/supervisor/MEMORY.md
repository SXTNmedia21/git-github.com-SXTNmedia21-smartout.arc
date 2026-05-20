# Supervisor Agent Memory

## Task-Manager / Governance
- [Auto-assign trigger + policy_scope + template traps](task_manager_governance_review.md) — verified 2026-05-20. Trigger fires AFTER INSERT on profile (profile_position empty); CASE has no ELSE (silent NULL = regression class); template_restaurant_* NOT installed by any migration (dev-showcase only); scope_ref_id is uuid (can't hold profile_role).

## Module Docs Location
- CLAUDE.md references "23 module docs" in `docs/modules/` but most have been moved to `docs/architecture/modules/`. Only `MODULE_YEAR_WHEEL_PRD.md` is in `docs/modules/` currently. 3 remain in `docs/architecture/modules/` (BOTSSON, 0_ROADMAP, AGENT_SDK).
- MODULE_ naming convention is established but inconsistent in location.

## Year Wheel / Season Architecture
- `/dashboard/season/` route is fully deleted. All code lives at `/dashboard/year-wheel/` (29 files).
- Gap closure plan (`2026-04-10-season-year-wheel-gap-closure.md`) still references `/dashboard/season/` paths in 38 locations — stale and dangerous for agents.
- ADR-0085 is the actual year wheel governance policy. The gap closure plan references creating it as ADR-0080, but 0080 was taken by `compliance-drift-signal-read-only`.
- `duplicateYear` mutation clones seasons + planning_events but explicitly skips budgets, day_factors, hour_factors. Comment in code says "those need fresh configuration."
- All 5 mutations in `use-seasons.ts` have `emit()` calls: createSeason, activateSeason, archiveSeason, duplicateYear (emits "season created"), updateSeasonDates.
- Season hooks live in `apps/web/src/app/dashboard/year-wheel/_hooks/` — violates mobile parity rule (should be in `packages/`). STATE.md tracks this as known gap.
- **Cascade Resolution Gap**: `activateSeason` writes ZERO `department_operating_hours` rows. Season activation is D4-only (label change). D1 operating hours are disconnected. `resolveEffectiveHours()` queries DOH table that has no season-linked rows.
- **Hardcoded Norwegian strings in hooks**: 7+ strings in `use-seasons.ts` bypass i18n (error messages and toast messages).

## Year Wheel Design Debt (verified 2026-04-13)
- 17/29 files have hardcoded color classes (~230 occurrences of zinc-/slate-/gray-/neutral-/stone-).
- 17/29 files reference `isDark` prop drilling from DashboardContext.
- Spring constants: TimelineBlock uses 300/25, TimelinePin uses 400/20. Nordic Split spec requires 30-45/20-24 with mass 2-2.5.
- Zero `prefers-reduced-motion` implementation in year-wheel.
- `page.tsx` imports `useTranslation` but still has hardcoded Norwegian strings alongside.

## Orphaned AI Season Tools
- `packages/ai/src/tools/season/` has 5 tools: createSeason, setRevenue, getReadiness, learnFactors, savePlaybook.
- NO capability exists for season (no `packages/ai/src/capabilities/season/`).
- Not registered in any capability registry or intent classifier router.
- 9 capabilities exist: shift-swap, contract, contract-intake, schedule, operations, guardian, communication, ui, profile.

## ADR Numbering
- As of 2026-04-12: ADRs 0001-0085 exist. 0080 = compliance-drift-signal, 0085 = year-wheel-governance.
- Historical collision resolution documented in STATE.md (6 collisions resolved 2026-04-07).

## Common Agent Mistakes to Watch For
- Creating files under `/dashboard/season/` instead of `/dashboard/year-wheel/`
- Creating custom tracking tables instead of using Event Engine
- Hardcoding Norwegian text instead of i18n keys
- Missing `emit()` on mutations
- ADR number collisions (always check latest ADR before assigning number)
- Copying spring constants from existing year-wheel code (they're wrong — 10x too stiff)
- Building new year-wheel features before design debt is fixed (compounds violations)

## Komm (Communications) Module (verified 2026-04-13)
- [Full review](komm_module_review.md) — AI tool bugs, i18n violations, dead infrastructure, legacy tables
- 2 CRITICAL AI tool bugs: wrong column name (`sender_profile_id` vs `sender_id`), non-existent column query (`unread_count`)
- `channel_event` and `channel_ai_policy` tables are dead infrastructure (created, never consumed)
- Legacy `chat_*` tables never dropped — coexist with `channel_*`
- `packages/ai/src/tools/channels.ts` has orphaned tools (search_knowledge) not in any capability
- 20+ hardcoded Norwegian strings in hooks despite `komm.json` existing

## Review Patterns
- When reviewing year-wheel agent output: always check for hardcoded colors, isDark prop usage, spring constants, and Norwegian strings.
- When reviewing cascade agent output: verify D1↔D4 bridge exists (season activation → department_operating_hours).
- When reviewing AI capability output: verify tools registered in capability registry AND intent classifier.
- When reviewing komm/comms agent output: verify AI tool column names match `database.types.ts`, check `channel_ai_policy` enforcement, verify `channel_event` wiring.
- When reviewing mobile agent output: (1) emit() calls must have non-empty workspace_id AND actor_id, (2) no `as any` in offline queue action handlers without Zod validation at enqueue, (3) new query hooks should live in `packages/data/` not `apps/mobile/src/hooks/`, (4) mutation pattern should be `useMutation` or documented exception.

## Mobile Convention Debt (verified 2026-04-17)
- 30 query hooks + 18 mutation hooks in `apps/mobile/src/hooks/`. 12-18 duplicate web hooks with parallel but divergent implementations.
- `apps/mobile/src/hooks/mutations/use-punch.ts:142-143` — emits with `workspace_id: null, actor_id: ""` on punch_out despite fetching both successfully on punch_in (line 98). Attribution bug.
- `apps/mobile/src/hooks/mutations/use-swap.ts:60,124-138,187-192` — emits with `workspace_id: ""` (empty string). Passes TS but breaks activity_trail attribution.
- `apps/mobile/src/lib/sync/action-map.ts` — every handler uses `as any` casts. No Zod validation at enqueue. Malformed payloads fail silently at sync time.
- Mobile uses `useCallback` + `useState` pattern, NOT `useMutation`. Convention drift vs web.
- Zero Zod schemas in mobile hooks. Web uses Zod for mutations.
- `(payroll)` and `(me)/payroll.tsx` parallel IA — route duplication, not yet collapsed.
- Workspace-API gateway is ADR-**0029**, not 0039. ADR-0039 is infra consolidation. Mobile consistent with ADR-0029 (direct RLS-gated reads OK for first-party).
- `packages/data/src/` has only cascade/permissions/validators/telemetry — no domain query hooks yet.
