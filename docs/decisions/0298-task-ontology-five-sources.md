---
title: "Task Ontology — Five Sources, One Read Surface, One Capability"
id: ADR_0298
status: accepted
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0298: Task Ontology — Five Sources, One Read Surface, One Capability

## Context and Problem Statement

Smartout has five distinct task-like surfaces in the database (`session_task`, `personal_task`, `schedule_day_task`, `emma_task`, `engine_state_step`), three competing capability paths (`personal.create_task`, `operations.complete_task`, `addTaskAction` Server Action), four disjoint telemetry event families (`session_task.*`, `personal.task_*`, `emma_task.*`, `task.added_manual`), and zero unified read surface. The Mobile Oppgaver Council (2026-05-12) identified that the fragmentation is causing concrete failures:

- `personal_task` was added 2026-05-04 without a cascade role declaration (Steward orphan-concept flag).
- `(me)/tasks/[id].tsx` performs direct Supabase update bypassing `gate_action`, telemetry emit, RLS WITH CHECK, and identity-derivation (4-ADR violation).
- `addTaskAction` Server Action writes `session_task` but is not registered in `capabilities/registry.ts` (shadow capability, invisible to C4 governance).
- `personal/tools.ts:196` emits `entity_type: "session_task"` for a `personal_task` row (registry-hygiene bug).
- Botsson cannot answer "hva må jeg gjøre i dag" — no capability tool returns a union across task surfaces.
- Voice-says "lag oppgave til Anna" writes to manager's `personal_task`, not assigned-to-Anna `session_task` (cross-assign bug).

The Mobile Oppgaver Council asked: "Should Smartout split tasks by actor (AI vs human), by domain (session vs personal), or unify into one type-tagged table?" The senior architect review (2026-05-13) reframed: the codebase already has five distinct ontologies — the decision is which boundaries to formalize and where to unify.

## Decision Drivers

- **Cascade Invariant 2** (every datum has one role): personal_task and emma_task currently violate this by lacking declared dimension placement.
- **C4 governance visibility** (ADR-0287): every mutation capability tool must be registered with `gate_action`; shadow Server Actions break the dashboard.
- **Mobile thin-client law** (ADR-0132): mobile mutates only via web BFF; direct Supabase update from mobile is forbidden.
- **Identity derivation** (ADR-0151): `workspace_id` + `profile_id` must be server-derived, never body-supplied.
- **Workspace isolation** (ADR-0078): all task tables are workspace-scoped; cross-workspace access only via explicit multi-workspace profile.
- **Voice channel policy** (ADR-0288): PII-risk tools must be chat-only until server-side PII redact exists.
- **Agent memory contract**: tasks must be discoverable to the agent in the next session without dual-write to `engine_memory`.
- **Mobile UX handoff** (`docs/design/design_handoff_calendar/source/screens.jsx`, 2026-05-04): canonical task-surface is Kalender DayView + AddSheet via FAB; not a separate "Tasks" tab.
- **Operational reality**: emma_task is live (Botsson scheduled notifications, cron-fired, max-3-per-profile UI poll); schedule_day_task is live (manager day-control ad-hoc). Neither is redundant.

## Considered Options

1. **Option A — Full unification.** One `task` table with `kind` discriminator enum, `actor_kind` enum, normalized status. All five sources collapse to one table. Single capability with discriminator-aware tools.
2. **Option B — Strict separation.** Five separate tables with no shared read surface. Each capability domain owns its own table. UI consumers UNION manually in each call site.
3. **Option C — Hybrid: separate tables, unified read RPC, unified capability surface.** Tables keep their domain integrity. A `fn_list_my_tasks` RPC returns normalized rows across all sources. A `task` capability with source-dispatched tools provides the canonical write surface.

## Decision Outcome

**Chosen: Option C — Hybrid.**

Justification:

- Option A breaks cascade integrity. `session_task` lives in D6 with 7 lifecycle states tied to `department_session` cron. `personal_task` lives in C2 with 3 lifecycle states tied to owner-actor. Collapsing the status enum loses load-bearing semantics. Collapsing RLS rules (workspace-shared vs owner-private) compromises either audit or privacy.
- Option B forces every consumer (mobile UI, Botsson capability tools, voice-agent prompt collection) to maintain its own UNION logic. Drift inevitable. Cross-capability writes already shadow-violate ADR-0240.
- Option C respects the domain boundaries that already exist while providing the single read surface and single capability surface that the agent + UI require.

The five sources are declared with explicit cascade roles:

