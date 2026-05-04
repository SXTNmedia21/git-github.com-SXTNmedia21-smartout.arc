---
title: "S1.1 Sub-Sortie Brief — Telemetry Foundation (extended)"
status: approved
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [sub-sortie, m1, telemetry, gate-a-verdict]
---

# S1.1 — Telemetry Foundation (Gate A extended scope)

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.1 extended
> **Gate A verdict:** PASS WITH CONDITIONS — this brief integrates all 6 conditions + 5 advisories.
> **Blocks:** S1.2, S1.3, S1.4 (all of M1 depends on S1.1 landing clean).

---

## Why this sub-sortie is bigger than originally specced

Gate A Agent-coordinator code-trace surfaced three **structural pipeline gaps** that the baseline brief didn't see:

1. **Event-name convention collides with `toDotNotation()`** at `packages/telemetry/src/providers/engine-event.ts:15`. ADR-0175 uses `journey.run_started` (dot). The provider expects space-input (`"shift published"` → `"shift.published"`). Merging journey events as dot-named into current pipeline yields either double-dot or non-match in `engine_event`.
2. **`activity_trail` silent-drops FLAT payloads.** `providers/activity-trail.ts:53` reads `props?.entity` (nested). Journey payload shapes specified in ADR-0175 are flat (`run_id`, `step_key`, ...). Without the nested `entity` block, every `journey.*` write to activity_trail silently returns — one of four required destinations is dead on arrival.
3. **`gate_action()` RPC does not implement `suggest`/`autonomous` semantics** at `supabase/migrations/20260506120000_gate_action_accept_entity_id.sql:45-161`. The RPC is boolean allow/deny; `level` is Node-side advisory only. Spec and plan wording must be corrected so downstream ADR-0176 consumers don't assume DB gating.

S1.1 extended closes all three in one PR, then adds the 5 journey events. No alternative keeps M1 on schedule — parallelizing on a known-broken foundation guarantees phantom-verification.

---

## Scope — exactly what lands

### Part A — Pipeline normalization (condition-work)

**A.1. Resolve event-name convention (Condition C-1).**
- Decision: keep **space-naming** as the registry convention (consistent with 459 existing events). All ADR-0175 mentions of `journey.run_started` are **wire-format after `toDotNotation()`**, not registry-key format.
- Registry keys land as:
  - `"journey run_started"`
  - `"journey step_reached"`
  - `"journey completed"`
  - `"journey stuck"`
  - `"journey run_failed"`
- `toDotNotation()` converts the space to dot at emit time — unchanged.
- Update `docs/superpowers/plans/2026-04-21-journey-engine-orchestration.md` §2.1 with a footnote documenting the convention + linking to this sub-sortie's brief.

**A.2. Widen activity-trail provider to accept flat payloads (Condition C-2).**
- File: `packages/telemetry/src/providers/activity-trail.ts`
- Current: reads `props?.entity?.entity_type`, `entity_id`, `entity_label`. If any missing → `console.warn` + `return`.
- Widen logic:
  ```
  const entity = props?.entity ?? {
    entity_type: props?.entity_type,
    entity_id: props?.entity_id,
    entity_label: props?.entity_label,
  };
  ```
  then validate the resulting object. Preserves nested backward-compat, accepts flat for new events.
- Unit test in `packages/telemetry/src/__tests__/activity-trail.flat.test.ts`: both shapes ingest without warn.
- Add `"journey_run"` + `"journey_version"` to `EntityType` union in `packages/telemetry/src/registry.ts:51-102`.

**A.3. Document gate_action semantics (Condition C-3).**
- Add header comment to `packages/ai/src/capabilities/types.ts` above `AuthorityLevel`:
  ```
  // AuthorityLevel is a Node-side advisory for tool-selector + router.
  // The unified_authority_gate RPC (gate_action) treats all non-disabled
  // levels as "allow=true"; it only enforces min_role downgrade and
  // requires_four_eyes. Level semantics ("suggest" vs "autonomous" vs
  // "confirm") are enforced by packages/ai/src/capabilities/tool-selector.ts,
  // not by the DB. See 20260506120000_gate_action_accept_entity_id.sql:45-161.
  ```
- Update orchestration plan §2.3 with the same note.
- No DB migration — this is documentation only for M1.

### Part B — Journey events (original S1.1 scope, corrected)

**B.1. Five event interfaces in `packages/telemetry/src/registry.ts`.**

Each event follows the existing TS-interface pattern (not Zod). Payloads use **FLAT fields** (matching current repo convention) + a nested `entity` block (required for activity_trail provider until broader L-0064 fix lands).

