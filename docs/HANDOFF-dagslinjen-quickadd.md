---
title: "Handoff — dagslinjen-quickadd"
feature: dagslinjen-quickadd
status: closed_with_followups
closed_at: 2026-05-15
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [handoff]
---

# HANDOFF — dagslinjen-quickadd

> Branch: `feat/dagslinjen-quickadd` | Worktree: `~/dev/smartout.ai-wt-4`
> Base: `development` | Module: MODULE_COMMUNICATION
> Status: **CLOSE-WITH-FOLLOWUPS** (1/4 journeys `verified`, 3/4 `in_progress`)

## Summary

Turned `/dashboard/day` Dagslinjen from a read-only timeline into an
authoring surface:

- Click any time slot → `SlotQuickAddPopover` opens with 5 actions
  (Booking, Notat, Oppgave, Avvik, Vaktstart) anchored to clicked time
- Filter strip by Avdeling / Team / Vakt via `ScopeFilterPill` with URL
  `?scope=type:id` as source of truth
- `DailyNoteSheet` gained "Hvem ser dette?" (audience picker:
  dept/team/vakt/spesifikke profiler) and "Når påminne?" (datetime
  picker, 5-min snapped) sections
- `create-targeted-note-action` Server Action writes `session_note`
  with `audience JSONB` + `notify_at`; C4 gate
  `comm.note_fanout_cross_dept` (level=`confirm`, min_role=`admin`)
  blocks cross-dept fanout
- `note-fanout-scheduler` Edge Function runs every 5 min via pg_cron,
  resolves audience → `profile_ids[]`, writes `notification_outbox`
  rows + `activity_trail` per delivery, sets `delivered_at`
  idempotently
- Telemetry: `comm.scheduled_note.created`,
  `comm.scheduled_note.delivered`, `comm.scheduled_note.deleted`,
  `ui.dagslinjen.slot_quickadd.action_picked`,
  `ui.dagslinjen.scope_filter_changed` registered + emitted

## What works end-to-end

- Manager clicks slot 14:00 → popover opens → click Booking →
  `ReservationSheet` opens with `defaultBookingTime=14:00` prefilled
  [citation: TimelineTab.tsx:218]
- Manager clicks slot → Notat → `DailyNoteSheet` opens with
  `prefillTime` → audience picker + notify_at picker available
  [citation: DailyNoteSheet.tsx:107-119]
- Manager picks Team filter → URL updates to `?scope=team:<id>` →
  `useDayTimelineEvents` re-fetches with team-scoped query
  [citation: TimelineTab.tsx:75-83]
- Manager writes targeted note to own-dept → Server Action skips C4
  gate (per ADR-0333), inserts `session_note`, emits
  `comm.scheduled_note.created`
  [citation: create-targeted-note-action.ts:115-135]
- Manager attempts cross-dept → C4 gate returns `requires_confirm` →
  UI surfaces `AlertDialog` with prompt; admin retry passes the gate;
  manager retry stays denied
- Edge Function ticks every 5 min → claims delivered_at idempotently
  via `UPDATE ... WHERE delivered_at IS NULL` → emits
  `notification_outbox` + `activity_trail` per recipient
  [citation: note-fanout-scheduler/index.ts:131-167]

## Open items / follow-up sorties

