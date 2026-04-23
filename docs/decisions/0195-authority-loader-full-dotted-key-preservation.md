---
title: "Authority loader full dotted-key preservation"
id: ADR-0195
status: proposed
layer: decision
created: 2026-04-23
updated: 2026-04-23
module: stage-engine
tags: [authority, c4, capability, stage-engine, cve-class, tool-selector]
---

# ADR-0195: Authority loader full dotted-key preservation

## Context and Problem Statement

`services/stage-engine/src/core/authority.ts:45-51` loads `engine_authority_config` rows and folds dotted capability keys (`journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided`) into a single base key (`journey`). The fold-rule is "store both the dotted key and the base key; for the base key, keep whichever dotted row arrives first from the `.select()` query." Because `.select()` has no `ORDER BY`, **row order is undefined** — the base-key authority level is non-deterministic per query.

Downstream, `packages/ai/src/router/tool-selector.ts:67` reads `authorityConfig[capability.name]` where `capability.name = "journey"` (the short form, per `packages/ai/src/capabilities/journey/index.ts:52`). The tool-selector therefore makes the **per-capability visibility decision using a non-deterministically chosen authority level**.

ADR-0176 deliberately seeded three capabilities at `suggest` and one (`journey.run_guided`) at `autonomous`. This C4 policy is silently defeated: `run_guided` may surface at `suggest` (confirmation-required) or `publish_mission` may surface at `autonomous` (no-confirm, no-UI-gate) depending on row insertion order per workspace.

This is a CVE-class authorization bug masked by the loader. Neither `gate_action` RPC (which does enforce per-capability authority correctly) nor the seed migration (which correctly writes 4 dotted rows per workspace) are broken. The loader is.

## Decision Drivers

- ADR-0173 (four journey capabilities with distinct authority defaults) assumes the loader preserves per-capability levels.
- ADR-0176 (C4 authority seed migration) writes dotted keys; the loader must read them the same way.
- L-0066 / L-0097 (C4 authority defaults are not free) — authorization state must be deterministic.
- L-0127 (loader-level bugs entrer ikke grep-audits) — this bug was not in any gap list; found by end-to-end code-trace.
- The base-key fold may have been intentional for legacy capabilities (schedule, contracts, etc.) that used single-word names. Any fix must preserve those.

## Considered Options

1. **Option A — Remove the fold entirely.** Store only dotted keys as written. Update all consumers to look up the dotted form. Breaks any consumer that reads a base key (schedule, contracts, etc. if any rely on it).
2. **Option B — Keep the fold, require `ORDER BY`.** Add `.order('capability', { ascending: true })` or similar so the fold is deterministic. Still collapses per-capability distinctions into one base-key level — just deterministically. Does not fix the ADR-0173 violation; makes it consistent instead of random.
3. **Option C — Keep both, but never fold to a single level.** Store `levels["journey"]` as an object `{ "run_dev": "suggest", "publish_mission": "suggest", "publish_guide": "suggest", "run_guided": "autonomous" }`. Consumers reading base key get structured data. Consumers reading dotted key get the specific level. Explicit migration path.
4. **Option D — Change `CapabilityName` union to dotted form + change tool-selector lookup.** Add `journey.run_dev` / `journey.publish_mission` / `journey.publish_guide` / `journey.run_guided` to `packages/ai/src/capabilities/types.ts` `CapabilityName`. Tool-selector reads `authorityConfig[tool.capability]` (dotted), not `authorityConfig[capability.name]` (short). Removes the fold's relevance for journey without touching legacy base-key consumers.

## Decision Outcome

Chosen option: **"Option D — Change `CapabilityName` union to dotted form + tool-selector reads dotted"**, because:
- Option A has widest blast radius — unknown legacy consumers may break.
- Option B preserves the authorization error, just makes it predictable. Unacceptable.
- Option C introduces a new data shape in authority config that every loader consumer must understand; migration risk high.
- Option D is surgical: change two contracts (CapabilityName union, tool-selector lookup) and delete the fold for journey-dotted keys. Legacy base-key capabilities keep their behavior. Each tool reads its own dotted level.

## Rules & Consequences

### Rules

1. **`packages/ai/src/capabilities/types.ts`:** `CapabilityName` union gains four new members — `"journey.run_dev" | "journey.publish_mission" | "journey.publish_guide" | "journey.run_guided"`. The short `"journey"` form is retained for legacy but deprecated for new code (mark with `@deprecated` JSDoc; remove in follow-up when zero consumers).
2. **`packages/ai/src/capabilities/journey/index.ts`:** Each tool registers with its dotted capability name. `journeyCapability.name` remains `"journey"` for backward compat; `journeyCapability.tools[n].capability` becomes the dotted form.
3. **`packages/ai/src/router/tool-selector.ts`:** Replace `authorityConfig[capability.name]` with `authorityConfig[tool.capability]` at line 67. Resolution becomes per-tool, not per-capability-group.
4. **`services/stage-engine/src/core/authority.ts`:** Loader keeps both the dotted key and any base-key aliases for legacy consumers. Per-dotted-key level is authoritative for journey tools; base-key `levels["journey"]` is deleted (any legacy consumer relying on it is out of contract per Rule 1).
5. **Migration:** Add integration test in `apps/e2e/tests/` that seeds `engine_authority_config` with deliberately out-of-order rows and asserts tool-selector picks the correct per-tool level.
6. **ADR-0099 re-affirmation:** `callGateAction` in each tool uses the dotted capability name. ADR-0099 is orthogonal — gate_action was always per-dotted-capability correctly; the bug was upstream in tool visibility.

### Consequences

- **Good, because:** ADR-0173 per-capability authority model is restored.
- **Good, because:** CVE-class authorization drift is eliminated at the source.
- **Good, because:** Adding future capabilities with distinct authority levels is straightforward — seed dotted, read dotted.
- **Bad, because:** Requires touching `CapabilityName` union (type-change; every consumer recompiles).
- **Bad, because:** Legacy capabilities that relied on the base-key fold (if any) must be migrated to dotted form before this ADR fully lands.
- **Agent Impact:** Tool-selector visibility decisions become deterministic per tool. Agent routing that selected `journey` as a capability-group and iterated tools now selects tools individually. LLM-facing tool list may grow (4 entries instead of 1 group); this matches real authority state.

## References

- ADR-0173 (four journey capabilities)
- ADR-0176 (C4 authority seed migration)
- ADR-0099 (gate_action mandatory)
- ADR-0192 (authority seed bootstrap-trigger pattern)
- L-0066, L-0097 (C4 authority defaults are not free)
- L-0127 (loader-level bugs entrer ikke grep-audits)
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-23
- `services/stage-engine/src/core/authority.ts:29-54`
- `packages/ai/src/router/tool-selector.ts:25,67,78`
- `packages/ai/src/capabilities/types.ts:24`
- `packages/ai/src/capabilities/registry.ts:40`
- `supabase/migrations/20260516000400_journey_authority_seed.sql:127-130`

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
