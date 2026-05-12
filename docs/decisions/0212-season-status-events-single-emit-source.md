---
title: "Season status-change events have exactly one emit source"
id: ADR_0212
status: accepted
layer: decision
created: 2026-04-24
updated: 2026-04-24
---

# ADR-0212: Season status-change events have exactly one emit source

## Context and Problem Statement

Campaign `botsson-arena` Phase B2 inherited the same triple-writer risk pattern
ADR-0187 solved for `department_session.status`. Auditing `season.status`
transitions revealed:

1. **DB trigger** `trg_season_activated`
   (`supabase/migrations/20260428100001_season_activation_trigger.sql:34-38`)
   — AFTER UPDATE OF status, emits `engine_event.event_type='season.activated'`
   (dot-delimited, workflow-style) and chains the
   `department_session_lifecycle` engine_process via the
   `season.activated → department_session_lifecycle` row in `engine_trigger`.

2. **Application emit** in `activateSeason.onSuccess`
   (`packages/year-wheel/src/hooks/use-seasons.ts:211-223`) —
   `emit({event: "season activated"})` routing via
   `packages/telemetry/src/registry.ts:6254` to
   `posthog + logger + activity_trail` (3 destinations, no `engine_event`).

The two emissions use **different event-names** for the same real-world
transition:

| Writer              | Event-name         | Destinations                      |
|---------------------|--------------------|-----------------------------------|
| DB trigger          | `season.activated` | `engine_event` (workflow chain)   |
| Application emit    | `season activated` | PostHog, Logger, `activity_trail` |

Both happen on every successful `activateSeason.mutate()` call today. Consumers
subscribing to `season.activated` (dot) see the trigger but miss the analytics;
consumers subscribing to `season activated` (space) see analytics but miss the
workflow context. A future AI capability with `gate_action` (Phase A2 `season`
tools, out of scope here but planned) or a cron-driven activation would fire
the trigger without the analytics emit — silent divergence.

This is the **third instance of the triple-writer drift pattern** (after
ADR-0114/0137 on the authority axis for gate-client and ADR-0187 on the
telemetry axis for `department_session.status`). Same failure mode, different
state-aggregate table.

## Decision Drivers

- **Consumer contract** — a subscriber to the `season activated` event must
  see *every* activation, regardless of writer (UI hook today, AI capability
  tomorrow, cron, admin SQL).
- **Single source of truth** — state-change events mirror column mutations;
  only the DB sees every UPDATE path.
- **Event-name discipline** — one transition → one canonical name. Ad-hoc
  divergence (dot vs space) is the exact pathology ADR-0164 fixed for
  Season-domain tracking events.
- **Idempotency guarantee** — trigger-level `idempotency_key = 'season_activated_' || NEW.season_id`
  eliminates double-fire races application emit cannot observe.
- **Pattern generalization** — any column on `season` whose change has
  business-event meaning (future `status='archived'` if it ever grows a
  downstream workflow) inherits the same discipline.
- **ADR-0187 precedent** — the session-level equivalent is already decided
  and implemented; extending it to `season` is a consistency move, not a
  new policy.

## Considered Options

1. **Status quo (2 writers, 2 event-names)** — keep both emission paths.
   Rejected — silent divergence; audit gap between `engine_event` and
   `activity_trail` for the same business event.
2. **DB trigger is the sole emitter** — application code writes the column;
   trigger emits to `engine_event`; the emit-registry subscriber (pending
   infra per ADR-0187 §References) fans out to PostHog / Logger /
   `activity_trail` under the space-delimited name.
3. **Application is the sole emitter** — delete the DB trigger; application
   emits to all 4 destinations. Rejected: the DB trigger is the *only* thing
   that guarantees `department_session_lifecycle` chaining across non-UI
   writers (cron activation, future AI tools, admin SQL). Dropping it
   breaks ADR-0044 cascade.
4. **Dual-emit with name unification** — keep both writers, align event-name
   at both sites to `season activated`. Rejected: registry entry already
   exists at that name; `engine_event.event_type='season activated'` breaks
   the existing `engine_trigger` row keyed on `season.activated` (dot). Fixing
   both requires a migration and still leaves two writers for the same
   business event.

## Decision Outcome

Chosen option: **Option 2 — DB trigger is the sole emitter for
`season.status` transitions.** Other writers MAY change `status` but MUST NOT
emit `season activated` / `season archived` events themselves.

Specifically:

- **`trg_season_activated`** remains the canonical emitter for
  `draft → active` (and `archived → active`, per its OR guard). Unchanged.
- **`use-seasons.ts#activateSeason.onSuccess`** removes its inline
  `emit("season activated")` call. The UPDATE alone is sufficient — trigger
  fires. The hook retains `queryClient.invalidateQueries` + `toast.success`
  (UI concerns, not telemetry).
