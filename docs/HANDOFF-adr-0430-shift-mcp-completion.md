---
title: "HANDOFF — ADR-0430 shift-mcp completion"
status: done
updated: 2026-05-29
created: 2026-05-29
module: scheduling
tags: [adr-0430, shift-mcp, workspace-api, L-0348, P0, handoff]
---

# HANDOFF — ADR-0430 shift-mcp completion

## Summary — what was built and why

ADR-0430 Phase b (shift × zone × location M:N reform) shipped to `development` @ 4e984e628.
M1 made `schedule_shift.department_id` NOT NULL; M4 dropped `schedule_shift.zone`,
`schedule_shift.location_id`, and `profile.location_id`. But the application rewrite was
**capability-layer-scoped** — it covered `packages/ai` capabilities + web `add-shift-action.ts`
only. Three write/read surfaces were missed and broke at runtime the moment those migrations landed:

1. `services/shift-mcp/src/tools/create-shift.ts` — INSERT set the dropped `zone` AND no
   `department_id` (NOT NULL violation). **Doubly broken** (broken since M1, not just M4).
2. `services/shift-mcp/src/tools/update-shift.ts` — set the dropped `zone`.
3. `supabase/functions/workspace-api/handlers/schedules.ts` — public `GET /v1/shifts` raw SQL
   selected the dropped `zone` (documented-active endpoint at `api.smartout.ai/v1/shifts`).

This sortie completes the reform across those surfaces by mirroring the already-shipped,
council-vetted web pattern (`add-shift-action.ts`) into the standalone shift-mcp Hono service,
and exposing `zones[]` (the M:N successor) on the public EF.

**Root cause: L-0348, 4th occurrence** — a capability-layer-scoped rewrite that misses a standalone
MCP service + a public EF handler. The Phase b plan DEFERRED its AC-4a.10 live-invoke gate; that gate
would have caught all three. Live-invoke was made **mandatory** in this sortie and is now green.

## What changed

| File | Change |
|---|---|
| `services/shift-mcp/src/types/shift.ts` | Zod: drop scalar `zone` from both schemas; add `zone_ids[]` + `department_id` + `department_session_id` to create, `zone_ids[]` to update (ADR-0112 same-commit; `server.ts` registers these directly as `inputSchema`). |
| `services/shift-mcp/src/tools/create-shift.ts` | Resolve `department_id` (session-first, then direct; fail-fast — L-0177); Rule 7 zone forgery defense; write `zone_ids` → `shift_zone` keyed by trigger-materialized `(shift_session_id, day_line_id)` with compensating DELETE on failure. |
| `services/shift-mcp/src/tools/update-shift.ts` | Drop scalar `zone`; reconcile `zone_ids` (binary delete + insert, no UPDATE policy on `shift_zone`); skip the schedule_shift UPDATE when only `zone_ids` supplied (empty-updateData coerce fix — caught by live-invoke). |
| `supabase/functions/workspace-api/handlers/schedules.ts` | `GET /v1/shifts` SELECT: drop `zone`, add `zones` text[] via correlated subquery `schedule_shift → shift_session → shift_zone → zone`. |
| `apps/landing/src/app/docs/api/page.tsx` | List Shifts example response shows `zones: [...]`. |
| `apps/e2e/procedure-engine/journey-4-shift-location.spec.ts` | J4-B rewritten for M4: shift inserts without `location_id`; assert dropped column unselectable (42703); location reachable via session→day_line. |
| `apps/e2e/db/triggers/shift-session-trigger.spec.ts` | Trigger no longer reads `schedule_shift.location_id`; seed a day_line in `beforeAll` (new location source); drop `location_id` from the insert helper; idempotency UPDATE fires on a watched column (`department_id`). |
| `docs/domains/core-structure/DATA-MODEL.md` | `domain-steward post`: added `shift_zone` composite-FK inbound rows + zone `uq_zone_id_location_id` note + M4 dropped-column schema note (was 0 shift_zone refs). |
| `docs/domains/{scheduling,core-structure}/STATE.md` | Reconciled obsolete S6/structural_block → S9 closed (the parent sortie shipped; block gated done work). |

## Decisions made (no new ADR — completes ADR-0430)

- **Public-API contract: expose `zones[]` (not omit).** The `zone` scalar existed before M4; silent
  drop would break documented API consumers. `zones[]` (zone names via the M:N junction) is the
  ADR-0430-coherent successor. Decided by orchestrator (not council — small, ADR-coherent contract
  decision, not an ontology-breaker). Landing docs updated to match.
- **shift-mcp adapts the web pattern without `mutateWithGate`.** shift-mcp is a standalone Hono service
  using its own service-role `supabaseAdmin`; it has no composition-gate harness and no emit/telemetry
  (it's a thin DB writer). The dept-resolution + zone-forgery + shift_zone-write logic is mirrored;
  the gate wrapper is not (the web Server Action retains it).
- **voice-agent `tools-schedule.ts` unchanged.** It proposes ghost cards (startTime/endTime/role/dateId)
  and never passes `zone` to shift-mcp — confirmed 0 zone refs.

## Learnings

- **Live-invoke earns its keep.** Static `tsc` was green on `update_shift`, but the live-invoke caught
  a real runtime bug: calling update with ONLY `zone_ids` left `updateData` empty, and
  `.update({}).select().single()` throws "Cannot coerce the result to a single JSON object". Fixed by
  guarding the scalar UPDATE. **Promote: every new/changed DB-write surface ends with a live-invoke**
  (sibling of L-0348 Track-F rule — "every new DB-read capability ends with a Node-script live invoke").
- **turbo typecheck ≠ standalone tsc.** Running `tsc --noEmit` directly in `apps/e2e` showed dozens of
  `@smartout/journey-ir` / `@smartout/ai` module-not-found errors — but these are dep-resolution
  artifacts: `pnpm turbo typecheck --filter` builds deps first (`dependsOn: ^build`) and passes clean.
  Don't mistake unbuilt-dep errors for real type errors; use the turbo path the close gate uses.
- **shift_zone is keyed by the session, not the shift.** Writing zones requires the
  `ensure_shift_session` trigger to have materialized `shift_session` + `shift_session_day_line` first
  (both need a `department_session` + `day_line` for the date). Any zone-write path must resolve those
  and compensate (DELETE the shift) if they're absent.

## Known issues / debt

- shift-mcp create/update have no telemetry emit (the service never had one). If shift authoring via
  MCP needs to land in `activity_trail`/`engine_event`, that's a separate wiring sortie — the canonical
  shift telemetry today is emitted by the web/capability layer, not the MCP.
- The full end-to-end UI save path for AddShiftDialog remains deferred (needs a test-date-aware
  department_session) — pre-existing J4 debt, unchanged by this sortie.

## Next steps

- **Day-line P1 (separate `day-session` feature folder)** — surfaced for Pontus go, NOT auto-started:
  web location filter `use-day-timeline-events.ts:336` (locationByShift null), mobile `useMyShifts`
  zones[] embed, and the design-fidelity RED (right-rail missing in `ManagerTimelineShell.tsx`,
  V1-stubbed bands). Canonical mockup: `docs/domains/day-session/day-planner/project/Manager Timeline.html`.

## Verification

- Diff-scoped `turbo typecheck` (apps/e2e, apps/landing, services/shift-mcp): **10/10 tasks, exit 0.**
- Live-invoke harness: **10/10 assertions green** (`reports/live-invoke-result.txt`).
- 0 scalar `zone` survivors in the three changed source files.