```typescript
interface JourneyRunStarted extends BaseEvent {
  event: "journey run_started";
  properties: {
    journey_version_id: string;
    run_id: string;
    actor_id: string;            // non-null per ADR-0134
    workspace_id: string;        // non-null per ADR-0134
    capability: "journey.run_dev" | "journey.publish_mission" | "journey.publish_guide" | "journey.run_guided";
    surface: "dev" | "admin" | "runtime_web" | "runtime_mobile";
    entity: {
      entity_type: "journey_run";
      entity_id: string;         // = run_id
      entity_label: string;      // human-readable run label
    };
  };
}
```

Same shape for `journey step_reached`, `journey completed`, `journey stuck`, `journey run_failed` — payloads per orchestration plan §2.1 table + nested `entity` block.

**B.2. Four destinations wired in `EVENT_ROUTING`.**

```typescript
"journey run_started": ["posthog", "logger", "activity_trail", "engine_event"],
"journey step_reached": ["posthog", "logger", "activity_trail", "engine_event"],
"journey completed":   ["posthog", "logger", "activity_trail", "engine_event"],
"journey stuck":       ["posthog", "logger", "activity_trail", "engine_event"],
"journey run_failed":  ["posthog", "logger", "activity_trail", "engine_event"],
```

**B.3. Destination-coverage test (Advisory A-2 — promoted to required).**
- New file: `packages/telemetry/src/__tests__/registry.journey.test.ts`
- Asserts: every `journey *` key in `EVENT_ROUTING` has exactly 4 destinations matching the set above.
- Asserts: every `journey *` interface has non-optional `actor_id` + `workspace_id` in properties.
- Asserts: every `journey *` interface has nested `entity` block with `entity_type: "journey_run"`.
- Runs as part of `pnpm turbo typecheck` downstream test target.

**B.4. Zod-in-dev runtime validation (Advisory A-2).**
- Skipped for S1.1. Defer to S1.4 once emit call sites exist. Noted in handoff as M1 deferred.

---

## Out of scope (do NOT touch)

- `journey_version` table creation → S1.2
- `journey_version_status` enum 0a/0b/0c → S1.2
- `engine_authority_config` seed rows → S1.3
- `packages/ai/src/capabilities/journey/` scaffold → S1.4
- `packages/journey-ir` package → M2 S2.1
- Legacy `packages/ai/src/journey/compile.ts` retirement → M2 S2.2
- Any Edge Function → out of campaign scope (only `journey-stuck-detector` is in-scope, and that's M5)

---

## Acceptance criteria (exit gates)

All must be green before close-feature:

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] `pnpm turbo test --filter=@smartout/telemetry` passes (registry.journey.test.ts green)
- [ ] `grep -n "journey run_started\|journey step_reached\|journey completed\|journey stuck\|journey run_failed" packages/telemetry/src/registry.ts` returns ≥10 hits (5 interfaces + 5 routing entries)
- [ ] `grep -n "journey_run\|journey_version" packages/telemetry/src/registry.ts` returns hits inside `EntityType` union
- [ ] `packages/telemetry/src/providers/activity-trail.ts` accepts both nested `props.entity` and flat `props.entity_type/_id/_label`, with unit test asserting both shapes ingest
- [ ] `packages/ai/src/capabilities/types.ts` has header comment documenting AuthorityLevel as Node-side advisory
- [ ] Handoff written at `docs/HANDOFF-journey-s1-1-telemetry-foundation.md` listing: (a) convention decision (space-naming), (b) flat+nested activity_trail widen, (c) gate_action semantics doc, (d) 5 events + 4 destinations, (e) test coverage, (f) deferred Zod-in-dev
- [ ] Decision log entry: `ADR-0175 clarification — registry keys use space-naming per repo convention; dot-naming is post-`toDotNotation()` wire format`
- [ ] No NEW imports from `packages/ai/src/journey` (grep gate)
- [ ] No `ALTER TYPE journey_status ADD VALUE` (grep gate)
- [ ] User journey doc at `docs/journeys/JOURNEY-journey-s1-1-telemetry-foundation.md` (operator flow for a dev emitting a journey event + verifying all 4 destinations receive it)

---

## Coordination notes

- **Do NOT touch** `packages/ai/src/capabilities/types.ts`'s `CapabilityName` union — that's S1.4 territory.
- **Do NOT add** journey capabilities. `emit()` call sites don't exist yet in S1.1 — registry is authored ahead of consumers, which is fine because `emit.ts:12` only errors when emit is called with an unregistered event.
- **Migration tip check:** none in S1.1 (no migrations). S1.2 verifies.
- **ADR-0174 (adapter) not touched.** M3 work.

---

## Dispatch

This brief is the complete contract. A single build subagent implements and returns a handoff. On handoff, orchestrator verifies all acceptance criteria before merging via `/close-feature`.

No council re-review needed unless an acceptance criterion fails in a way that requires Trust Gate re-evaluation (e.g., discovering a fourth structural pipeline gap). In that case, Gate B council convenes before S1.2 dispatch.
