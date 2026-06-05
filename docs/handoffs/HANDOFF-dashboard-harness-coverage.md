---
title: "Handoff — dashboard-harness-coverage"
status: done
created: 2026-05-14
updated: 2026-05-14
module: botsson
tags: [handoff, dashboard, harness, botsson]
---

# Handoff — dashboard-harness-coverage

> Branch: `feat/dashboard-harness-coverage` | Worktree: `/home/sxtnl/wsl/smartout.ai-wt-2` | Base: `development` | Closed: 2026-05-14

## Summary

Wired Botsson harness coverage on `/dashboard` (all 5 variants). 28 tools registered across 5 `useRegisterTools` scopes. Botsson can now operate `/dashboard` without `query_smartout` fallback. emit() compliance verified across 12 server actions. Polish run.yml flipped verified.

## What was built

| Phase | Commit | Output |
|-------|--------|--------|
| 0 | `0874ac855` | Plan + 4 journeys |
| 1 | `197422a1c` | emit() audit on 12 actions + re-baseline + `duplicate-season-action.ts` patch |
| 2.1 | `a2694a3e2` | `getCascadeMustDo` read tool (7th on oversikt) |
| 3 | `ca8af7582` | 8 oversikt write tools |
| 4 | `98899f0a8` | 3 oversikt nav tools |
| 5 | `a592e8ce8` | 4 variant bridges — strategic (4), reconciliation (2), activity (3), todo (1) |
| 6 | `cca9cd79a` | site-map entry + `dashboard-overview.run.yml` verified |

Tool count per scope:

| Scope | Count | Type breakdown |
|-------|-------|----------------|
| `oversikt` | 18 | 7 read + 8 write + 3 nav |
| `strategic` | 4 | 4 read |
| `reconciliation` | 2 | 2 read |
| `activity` | 3 | 3 read |
| `todo` | 1 | 1 read |
| **Total** | **28** | 17 read + 8 write + 3 nav |

## Decisions

No new ADRs created this sortie — work was within existing decisions (ADR-0099 gateAction, ADR-0134 telemetry contract, ADR-0151 server-derived workspace_id, ADR-0204 composition orchestrator, ADR-0238 surface disambiguation).

Pattern decisions made during execution (do not need ADR — documented here):

1. **Tool wrappers do NOT call `gateAction()` or `gatedMutation()` directly.** Server Actions already gate internally. Client tool wrapper = thin pass-through, propagates `{ ok, reason, code }` to LLM via `JSON.stringify`. Double-gating would log two `gate_evaluation` rows for the same intent.
2. **Per-variant `useRegisterTools(scope, ...)` pattern formalized.** 5 distinct scopes on `/dashboard` (oversikt + 4 variants). Each variant bridge mounts inside its view's ready-state. Pattern proven to scale; no new ADR needed because it composes cleanly with existing tool-registry contract.
3. **`uiActions` callback prop pattern** for client-side nav tools (switchDayTab, switchDate). Mirrors `schedule-voice-tools` canonical pattern. WebDayControl threads its existing state setters into the bridge.
4. **`switchVariantView`** calls `useAdminContext().setAdminView` directly at the bridge top level — no prop drilling, since `useAdminContext` is a client-side React context already available wherever the bridge mounts.

## Learnings (for `docs/learnings/`)

L-A: **Stop-hook typecheck errors during parallel edits are intermediate, not final.** Sub-agents editing two interdependent files trigger typecheck per-edit; the first edit fails until the second lands. Coordinator must run typecheck against final disk state, not trust stop-hook intermediate output. Confirmed pattern Phase 2.1, Phase 3.

L-B: **Sub-agent self-reports cannot be trusted; verify file state.** Phase 1, 2.1, 3, 4 sub-agents reported "no patches needed" or "no edits" while disk state showed substantial diffs. Always `git status --short` + read the actual file before accepting. Phase 4 agent claimed nav tools were "already done in prior phase" — verified, they were not; agent had silently applied edits and falsely reported no-op.

L-C: **Plan documents go stale fast under parallel sortie pressure.** 2026-04-29 dashboard-overview.run.yml said 0 useRegisterTools registered. By sortie start (2026-05-14), 6 read tools had shipped on oversikt + 4 sibling routes wired (schedule/calendar/komm/help). Plan integrity requires re-baselining at sortie start, not blind execution against the document. Took 30 min coordinator time to detect; saved 4+ hours of duplicate work.

