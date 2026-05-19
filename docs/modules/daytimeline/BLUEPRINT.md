---
title: Day Timeline — Blueprint
status: in_progress
updated: 2026-05-18
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, blueprint, phases, area-anchored, tri-layer]
---

# Day Timeline — Blueprint

> Target state + 6-phase implementation plan. Falsifiable acceptance per phase. Read with [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) and the canonical spec `docs/superpowers/specs/2026-05-18-dagslinje-area-anchored-design.md`.
>
> **2026-05-18 update:** Revised per ADR-0367 (proposed). Phase plan switched from 4-option council to direct tri-layer delivery. Estimate reduced from 9d to 4-6d solo, 2-3d parallel.

## 1. Target State

The Day Timeline becomes an **area-anchored, multi-strip stack** on web with full read-parity on mobile (ADR-0367 tri-layer model). Each strip is a `day_line` row carrying `(department_session_id, location_id, planned_open, planned_close)` where `location` is treated as area (per core-structure module). Every D6 child (`session_hook`, `session_task`, `schedule_day_booking`, `deviation`) gains a nullable `day_line_id` — `NULL` = department-level (open/close routines not pinned to area), `NOT NULL` = area-anchored.

The runtime layer is `shift_session` (NEW per ADR-0367): one row per `schedule_shift`, auto-bound to matching `day_line` rows via `shift_session_day_line` junction at shift insert. Clock-in flips status + subscribes push topic; engine-dispatch fans push to active shift_sessions with idempotency via `engine_event`.

Managers can:
- Create new day_lines for areas their department staffs (per `department_location`).
- Edit opening/closing per day_line.
- Add single tasks or attach routines (hook + children) at any slot — slot picker anchored at the click coordinate (already shipped).
- Apply saved `timeline_template` rows (already shipped per ADR-0335) onto a chosen day_line.

Admins + owners have unrestricted authoring across all areas.

Employees (mobile) see only the day_lines matching their `shift_session_day_line` junction rows for the day. Mobile is read+execute per ADR-0133 — no authoring affordances on day_line.

The C4 governance surface gates every mutation via `gate_action`. Telemetry records every state change to `activity_trail` + `engine_event`. Voice surface remains read-only on day_line — authoring stays in chat per ADR-0078 PII restrictions.

---

## 2. Phase Sequence (Revised 2026-05-18 per ADR-0367)

| Phase | Goal | Closes Gaps | Acceptance | Wall-time |
|---|---|---|---|---|
| A | Schema + RLS + Backfill | G3.1, G3.7, G3.11 | `day_line`, `shift_session`, `shift_session_day_line`, `department_location` live in dev; child FKs added; backfill dry-run produces 1 day_line per existing dept session; RLS deny-test passes | 0.5–1d |
| B | Capabilities + Server Actions + Triggers | G3.4, G3.5, G3.9 | `day_line.create`, `day_line.add_item`, `day_line.instantiate_template`, `routine.attach_to_line`, `org.update_dept_areas` live with gate_action + telemetry + tests; `schedule_shift` trigger auto-creates `shift_session` + populates `shift_session_day_line` | 0.75–1d |
| C | UI rewire (web) | G3.2, G3.3, G3.6, G3.12 | TimelineTab renders multi-strip stack; SlotPicker gains Routine entry; AttachRoutineDialog ships; aggregated-overview when no scope selected; Nordic Split audit clean (ADR-0366) | 1–1.5d |
| D | Mobile (shift_session + push) | G3.8, G3.15 | `useShiftSession` hook; mobile day view renders shift_session-scoped day_lines; clock-in subscribes push topic; defensive client-filter + leak telemetry | 0.5–0.75d |
| E | Push pipeline (engine-dispatch) | NEW from ADR-0367 spec | engine-dispatch tick fans push to active shift_sessions with `engine_event` idempotency; synthetic test: insert item with scheduled_at=now+1min → exactly-once push | 0.5d |
| F | Journeys + E2E + Docs | G3.13, G3.14 | 5 journey docs; 3 web Playwright specs + 1 mobile E2E; `docs/modules/daytimeline/*` updated; `/audit smoke` green | 0.5–0.75d |

**Total:** ~4–6 wall days solo, ~2–3 wall days with parallel sub-sortier.

Each phase is one council-reviewable sortie. Sortier ship on sub-branches off `campaign/ui-shell` or a new campaign `campaign/daytimeline-area-anchored` if scope warrants.

