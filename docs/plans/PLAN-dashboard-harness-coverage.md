---
title: "Plan — dashboard-harness-coverage"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: botsson
tags: [plan, dashboard, harness, botsson, useregistertools, c4-authority, page-polish]
---

# Plan — dashboard-harness-coverage

> Branch: `feat/dashboard-harness-coverage` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-2` | Base: `development` | Module: botsson | Started: 2026-05-14

## Context

Pre-existing map: `.claude/page-polish/dashboard-overview.run.yml` (2026-04-29) inventoried `/dashboard` (variants oversikt/strategic/reconciliation/activity/todo):

- 11 server actions defined under `apps/web/src/app/dashboard/_actions/` (transitionSession, openSession, signoffSession, pinDayControlContext, addShift, manualTimeEntry, addTask, toggleSessionTask, sendBroadcast, activateSeason, archiveSeason, duplicateSeason)
- 0 `useRegisterTools` calls across WebDayControl + 6 tabs + 4 variant views + 5 supporting cards
- emit() audit on 11 actions: NOT YET COMPLETE
- Botsson can answer "what page am I on?" via engine_memory pin but cannot OPERATE the page

Result: most-used dashboard surface is invisible to harness. Manager voice questions fall through to `query_smartout` (5-15s latency per ADR-0297 baseline) or "I don't know" replies.

## Goal

Wire Botsson harness coverage on `/dashboard` (all 5 variants): 18 tools (7 read + 8 write + 3 nav) registered via `useRegisterTools` per variant scope, with C4 authority gates on every write tool, emit() on every server action, and site-map.json reflecting full tool inventory. After ship: voice manager can ask "kor mange er på vakt?", "start dagen", "vis avstemming", "lås dagen" — Botsson picks correct tool, no `query_smartout` fallback.

## Hard Constraints

1. **Scope: `/dashboard` variants only.** Do not touch other dashboard sub-routes (schedule, payroll, governance, etc).
2. **ADR-0204 C4 authority gates** on every write tool. Use `gatedMutation` helper. Server actions remain authoritative — tool wrappers thin.
3. **ADR-0151 server-derived workspace_id.** No tool accepts workspace_id from caller args.
4. **ADR-0078 voice-channel restriction.** `sendBroadcast` priority 1/2 voice-restricted.
5. **ADR-0238 surface ownership** — /dashboard does NOT host embedded chat surface (per dashboard-overview.run.yml). owns_chat_surface stays false.
6. **No new dependencies.**
7. **No edits to `apps/web/src/app/Botsson/_components/tool-registry.ts`** core — only consumers (page-tools-bridge files per variant).
8. **Telemetry registry read-only** for this sortie. If event not yet registered → escalate, do not silently add.
9. **Lighthouse measurement deferred** — dev server availability not guaranteed. Coordinator-level follow-up.

## Re-baseline 2026-05-14

Phase 1 + Phase 2 audit revealed prior work shipped since 2026-04-29 plan baseline:

- ✅ **Phase 1 closed:** 12 server actions audited, all emit() compliant, all workspace_id auth-derived (ADR-0151), all event names registered. Zero patches needed.
- ✅ **Phase 2 partial:** `apps/web/src/components/day/_tools/oversikt-tools-bridge.tsx` + `use-oversikt-tools.ts` shipped with 6 of 7 read tools. `getCascadeMustDo` NOT shipped (useCascadeTasks not wired into bridge).
- ✅ **Sibling routes shipped (out-of-sortie):** /dashboard/schedule, /dashboard/calendar, /dashboard/komm, /dashboard/help (3 scopes).

Remaining scope:

- Phase 2.1 — `getCascadeMustDo` read tool added to use-oversikt-tools.ts
- Phase 3 — 8 write tools on oversikt + C4 gates
- Phase 4 — 3 nav tools
- Phase 5 — variant bridges: strategic, reconciliation, activity, todo
- Phase 6 — site-map + verify

## Phases — original spec retained for reference; closed phases marked DONE

### Phase 1 — emit() audit (sonnet sub-agent) — DONE 2026-05-14
Audit each of 11 server actions in `apps/web/src/app/dashboard/_actions/*.ts` for `emit()` calls. For each missing emit():
- Confirm event name exists in `packages/telemetry/src/registry.ts`. If missing → escalate.
- Patch action body to call `emit()` after DB write with correct payload (workspace_id from auth context, never body).

Output: diff per action + list of registry gaps.

### Phase 2 — Read-tools bridge for oversikt (sonnet sub-agent) — DONE (6 of 7) 2026-05-08 (prior sortie)

Shipped at `apps/web/src/components/day/_tools/oversikt-tools-bridge.tsx` (NOT the path in original plan). Path corrected. 6 of 7 read tools registered. `getCascadeMustDo` deferred to Phase 2.1 below.

### Phase 2.1 — getCascadeMustDo read tool (sonnet sub-agent)

Extend `apps/web/src/components/day/_tools/use-oversikt-tools.ts` + `oversikt-tools-bridge.tsx`. Add 7th read tool:
1. `getDaySnapshot` — full day phase + roster + tasks + deviations + budget
2. `getRosterForDay` — staff + role + status (planned/active/completed)
3. `getOpenDeviations` — open + acknowledged + escalated
4. `getSessionTasks` — grouped by hook
5. `getDayBudget` — revenue + labor cost + day_factor
6. `getCascadeMustDo` — cascade-derived urgent items
7. `getDayActivity` — timeline events

Each tool: LLM-facing description (when Botsson should pick it), Zod params schema, handler calling existing hook.

Mount bridge inside WebDayControl `ready` state. Unmount in `loading|no-dept|no-session` (Botsson should not offer read tools without session).

### Phase 3 — Write-tools bridge for oversikt (sonnet sub-agent)
Extend same `oversikt-tools-bridge.tsx`. Register 8 write tools, each wrapped in `gatedMutation` per ADR-0204:
1. `openSession` (C4 `session.open`)
2. `transitionSession` (C4 `session.transition`)
3. `signoffSession` (C4 `session.signoff`)
4. `addShift` (C4 `shift.create`)
5. `manualTimeEntry` (C4 `time_entry.manual`)
6. `addSessionTask` (C4 `session_task.create`)
7. `toggleSessionTask` (C4 `session_task.toggle`)
8. `sendBroadcast` (C4 `broadcast.send` + voice-channel restriction per ADR-0078)

Tool body: validate args → call gatedMutation → invoke existing server action → emit() handled by action.

C4 authority rows: check `engine_authority_config` for each capability. If missing → escalate (council decision: auto-seed vs manual).

### Phase 4 — Navigation tools (sonnet sub-agent)
3 client-only state-setter tools (no DB writes, no C4 gate):
1. `switchDayTab` (overview|timeline|roster|tasks|deviations|broadcast)
2. `switchDate` (ISO)
3. `switchVariantView` (oversikt|strategic|reconciliation|activity|todo)

Wire into oversikt bridge.

### Phase 5 — Variant bridges (sonnet sub-agent)
Per skill spec, one bridge per variant:
1. `strategic-tools-bridge.tsx` — read tools for StrategicView KPIs (estimate 3-4)
2. `reconciliation-tools-bridge.tsx` — read (list) + write (lockReconciliation, revertReconciliation)
3. `activity-tools-bridge.tsx` — read (searchActivity) tools
4. `todo-tools-bridge.tsx` — read (listTodos) + write (assignTodo, completeTodo)

Mount each bridge inside its variant view's ready-state.

### Phase 6 — site-map.json + verify (sonnet sub-agent + coordinator)
- Add `/dashboard` entry to `apps/web/.botsson/site-map.json`: purpose, module=Dashboard, tier=1, access=[owner,admin,manager,employee], 18+ tools listed verbatim, common_intents (5 Norwegian utterances).
- Run `pnpm --filter web site-map:validate` → exit 0.
- Flip `.claude/page-polish/dashboard-overview.run.yml` `verified: true` + populate Step 13 checklist (lighthouse deferred to coordinator).

## Acceptance Criteria

- [ ] All 11 server actions emit() — verified via grep + read
- [ ] 18+ tools registered via `useRegisterTools` (7 oversikt-read, 8 oversikt-write, 3 nav + variant-specific)
- [ ] Every write tool wrapped in `gatedMutation` per ADR-0204
- [ ] Zero `query_smartout` fallback for 4 journey utterances (manual smoke when dev server up)
- [ ] `pnpm --filter web typecheck` passes (`web` + `stage-engine` + `@smartout/ai`)
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] `dashboard-overview.run.yml` `verified: true`, checklist 7/8 green (Lighthouse deferred)
- [ ] HANDOFF doc written at closure
- [ ] User journeys file written (4 journeys, see below)

## Risks & Council Triggers

| Risk | Escalation |
|------|-----------|
| C4 authority rows missing for some capabilities | Council: auto-seed vs manual seed in migration |
| Per-variant `useRegisterTools(scope, ...)` pattern affects 30+ pages | Council: new ADR for pattern before scale-out |
| `sendBroadcast` voice-channel rules (ADR-0078) may need refinement | Lovsen or system-agent-coordinator review |
| Tool description quality — LLM picks wrong tool | After Phase 4: dispatch frontend-designer for description review |

## Out of Scope

- InteractiveDashboard iframe mockup variant
- Lighthouse measurement (coordinator-level follow-up)
- `page_knowledge` DB sync (table not present)
- Tool-registration ADR draft (only if council triggered)
- Mobile parity (informational dashboard; per ADR-0133 mobile is thin client)
- Other dashboard sub-routes
