---
id: ADR_0335
title: Timeline Templates — D6 Authoring with Scope Filter + Save/Apply
status: accepted
date: 2026-05-16
deciders: Pontus + Claude (timeline-templates sortie)
supersedes: []
superseded-by: []
related: [ADR_0078, ADR_0099, ADR_0116, ADR_0133, ADR_0151, ADR_0156, ADR_0189, ADR_0204, ADR_0287, ADR_0298, ADR_0313, ADR_0316]
council: 2026-05-16 (Pre-Day Planning Wizard council, REJECTED-as-framed; this ADR documents the re-scoped narrower D6-only feature that emerged)
---

# ADR-0335 — Timeline Templates: D6 Authoring with Scope Filter + Save/Apply

## Status

Accepted 2026-05-16.

## Context

The 2026-05-16 System Council reviewed a "Pre-Day Planning Wizard" that proposed mounting a cross-cascade-role projection (D2+D3+D4+D6+C2+C3+C4) as a mode-switch inside `WebDayControl`'s Dagslinjen tab. The council REJECTED that framing per L-0252 + ADR-0316 (cross-cascade projections belong on their own route, not as tabs of single-dimension shells).

Pontus immediately reframed the requirement: instead of a cross-cascade wizard, build **scope-filtered timeline templates** — narrower, D6-rooted, no aggregation across cascade roles. This ADR documents that narrower feature.

## Decision

Add **timeline templates** as a workspace-scoped authoring affordance inside the existing `Dagslinjen` (TimelineTab) tab of `WebDayControl`. No new route. No mode-switch. No cross-cascade aggregation.

### Surface

- `TimelineTab.tsx` gains a `TimelineTopBar` row composed of `<ScopeFilterPill/>` (extended to 4 scope types: team, department, location, single-shift) + `<SavedTimelinesDropdown/>`
- Slot-click picker grouped into 3 visual lanes (D6 / D2 / free-form)
- `<SaveTemplateDialog/>` + `<ApplyTemplateDialog/>` are overlay surfaces, not new routes
- Mobile parity (ADR-0133): **authoring is web-only.** Mobile reads materialized rows via existing read paths.

### Persistence

New workspace-scoped table `timeline_template`:

- 11 columns (id, workspace_id, name, scope_type, scope_id, items_json, notes, created_by, created_at, updated_at, is_archived)
- `scope_type` enum: `team | department | location | shift`
- `scope_id` polymorphic by `scope_type` (NO foreign key — validated app-side at save + apply)
- `items_json` Zod-validated discriminated union, 6 item kinds
- Soft-delete via `is_archived` (no DELETE policy)
- RLS per ADR-0313: SELECT (workspace member), INSERT (admin only WITH CHECK), UPDATE (creator or admin)

### 6 item kinds (down from 8 in initial proposal)

`schedule_shift`, `session_hook`, `session_task`, `session_note`, `deviation`, `free_form`

Dropped during T0 deep-dive verification:
- `booking` — no `reservation` table exists
- `shift_start` — collapsed into `schedule_shift`
- `daily_note` — renamed to `session_note` (the actual table name)

### Capability surface

New capability `timeline_template` in `packages/ai/src/capabilities/timeline-template/` with 4 tools:

| Tool | gate_action | mutateWithGate | emit() | Surface |
|---|---|---|---|---|
| `save_template` | `timeline_template.save` | INSERT timeline_template | `timeline_template.saved` | chat-only |
| `list_templates` | none (read-only) | direct SELECT | `timeline_template.listed` | chat-only |
| `apply_template` | `timeline_template.apply` | transactional per-kind inserts | `timeline_template.applied` + per-row reused events | chat-only |
| `archive_template` | `timeline_template.archive` | UPDATE is_archived=true | `timeline_template.archived` | chat-only |

All tools per ADR-0204/0287 (mutateWithGate), ADR-0078 (chat-only voice-reject), ADR-0151 (server-derived workspace_id + profile_id), ADR-0116 (terminal emit() on success path).

### Cron coordination

Spec-critical invariant: **canvas writes `session_hook`, NEVER pre-creates `session_task` derived from hooks.** Cron `session_hook_executor` materializes session_task from procedure_step at the hook's anchor time on the applied date. This preserves the cron's idempotency contract and avoids dual-pipeline drift.