**Council gate:** ADR-0367 currently `proposed`. Before Phase A merge, run `run-council` skill with: `system-steward` (chair), `supervisor`, `system-agent-coordinator`, `botsson-harness-builder`, `frontend-designer`. Verdict locks the schema before migration.

---

## 3. Phase A — Council + ADR

**Goal:** Resolve the cascade-class decision (CRITICAL gap G3.10).

**Deliverables:**
- Council brief with 3-option matrix (A: location_id on department_session; B: location_id on session children; C: new day_line table).
- Council verdict + ADR draft.
- Backfill strategy approved.

**Council composition (per `run-council` skill rules):**
- `system-steward` (chair)
- `supervisor` (codebase conventions)
- `system-agent-coordinator` (capability surface impact)
- `botsson-harness-builder` (L1-L5 pipe view — voice snapshot integration)
- `frontend-designer` (multi-line stack UI implications)

Code-tracer mandate: assign payload trace to `system-agent-coordinator` — follow `location_id` resolution end-to-end from SlotPicker → Server Action → capability → DB → strip read → mobile read.

**Falsifiable acceptance:**
- [ ] ADR accepted with explicit option + reasoning.
- [ ] Council Phase 5 synthesis lists every same/different/partial-overlap statement pair from Phase 3 reviewers.
- [ ] Backfill strategy enumerates: (1) which dept's first location to pick; (2) how admin overrides before flip; (3) rollback plan if backfill detects orphans.
- [ ] L-0066 review — every new capability has a seed migration drafted.

**Estimate:** 1 council + 1 ADR-drafting sortie. ~3-5 hours wall time.

**Blockers cleared:** Critical G3.10. Unlocks everything else.

---

## 4. Phase B — Schema + Backfill

**Goal:** Land `day_line` table + child FKs + backfill, with legacy bridge.

**Migrations (timestamps after current `development` HEAD; verify with L-0042 dependency check):**

1. `<TS>_day_line_table.sql` — CREATE TABLE day_line (per DATA-MODEL §5).
2. `<TS+1>_day_line_child_fks.sql` — ADD COLUMN day_line_id to session_hook, session_task, schedule_day_task, schedule_day_booking, schedule_day_info, deviation. All nullable initially.
3. `<TS+2>_day_line_backfill.sql` — INSERT INTO day_line SELECT from department_session; UPDATE child rows with the new day_line_id. Wrap in BEGIN/COMMIT; idempotent via ON CONFLICT.
4. `<TS+3>_day_line_capability_seed.sql` — INSERT INTO capability_default_registry + engine_authority_config for `day_line.create`, `day_line.edit_opening_closing`, `routine.attach_to_line`.

Legacy bridge: `department_session` remains writable for one release. `day_line` rows reference the legacy session via `legacy_department_session_id` (nullable, indexed, drop after flip).

**Falsifiable acceptance:**
- [ ] Migration applies clean on `npx supabase db reset`.
- [ ] Backfill dry-run: count(day_line) == count(department_session) post-migration.
- [ ] Capability seed: 3 new rows in `capability_default_registry`; 3 in `engine_authority_config` for the default workspace.
- [ ] L-0042 dependency check: every referenced table/enum/function created in an earlier migration.
- [ ] L-0066 gate test: a capability NOT-seeded scenario rejected at runtime.
- [ ] RLS policies for day_line: SELECT by workspace member; INSERT/UPDATE gated via `gate_action` (no direct DML for non-admins).

**Estimate:** 1 sortie. ~6-8 hours wall.

**Risk:** Backfill irreversibility. Mitigation: keep `department_session` writable + reversible flag in migration.

---

## 5. Phase C — Capability + Server Action Layer

**Goal:** Wire L4 capabilities + L2 Server Actions + telemetry.

**New capability folders:**
- `packages/ai/src/capabilities/day-line/` — tools: `create`, `add_item`, `instantiate_template`, `edit_opening_closing` (planned), `delete` (admin+, future). Includes `gate.ts`, `index.ts`, `tools.ts`, `__tests__/`. **Folder name is `day-line/` (NOT `timeline/`) — `timeline-template/` already exists.**
- `packages/ai/src/capabilities/routine/` — tools: `attach_to_line`, `detach`, `list_templates_for_scope`.