| Source | Table | Cascade Role | Actor Model |
|---|---|---|---|
| `session` | `session_task` | D6 Production (cascade-derived) | cron + manager + agent |
| `day_ad_hoc` | `schedule_day_task` | D6 Production (ad-hoc manager-curated) | manager |
| `personal` | `personal_task` | C2 Agent-Utility (user-curated) | user via agent |
| `emma` | `emma_task` | C2 Agent-Utility (agent-curated, max-3 guardrail) | Botsson auto-schedule |
| `runtime` | `engine_state_step` | C2 Workflow Runtime | engine-dispatch (NEVER user-visible as "task") |

`engine_delayed_trigger` is the generic timer-queue (workflow-internal). It is NOT a task source — it fires events that may create tasks elsewhere.

## Architecture

### Read surface — single RPC

```sql
CREATE OR REPLACE FUNCTION public.fn_list_my_tasks(
  p_window_start TIMESTAMPTZ DEFAULT now() - INTERVAL '1 day',
  p_window_end   TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
)
RETURNS TABLE (
  id              UUID,
  source          TEXT,           -- 'session' | 'personal' | 'day_ad_hoc' | 'emma'
  raw_status      TEXT,           -- source-native enum value (lossless)
  status          TEXT,           -- normalized: pending|in_progress|done|cancelled|overdue|triggered
  title           TEXT,
  description     TEXT,
  due_at          TIMESTAMPTZ,
  priority        TEXT,           -- normalized: critical|high|normal|low
  assigned_to     UUID,
  workspace_id    UUID,
  session_id      UUID,           -- nullable, source='session' only
  hook_id         UUID,           -- nullable, source='session' only
  compliance      BOOLEAN,
  created_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  origin_actor    TEXT            -- 'human' | 'cascade_cron' | 'agent_auto'
)
SECURITY DEFINER
LANGUAGE sql STABLE;
```

UNION across `personal_task`, `session_task`, `schedule_day_task`, `emma_task`. `engine_state_step` is NEVER included. Caller identity derived internally from `auth.uid()` — no profile_id parameter (ADR-0151).

### Write surface — single `task` capability

Six tools registered in `packages/ai/src/capabilities/task/`:

| Tool | Writes to | Min Role | Channel V1 | Channel V2 |
|---|---|---|---|---|
| `task.list_mine(window?)` | (read) | employee | chat + voice | chat + voice |
| `task.create_personal(title, due_at?, priority?)` | personal_task | self (employee+) | chat-only | chat + voice with PII gate |
| `task.create_session(session_id, title, assignee_profile_id?, hook_id?, compliance?, reason)` | session_task via BFF | manager+ | chat-only | chat + voice with PII gate |
| `task.create_day_ad_hoc(date, title, assignee_profile_id?, highlight?, category?)` | schedule_day_task via BFF | manager+ | chat-only | chat + voice with PII gate |
| `task.complete(id, source)` | source-dispatched | source-dependent | chat + voice | chat + voice |
| `task.cancel_personal(id, reason)` | personal_task | self | chat-only | chat-only (irreversible) |

`emma_task` mutations stay internal to Botsson auto-schedule logic — no user-callable tool. emma rows can be `dismissed` via existing `/api/emma/tasks/dismiss` endpoint, which `task.complete` dispatches to when `source='emma'`.

### Authority model

Per-tool gate via `gate_action(p_capability='task', p_action_type=...)`:

- `task.list_mine` — ungated (read-only)
- `task.create_personal` — `level=suggest`, self-grant
- `task.create_session` — `level=suggest`, manager+; cross-assign requires workspace-membership verification on `assignee_profile_id`
- `task.create_day_ad_hoc` — `level=suggest`, manager+
- `task.complete` — dispatched; personal=self, session=manager OR `assigned_to=self`, day_ad_hoc=manager OR `assigned_to=self`, emma=self
- `task.cancel_personal` — self only, irreversible

Authority seeded in migration alongside capability registration. Per ADR-0287, gate is mandatory at function entry, before any persistence call.

### Telemetry consolidation

Replace 8+ disjoint events with single `task.*` family routed to PostHog + Logger + activity_trail + engine_event:

```
"task created"    { source, actor_kind, assigned_to_self: boolean, kind_specific... }
"task completed"  { source, actor_kind, completed_via: 'self'|'manager'|'agent' }
"task cancelled"  { source, reason }
"task assigned"   { source: 'session'|'day_ad_hoc', from_actor, to_actor }
"task overdue"    { source: 'session', auto: true }
```

