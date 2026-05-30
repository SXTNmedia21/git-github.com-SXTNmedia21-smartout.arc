# Supervisor Agent Memory

## Task Tables (Task Ontology)
- e2e seed-helper drift (verified 2026-05-29, J1 review): `session_task` has NEITHER `priority` NOR `task_type` (DDL 20260412100300_session_infrastructure.sql + types.ts:18475-18494). Seed helpers in apps/e2e insert both. Removing only `priority` leaves `task_type` as next CI-red (L-0348 one-col-at-a-time class, 4th occurrence). Real session_task cols: assigned_to/completed_*/day_line_id/department_session_id/description/evidence/generated_by/id/is_compliance_required/origin/scheduled_at/session_hook_id/source_reference/status/title/workspace_id.
- `schedule_day_task` real cols: label(NOT title), shift_date(NOT task_date), task_status(NOT status), category, highlight, schedule_day_task_id PK(NOT id). NO department_id/priority/status. sortie-p0 T3 insert had 5 wrong cols.
- FALSE-GREEN test pattern: sortie-p0-fix-sweep-task-complete-source.spec.ts T3 (~line 286) does `test.skip(true, "table may not exist")` on insert FAILURE — table exists, insert is malformed → test never executes, never goes red, claims day_ad_hoc→200 coverage it doesn't have. Watch for test.skip on seed-error: it converts column drift into fabricated coverage. Fix = correct cols OR change skip→throw.
- [4 task-table consolidation blast radius](task_table_consolidation.md) — verified 2026-05-22. session_task=65 src files/20 migs (cascade D6, day_line FK, 2 crons); other 3 tiny. PK convention split (id vs {table}_id); 3 incompatible status types; dual union (fn_list_my_tasks RPC + list_mine TS tools.ts:144-207) must co-change. Verdict: approve C2 merge standalone, reject bundled 4→2 (70% cost is code churn unaffected by empty DB), D6 fights ADR-0367.

## Task-Manager / Governance
- [Auto-assign trigger + policy_scope + template traps](task_manager_governance_review.md) — verified 2026-05-20. Trigger fires AFTER INSERT on profile (profile_position empty); CASE has no ELSE (silent NULL = regression class); template_restaurant_* NOT installed by any migration (dev-showcase only); scope_ref_id is uuid (can't hold profile_role).

## Botsson AI Composer (shared surface)
- [No precedent for feature buttons in AI composer](botsson_composer_precedent.md) — verified 2026-05-22. procedure-engine-2b was FIRST to add a button (Camera, photo→routine) to BotssonSheet.tsx text-mode row. channel-chat MessageInput.tsx:281 Camera is a DIFFERENT surface (attach-to-message), NOT precedent. Pontus taste-rejected despite spec §6/§14 approval: icon collision + persistent manager-only fixture, no role gate. Adding a button to the AI composer = PATTERN DECISION; require precedent/ADR + role-gate + visual distinction. ADR-0394 authorizes the FLOW, not the placement.

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

## Billing / Invoice Cron (verified 2026-05-20)
- [Full review](billing_cron_review.md) — cron-pattern split, stuck-draft trap, no watchdog, phantom telemetry
- generate-monthly-invoices uses external n8n; dunning (same billing engine) uses pg_cron+engine_event. Inconsistency = Fase-1 drift. House style = pg_cron+engine_event.
- Stuck-draft bug: per-company insert→lineitems→issue is NON-transactional. Die mid-sequence → re-fire early-exits on the draft row → company permanently skipped with header-only invoice. Fix = wrap in SECURITY DEFINER RPC.
- Zero billing missing-run watchdog (ops-monitor has no billing refs). n8n silent fail = undetected.
- `invoice sent` + `invoice voided` registry events have NO emit-sites (phantom per ADR-0358).
- Runbook `docs/runbooks/billing-monthly-cron-n8n.md` (cited index.ts:4) does not exist.

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
