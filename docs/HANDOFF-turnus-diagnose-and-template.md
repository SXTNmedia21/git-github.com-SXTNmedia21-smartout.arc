---
title: HANDOFF — Turnus Diagnose + Week Template (Phase 1)
status: ready_for_close
updated: 2026-05-25
created: 2026-05-25
module: scheduling
tags: [handoff, scheduler, turnus, week-template, ADR-0417, phase-1]
---

# HANDOFF — Turnus Diagnose + Week Template (Phase 1)

## Summary

Phase 1 adds two new capabilities to the `scheduler` capability: `diagnose_turnus_disabled` (read-only D1–D5 audit that tells a manager exactly which cascade pre-conditions are missing before they can activate turnus) and `list_week_templates` + `apply_week_template` (manager applies a past archived week as a planning template, yielding a `change_proposal` of `kind='template_apply'`). The `accept_proposal` tool was extended to handle this new kind. All three intents were wired into the intent classifier and the `mr-botsson` mission system prompt.

Track F (this track) additionally resolved four column-drift bugs in `diagnose_turnus_disabled` that surfaced during live E2E — same class as L-0348, caught only when running against the real schema. 54/54 tests pass after fix.

## What was built

| Component | File | Description |
|---|---|---|
| `diagnose_turnus_disabled` tool | `packages/ai/src/capabilities/scheduler/diagnose-tools.ts` | Read-only D1–D5 audit. Checks planning_cycle, department_operating_hours, employment_contract, regulatory_framework, season/budget/factors, workspace.is_active, D6 shift count. Returns structured Norwegian output with per-dimension fix-hints. Voice: trimmed summary. |
| `list_week_templates` tool | `packages/ai/src/capabilities/scheduler/tools-template.ts` | Lists archived planning_cycles as template candidates. Read-only, voice-OK. Returns Norwegian-formatted table or "ingen" message. |
| `apply_week_template` tool | `packages/ai/src/capabilities/scheduler/tools-template.ts` | Derives `proposed_shifts[]` from archived source cycle, writes `change_proposal kind='template_apply'`. Chat-only (ADR-0288). Gate + emit wired. |
| `accept_proposal` extension | `packages/ai/src/capabilities/scheduler/tools.ts` | Extended to handle `kind='template_apply'`: bulk-inserts `schedule_shift` rows with `employee_id=NULL` (unassigned; manager assigns post-accept). |
| Intent classifier | `packages/ai/src/router/intent-classifier.ts` | Added: `scheduler_turnus_diagnose`, `scheduler_week_template_list`, `scheduler_week_template_apply` intents to `z.enum()`. |
| mr-botsson mission | `packages/ai/src/missions/mr-botsson.ts` | System prompt extended with turnus diagnose + week template intent descriptions. |
| ADR-0417 | `docs/decisions/0417-turnus-diagnose-week-template.md` | Promoted from draft → accepted. Defines tool contract, channel policy, kind='template_apply' taxonomy, status='archived' for template eligibility. |
| COMMENT migration | `supabase/migrations/20260626200000_comment_change_proposal_kind_template_apply.sql` | Documents `kind='template_apply'` payload shape in DB column comment. No DDL change. |
| Scheduler tests | `packages/ai/src/capabilities/scheduler/__tests__/diagnose-tools.test.ts` | 9 tests (7 existing + 2 new for voice + ISO week). Mock tables updated to reflect real schema. |
| Track A drift fixes | `docs/decisions/0417-turnus-diagnose-week-template.md` + commit `254e9d619` | Schema cross-check: `planning_cycle.start_date`/`end_date`, `department_operating_hours.id`, `employment_contract.contract_id`, `regulatory_framework` (no workspace_id), workspace has no `niche` column. |

## Decisions made