Entity_type enum extended with `personal_task`, `schedule_day_task`, `emma_task`. Existing event names aliased for 30 days during migration (Sortie 3) then deprecated.

## Rules

### R1. Five ontologies, declared roles

Every task-like row belongs to exactly one of the five declared sources. No new task table may be added without an amendment to this ADR declaring its cascade role.

### R2. `engine_state_step` is workflow runtime, not a task

`engine_state` and `engine_state_step` are control-plane workflow state, not user work-items. They MUST NOT appear in `fn_list_my_tasks`. They MUST NOT be readable via the `task` capability. If an agent needs to surface workflow progress, use `mission.get_active_missions` (separate capability).

Sixten dispatcher queue (`infra/sixten/queue.json` per ADR-0255 Phase 0.5, future `engine_state` migration per Phase 1) is also NOT a task source. It is agent-job-scheduling, not user-task-management.

### R3. Mobile mutation routes through BFF

Per ADR-0132 + ADR-0283 + ADR-0273, every `task.*` mutation from mobile MUST go through a `/api/mobile/tasks/*` BFF endpoint. Direct Supabase update from mobile is forbidden, regardless of which table is touched. Specifically: `(me)/tasks/[id].tsx` direct-update pattern (currently the violation) must be replaced with `/api/mobile/tasks/[id]/complete` BFF route.

### R4. Identity derivation server-side

Per ADR-0151, no `workspace_id` / `profile_id` / `assigned_to` / `completed_by` may appear in the request body of any `task.*` BFF route. Identity is derived from the JWT or cookie session. The `assignee_profile_id` parameter on `task.create_session` is the explicit exception (manager assigns to other) — the BFF MUST verify the assignee shares workspace with the actor before insert.

### R5. RLS UPDATE policies require WITH CHECK

Per Mobile Oppgaver Council Supervisor finding (≥30 RLS policies missing WITH CHECK across migrations), every UPDATE policy on a task table MUST include both USING and WITH CHECK clauses. Specifically:
- `session_task` UPDATE: `WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))`
- Plus actor predicate: `WITH CHECK (assigned_to = (SELECT profile_id FROM profile WHERE user_id = auth.uid()) OR is_admin_in_workspace(workspace_id))` for state transitions to `completed`.

This is defense-in-depth. The application gate (`gate_action`) remains the primary enforcement; RLS catches bypass attempts.

### R6. Voice channel policy V1 = chat-only on user-creatable writes

`task.create_personal`, `task.create_session`, `task.create_day_ad_hoc`, `task.cancel_personal` are CHAT-ONLY in V1 until server-side PII detector exists. Free-text title/description fields can contain personnummer / kontonummer / telefon / email via voice-transcript. `task.list_mine` and `task.complete` remain chat + voice (no free-text input).

V2 policy (post-PII-detector): voice unlocked on `create_*` tools after regex + NER gate at BFF entry strips or rejects body with PII match. Norwegian-language operator feedback to Botsson: "Si dette på tekst, så lager jeg oppgaven."

### R7. Agent memory contract — read personal_task in collectContext

`packages/ai/src/context/collect-context.ts` MUST query `personal_task` actively during system-prompt assembly (next-session discoverability). No dual-write to `engine_memory`. Tasks are memory-relevant by definition; the source of truth is the task table, not a duplicated memory row.

### R8. Multi-workspace caller resolution

`fn_list_my_tasks` resolves `auth.uid()` to all active `profile` rows. Multi-workspace profile (regional manager) receives UNION across workspaces. UI consumers needing single-workspace context pass `p_workspace_id UUID` filter (optional parameter, future amendment).

## Consequences

### Good

- **Single read endpoint** for "what do I owe today" — mobile, web, voice, chat all use one RPC.
- **Single capability surface** — agent + intent-classifier route to one `task` capability instead of three shadow paths.
- **Cascade integrity preserved** — each table keeps its dimension role; status enums stay meaningful.
- **C4 governance visible** — every write capability tool registered with `gate_action`, dashboardable.
- **Voice safety guaranteed V1** — chat-only on free-text-write closes PII vector pending V2 detector.
- **emma_task and schedule_day_task survive** — both are functional, neither is forced into deprecation by an over-aggressive unification.
- **Telemetry consolidated** — one `task.*` event family with `source` discriminator replaces eight disjoint event names.

### Bad