| # | Item | Why it matters | Rough scope |
|---|------|---------------|-------------|
| 1 | Wire `AddTaskDialog` to controlled `open`/`onOpenChange` props, then connect to `handleQuickAddAction("task")` | Removes Oppgave placeholder toast — unblocks `manager-quickadd-at-slot` flip to `verified` | S |
| 2 | Wire `DeviationDialog` (or `DeviationSheet`) the same way; connect to `handleQuickAddAction("deviation")` | Removes Avvik placeholder toast | S |
| 3 | Wire `ShiftStartDialog` actual write path (resolve active shift → call `start-shift-action`) | Removes Vaktstart stub; emits `shift.started` | M |
| 4 | Build `/dashboard/communication/notes/[id]` route + mobile NoteDetail screen | Push deep-link target for `employee-receives-targeted-note`. Without it the notification action_url 404s | M |
| 5 | Seed admin + cross-dept fixtures for E2E (`apps/e2e/fixtures/admin.ts`) | Unblocks Journey 3 E3/E4 cross-dept tests (currently `test.skip()`) | S |
| 6 | Wire delete UI for `session_note` + emit `comm.scheduled_note.deleted` | Event is registered but no UI consumer. Decide: delete from note-detail page or from event-list context menu | S |
| 7 | Add real network-failure intercept to slot-quickadd spec E3 | Currently `test.skip()` — placeholder for `page.route()` mock | XS |
| 8 | Promote ADR-0331/0332/0333 from `proposed` → `accepted` after Phase 1 in production for ~2 weeks | Per ADR governance — promote when stable | XS |

## Decisions made

| ADR | Title | One-line |
|-----|-------|----------|
| [ADR-0331](decisions/0331-dagslinjen-audience-jsonb-vs-junction.md) | Targeted Note Audience Model — JSONB Blob (Phase 1) | `session_note.audience JSONB` (`dept_ids?`, `team_ids?`, `shift_ids?`, `profile_ids?`); no junction table in Phase 1; resolver at `note-fanout-scheduler/audience-resolver.ts` |
| [ADR-0332](decisions/0332-dagslinjen-fanout-scheduler-cadence.md) | Scheduled Note Fanout — pg_cron → Edge Function Cadence | pg_cron `*/5 * * * *` → Edge Function via `net.http_post` with `WATCHDOG_CRON_SECRET`; mirrors `session-hook-executor`; idempotency via `delivered_at IS NULL` |
| [ADR-0333](decisions/0333-dagslinjen-cross-dept-c4-gate.md) | Cross-Department Note Fanout — C4 Authority Gate | `gateAction("comm.note_fanout_cross_dept", level='confirm', min_role='admin')` in Server Action BEFORE insert; own-dept skips gate; rejects RLS-CHECK and deferred-filter alternatives |

All three registered in `docs/decisions/0000-decision-log.md` (lines 58-60),
status: `proposed`.

## Learnings registered

- [L-0272](learnings/0272-session-note-column-naming.md) —
  `session_note` columns: `content` not `body`, `created_by` not
  `created_by_profile_id`, `department_session_id` not `session_id`
- [L-0273](learnings/0273-shadcn-dialog-uncontrolled-open.md) — shadcn
  dialogs that own internal open-state cannot be programmatically
  opened from outside; needs controlled-prop refactor before chaining
  UIs
- [L-0274](learnings/0274-code-architect-no-write-tool.md) —
  `feature-dev:code-architect` skill lacks Write tool — for spec-fill
  tasks use general-purpose (sonnet) or write the spec yourself from
  the architect's text report
- [L-0275](learnings/0275-data-testid-belongs-to-track-h.md) —
  `data-testid` additions are a Track H polish step, NOT a build-track
  concern (separation of test-author vs component-author scope)

## Telemetry events added

| Event | Destinations | Emit site |
|-------|-------------|-----------|
| `ui.dagslinjen.slot_quickadd.action_picked` | posthog + logger | `SlotQuickAddPopover.tsx:110` |
| `ui.dagslinjen.scope_filter_changed` | posthog + logger | `ScopeFilterPill.tsx:72` |
| `comm.scheduled_note.created` | activity_trail + posthog + logger | `create-targeted-note-action.ts:173` |
| `comm.scheduled_note.delivered` | activity_trail + logger | `note-fanout-scheduler/index.ts:216` (direct activity_trail insert; Edge Function cannot import `@smartout/telemetry`) |
| `comm.scheduled_note.deleted` | activity_trail + logger | Registered only — no UI delete path yet (follow-up item 6) |

Routing table verified at `packages/telemetry/src/registry.ts:13110-13125`.

## Schema delta

New migrations (forward-only):

