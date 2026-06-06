---
title: "PLAN-1 — shift-mcp completion (create + update + Zod)"
status: in_progress
updated: 2026-05-29
created: 2026-05-29
module: scheduling
tags: [adr-0430, shift-mcp, L-0348, P0]
---

# PLAN-1 — shift-mcp completion

**Branch:** `feat/adr-0430-shift-mcp-completion` · **Model:** sonnet · **Worktree:** `~/dev/smartout.ai-wt-1`

Mirror the already-shipped, council-vetted web pattern in `apps/web/src/app/dashboard/_actions/add-shift-action.ts` into the standalone shift-mcp Hono service. shift-mcp uses its own `supabaseAdmin` (service role) client — NO `mutateWithGate`, NO emit/telemetry (the service is a thin DB writer; it has zero emit call-sites today — do NOT add a telemetry system).

## Files

### A. `services/shift-mcp/src/types/shift.ts` (Zod — ADR-0112 same-commit)

**createShiftInput** (~line 40-62):
- REMOVE `zone: z.string().nullish()...` (line ~54)
- ADD `zone_ids: z.array(z.string().uuid()).optional().default([]).describe("Zone UUIDs to assign this shift to (M:N via shift_zone). ADR-0430.")`
- ADD `department_id: z.string().uuid().optional().describe("Department UUID. Required if departmentSessionId not supplied (M1 NOT NULL).")`
- ADD `department_session_id: z.string().uuid().optional().describe("Department session UUID — strongest department resolution path.")`

**updateShiftInput** (~line 65-90):
- REMOVE `zone: z.string().nullish()...` (line ~80)
- ADD `zone_ids: z.array(z.string().uuid()).optional().describe("Replace zone assignments. undefined = leave unchanged; [] = clear all.")`

Keep all other fields. Verify the inferred `CreateShiftInput`/`UpdateShiftInput` types still export.

### B. `services/shift-mcp/src/tools/create-shift.ts`

Replace the body. Sequence:

1. **Workspace scope check** — keep existing `input.workspace_id !== workspaceId` guard.
2. **Resolve department_id** (mirror add-shift-action lines ~243-280; NO trigger-derive on INSERT):
   - if `input.department_session_id`: `SELECT workspace_id, department_id FROM department_session WHERE department_session_id = ...`; verify workspace match; `departmentId = ds.department_id`.
   - else if `input.department_id`: `SELECT workspace_id FROM department WHERE department_id = ...`; verify workspace match; `departmentId = input.department_id`.
   - if neither resolves → return isError with `"department_unresolved: supply department_session_id or department_id"`. (NO silent fallback — L-0177.)
3. **Validate zone_ids** (Rule 7 forgery defense, mirror lines ~314-345) — for each zone_id:
   - `SELECT zone_id, location_id FROM zone WHERE zone_id = ... AND workspace_id = ...`; null → isError `"zone_forgery_workspace: zone <id> not in workspace"`.
   - `SELECT location_id FROM department_location WHERE department_id = <departmentId> AND location_id = <zone.location_id> AND workspace_id = ...`; null → isError `"zone_forgery_dept_area: zone <id> location not in department area"`.
   - collect `{ zone_id, location_id }` pairs.
4. **INSERT schedule_shift** — same columns as today MINUS `zone`, PLUS `department_id: departmentId`. (M4: no location_id, no zone.) `.select("schedule_shift_id").single()`.
5. **INSERT shift_zone rows** (Rule 4, mirror lines ~415-470) — only if pairs.length > 0:
   - `SELECT shift_session_id FROM shift_session WHERE schedule_shift_id = <newShiftId>` (trigger-materialized). If none → compensating `DELETE schedule_shift WHERE schedule_shift_id = <id> AND workspace_id = ...` + isError `"shift_zone_insert_failed: no shift_session created by trigger"`.
   - `SELECT day_line_id FROM shift_session_day_line WHERE shift_session_id = ...`; take first. If none → compensating DELETE + isError `"shift_zone_insert_failed: no day_line"`.
   - for each pair: `INSERT shift_zone { shift_session_id, day_line_id, zone_id, location_id }` (workspace_id auto-filled by trigger `set_shift_zone_workspace_id`). On error → compensating DELETE + isError.
6. **Return** the created shift row (re-select with zone_ids echoed back is nice-to-have, not required).

### C. `services/shift-mcp/src/tools/update-shift.ts`

1. Keep existing fetch + workspace-scope guard.
2. In the `updateData` builder: REMOVE the `if (fields.zone !== undefined) updateData.zone = ...` line (~68).
3. After the `schedule_shift.update(...)`, if `fields.zone_ids !== undefined` (reconcile zones):
   - Resolve `departmentId` from the existing/updated shift: `existing.department_id` (M1 guarantees non-null).
   - Validate each new zone_id with the SAME Rule 7 forgery checks as create (workspace + department_location).
   - Resolve `shift_session_id` + `day_line_id` for this shift (same trigger-materialized lookups as create). If none and zone_ids non-empty → isError (do NOT silently drop).
   - **Reconcile**: `DELETE FROM shift_zone WHERE shift_session_id = ... AND day_line_id = ...` then INSERT the new set. (shift_zone has no UPDATE policy — binary delete+reinsert per M2 RLS design.) `zone_ids: []` clears all.
4. Keep the SHIFT_LOCKED_MUTATION error handling.

## Acceptance (PLAN-1)

- `pnpm --filter @smartout/shift-mcp typecheck` (or service tsc) → 0 errors. (TURBO_CONCURRENCY=1.)
- grep: 0 `zone` references in create-shift.ts / update-shift.ts / types/shift.ts that mean the scalar column (zone_ids OK).
- Verify caller sites: `services/voice-agent/src/tools-schedule.ts` (already 0 zone refs) + `packages/ai/src/agents/schedule.ts` — if they pass `zone` to shift-mcp create/update, update to `zone_ids`. grep both.

## Commit

One commit: `fix(shift-mcp): complete ADR-0430 — dept resolution + zone_ids→shift_zone (L-0348)`. Body notes the 4th-occurrence L-0348 + the deferred live-invoke gate. Co-Authored-By trailer per CLAUDE.md.
