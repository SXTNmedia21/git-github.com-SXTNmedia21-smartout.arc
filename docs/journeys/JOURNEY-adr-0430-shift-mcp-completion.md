---
title: "JOURNEY — ADR-0430 shift-mcp completion (P0 regression remediation)"
feature: adr-0430-shift-mcp-completion
status: verified
updated: 2026-05-29
created: 2026-05-29
module: scheduling
tags: [adr-0430, shift-mcp, workspace-api, L-0348, P0, journey]
---

# JOURNEY — ADR-0430 shift-mcp completion

> Remediation of a P0 regression: ADR-0430 Phase b dropped `schedule_shift.zone` +
> `location_id` (M4) and made `department_id` NOT NULL (M1), but the rewrite only
> covered `packages/ai` + web `add-shift-action.ts`. Two write surfaces (shift-mcp
> create/update) + one public read EF (`GET /v1/shifts`) were never touched and broke
> at runtime. This journey is the contract for the completion. **L-0348, 4th occurrence.**
>
> **Status: verified** — backed by a live-invoke harness (10/10 assertions green against
> local Supabase on the post-M4 schema). See `docs/domains/scheduling/adr-0430-shift-mcp-completion/reports/live-invoke-result.txt`.

## Journey: Agent/MCP creates a shift via shift-mcp (voice + MCP authoring)

**Precondition:** A workspace with a department, a department_session for the shift date,
and a day_line (so the `ensure_shift_session` trigger can materialize the session). The
caller is authenticated to that workspace.

1. Caller invokes `create_shift` with `department_id` (or `department_session_id`) + `zone_ids[]`
   → shift-mcp resolves `department_id` (M1 NOT NULL), validates each zone belongs to the
   workspace + the department's area (Rule 7 forgery defense), inserts `schedule_shift`
   (no `zone`/`location_id` columns), then writes one `shift_zone` row per zone (keyed by the
   trigger-materialized `shift_session_id + day_line_id`)
   → Caller sees the created shift row + the assigned `zone_ids[]`.
2. Caller invokes `create_shift` with NO department
   → shift-mcp returns `department_unresolved` (fail-fast, L-0177 — no silent fallback)
   → Caller sees an explicit error, no row created.
3. Caller invokes `create_shift` with a zone from another workspace
   → shift-mcp returns `zone_forgery_workspace` (Rule 7)
   → Caller sees an explicit error, no row created.

**Postcondition:** A `schedule_shift` row with a non-null `department_id` and N `shift_zone`
junction rows; or an explicit error and no partial write.

**Error paths:**
- No `shift_session` materialized by the trigger (session/day_line preconditions unmet)
  → compensating DELETE of the inserted shift + `shift_zone_insert_failed` error (no orphan shift).
- Forged or out-of-area zone → fail-fast before any write.

## Journey: Agent/MCP updates a shift's zones via shift-mcp

**Precondition:** An existing shift with a materialized shift_session + day_line.

1. Caller invokes `update_shift` with `zone_ids: [<new set>]` (and optionally scalar fields)
   → shift-mcp updates scalar fields only if present (empty-update guard), validates the new
   zones (Rule 7), then reconciles `shift_zone` by binary delete + re-insert (the junction has
   no UPDATE policy per M2 RLS)
   → Caller sees the updated shift + the reconciled `zone_ids[]`.
2. Caller invokes `update_shift` with `zone_ids: []`
   → all zone assignments cleared.
3. Caller omits `zone_ids`
   → zone assignments left unchanged.

**Postcondition:** `shift_zone` reflects exactly the requested set; scalar fields updated
only when supplied.

**Error paths:**
- `zone_ids` non-empty but no session/day_line → `shift_zone_reconcile_failed` (no silent drop).
- Locked shift (started/past) → existing `SHIFT_LOCKED_MUTATION` handling preserved.

## Journey: API consumer lists shifts via public `GET /v1/shifts`

**Precondition:** Valid API key with `schedules:read` scope (documented at `api.smartout.ai/v1/shifts`).

1. Consumer calls `GET /v1/shifts?date_from=...`
   → workspace-api resolves shifts under the API key's workspace context and surfaces each
   shift's zone NAMES as a `zones` text[] via the M:N path
   `schedule_shift → shift_session → shift_zone → zone` (replacing the dropped scalar `zone`)
   → Consumer receives shifts each with a `zones: [...]` array (empty `[]` when no zones assigned).

**Postcondition:** Response includes `zones[]`; no SQL error from the dropped column.

**Error paths:**
- Missing scope → 403 `Missing scope: schedules:read` (unchanged).
- Invalid key → 401 (unchanged).

## Verification evidence (status: verified)

Live-invoke harness `reports/live-invoke.ts` run against local Supabase (post-M4 schema:
`schedule_shift` without `zone`/`location_id`, `shift_zone` present, `ensure_shift_session`
trigger watch list without `OF location_id`):

| # | Assertion | Result |
|---|-----------|--------|
| 1 | create_shift resolves department + writes 2 shift_zone rows | PASS |
| 2 | create_shift with no department → `department_unresolved` | PASS |
| 3 | create_shift with forged zone → `zone_forgery_workspace` | PASS |
| 4 | update_shift `zone_ids` reconcile {A,B} → {Terrasse} | PASS |
| 5 | `GET /v1/shifts` EF correlated subquery executes + returns `zones[]` | PASS |

**10 passed, 0 failed.** The gate caught a real `update_shift` bug (empty-updateData coerce)
that static typecheck missed — proving the value of the mandatory live-invoke that Phase b deferred.