| Decision | Registered |
|---|---|
| ADR-0417: `template_apply` kind + tool contracts + channel policy | `docs/decisions/0417-turnus-diagnose-week-template.md` (promoted accepted) |
| `accept_proposal` extended to cover `kind='template_apply'` — same gate, same emit, same bulk-shift path, `employee_id=NULL` | ADR-0417 §accept_proposal |
| `status='archived'` is the template eligibility criterion for planning_cycle | ADR-0417 §Template source criteria |
| D3 check uses `regulatory_framework` (K1a platform-level, `is_active=true`) — NOT `framework_rule.workspace_id` (column doesn't exist) | This HANDOFF §Learnings |
| D5 check uses `workspace.is_active` — NOT `workspace.niche` (column doesn't exist; aspirational spec) | This HANDOFF §Learnings |
| `applied_from_template_id` column (ADR-0417 line 55) deferred to Phase 2 — no schema migration in Phase 1 | ADR-0417 §Deferred |
| `applied_template_provenance.source_cycle_id` field removed from tools-template.ts body (Track E review) — writer never populated it (phantom field, L-0176 class) | commit `83a73bf8a` |

## Learnings

**L-NEW-1 — D1/D3/D5 column drift caught only at live E2E (Track F)**

Four column drift bugs survived Track E review because tests used mocks, not the real DB:

| Check | Code queried | Real column |
|---|---|---|
| D1 `department_operating_hours` PK | `department_operating_hours_id` | `id` |
| D2 `employment_contract` PK | `employment_contract_id` | `contract_id` |
| D3 `framework_rule.workspace_id` | does not exist | No `workspace_id` on `framework_rule`; belongs to `regulatory_framework` (K1a) |
| D5 `workspace.niche` | does not exist | Column is aspirational spec; actual check is `workspace.is_active` |

Same class as L-0348 (solver column drift). Root cause: tool spec written against aspirational schema not cross-checked against `database.types.ts` or `psql \d`. Fix: real-DB smoke (Node E2E script) catches this; mock-only tests cannot.

**L-NEW-2 — Telemetry activity_trail rejection for `entity`-less events**

Both `scheduler.diagnose.requested` and `scheduler.template.listed` emit without an `entity` reference, triggering:

```
[telemetry] Expected entity reference (nested 'entity' or flat entity_type/entity_id) for event "X" but none was found. Activity trail rejected.
```

Telemetry still fans out to PostHog + Logger. Activity trail silently drops the event. This is a known telemetry contract constraint (events without `entity` fail the activity_trail writer). Deferred to Phase 2 — would require adding `entity_type: "planning_cycle"` + `entity_id: planning_cycle_id` to the emit calls, which needs either the cycle ID injected into diagnose or a synthetic entity for list operations.

**Sibling references:**
- L-0292 (intent enum lag): every new capability name must land in same commit as classifier enum + system prompt. Done here: commit `6ad5cf31d`.
- L-0348 (column drift recurring): live E2E is the only reliable gate. Mock tests pass on non-existent columns.
- L-0176 (phantom field): `applied_template_provenance.source_cycle_id` removed at Track E — writer never populated it.

## Acceptance status vs plan

| Deliverable | Status | Notes |
|---|---|---|
| Track A: schema audit + ADR-0417 | PASS | Promoted draft→accepted, commit `254e9d619` |
| Track B: `diagnose_turnus_disabled` | PASS (with fix-up) | Column drift fixed in Track F; 9/9 diagnose tests pass |
| Track C: `list_week_templates` + `apply_week_template` + `accept_proposal` extension | PASS | Commits `e297d17ee` + `413a6c8a8` |
| Track D: intent classifier + mr-botsson wire | PASS | Commit `6ad5cf31d` |
| Track E: code review APPROVE-WITH-CONDITIONS | PASS | 2 conditions fixed in `83a73bf8a` (shift-count column + phantom provenance) |
| typecheck | PASS | 33/33 scheduler tests (pre-Track-F) |
| **E2E.1 — diagnoseTurnusDisabled** | PASS (after fix-up) | Returns Norwegian structured output with 3 missing dimensions (D1/D2/D4) for hq-workspace. Live data gap — no dept_operating_hours/contracts/season seeded. Result: `ready=false, missing_count=3`. |
| **E2E.2 — listWeekTemplates** | PASS (DATA GAP) | Returns `"Ingen tidligere uker å bruke som mal — ingen arkiverte planleggingssykluser funnet."` — expected: hq-workspace has only 1 active cycle, no archived ones. |
| **E2E.3 — applyWeekTemplate** | PASS (DATA GAP) | Returns `"Kilde-syklus ikke funnet: ..."` — expected: no archived source cycle in seed data. No `change_proposal` of kind `template_apply` written (correct: gate blocked on missing source). |
| Track F: 54/54 tests pass | PASS | After mock table updates to reflect real schema |

## Known issues / debt

| Item | Severity | Phase |
|---|---|---|
| `applied_from_template_id` column not implemented | Medium | Phase 2 — requires migration + `apply_week_template` body update to store source reference on each proposed shift |
| `scheduler.diagnose.requested` + `scheduler.template.listed` emit without entity → activity_trail rejected | Low | Phase 2 — add `entity_type: "planning_cycle"` / `entity_id` to emit calls |
| hq-workspace seed data has no `department_operating_hours`, `employment_contract`, or `season` → diagnose always returns 3+ missing | Low | Demo data gap — add seed rows in Phase 2 if live demo of ready=true path is needed |
| `listWeekTemplates` soft-skip pattern: per-cycle errors (e.g. date format) push error string into result array instead of throwing | Low | Known design choice (ADR-0417 §soft-skip). Logged, not user-surfaced in V1. |
| `makeMaybySingle` typo in comment (tools-template.ts) | Trivial | Fix in next pass |
| Telemetry `activity_trail` silently drops diagnose + list events | Low | L-NEW-2 above; Phase 2 add entity reference |

## Next steps

1. **Phase 2 — `applied_from_template_id` column**: Add migration `20260627000000_add_applied_from_template_id_to_schedule_shift.sql`, update `accept_proposal` body to populate it, and add regression test.
2. **Phase 2 — seed archived cycle**: Add a migration or seed entry that sets one `planning_cycle` to `status='archived'` in hq-workspace so E2E.3 can produce a real `change_proposal` row.
3. **Phase 2 — telemetry entity**: Add `entity_type: "planning_cycle"` + `entity_id` to both emit calls in diagnose + list tools.
4. **Empty-state UI**: `BotssonArena` / schedule page — wire diagnose result into a visible card when turnus is disabled (frontend-designer territory).
5. **Voice view-tool mirror for diagnose**: `diagnose_turnus_disabled` is voice-OK. A companion `set_schedule_diagnose_view` client tool could open the diagnose panel on voice trigger. Follows pattern from commit `bc1b3c3ee` (schedule view-tools).
6. **Demo data seed**: seed `department_operating_hours`, `employment_contract`, `season`/`season_budget` for hq-workspace so the happy-path (ready=true) is demonstrable end-to-end.

## References

- ADR-0417: `docs/decisions/0417-turnus-diagnose-week-template.md`
- Track A schema audit: commits `254e9d619` (drift fixes + ADR-0417 promoted)
- Track B: commit `01e3c6946` (diagnose_turnus_disabled)
- Track C: commits `e297d17ee` (list + apply) + `413a6c8a8` (accept_proposal extension)
- Track D: commit `6ad5cf31d` (intent classifier + mr-botsson)
- Track E: commit `83a73bf8a` (shift-count column fix + phantom provenance removal)
- Track F column drift fix: this commit (diagnose-tools.ts: 4 column names, test mocks)
- L-0292 (intent enum lag), L-0348 (column drift), L-0176 (phantom field)
- COMMENT migration: `supabase/migrations/20260626200000_comment_change_proposal_kind_template_apply.sql`
