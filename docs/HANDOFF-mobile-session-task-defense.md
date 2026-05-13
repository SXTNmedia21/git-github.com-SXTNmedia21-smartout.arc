---
title: "HANDOFF — Mobile Session-Task Defense (Sortie 1)"
status: done
updated: 2026-05-13
created: 2026-05-13
module: mobile
tags: [sortie-1, defense, session-task, ADR-0298, ADR-0299]
---

# HANDOFF — Mobile Session-Task Defense (Sortie 1)

> Branch: `feat/mobile-session-task-defense` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-2`
> Base: `development` | Closed: 2026-05-13

---

## What Was Built and Why

Sortie 1 implements the **defense surface** of the Mobile Oppgaver (Task) initiative, as specified by ADR-0298 and the council verdict of 2026-05-12.

Before this sortie, mobile task mutations were undefended:
- 5 direct-mutation handlers in the mobile action-map wrote to `session_task`, `schedule_shift`, and `shift_approval` tables by calling the DB from the client side, with no identity derivation, no capability gate, and `.catchall(z.unknown())` Zod schemas that accepted forgeable actor fields from the request body.
- 2 orphan routes (`/api/mobile/tasks`, `/api/mobile/tasks/[id]`) existed without handlers.
- `session_task` had no RLS WITH CHECK predicate — `INSERT` and `UPDATE` policies applied to any authenticated role.
- `personal` capability emitted `entity_type: "personal_task_action"` (unregistered) instead of the registered `"personal_task"` value.

Sortie 1 shuts all five mobile mutation paths behind:
1. **Three BFF PATCH routes** — server-derives actor identity from JWT, rejects forgeable body fields.
2. **Three Server Actions** — gated via `gateAction()` (ADR-0193 branded IDs + `engine_authority_config` capability check).
3. **RLS WITH CHECK migration** — `session_task` `UPDATE` policy tightened to require `assignee_profile_id = auth.uid()`.
4. **Three `gate_action` seeds** — `task.complete_session_task`, `schedule.confirm_shift`, `timesheet.confirm_hours` registered in `engine_authority_config`.
5. **Zod schema tightening** — 5 schemas upgraded from `.catchall(z.unknown())` to strict, with actor fields removed.
6. **Action-map rewiring** — 5 handlers now call Server Actions instead of DB directly.

Scope is deliberately narrow: **defense only**. The read path (RPC `fn_list_my_tasks`), the unified `task` capability, and the mobile Kalender UI all belong to Sorties 2–5 per ADR-0298.

---

## 17 Commits — Enumerated

| SHA | Commit | Description |
|-----|--------|-------------|
| `7751867eb` | `chore(mobile): delete 2 orphan task routes` | Remove `/api/mobile/tasks` + `/api/mobile/tasks/[id]` (no handlers, dead code) |
| `f49e58dbf` | `feat(db): session_task RLS WITH CHECK + 3 gate-action seeds` | Migration `20260604120000` adds `WITH CHECK (assignee_profile_id = auth.uid())` to session_task UPDATE policy; migration `20260604121000` seeds 3 `engine_authority_config` rows |
| `3b3f8c656` | `docs: close 3 doc-drift surfaces flagged by Mobile Oppgaver Council` | Fixes BOTSSON-SYSTEM-MAP + MODULE_14 + DATABASE.md drift from prior PRs |
| `ef8eed51d` | `feat(mobile): tighten 5 task-class Zod schemas` | Remove `.catchall(z.unknown())` + actor body fields from 5 schemas; add `.strict()` |
| `3a441be72` | `feat(telemetry): extend EntityType + register shift/hours confirmed events` | Add `session_task`, `personal_task`, `schedule_day_task`, `emma_task` to EntityType union; register `ShiftConfirmed` + `HoursConfirmed` events; wire EVENT_ROUTING (4 destinations each) |
| `c2c42f1aa` | `fix(personal): emit with registered entity_type per ADR-0298` | Fix `personal` capability `create_task` tool: emit `"personal_task"` not `"personal_task_action"` (line 192 of tools.ts) |
| `b367c4867` | `refactor(api): extract resolveMobileActor to shared module` | New `apps/web/src/app/api/mobile/_shared/actor.ts` — `resolveMobileActor(token) → ResolvedActor \| null`, fail-fast, no fallback |
| `e80c531d6` | `feat(api): mobile BFF /api/mobile/tasks/[id]/complete` | PATCH route — derives actor from JWT, calls `completeSessionTaskAction`, returns 200/401/422/500 |
| `b232620df` | `feat(api): mobile BFF /api/mobile/shifts/[id]/confirm` | PATCH route — derives actor from JWT, calls `confirmShiftAction`, returns 200/401/422/500 |
| `b8f1e266b` | `feat(api): mobile BFF /api/mobile/shift-approvals/[id]/confirm` | PATCH route — derives actor from JWT, calls `confirmHoursAction`, returns 200/401/422/500 |
| `fdb98bf71` | `feat(actions): add completeSessionTaskAction Server Action` | `gateAction("task.complete_session_task")` gate, actor from `resolveMobileActor`, emits `session_task completed` |
| `d5d8385de` | `feat(actions): add confirmShiftAction Server Action` | `gateAction("schedule.confirm_shift")` gate, actor from `resolveMobileActor`, emits `shift confirmed` |
| `bfd733b7d` | `feat(actions): add confirmHoursAction Server Action` | `gateAction("timesheet.confirm_hours")` gate, actor from `resolveMobileActor`, emits `hours confirmed` |
| `64d19fbab` | `fix(actions): brand actor IDs via nonEmpty() per ADR-0193` | Replace plain `z.string()` with `z.string().min(1)` branded `NonEmptyString` type on `actorProfileId` and `actorWorkspaceId` across all 3 Server Actions; caught by stop-hook typecheck after dist rebuild |
| `0f9eef74c` | `feat(mobile): BFF-wrap 5 direct-mutation handlers` | Action-map rewired: 5 handlers now call BFF routes instead of DB directly; PK field names corrected (`id`, `schedule_shift_id`, `approval_id`) |
| `363a62b11` | `feat(telemetry): add schedule_shift to EntityType union` | Follow-up to `3a441be72` — `schedule_shift` added to EntityType; not caught in initial telemetry commit because `confirmShiftAction` was written after |
| `9be87221c` | `test(playwright): add happy-path coverage for 3 BFF defense routes` | 3 Playwright spec files, 9 tests (complete task / confirm shift / confirm hours — happy + 401 + 422) |

---

## Decisions Made

### D1 — 2 migrations delivered, not 3 (spec §4.6 + §4.7)

The spec §4.6 listed `session_task` RLS WITH CHECK and §4.7 listed gate-action seeds as separate deliverables. These shipped as 2 migrations (`20260604120000` + `20260604121000`). The spec's §R6 deferred the equivalent `schedule_shift` / `shift_approval` RLS WITH CHECK to **Sortie A** — that constraint was NOT added in Sortie 1, which is intentional (scope control).

### D2 — Playwright scope, not `e2e`

Commitlint rejected `test(e2e): ...` scope (unknown scope in conventional-commit config). Scope `playwright` was used instead. Tests still live at `apps/e2e/` per project convention.

### D3 — `NonEmptyString` brand caught mid-sortie

Stop-hook scoped typecheck surfaced `NonEmptyString` brand mismatch on `actorProfileId` / `actorWorkspaceId` in all 3 Server Actions after `pnpm --filter @smartout/ai build` rebuilt dist. The plain `z.string()` → `z.string().min(1)` fix was a separate commit (`64d19fbab`) rather than rewriting the Server Action commits. This preserved atomicity.

### D4 — `schedule_shift` added to EntityType post-P1

The initial telemetry commit (`3a441be72`) registered `session_task`, `personal_task`, `schedule_day_task`, `emma_task` but missed `schedule_shift` because `confirmShiftAction` was written in a later phase. Follow-up commit `363a62b11` closed the gap cleanly. No registry migration needed — EntityType is a TypeScript union, not a DB enum.

### D5 — entity_type fix scoped to line 192 only

`c2c42f1aa` fixed the `personal` capability `create_task` tool at `tools.ts:192`. Sibling sites at lines 121, 314, and 468 use `"agent_session"` intentionally and were left untouched. The 3 remaining `entity_type` drift sites are Sortie B debt (documented in known issues below).

---

## Learnings

### L1 — Fresh worktree: build dist before scoped typecheck

Confirmed the pattern from `learning_stage_engine_subpath_imports.md`: a fresh worktree with `pnpm install` but without `pnpm turbo build` will produce TS2307 errors on `@smartout/ai/*` subpath imports. The stop-hook typecheck gives no signal until `pnpm --filter @smartout/ai build` (and any other workspace packages the changed file imports) has produced a `dist/`. Build dist first when entering a new worktree against stage-engine or packages/ai territory.

### L2 — Stop-hook noise on missing node_modules is not informative

When the stop-hook fires on a file edit and node_modules is missing or stale, the error trace is not meaningful. The correct response is: rebuild (`pnpm install && pnpm turbo build`), then re-run typecheck. Do not react to stop-hook errors until a clean build is confirmed.

### L3 — Mid-edit hook errors are stale snapshots

The stop-hook fires on the state at the time of the previous save. If a second file in the same logical change is not yet edited, the hook error represents an intermediate (intentionally broken) state. Verify with `pnpm turbo typecheck` over the whole changed surface before treating any hook error as a real bug.

---

## Known Issues / Debt

| ID | Debt | Target |
|----|------|--------|
| K1 | `schedule_shift` + `shift_approval` RLS WITH CHECK deferred | Sortie A |
| K2 | `personal` capability `tools.ts` lines 121/314/468 still emit wrong `entity_type` (`"agent_session"`) — 3 drift sites | Sortie B |
| K3 | `tasks_completed` counter in workspace KPI surface not yet incremented on task completion (no `update_entity` hook wired) | Sortie 2 (RPC phase) |
| K4 | intent-coverage script confirms 29 capabilities ↔ 33 enums (clean) — no new toolless intents created. Verify again after Sortie 3 adds `task` capability. | Sortie 3 |
| K5 | ADR-0298 status is `proposed` — promote to `accepted` after Sortie 2 RPC lands (confirms viability of hybrid architecture) | Sortie 2 |

---

## Next Steps

1. **Sortie A** — `schedule_shift` + `shift_approval` RLS WITH CHECK hardening (spec §R6). Unblocked by Sortie 1 close.
2. **Sortie 2** — `fn_list_my_tasks` SECURITY DEFINER RPC (ADR-0300). Read path for unified task surface.
3. **Sortie 3** — Single `task` capability with 6 tools (ADR-0301). Replaces 3 shadow paths.
4. **Sortie 4** — Mobile Kalender UI (ADR-0302). Requires design handoff `docs/design/design_handoff_calendar/source/screens.jsx`.
5. **Sortie 5** — E2E full suite.
6. **Cutover** — Deploy `20260604120000` + `20260604121000` migrations to preview after merge to development.

---

## Verification Status (P12 Gate — 8/8)

| Gate | Result |
|------|--------|
| G1 — `pnpm turbo typecheck` 0 errors | PASS |
| G2 — Intent coverage (29 caps ↔ 33 enums) | PASS |
| G3 — RLS migrations apply clean on local | PASS |
| G4 — 3 BFF routes return 401 on missing JWT | PASS |
| G5 — 3 Server Actions blocked by gateAction on unconfigured config | PASS |
| G6 — Playwright 9/9 green | PASS |
| G7 — entity_type fix confirmed in registry | PASS |
| G8 — Orphan routes deleted, no dangling imports | PASS |