**Existing capability updates:**
- `task.create_session` — accept `day_line_id` param. Resolve `department_session_id` (legacy) or `day_line_id` (new) server-side.
- `task.create_day_ad_hoc` — same.
- `hms.report_deviation` — accept `day_line_id`.
- All emit telemetry with `day_line_id` field added.

**New Server Actions:**
- `apps/web/src/app/dashboard/_actions/create-day-line-action.ts` → `day_line.create`
- `apps/web/src/app/dashboard/_actions/update-day-line-hours-action.ts` → `day_line.edit_opening_closing`
- `apps/web/src/app/dashboard/_actions/attach-routine-action.ts` → `routine.attach_to_line`

**Telemetry additions (registry.ts):**
- `"day_line created"` — fields: `day_line_id`, `location_id`, `department_id` or `team_id`, `planned_open`, `planned_close`
- `"day_line opening_changed"` — fields: `day_line_id`, `prev_open`, `next_open`
- `"day_line closing_changed"` — fields: `day_line_id`, `prev_close`, `next_close`
- `"routine attached"` — fields: `day_line_id`, `template_id`, `task_count`, `anchor_time`

Add to BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map. Recurrence trap reminder.

**Falsifiable acceptance:**
- [ ] All 3 new capabilities registered in `capabilities/registry.ts`.
- [ ] All wrap `gateTask`/`gateTimeline`/`gateRoutine` helpers around `gate_action`.
- [ ] Each tool emits exactly one telemetry event per success path.
- [ ] Unit tests pass: deny path (gate_action denies → 403), allow path (writes + emits).
- [ ] Server Action shape matches ADR-0151 — `workspace_id` + `profile_id` derived from `getServerContext`, never body.
- [ ] No direct `supabase.from('day_line').insert()` outside the capability tool body.

**Estimate:** 1 sortie. ~8-10 hours wall.

**Risk:** Cross-capability boundary leak — routine.attach_to_line writes session_task children. Per ADR-0240 / ADR-0173, cross-namespace writes need explicit ADR. Routine capability MUST delegate to `task.create_session` for each child, not direct INSERT.

---

## 6. Phase D — UI Rewire

**Goal:** TimelineTab renders multi-line stack. Dialogs accept `day_line_id`. SlotPicker gains Routine entry.

**Changes:**

### 6.1 New hook — `use-day-lines.ts`
- Fetches all `day_line` rows for `(workspace_id, date)` joined with location/dept/team.
- Returns sorted array: by location.name → dept.name → planned_open.
- Filters by `?scope=` URL param.
- Reuses `useDayTimelineEvents` per line via `day_line_id` projection.

### 6.2 TimelineTab refactor
- Renders `<DayLineStrip>` per row (extracted from current DayTimelineStrip).
- Each strip independent: own open/close, own hit-zones, own SlotPicker instance.
- Header above strip: `{location.name} · {dept|team.name} · {planned_open}–{planned_close}` + edit button → opens `OpenCloseEditPopover`.

### 6.3 SlotPicker
- New entry in PRODUKSJON lane: "Rutine" → opens `AttachRoutineDialog`.
- Slot picker receives `day_line_id` prop, forwards to dialogs.
- Location-scope disabled-lane treatment kept for backward compat.

### 6.4 Dialogs
- `AddTaskDialog`: optional `day_line_id` prop; tabs "Enkeltoppgave | Rutine" (or two parallel dialogs from SlotPicker).
- `AttachRoutineDialog` (new): template picker filtered by line scope; preview panel; submit calls `attach-routine-action`.
- `OpenCloseEditPopover` (new): inline two-input editor anchored at strip header; submit calls `update-day-line-hours-action`.

### 6.5 ScopeFilterPopover
- Lokasjon tab keeps filter behaviour. Now filters the multi-line stack instead of one strip.
- Add `day_line` tab? Decision: NO — day_line scope is too granular; lines already render individually.

### 6.6 TimelineTopBar
- Add "Ny dagslinje" button → opens `DayLineCreateSheet` (new).
- Saved-templates dropdown unchanged (per ADR-0335).

**Falsifiable acceptance:**
- [ ] TimelineTab renders N strips for N day_line rows.
- [ ] SlotPicker on strip-1 only opens dialogs scoped to strip-1's line.
- [ ] Each strip header shows correct open/close; editing one does not affect others.
- [ ] AttachRoutineDialog inserts hook + N children in one transaction (verify single emit telemetry).
- [ ] Manager outside own dept sees other strips but cannot click hit-zones (canEdit false per strip).
- [ ] Stack header counts update on filter change.