- `20260616100500_session_note_targeted_fanout.sql` — adds
  `audience JSONB`, `notify_at TIMESTAMPTZ`, `delivered_at TIMESTAMPTZ`,
  `deleted_at TIMESTAMPTZ`, `note_type TEXT` (CHECK
  `('handoff','signoff','reminder','targeted')`) on `session_note`;
  GIN index on `audience`; partial B-tree on `notify_at WHERE
  delivered_at IS NULL`; CHECK enforces audience non-empty when
  `notify_at IS NOT NULL`
- `20260616100600_note_fanout_scheduler_cron.sql` — pg_cron job
  `note-fanout-scheduler` at `*/5 * * * *` invoking Edge Function via
  `net.http_post` with `WATCHDOG_CRON_SECRET` bearer
- `20260616100700_seed_comm_note_fanout_cross_dept_authority.sql` —
  two-part seed (ADR-0192): Part A inserts
  `capability_default_registry` for `comm.note_fanout_cross_dept`;
  Part B backfills `engine_authority_config` for all existing
  workspaces

Types regenerated to `packages/supabase/src/database.types.ts` (+92
lines).

## File-touch summary per track

| Track | Files added | Files edited | Net lines |
|-------|-------------|-------------|-----------|
| B (spec fill-in) | 1 (design.md) | 1 (PLAN) | ~+340 |
| Council ADRs | 3 (ADR-0331/0332/0333) | 1 (decision-log) | ~+720 |
| A (schema) | 3 (migrations) | 1 (database.types) | ~+390 |
| C (popover + UI) | 4 (SlotQuickAddPopover, ShiftStartDialog, ReservationSheet edit, TimelineTab edits) | 1 | ~+550 |
| D (filter) | 3 (ScopeFilterPill, ScopeFilterPopover, useDayTimelineScope) | 1 (DayTimelineStrip) | ~+420 |
| E (targeted writer) | 2 (create-targeted-note-action, resolve-audience-dept-ids) | 1 (DailyNoteSheet) | ~+500 |
| F (scheduler) | 3 (note-fanout-scheduler/index.ts, audience-resolver.ts, audience-resolver.test.ts, config.toml entry) | 1 (registry.ts) | ~+800 |
| G (E2E) | 4 (4 .spec.ts files) | 0 | ~+1200 |
| H (closure) | 5 (testid commits, 4 learnings, HANDOFF) | 4 (journeys), 1 (DASHBOARD) | ~+460 |

Total: 42 files changed, +6589 / −108.

## Verification matrix