- **RPC complexity** — UNION ALL across 4 tables. Index discipline required per-source. Query plan must be verified at scale.
- **Status normalization tradeoff** — 4 enums collapse to 6 normalized states. `raw_status` column preserves source-precision for admin tools but adds row width.
- **Capability rename window** — `personal.create_task` aliased to `task.create_personal` for 30 days during intent-classifier A/B. Some classifier-misroute regression expected during migration.
- **Migration weight** — 5 sorties spanning ~3-4 weeks if serial. 4 sorties parallel-safe.
- **emma_task vs engine_delayed_trigger overlap** — two timer-style surfaces remain. Agent prompt must include explicit decision rule (R-NEW per Q11/Q13 below).
- **Defense-in-depth migration** — RLS WITH CHECK audit (≥30 policies) is out-of-band sortie; not blocked by this ADR but adjacent.

### Agent Impact

- Mr. Botsson + voice-agent route ALL task verbs through the `task` capability after Sortie 3.
- `personal` capability becomes a thin alias for 30 days, then deprecated for task-verbs (kept for `add_note`, `set_reminder`, `get_history`, `update_setting`).
- Botsson prompt must include: "Tasks live in five sources. Use task.list_mine to see them all. Use task.create_personal for user todos, task.create_session when manager assigns to team during shift, task.create_day_ad_hoc for date-anchored workspace todos."
- `task.complete(id, source)` is the canonical complete verb. Agent never directly mutates `session_task` or `personal_task` tables.
- Cross-assign (manager → other profile) requires explicit `assignee_profile_id`; default is self-assign.
- Voice + free-text-input combinations are blocked V1 — agent suggests chat fallback.

## Migration Plan — 5 Sorties

| # | Branch | Scope | Blocks | ADR |
|---|---|---|---|---|
| **1** | `feat/mobile-session-task-defense` | BFF wrap 5 mobile direct-mutation handlers (`complete_task`, `complete_checkpoint`, `sign_checklist`, `confirm_shift`, `confirm_hours`). Add `WITH CHECK` to `session_task` UPDATE policy. Tighten schemas (forbid identity fields in payload). Fix `personal/tools.ts:196` entity_type. Delete orphan routes `(me)/tasks/[id].tsx` + `(home)/create-task.tsx`. Three doc-drift fixes (JOURNEY-mobile-task / BotssonSheet docstring Ultravox→LiveKit / ADR-0283 status). | — | ADR-0299 |
| **2** | `feat/task-rpc-readpath` | `fn_list_my_tasks` RPC with 4 sources. `fn_normalize_session_task_status` helper. `fn_normalize_priority` helper. Wire mobile `useMyTasks` hook to RPC. Backfill `activity_trail.entity_type` for `personal_task` rows. Add `personal_task`, `schedule_day_task`, `emma_task` to telemetry entity_type enum. | Sortie 1 | ADR-0300 |
| **3** | `feat/task-capability-unify` | New `task` capability with 6 tools. `assignee_profile_id` parameter on `create_session`. Chat-only voice policy on `create_*` tools. Register `task` in `capabilities/registry.ts`. Wrap `addTaskAction` body inside `task.create_session` tool. Add `task` intent to `intent-classifier.ts`. A/B test against `personal` alias 30 days. Update `collect-context.ts` to query `personal_task`. | Sortie 2 | ADR-0301 |
| **4** | `feat/mobile-kalender-task-wire` | Mobile UI per Pontus's handoff `docs/design/design_handoff_calendar/source/screens.jsx`. Filter-chip "Oppgaver" on Kalender WeekView. Tasks-summary-card with ProgressRing. Wire FAB → AddSheet (currently opens BotssonSheet — relocate Botsson to chat-tab header mic icon). Mount built-but-orphan `apps/mobile/src/components/calendar/AddSheet.tsx` (897 lines). DetailSheet via item-tap with onComplete callback. | Sortie 3 + handoff | ADR-0302 |
| **5** | `feat/task-e2e` | Playwright: voice-create → list-RPC → tap-complete → telemetry verify → cross-workspace RLS isolation → memory-discoverability (Botsson session 2 sees session 1 creates) → performance gate (`fn_list_my_tasks` < 500ms p95) → DB consistency (emit + activity_trail + engine_event agree on entity_type). | Sortie 4 | — |

**Out-of-band (parallel-safe):**

| # | Branch | Scope | ADR |
|---|---|---|---|
| **A** | `feat/rls-with-check-audit` | Grep all UPDATE policies missing WITH CHECK across `supabase/migrations/`. ≥30 policies identified. Migration adds WITH CHECK + actor predicates. | ADR-0302-companion |

## Open Questions — Tracked, Not Blocking