For canvas-authored `session_task` items (template entry with kind=session_task), inserts go through with `session_hook_id = NULL` to distinguish from cron-materialized tasks. This was the supervisor's Phase 3 finding from the rejected wizard council; preserved here.

### Telemetry

5 new event ids per ADR-0116. Per-row apply emits reuse existing events with `metadata.source: "template_apply"` for provenance discrimination (no registry bloat). Verified by T6 audit 2026-05-16.

### Authority

Authority seed migration sets `engine_authority_config(capability='timeline_template', level='confirm')` per workspace + adds row to `capability_default_registry` for ADR-0189 auto-seed on future workspaces.

## Why not the wider council-rejected wizard?

The 2026-05-16 council found that cross-cascade-role projections (D2+D3+D4+D6+C2+C3+C4) embedded inside a single-dimension shell (D6 Dagslinjen) violate L-0252 + ADR-0316. The council recommended either (a) own route + 4 sequential sorties (3 prerequisite + 1 wizard), or (b) re-scope to narrower D6-rooted feature.

Pontus picked (b). The narrower feature:
- Stays D6-rooted (the only writes target D6 + D2 tables, all authoring verbs)
- Filter is presentation-state, not cascade-role projection
- No framework_rule evaluator dependency
- No pre-shift cost-preview dependency
- No prior-session aggregator
- No new department_session status
- No hybrid commit across 5+ artifact types

Result: L-0252 / ADR-0316 conflict evaporates. This is a clean D6 authoring extension, not a cross-cascade surface.

## Consequences

### Positive

- Admins can save reusable timeline templates per scope, apply to any future date
- Free-form chips give flexibility without requiring schema extension
- No new route, no new tab — extends the surface Pontus already uses daily
- Cron coordination preserved (no dual-pipeline drift)
- Mobile parity respected (web-only authoring, mobile reads materialized rows)

### Negative

- Polymorphic `scope_id` has no FK — orphans on scope-entity deletion (mitigation: nightly heartbeat marks orphans `is_archived=true` — separate sortie)
- `apply_template` transaction uses single-exec-callback serial atomicity, not native Postgres `BEGIN/COMMIT`. True transaction wrap = Phase 2 upgrade via dedicated SQL function (documented in `tools.ts` file header)
- Location scope only filters `schedule_shift` items (D6 items don't have `location_id`). UI displays explicit warning notice
- Hook authoring proxied to AddTaskDialog as TODO (dedicated HookDialog = follow-up sortie)

### Neutral

- 5 new telemetry events but 0 new per-row events (reuses existing ids via `metadata.source` discrimination)

## Phasing

- **Phase 1 (this sortie):** All 6 item kinds, save/apply/archive, 4 scope types, free-form per-chip materialization
- **Phase 2:** "Vis arkiverte" + undo, bulk apply, template duplication, native SQL transaction wrap, dedicated HookDialog
- **Phase 3:** Recurrence (cron auto-apply on weekday match) — requires recurrence-engine ADR first

## Verified by

- T0 — deep-dive grep verified column names + table existence
- T1 — migration + types, typecheck 0 errors, RLS confirmed (commit f458ae7d3)
- T2 — capability tools, per-tool compliance PASS (commit fb275db29)
- T3 — BFF routes + hooks, per-route security audit PASS (commit c1c770568)
- T4 — 3 mockup HTML frames + INDEX (commit 30216e608)
- T5 — UI components, 0 new typecheck/lint errors (commit d0deaa6a9)
- T6 — telemetry + emit audit, PASS zero blockers
- T7 — 9 Playwright tests across 3 journeys, 0 bugs found (commit 8dd21ed12)
- T8 — final audit (this commit)

## References

- Spec: `docs/superpowers/specs/2026-05-16-timeline-templates-design.md`
- Journey: `docs/journeys/JOURNEY-timeline-templates.md`
- Handoff: `docs/HANDOFF-timeline-templates.md`
- Council: 2026-05-16 (rejected wider wizard, this ADR documents narrower re-scope)
- Related ADRs: 0156 (WebDayControl canonical), 0204/0287 (mutateWithGate), 0151 (server-derive), 0078 (chat-only), 0116 (telemetry), 0099 (gate_action), 0313 (D6 RLS), 0189 (authority seed parity), 0298 (task source fragmentation), 0316 (cross-cascade route rule — verified no violation), 0133 (mobile boundary)