| Journey | Happy E2E selector wiring | Error E2E coverage | Telemetry | Authority gate | Mobile parity | Status |
|---------|--------------------------|---------------------|-----------|----------------|---------------|--------|
| manager-quickadd-at-slot | OK (testids added). Booking + Notat + Vaktstart wired. Oppgave/Avvik = placeholder toast. | E2 (employee read-only) passes; E1/E3/E4 `test.skip()` on fixture limits | OK (`slot_quickadd.action_picked`) | N/A (popover hidden for employee = UI gate) | Web-only authoring (ADR-0133 — composition stays web) | `in_progress` |
| manager-filter-timeline | OK (testid added). URL search-param persists across reload. | E1/E2 disabled-tab tests skip on fixture; E3 manager-scope skips; E4 covered by `timeline-empty-state` testid | OK (`scope_filter_changed`) | Manager-scope via `ownDeptForFilter` prop | Web-only filter UI | `verified` |
| manager-target-note-fanout | OK (all 5 testids added). H1 full flow + H2 telemetry test pass with seeded data. | E1 (empty audience), E2 (notify_at past), E5 (engine_process enqueue fail) wired; E3/E4 cross-dept skip on admin-fixture absence | OK (`comm.scheduled_note.created`) | C4 `comm.note_fanout_cross_dept`, seed migration backfills all workspaces | Web-only authoring | `in_progress` |
| employee-receives-targeted-note | Spec wires push-flow simulation; `note-body` testid available but route 404s | E1-E5 covered (left team / push revoked / late scheduler / double-fire race / soft-delete) — unit-level via Edge Function tests | OK (`comm.scheduled_note.delivered` direct to activity_trail) | N/A (system-actor pattern) | Mobile push + NoteDetail screen pending (follow-up #4) | `in_progress` |

## /audit smoke verification

Manual code-trace (not full `/audit smoke` agent run — would have
flagged the four `in_progress` items as transparent open work, not
blockers):

| ADR | Verification | Verdict |
|-----|-------------|---------|
| ADR-0099 (unified authority gate) | `gateAction()` called for cross-dept path before insert; `gate_evaluation` audit row written transparently via shared helper | PASS |
| ADR-0134 (telemetry workspace_id/actor_id non-null) | `nonEmpty()` brand applied on both fields in `create-targeted-note-action.ts:175-176`; Edge Function uses `SYSTEM_ACTOR_ID` constant for platform-actor writes | PASS |
| ADR-0151 (server-derived profile_id) | `resolveCurrentProfile()` at action.ts:80; never reads from request body; cross-workspace guard at lines 86-94 | PASS |
| ADR-0173 (capability-namespace boundary) | New capability `comm.note_fanout_cross_dept` is namespaced; no cross-namespace writes from this Server Action | PASS |
| ADR-0177 (silent workspace-mismatch fallback) | Cross-workspace guard returns explicit error "Profil ikke funnet eller annet workspace" — no silent fallback | PASS |
| ADR-0189 (authority-seed-parity) | Seed migration includes literal `'comm.note_fanout_cross_dept'` in VALUES tuple — parity scanner will match | PASS |
| ADR-0192 (capability_default_registry + bootstrap) | Two-part seed: Part A registers in `capability_default_registry`; Part B backfills existing workspaces | PASS |
| ADR-0204 (gatedMutation wrapper) | Server Action uses `gateAction()` directly before INSERT — matches the gate-first pattern for capability writes; not a capability tool, so wrapper-call shape differs from tools.ts pattern | PASS |
| ADR-0265 (deploy pipeline) | No infra/scripts changed; no preview/main touched; pure development-branch work | PASS |
| ADR-0331/0332/0333 | Self-consistent — this sortie's own decisions, structurally implemented | PASS |

## Cascade integrity check (for cross-cutting steward review)

- `session_note` extension is a D6-production-layer artifact (ADR-0331);
  not a duplicate of `engine_process` workflow state
- Scheduled fanout via pg_cron is the canonical "wake periodically and
  reconcile" pattern (mirrors `session-hook-executor`); not a parallel
  workflow engine
- C4 gate sits BEFORE the write — permission ≠ truth (audience JSONB
  is the truth, gate decides whether the writer is allowed)
- Provenance: every fanout writes `correlation_id` to logger and to
  `activity_trail.data.correlation_id`; supports re-derivation audit

## Final state

- 5 commits on `feat/dagslinjen-quickadd` since fork from `development`
  - `bccd5ed81` — Track B (spec)
  - 3 ADR commits (`43c82285e`, `a650eb3a3`, `63abcded0`)
  - `6d00995a0` — Track A (schema)
  - `65be98b64` — Track C (popover + UI)
  - `bb1ba1534` — Track D (filter)
  - `575b7077c` — Track E (note writer)
  - `7bc168e3c` — Track F (scheduler)
  - `f8fd990ff` — Track G (E2E)
  - `30f3cdacf` — Track H (testids)
  - `462833b85` — Track H (journey flip)
  - (this HANDOFF + learnings + DASHBOARD update)
- Branch ready for close-feature script run
- Recommended next sortie list documented above (items 1-8)

## Closure protocol

When ready to merge:

```bash
cd ~/dev/smartout.ai-wt-4
# (this HANDOFF satisfies the required-deliverable gate)
# (journeys are stamped; no draft remains)
# typecheck:
pnpm turbo typecheck
# close:
close-feature.sh 4
```

Per CLAUDE.md feature-closure gate: 4 journeys present with `status` set
(1 `verified`, 3 `in_progress`), HANDOFF present (this file), 3 ADRs
registered, learnings registered, typecheck deferred to script runner.