**Q11 — emma_task auto-schedule writer identity.** Who INSERTs emma_task rows? Cron Edge Function? Botsson chat-tool? Manual seed? Pre-Sortie 2 grep-task. Affects agent-prompt documentation only — not architecture.

**Q12 — `tasks:read` / `tasks:write` Edge Function scope names.** Canonical scope list in `smartout-edge-function-guide` does not include task scope. Adding required for `/api/mobile/tasks/*` workspace-api gateway routes. Decision: `tasks:read` + `tasks:write` is its own scope, not folded into `operations:*` (which only covers `session_task` historically). Resolved in Sortie 3 with workspace-api registry update.

**Q13 — emma_task vs engine_delayed_trigger differentiation rule for agent prompt.** Two timer-style scheduling surfaces. Botsson must learn when to use which. Decision rule for agent prompt:
- emma_task = "Botsson reminds you of X" (Botsson auto-curated, max-3 active, UI-visible, dismissable)
- engine_delayed_trigger = "fire event Y at time Z" (generic workflow timer, no UI, no max, fires events that may create downstream actions)
- `personal.set_reminder` writes to engine_delayed_trigger (NOT emma_task)
- Documented in tool descriptions during Sortie 3.

**Q14 — Cross-workspace UNION behavior on regional managers.** Multi-workspace profile receives UNION across workspaces. Confirmed intended for V1. Future `p_workspace_id` filter parameter when UI requires single-workspace context. Defer until use case proven.

**Q15 — Task templates / recurring tasks.** Both personal and session may want "daily check-X" templates. Session has `session_hook` + `procedure`. Personal has none. Defer V2.

## Cross-references

- ADR-0078 (channel restriction on workspace data)
- ADR-0099 (gate_action before mutation)
- ADR-0114 (Server Actions as canonical mutation primitive)
- ADR-0132 (mobile thin client — BFF routing)
- ADR-0133 (web composes, mobile executes)
- ADR-0134 (telemetry emit with non-null identity)
- ADR-0151 (server-derived identity, no body-supplied IDs)
- ADR-0240 (cross-namespace writes require delegation)
- ADR-0255 (Sixten dispatcher Phase 0.5/1)
- ADR-0268 (5-tab canonical mobile layout)
- ADR-0273 (deviation + day-info BFF migration — same pattern)
- ADR-0283 (task create mobile BFF wrap — predecessor)
- ADR-0287 (gate_action mandatory on mutation capability tools)
- ADR-0288 (voice policy split — chat-only forbidden domains)

## Related Learnings

- L-0042 (migration timestamp ordering — apply when sequencing the 5 sorties' migrations)
- L-0147 (chair self-reversal — Mobile Oppgaver Council 6th precedent)
- L-0176 (docstring claims compliance before body satisfies — fix at `personal/tools.ts:196`)
- L-0177 (silent identity from payload — fix in `completeTaskSchema.catchall(z.unknown())`)
- L-0202 (ADD COLUMN vs sibling-table — supports keeping schedule_day_task separate)
- L-0237 (`.catchall(z.unknown())` accepts forgeable identity — Sortie 1 schema tightening)
- L-0238 (Steward Phase 3 grep sibling-shape patterns before verdict — applied during this ADR)

---

> After acceptance: register in `docs/decisions/0000-decision-log.md`. Update `CLAUDE.md` task-handling section. Reserve ADR-0299 through ADR-0302 for sortie ADRs. Bump `docs/STATE-SUMMARY.md` with Sortie 1 as next active work.

---

## Closure (2026-05-13)

ADR-0298 promoted `proposed` → `accepted` upon Sortie 5b shipping:
- Sortie 1 (ADR-0299): mobile session-task defense
- Sortie 2/B (ADR-0300): fn_list_my_tasks RPC
- Sortie 3 (ADR-0301): task capability unification
- Sortie 4 (ADR-0302): mobile Kalender wire
- Sortie 5a: voice-agent tools-task surface
- Sortie 5b: operations.complete_task hard-delete + capability migration

Outstanding (deferred):
- Sortie 5c (2026-06-12): drop 30-day telemetry alias `task.added_manual`
- aliasTaskVerbs intent-classifier shim: eval-gate SKIPPED 2026-05-13 (no API key in CI agent env); rerun manually with OPENROUTER_API_KEY, drop in follow-on sortie if accuracy ≥95% on IC1-IC4.
- HMS module `useCompleteTask` direct-supabase migration: separate sortie (ADR-0287 violation).
- Botsson Arena `completeTask` (Emma in-memory list): unrelated entity; ADR addendum may rename for clarity.