- **Registry entry at `registry.ts:6254`** (`"season activated"`) is kept.
  Destinations stay `posthog + logger + activity_trail`. The source switches
  to the pending trigger-subscriber (ADR-0187's open infra); until that
  subscriber lands, `season activated` is an orphan registry entry —
  identical situation to `session pending_signoff` after ADR-0187
  implementation. This is accepted as the cost of pulling the canonical
  emit point into the DB.

**Event-name canonicalization.** Same rule as ADR-0187:

- `engine_event.event_type` column uses `season.activated` (dot-delimited —
  matches existing `engine_trigger` keying).
- Emit-registry entry uses `season activated` (space-delimited — matches
  the domain-first convention from ADR-0164).
- Both names reference the same trigger-driven emission; the future
  emit-registry subscriber reads `engine_event` rows where
  `event_type = 'season.activated'` and fans out under
  `"season activated"`.

**Scope of "status-change events".** This ADR applies to `season.status`
transitions only (`draft → active`, `active → archived`, `draft → archived`).
It does NOT apply to:

- `season created` / `season updated` — these are not `status`-column
  transitions; they are row-level insert/update on fields like `name`,
  `start_date`, `end_date`. Application emit is still canonical for these.
  `season-actions.ts` + `use-seasons.ts#createSeason` / `#updateSeasonDates`
  / `#duplicateYear` / `#archiveSeason` keep their `emit(...)` calls.
- `season operating_hours_*` — projection / data-edit events, not state
  transitions.
- `season block_clicked` / other UI telemetry — user-interaction events.

The rule is scoped to "column change with business-event meaning **and** a
DB trigger that emits `engine_event`," not "every season-domain emit."

## Rules & Consequences

- **Good, because** a consumer subscribing to `season activated` sees every
  real-world activation regardless of writer (UI hook, future AI tool, cron,
  admin SQL).
- **Good, because** `engine_event` and `activity_trail` / PostHog can be
  reconciled on a single `(workspace_id, season_id, idempotency_key)` tuple
  once the subscriber lands.
- **Good, because** `department_session_lifecycle` engine_process fires
  exactly once per activation — `idempotency_key` guards against the UI
  race where a user double-clicks the activate button.
- **Good, because** the pattern generalizes: if `season archived` ever
  grows a downstream workflow (engine_trigger row), the same rule applies
  without a new ADR.
- **Good, because** it closes the third known instance of triple-writer
  drift (companions: ADR-0114 / ADR-0137 on authority axis; ADR-0187 on
  telemetry axis for sessions).
- **Bad, because** until the emit-registry subscriber lands, PostHog /
  Logger / `activity_trail` temporarily lose the `season activated`
  analytics stream. Mitigation: `engine_event` rows carry the same payload;
  analytics can be backfilled from `engine_event` once the subscriber
  ships. This is the identical acceptance as ADR-0187.
- **Bad, because** developers must NOT re-introduce
  `emit({event: "season activated"})` from Server Actions, hooks, or
  capability tools. Enforceable today only via code review; lint rule
  (ADR-0187 Rule 4) can cover `"season activated"` when it lands.
- **Neutral:** does NOT affect `createSeason`, `updateSeasonDates`,
  `archiveSeason`, `duplicateYear`, `season-actions.ts#createSeason`,
  `season-actions.ts#updateSeason` — they continue to `emit()` normally
  because those events are not backed by a `season_*` DB trigger today.

## Agent Impact

- **Migration:** None. `trg_season_activated` was correct — only the
  application-layer emit needed removal.
- **Test (new):** `packages/year-wheel/src/hooks/use-seasons.activation-emit.test.ts`
  asserts that `activateSeason.onSuccess` does NOT call
  `emit({event: "season activated"})`. Test spies on `@smartout/telemetry`
  and confirms zero calls for the activation event-name (other emits
  like `season created`, `season archived`, `season updated` are
  unaffected).
- **ADR-0134 amendment (pending):** §3.7 from ADR-0187 already covers
  "state-change events have exactly one emit source — the DB trigger."
  This ADR reinforces for `season.status`; no new amendment text needed.
- **Smartout-cascade-developer skill:** add "season activation emits via
  `trg_season_activated` only — do NOT `emit('season activated')` from
  UI hooks or Server Actions" to the D4 season chapter.
- **Review checklist:** any new `status` column UPDATE path on `season`
  (AI capability, cron job, admin action) MUST rely on
  `trg_season_activated` for telemetry. Adding `emit('season activated')`
  to a new call site is a merge blocker.

## References

- **Extends** ADR-0187 (Session state-change events) — same pattern, applied
  to `season.status` transitions.
- **Precedent:** ADR-0114 / ADR-0137 / ADR-0138 (gate-client Wave 2) — same
  triple-writer pattern on the authority axis.
- **Related:** ADR-0044 (cascade) — `department_session_lifecycle` depends
  on the trigger's `engine_event` emission.
- **Related:** ADR-0164 (season-namespace unification) — registry entry
  uses space-delimited name per that convention.
- **Related:** ADR-0099 (Unified Authority Gate) — if a future AI
  capability gates on `season:activate`, gate_action fires first, then
  trigger fires on UPDATE, then subscriber fans out. Nothing changes here.
- **Related:** ADR-0187 §References — the "pg_notify listener / cron
  reader" subscriber on `engine_event` is shared infra; this ADR inherits
  the same open item.
- **Supersedes:** none.
- **Files touched by implementation commit:**
  - `packages/year-wheel/src/hooks/use-seasons.ts:211-223` — inline emit
    deleted; comment block references this ADR.
  - `packages/year-wheel/src/hooks/use-seasons.activation-emit.test.ts` —
    NEW, asserts single-emission invariant.
  - `docs/decisions/0000-decision-log.md` — register this ADR.

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