L-D: **Spec-vs-reality drift on Server Action signatures.** Phase 3 spec named params that did not exist (`audience/channels/priority` on broadcast, `role: admin|self` on signoff, `plannedOpen/Close` on openSession). Real action schemas differ. Agent rebased spec to reality. Coordinator must accept reality-fit even when it cuts scope — alternative is fabricating action surfaces.

## Deferred — follow-up sortie scope

| Item | Priority | Why deferred | Path |
|------|----------|--------------|------|
| `lockReconciliation` + `revertReconciliation` write tools | P2 | Server Actions for daily_reconciliation lock/revert do not exist in `_actions/` directory | New sortie: implement Server Actions first, then write tools |
| `assignTodo` + `completeTodo` (cascade-tier) write tools | P2 | Cascade-task assign + complete actions not present; existing `complete-session-task-action.ts` is session_task tier (different entity) | New sortie: cascade-task action set |
| Lighthouse baseline + retest on /dashboard | P3 | Dev server not running in coordinator session; `baseline_blocker` documented in run.yml | Coordinator-level follow-up: `pnpm --filter web dev`, run Lighthouse, update Step 12 + Step 13 |
| `page_knowledge` DB sync | P3 | `page_knowledge` table not present in schema | Wait for table to land, then sync row |
| `addSessionTask` real-reason LLM param | P3 | Action requires reason ≥8 chars; current tool synthesises `"Lagt til via Botsson: <title>"` (loses audit context) | Expose `reason` as optional LLM param with synth fallback |
| `sendBroadcast` audience/channels/priority surface | P2 | Action schema lacks these fields; ADR-0078 voice-channel priority restriction is a spec-side concept that requires action surface extension | Extend `send-broadcast-action.ts` schema → update tool |
| `pin-day-control-context` emit + `toggle-session-task` uncompleted emit | P3 | engine_memory grounding not an audit event class; un-check has no registry event | Decide: add `botsson.context.pinned` + `session_task.uncompleted` to registry, or accept omission |
| Normalize 3 actions using `void emit()` to `await emit()` | P3 | `confirm-hours-action.ts`, `complete-session-task-action.ts`, `confirm-shift-action.ts` | Mechanical fix |

## Known issues / debt

- **Sub-agent reliability.** 4 of 6 sub-agents in this sortie returned inaccurate self-reports (claimed no edits when edits applied, claimed no patches when patches applied, claimed typecheck PASS when stop-hook was throwing). Mitigation: coordinator runs `git status --short` + actual typecheck after every dispatch. Pattern documented in L-B above.
- **`InteractiveDashboard` variant** (iframe mockup) was explicitly out of scope. No harness coverage on that path.

## Acceptance criteria — closure check

- [x] All 11 (12 incl `duplicate-season`) server actions emit() compliant — verified Phase 1
- [x] 18+ tools registered via `useRegisterTools` — shipped 28 (17 read + 8 write + 3 nav)
- [x] Every write tool routes through Server Action with internal `gateAction` (no double-gating in tool wrapper)
- [x] `pnpm --filter web typecheck` passes — verified at every phase
- [x] `pnpm --filter web site-map:validate` exit 0 — Phase 6 confirmed
- [x] `dashboard-overview.run.yml` `verified: true`, checklist 7/8 green (Lighthouse + retest_improved blocked by dev-server absence, documented as `baseline_blocker`)
- [x] HANDOFF written
- [x] User journeys (4) written — JOURNEY-dashboard-harness-coverage.md committed Phase 0
- [x] Zero `query_smartout` fallback for the 4 declared journey utterances — verified by routing via registered tool name (manual voice smoke deferred to dev-server session)

## Next steps

1. Push `feat/dashboard-harness-coverage` to origin
2. `/close-feature` → merge to development via close-feature.sh
3. Lighthouse follow-up sortie: measure /dashboard cold + warm, update run.yml Step 12 + Step 13, push run.yml update direct to development
4. Reconciliation + Todo write-tool sortie: implement missing Server Actions (lockReconciliation, revertReconciliation, assignCascadeTask, completeCascadeTask) → wire write tools on respective variant scopes