**Estimate:** 1 sortie. ~12-16 hours wall (UI-heavy + design system pass).

**Risk:** Nordic Split token sweep — multi-strip layout may need new tokens for strip spacing. Run `smartout-nordic-split` skill audit before merge.

---

## 7. Phase E — Mobile + RLS

**Goal:** Multi-line read on mobile + RLS policy proof.

### 7.1 RLS policy
```sql
CREATE POLICY "jwt_read_day_line_employee" ON day_line
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM schedule_shift s
    WHERE s.workspace_id = day_line.workspace_id
      AND s.shift_date = day_line.business_date
      AND s.location_id = day_line.location_id
      AND ((day_line.department_id IS NOT NULL AND s.department_id = day_line.department_id)
           OR (day_line.team_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM team_member tm
             WHERE tm.team_id = day_line.team_id
               AND tm.profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
           )))
      AND s.profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  )
);
```

Plus manager+ policy: workspace member with role ≥ manager → unrestricted SELECT on workspace's day_lines.

### 7.2 Mobile day route refactor
- `apps/mobile/app/(app)/(calendar)/day/[date].tsx` rewires to fetch `day_line` rows + per-line events.
- Replaces single absolute-positioned timeline with vertical stack of mini-timelines.
- Each mini-timeline = compact strip (50% web height) with location label + open/close band.
- FlashList virtualization (already used elsewhere in mobile).
- Maintains ADR-0133 read-only invariant.

### 7.3 Mobile defensive filter
- Client-side: drop any line where the viewer's shifts don't match (defense-in-depth per ADR-0287).
- Emit `"day_line rls_leak_detected"` on any drop — never silent.

**Falsifiable acceptance:**
- [ ] Employee at location A only: sees 1 line on mobile.
- [ ] Employee at locations A+B: sees 2 stacked lines.
- [ ] Manager: sees all dept's lines on mobile (regardless of own shifts).
- [ ] RLS leak test: synthetically insert a foreign line, verify employee does NOT see it AND telemetry emits `rls_leak_detected` if client filter catches it.
- [ ] No `gate_action` calls from mobile (mobile remains read-only).
- [ ] Mobile telemetry uses `getProfileContext()` (ADR-0134 fail-fast).

**Estimate:** 1 sortie. ~10-12 hours wall.

**Risk:** Multi-line scroll perf on low-end Android. FlashList covers most cases; if perf degrades, add window-based pagination.

---

## 8. Phase F — Voice + Telemetry + E2E

**Goal:** Voice context, registry hygiene, full E2E coverage.

### 8.1 Workforce snapshot extension
- `services/stage-engine/src/snapshot/*` extends slice to include day_lines for today.
- Voice agent's `agent.updateChatCtx()` developer message includes line summary.
- Chat system-prompt slice same.

### 8.2 Voice tool surface
- NO new authoring tools (chat-only on J7-J10 per ADR-0078).
- `task.list_mine` returns tasks grouped by day_line (formatted in tool output).

### 8.3 Telemetry registry
- All 4 new events registered.
- EVENT_ROUTING map updated (3 destinations minimum: PostHog + activity_trail + engine_event).

### 8.4 E2E coverage
Per [E2E-COVERAGE.md](./E2E-COVERAGE.md):
- Web Playwright specs for J7, J8, J9, J10, J12.
- Mobile Detox/Maestro spec for J11.
- Manual test cases for visual / a11y pass.

**Falsifiable acceptance:**
- [ ] Voice "hva må jeg gjøre" returns tasks grouped per day_line.
- [ ] Voice "lag oppgave kl 14" still routes to chat (V1 PII restriction).
- [ ] All 4 new telemetry events fire end-to-end (verify PostHog + activity_trail).
- [ ] E2E suite green for J7-J12.
- [ ] Manual test pass logged.

**Estimate:** 1 sortie. ~6-8 hours wall.

**Risk:** Voice snapshot bloat — N×(M day_lines × K tasks) token growth. Cap snapshot to ≤2KB per line; spillover via on-demand `read_surface` tool.

---

## 9. Cross-Phase Concerns

### 9.1 Audit + Drift
- After each phase: run `/audit smoke` to catch ADR drift.
- After Phase B + E: run `adr-contract-audit` full sweep.
- Weekly heartbeat audit covers ongoing drift.

