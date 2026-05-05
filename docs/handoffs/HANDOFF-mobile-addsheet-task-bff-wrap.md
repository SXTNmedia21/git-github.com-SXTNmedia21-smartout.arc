---
title: Handoff — Mobile AddSheet Task BFF Wrap (wt-6)
status: done
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [mobile, task, bff, gate, telemetry, handoff]
---

# HANDOFF — Mobile AddSheet Task BFF Wrap (wt-6)

**Branch:** `feat/mobile-addsheet-task-bff-wrap`
**Worktree:** `~/dev/smartout.ai-mobile-wt-6`
**Base:** `campaign/mobile`
**Commit range:** `03f8c8a6c`..`86daf953e` (7 commits)

---

## What Was Built

Closed the ADR-0099 / ADR-0134 / ADR-0151 violation in `apps/mobile/src/lib/sync/action-map.ts` where `actionMap.create_task` inserted directly into `session_task` without going through `gate_action()` or `emit()`.

Three files changed in the production surface:

1. **`apps/web/src/app/dashboard/_actions/add-task-action.ts`** — Extended with `actor?: ResolvedActor` and `channel: "chat" | "system" = "chat"` params. When `actor` is supplied the cookie-based `resolveCurrentProfile()` is skipped; gate and emit receive the pre-resolved identity. Cookie callers (web DayControl) are unaffected — no signature change for zero-argument callers.

2. **`apps/web/src/app/api/mobile/tasks/route.ts`** — New BFF route. Bearer-auth only. Resolves identity server-side via `createAdminClient().auth.getUser()`. Never accepts `workspace_id` or `profile_id` from the body (ADR-0151). Delegates to `addTaskAction` with explicit actor and `channel='system'`. Returns `{ ok, taskId }` or a typed error with appropriate HTTP status.

3. **`apps/mobile/src/lib/sync/action-map.ts`** — `create_task` handler replaced with BFF fetch. Reads Bearer token from active Supabase session; throws early if no session. Strips `workspace_id` from payload before sending body. Throws on non-2xx to surface the error through `SyncWorker`.

Helper: **`apps/mobile/src/lib/web-api.ts`** — Added `getMobileTasksUrl()` returning `${getWebApiUrl()}/api/mobile/tasks`.

---

## Decisions Made

| Decision | ADR |
|---|---|
| Task create routed through BFF — mirrors ADR-0270 shift-authoring pattern | ADR-0272 |
| Identity never accepted from body; always derived from Bearer JWT server-side | ADR-0151 (applied) |
| `addTaskAction` extended with optional actor rather than forked | ADR-0272 §B2 |
| `channel='system'` used to signal mobile origin through gate + telemetry | ADR-0272 §B3 |

ADR-0272 registered in `docs/decisions/0000-decision-log.md` (renumbered from 0271 → 0272 to avoid collision with wt-4's ADR-0271).

---

## Learnings

**L-wt6-01 — Telemetry source union must be widened when new surfaces are added.**
`TaskAddedManual.properties.metadata.source` was typed as the literal `"web_day_control_tasks_tab"`. Adding `"mobile_addsheet"` required widening the union in `packages/telemetry/src/registry.ts:1006` to `"web_day_control_tasks_tab" | "mobile_addsheet"`. Caught at gate-check; fix is one-line. Pattern: any new surface that reuses an existing telemetry event must check the source union type.

**L-wt6-02 — `as unknown as` cast required when stripping known fields from typed payload.**
In `actionMap.create_task`, the payload type from `WriteActionPayload<"create_task">` did not include `workspace_id` (by schema design), but the cast `p as typeof p & { workspace_id?: string; ... }` was needed to safely destructure and omit it before building the fetch body. Pattern: typed payload narrowing at BFF boundary requires explicit widening + re-narrowing.

---

## Known Issues / Debt

- **Merge conflict at `action-map.ts` L21 and `web-api.ts` L109 with wt-4:** Both branches add `import from "@/lib/web-api"` at the same position. Resolution at merge: place wt-6's import line after wt-4's. Both are clean inserts — no semantic conflict.
- **Typecheck not runnable in worktree without `pnpm install`:** The worktree has no independent `node_modules`. Typecheck passes in the main repo with installed deps. The telemetry source type fix (L-wt6-01 above) resolves the only new TS error introduced by this sortie.
- **`create_shift` in `actionMap` still does direct insert** — same class of violation as the one this sortie fixed. Tracked as follow-up (same pattern as ADR-0270 + ADR-0272; create a wt-7 or extend wt-4).

---

## Next Steps

1. Merge `feat/mobile-addsheet-task-bff-wrap` → `campaign/mobile` via close-feature.
2. At campaign milestone merge: resolve the positional import conflict with wt-4 (see Known Issues above).
3. Follow-up: audit remaining direct-insert handlers in `actionMap` (`create_shift`, `haccp_log`) against the same ADR-0099 / ADR-0134 gate requirement.
