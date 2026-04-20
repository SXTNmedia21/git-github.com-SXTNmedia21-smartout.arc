---
title: "Orphan capability code is invisible until an engine_trigger points at it"
id: LEARNING_0061
status: canonical
layer: learning
created: 2026-04-19
updated: 2026-04-19
tags: [council, capabilities, engine-trigger, orphan-code, cascade]
---

# Learning-0061: Orphan capability code is invisible until an engine_trigger points at it

## Context

System Health Audit Council (2026-04-19) Agent Coordinator traced the Season capability. Finding:

- `packages/ai/src/tools/season/` contains 3 mutating tools (`create-season.ts`, `save-playbook.ts`, `set-revenue.ts`) — all write to `season_budget` / `day_factor` / `hour_factor`.
- `packages/ai/src/capabilities/` has NO `season/` or `season-management/` capability directory.
- `packages/ai/src/capabilities/registry.ts:18-33` registers 14 capabilities — Season is not one of them.
- Intent classifier (`packages/ai/src/router/intent-classifier.ts:34-55`) never routes to Season.
- The tools therefore cannot be invoked from the agent runtime; they are orphan code.

But: `supabase/migrations/20260422400500_cascade_budget_engine_process.sql:23-36` registers `engine_trigger` rows listening for `season_budget.updated` + `day_factor.updated` + `hour_factor.updated` events. These triggers consume `engine_event` rows that only `emit()` produces. With the Season tools never called AND never registered as a capability, the triggers can *only* fire if some other code path writes those events — which nothing currently does.

**Result:** `cascade_budget_engine_process` is registered, active, and permanently dormant. Invisible at registry-audit level (it *exists*), invisible at capability-registry level (Season is absent), and invisible at runtime (no events arrive).

## Discovery

Three separate registries exist independently:
- Capability registry (`packages/ai/src/capabilities/registry.ts`)
- Tool files (`packages/ai/src/tools/*/`) — which may or may not be routed
- Engine triggers (`engine_trigger` DB rows listening for event names)

A capability can be fully wired in any one registry while orphaned in the others. The most dangerous shape is: **tool file exists + engine_trigger listens + capability is NOT registered**. The trigger waits forever for events that have no producer.

This is structurally invisible to:
- Code grep (tools look like they exist)
- Capability registry audit (Season isn't in registry.ts, so no red flag there either)
- Engine_trigger audit (trigger is registered and active)

Only a cross-registry audit that asks "for every `engine_trigger` event name, does the producing capability/tool path actually exist and get called?" surfaces the gap.

## Impact

- **Council Phase 2 check:** Post-implementation councils on cascade-related topics must cross-reference `packages/ai/src/tools/*/` AND `packages/ai/src/capabilities/registry.ts` AND `engine_trigger.event_type` values. Any mismatch triangle is a dormant process.
- **Capability authoring discipline:** Tool files must never land before their capability is registered AND their consumer (engine_trigger or direct caller) is wired. The current Season state is a failed land: tools exist but none of their consumers do.
- **Cleanup action:** `packages/ai/src/tools/season/` should be either deleted OR registered + wired. Both are sprint-local; deletion is safer if Season is not a scoped feature.

## References

- Council: 2026-04-18 / 2026-04-19 System Health Audit (COUNCIL-LOG.md)
- Orphan tool files: `packages/ai/src/tools/season/create-season.ts`, `save-playbook.ts`, `set-revenue.ts`, `learn-factors.ts`, `get-readiness.ts`, `set-revenue.ts`
- Dormant engine process: `supabase/migrations/20260422400500_cascade_budget_engine_process.sql:23-36`
- Related: L-0041 (registry-declaration partial-routing), L-0049 (hidden route groups ship)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