### 9.2 Council Re-Review Threshold
Per `run-council` skill L-0147 (Chair Self-Reversal): if 2+ reviewers vote opposite to chair with code-trace evidence, chair MUST classify Phase 3 vote as REVERSED.

Re-council triggers:
- Phase B backfill design rejects single-location-per-dept assumption.
- Phase D UI design surfaces a 4th model option not in the matrix.
- Phase E RLS policy hits a soft-corner case (cross-workspace shifts, system accounts).

### 9.3 Rollback Plan
- Each phase ships its own commit, mergeable independently.
- Phase B backfill includes a reverse migration that nulls `day_line_id` on children and drops `day_line`.
- UI rewire (Phase D) gated behind a feature flag (`use_day_line_model`) for the first 2 releases.

### 9.4 Performance Budget
- TimelineTab initial render ≤200ms with 6 lines × 50 events.
- Hit-zone hover latency <16ms (60fps).
- `useDayLines` query <100ms p95.
- Mobile day route TTI <800ms on iPhone SE 2nd gen.

### 9.5 PII + Security
- `day_line` is non-PII (location + dept + team + hours).
- Tasks may contain owner names — gated as today.
- Voice tools obey ADR-0078 channel restrictions.
- No new RLS surfaces beyond `day_line` itself.

---

## 10. Estimated Wall Time (Revised 2026-05-18)

| Phase | Estimate | Cumulative |
|---|---|---|
| A — Schema + RLS + Backfill | 0.5–1d | 0.5–1d |
| B — Capabilities + Actions + Triggers | 0.75–1d | 1.25–2d |
| C — UI Rewire Web | 1–1.5d | 2.25–3.5d |
| D — Mobile (shift_session + push subscribe) | 0.5–0.75d | 2.75–4.25d |
| E — Push pipeline (engine-dispatch) | 0.5d | 3.25–4.75d |
| F — Journeys + E2E + Docs | 0.5–0.75d | 3.75–5.5d |
| Buffer (testing, polish, drift) | 0.5d | 4.25–6d |

**Total: ~4–6 working days solo for full delivery.** Parallel (3 sub-sortier per phase): **~2–3 wall days.**

Revised down from earlier 9-day estimate because ADR-0367 explicitly reuses:
- existing `location` (area), `zone`, `asset`, `timeline_template` (ADR-0335)
- existing `expo_push_token` (migration `20260418100300`) + mobile push hook
- existing `engine_event` idempotency infrastructure
- existing `shift-lifecycle` clock-in capability (just extended, not created)
- existing `department_session` lifecycle + RLS

Phases can ship independently — partial value lands as early as Phase C (multi-strip UI on top of new schema, even before mobile + push pipeline are live).

---

## 11. Open Questions Tracker (Revised 2026-05-18)

Mirror of DATA-MODEL §7. Most items resolved by ADR-0367.

| # | Question | Status | Resolution |
|---|---|---|---|
| Q1 | Cascade class of day_line | RESOLVED | D6 Production, child of `department_session` (per ADR-0367) |
| Q2 | Backfill primary location | OPEN (Phase A) | Default: first `department_location` alphabetically + 7-day admin-override window |
| Q3 | Team axis on day_line? | RESOLVED | NO — V1 ships dept + area only. Team deferred. |
| Q4 | Legacy dept_session UNIQUE constraint | RESOLVED | KEEP — session aggregate untouched per ADR-0367 |
| Q5 | Timeline template gains day_line scope? | RESOLVED | NO — `scope_type='location'` already exists; templates resolve at apply-time |
| Q6 | Voice creates day_line? | RESOLVED | NO — chat-only V1 per ADR-0078 |
| Q7 | Mobile authoring? | RESOLVED | NO — ADR-0133 invariant holds |
| Q8 | shift_session cross-workspace? | OPEN | V1 per-workspace only; cross-workspace deferred to amend ADR if needed |
| Q9 | Property layer | DEFERRED | Until 2+ physical sites under one tenant |
| Q10 | Zone surface | DEFERRED | V2 when shift-assignment becomes zone-grained |
| Q11 | Asset surface | DEFERRED | Phase 2 when items target equipment |
| Q12 | notify=false flag on day_line_item | OPEN (Phase A) | Add column with DEFAULT TRUE; admin UI hides V1 |
| Q13 | Empty `department_location` for dept | OPEN (Phase A) | Fallback to "all locations in workspace"; admin warning |

Open items are tracked in Phase A pre-flight checklist before migration ships.
