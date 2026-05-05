---
title: "HANDOFF — B2: Season dual-emission fix"
status: done
updated: 2026-04-24
created: 2026-04-24
module: botsson-arena
tags: [botsson-arena, phase-b, season, telemetry, adr-0187, adr-0212]
---

# HANDOFF — B2: Season dual-emission fix

Campaign: `botsson-arena` · Phase B2 · Branch: `feat/botsson-arena-b2-season-dual-emission-fix` · Parent tip: `077197ea`

## Summary

Applied the ADR-0187 "DB trigger is the sole emitter for state-change events"
pattern to `season.status`. The sole real dual-emission — `season activated` —
is now emitted by exactly one writer (the DB trigger `trg_season_activated`).
The application-layer `emit("season activated")` call in
`use-seasons.ts#activateSeason.onSuccess` has been removed; the registry
entry at `registry.ts:6254` is kept with an inline ADR-reference comment;
the pending `engine_event` subscriber (ADR-0187 shared infra) will fan out
the trigger row to PostHog / Logger / `activity_trail` when it lands.

`season created`, `season updated`, `season archived` are NOT state-change
events backed by DB triggers — they keep their application-layer emits per
ADR-0212 §"Scope of state-change events".

## Root-cause — emission paths enumerated

**Before B2 — `season.status` → 'active' fired:**

| # | Writer | Path | Event-name | Destinations |
|---|---|---|---|---|
| 1 | DB trigger `trg_season_activated` | `supabase/migrations/20260428100001_season_activation_trigger.sql:34-38` | `season.activated` (dot) | `engine_event` → chains `department_session_lifecycle` |
| 2 | `use-seasons.ts#activateSeason.onSuccess` | `packages/year-wheel/src/hooks/use-seasons.ts:211-223` | `season activated` (space) | `posthog + logger + activity_trail` |

Both fired on every successful activation. Event-name drift (dot vs space)
meant:
- Consumers of `season.activated` (workflow chain) saw the trigger but not analytics.
- Consumers of `season activated` (analytics) saw emit but lost if activation came from anywhere non-UI (cron, AI tool, admin SQL).
- A future AI season capability with `gate_action` (out of scope here) would fire the trigger but skip the `onSuccess` emit entirely — silent loss of PostHog / Logger / activity_trail coverage for that path.

**After B2:**

| # | Writer | Path | Event-name | Destinations |
|---|---|---|---|---|
| 1 | DB trigger `trg_season_activated` | unchanged | `season.activated` (dot) | `engine_event` → chains `department_session_lifecycle` |
| ~~2~~ | ~~`use-seasons.ts#activateSeason.onSuccess`~~ | **DELETED** | — | — |

Registry entry for `"season activated"` is orphan today — same situation as
`session pending_signoff` after ADR-0187 implementation. Both get
un-orphaned when the shared `engine_event` subscriber lands (ADR-0187
§References "pg_notify listener or cron reader").

**Non-status-change emits — unchanged:**

| Event | Writer | Kept |
|---|---|---|
| `season created` | `use-seasons.ts#createSeason.onSuccess` + `use-seasons.ts#duplicateYear.onSuccess` + `season-actions.ts#createSeason` | yes |
| `season updated` | `use-seasons.ts#updateSeasonDates.onSuccess` + `season-actions.ts#updateSeason` | yes |
| `season archived` | `use-seasons.ts#archiveSeason.onSuccess` | yes |

None of these have DB triggers today. If a future ADR adds a trigger on
archive (e.g., "archive season → deactivate future shifts"), the same rule
from ADR-0212 applies and the application emit must be retired at that time.

## Files changed

| File | Status | Change |
|---|---|---|
| `packages/year-wheel/src/hooks/use-seasons.ts` | modified | Removed inline `emit("season activated")` from `activateSeason.onSuccess`; added ADR-0212 reference comment. `emit`/`nonEmpty` imports retained (used 14× elsewhere in file). |
| `packages/year-wheel/src/hooks/use-seasons.activation-emit.test.ts` | new | Static-analysis invariant test — 3 assertions: (a) no `event:"season activated"` outside comments, (b) `activateSeason` mutation still present, (c) non-status emits (`created`/`updated`/`archived`) retained. |
| `packages/telemetry/src/registry.ts` | modified | Added ADR-0212 reference comment above the `"season activated"` routing entry; routing unchanged. |
| `docs/decisions/0212-season-status-events-single-emit-source.md` | new | New ADR (accepted) extending ADR-0187 pattern to `season.status`. |
| `docs/decisions/0000-decision-log.md` | modified | Registered ADR-0212. |

## Acceptance criteria — evidence

| # | Criterion | Verification | Result |
|---|---|---|---|
| 1 | Single emission source per status change | `grep -rnE 'event:\s*"season (activated)"' apps packages` outside comments | 0 matches (trigger is sole emitter) |
| 2 | Emit-registry entry exists | `grep "season activated" packages/telemetry/src/registry.ts` | 3 hits (type, routing, comment) |
| 3 | Test asserts exactly one event-path | `pnpm --filter @smartout/year-wheel test` | 5/5 pass (2 pre-existing + 3 new) |
| 4 | Scoped typecheck 0 errors | `pnpm --filter @smartout/year-wheel typecheck` + `pnpm --filter @smartout/telemetry typecheck` | both clean |
| 5 | Existing season tests pass | `pnpm --filter @smartout/year-wheel test` → `CreateSeasonInput` suite | 2/2 pass |

