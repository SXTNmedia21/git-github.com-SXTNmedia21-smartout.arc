---
title: Handoff — Schedule Admin View (feat/schedule-admin-view)
status: done
updated: 2026-05-11
created: 2026-05-11
module: schedule
tags: [schedule, admin, botsson, role-gate, telemetry]
---

# Summary

Fixes the class of bugs where admin/manager/owner users queried Botsson about staffing for a specific date and received either an empty "no shifts" response (the employee tools filter on `ctx.profileId`) or a hallucinated answer (LLM received English prose like "No upcoming shifts found" and invented team names / context). Two new tools added; English prose fallbacks removed from the schedule capability.

## What Was Built

### New tools in `packages/ai/src/capabilities/schedule/tools.ts`

**`get_workspace_schedule`**
- Schema: `date` (YYYY-MM-DD, required) + `department_id` (UUID, optional)
- Role gate: admin/manager/owner only; `{ error: "forbidden" }` returned BEFORE DB query for other roles
- Voice guard: `display_name` is PII; `{ error: "channel_forbidden" }` before DB for voice channel
- Queries: `schedule_shift` + related `department`, `location`, `profile` (display_name) joined
- Returns: enriched rows with `local.weekday`, `start`, `end` pre-computed
- Emits: `agent.schedule.workspace_queried` → posthog + logger + activity_trail

**`get_date_schedule_for_me`**
- Schema: `date` (YYYY-MM-DD, required)
- Filters: `employee_id = ctx.profileId` — server-derived, unforgeable per ADR-0151
- Voice-safe: returns only caller's own shifts, no other employee PII
- Returns: own shifts for that date as enriched JSON
- Emits: `agent.schedule.date_queried_self` → posthog + logger

### JSON fallbacks everywhere

All English prose fallbacks in `getShiftColleagues` replaced with structured JSON. Combined with earlier work in other tools, the entire schedule capability now returns machine-readable facts. LLM translates to Norwegian from structure — stops hallucination class documented in the trace.

### Telemetry (`packages/telemetry/src/registry.ts`)

Two new events registered:
- `agent.schedule.workspace_queried` — `AgentScheduleWorkspaceQueried` interface; destinations: posthog + logger + activity_trail
- `agent.schedule.date_queried_self` — `AgentScheduleDateQueriedSelf` interface; destinations: posthog + logger

Both added to `SmartoutEvent` union and `EVENT_ROUTING` map.

### Intent Classifier (`packages/ai/src/router/intent-classifier.ts`)

Extended the write-vs-read disambiguation block with role-aware date-query routing. Admin/manager asking "hvem jobber lørdag?" → `schedule`. Employee asking "jobber jeg fredag?" → `schedule`. Unknown role with date reference → `schedule` confidence 0.6.

### Capability Registry (`packages/ai/src/capabilities/schedule/index.ts`)

Both tools added to `tools` array (read-only surface). Description updated to mention admin/manager workspace-level date views.

## Decisions Made

### Why role is read from `ctx.userContext.role` not a DB lookup

`ctx.userContext` is server-derived at session start by the BFF (`/api/botsson/voice/session-context`) from JWT + profile table. It is as trusted as `ctx.profileId`. A second DB lookup inside the tool adds latency and redundancy — the BFF already resolves the role. Pattern consistent with other tools that read from `ctx.userContext` (e.g. legal tools, billing_query).

### Why `engine_authority_config` needed no new row

Existing entry: `(b0000000, schedule.read, autonomous)`. New tools are both read-only; the capability's `defaultAuthority: "read_only"` covers them. No migration needed.

### Why voice is blocked for `get_workspace_schedule` but not `get_date_schedule_for_me`

`get_workspace_schedule` returns `profile.display_name` (joined from multiple employees). This is PII under ADR-0078. `get_date_schedule_for_me` only returns the caller's OWN shift data — no other employee names in the response.

### Why telemetry emits fire after enrichment, not before

Emit at the success path only. A failed/empty query doesn't need an activity_trail entry — those are structured JSON responses the LLM handles. Emit on success gives the activity_trail a meaningful access record (workspace schedule viewed with result_count).

## Known Issues / Debt

### G10 (open) — schedule wrong-day bug

The wrong-day bug (D2 — admin seeing wrong Oslo day) is not fixed in this sortie. The new `get_workspace_schedule` tool uses `shift_date = params.date` (DATE column equality, not TIMESTAMPTZ range) which completely avoids the UTC-vs-Oslo issue. The old `get_today_schedule` tool uses `startOfOsloDay`/`endOfOsloDay` which is the correct fix. G10 is still open for `get_today_schedule` and `get_my_shifts` edge cases.

### Role field on UserContext

`UserContext.role` is typed as `"owner" | "admin" | "manager" | "employee"`. The tool guard checks `ctx.userContext?.role` which can be `undefined` when `userContext` is not set. In that case `allowed.includes(undefined)` is false → correct forbidden response. No null-pointer risk but there's a future improvement to provide a clearer error when `userContext` is completely absent.

## Next Steps

1. Fix G10 (schedule wrong-day bug) — add TZ-aware fixtures and verify `get_today_schedule` Oslo boundary edge cases
2. E2E spec: Playwright test that logs in as admin, opens Botsson, asks "hvem jobber [next Saturday]?" and verifies the response contains real shift data
3. Consider adding `department_id` filter to `get_date_schedule_for_me` so employees in large workspaces can scope to their department without getting all shifts