**Falsifiability (Invariant 12):** the new invariant test
`use-seasons.activation-emit.test.ts` reads the source file and fails
deterministically if anyone re-introduces `emit({event: "season activated"})`
into `use-seasons.ts` (comments are stripped before the regex match to
avoid false positives on the ADR-reference block).

## Decisions made

- **ADR-0212** (accepted, 2026-04-24) — "Season status-change events have exactly one emit source." Extends ADR-0187 from `department_session` to `season`. Same decision outcome: DB trigger is canonical; application emit removed; registry entry orphaned pending shared-infra subscriber.
- **Scope** — status-change events only. `created`/`updated`/`archived` application emits kept because no DB trigger backs them today.
- **No ADR-0187 amendment** — the existing ADR-0187 text generalises to "any state-change column on D6 aggregates" (its own §Generalization). ADR-0212 is a sibling application, not an amendment.

## Learnings

- **The dual-emission wasn't routing-duplicate, it was name-divergent.** The application emit targeted PostHog/Logger/activity_trail (3 destinations) while the DB trigger targeted only `engine_event`. The visible "duplicate downstream workflow" referenced in the campaign hazards list (line 175 CAMPAIGN-botsson-arena.md) is more precisely: "one real-world event surfaces under two different names to two disjoint consumer sets." Fixing it means losing the analytics stream temporarily until the shared `engine_event` subscriber lands. This is the same trade-off ADR-0187 explicitly accepted; we accept it here too.
- **`vitest-node` without React-testing-library constrains hook testing to static-analysis patterns.** Writing a runtime spy on `emit()` through a React hook would require adding `@testing-library/react` + `happy-dom` to the `year-wheel` package. That's out-of-scope inflation for one assertion. The project precedent (`registry.journey.test.ts`) already uses literal-source-reading tests; B2 follows the same pattern.
- **The pre-existing `parity.test.ts` failure on `session-watchdog-demoter` is unrelated.** It tripped during verification but on untouched files; it's an ADR-0180 parity gap in a different Edge Function. Out of B2 scope.

## Known issues / debt

- **Orphan registry entry.** `"season activated"` in `registry.ts:6254` currently has no caller. It is intentionally kept (same as `"session pending_signoff"` after ADR-0187) so the future `engine_event` subscriber can fan out under this name without a registry-migration. A lint rule could enforce "no `emit('season activated')` call site anywhere" — deferred to the broader lint pass that ADR-0187 §Agent Impact also flagged.
- **`engine_event` subscriber is still missing.** This is ADR-0187's open item, not B2's. Until it lands, `season activated` + `session pending_signoff` + `session closed` + any future state-change event written by a DB trigger are in `engine_event` only, not `activity_trail`, not PostHog, not Logger. Operationally acceptable (`engine_event` has full payload) but backfill is needed once the subscriber is built.
- **No runtime test that the trigger actually fires.** The new test only asserts the application emit is gone. A `.sql.draft` pgTAP test asserting `trg_season_activated` INSERTs an `engine_event` row on `season.status='active'` would close the loop. Deferred — belongs in the broader trigger-invariants pgTAP suite.

## Next steps

1. **Close this sub-sortie normally.** All required closure gates are met: ADR registered, test added, scoped typecheck clean, existing tests pass. User journeys doc is not expected for a campaign-internal infra fix (campaign CLAUDE.md B2 is not a user-facing flow).
2. **Update `BOTSSON-SYSTEM-MAP.md` row for B2.** After merge, flip the B2 hazard row from 🟡 to 🟢 (per the Five Laws of the harness-builder prompt — map colour updates go in the same change, so this should happen on the merge commit to the campaign, not this feature branch).
3. **When ADR-0187's shared `engine_event` subscriber ships, remove this ADR's `Pending` language from §Decision Outcome** — the same amendment applies to ADR-0212.
4. **Consider generalising to `season_budget.status` transitions** if/when those grow downstream workflows. No ADR needed — the "state-change events have one emit source" rule is already general.

## Commit plan

Single conventional commit on `feat/botsson-arena-b2-season-dual-emission-fix`:

```
fix(season): retire dual-emission — DB trigger is sole emitter (ADR-0212)

Extends ADR-0187 pattern from department_session.status to season.status.
Removes the inline emit({event: "season activated"}) from
use-seasons.ts#activateSeason.onSuccess. The DB trigger
trg_season_activated is now the canonical writer; registry entry is
kept as orphan until the shared engine_event subscriber lands (same
situation as "session pending_signoff" after ADR-0187 implementation).

Non-status-change emits (season created/updated/archived) are
unchanged — they have no DB trigger, application emit remains canonical.

- packages/year-wheel/src/hooks/use-seasons.ts: delete activate emit
- packages/year-wheel/src/hooks/use-seasons.activation-emit.test.ts: new invariant test
- packages/telemetry/src/registry.ts: inline ADR reference on "season activated" entry
- docs/decisions/0212-season-status-events-single-emit-source.md: new ADR
- docs/decisions/0000-decision-log.md: register ADR-0212

Campaign botsson-arena Phase B2. Budget: 45-75 min. Actual: ~60 min.
Refs ADR-0187.
```
