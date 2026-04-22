---
title: "Handoff — S1.4 journey capability skeletons"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [handoff, s1-4, m1, capabilities, adr-0173, adr-0078, adr-0134]
---

# HANDOFF — S1.4 Journey Capability Skeletons

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.4 (final M1 sub-sortie)
> **Branch:** `feat/journey-engine-journey-s1-4-capability-skeletons` (based on `campaign/journey-engine`, tip `1daff0eb`)
> **Brief:** `docs/superpowers/plans/2026-04-22-s1-4-capability-skeletons.md`
> **Predecessors:** S1.1 (merged `05b827b1`), S1.2 (merged `eef0b78d`), S1.3 (merged `fdfe1575`)
> **Trust-Gate Unblock closed:** #4 (capability skeletons registered)
> **Binding ADRs:** 0078 (voice forbidden for PII), 0134 (mobile telemetry contract), 0173 (capability model), 0175 (telemetry contract)
> **Gate A conditions applied:** C-3 (actor_id non-null test), C-5 (actor_id grep gate), A-1 (readOnlyTools explicit empty), A-5 (intent-classifier wiring)

## Summary

S1.4 wires the four journey capabilities into the tool-selector + intent-classifier stack. Each tool is a skeleton: ADR-0134 guard → generate `run_id` → emit exactly one `journey run_started` event → return a JSON-stringified skeleton result. No downstream events, no state machine, no Playwright bridge — all deferred to M3/M4/M5 per ADR-0173.

This closes Trust-Gate Unblock #4 (capability skeletons registered) and completes M1 Foundations. After merge, the orchestrator bumps ADRs 0172 / 0173 / 0175 / 0176 from `proposed → accepted`.

### What changed

**Capability (2 new files):**

- `packages/ai/src/capabilities/journey/index.ts` — `journeyCapability: CapabilityDefinition` with `allowedChannels: ["chat"]`, `readOnlyTools: []` (explicit), `suggestTools = [runDevTool, publishMissionTool, publishGuideTool]` (3 of 4), `tools = allTools` (4). Re-exports all 4 tools + `allTools`.
- `packages/ai/src/capabilities/journey/tools.ts` — 4 `defineTool()` definitions (`runDevTool`, `publishMissionTool`, `publishGuideTool`, `runGuidedTool`). Each has: shared Zod schema (`journey_version_id` uuid), ADR-0134 guard, single `emit("journey run_started")` with FLAT + nested-entity payload, skeleton return.

**Type + registry wiring (3 files edited):**

- `packages/ai/src/capabilities/types.ts` — appended `| "journey"` to `CapabilityName` union (line 24).
- `packages/ai/src/capabilities/registry.ts` — imported `journeyCapability`, added `journey: journeyCapability` row.
- `packages/ai/src/router/intent-classifier.ts` — added `"journey"` to `intentSchema.capability` enum and prompt description (Gate A A-5, advisory).

**Test (1 new file):**

- `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts` — 22 assertions across 3 describe-blocks: capability shape, ADR-0134 compliance (3 empty-context variants per tool × 4 tools = 12 cases), happy-path run_id + surface.

**Docs (3 files):**

- `docs/HANDOFF-journey-s1-4-capability-skeletons.md` (this file).
- `docs/journeys/JOURNEY-journey-s1-4-capability-skeletons.md`.
- `docs/decisions/0000-decision-log.md` — ADR-0173 landing row + ADR-0134 compliance-test pattern row.

### What did NOT change (out of scope per brief)

- `packages/journey-ir/` — M2.
- `packages/ai/src/journey/compile.ts` — legacy, grandfathered until M2 retires it.
- Migration files — authority is already seeded (S1.3).
- BFF routes for mobile (`/api/journey/guided/...`) — M5.
- Downstream events (`step_reached`, `completed`, `stuck`, `run_failed`) — M5 wires where they actually fire.
- Generator retarget / `protocolToJourneyIR()` adapter — M3.
- Gate_action RPC default-allow fix — separate, larger ADR (L-0066 / L-0097 tracked).

## Decisions

### ADR-0173 — four journey capabilities, registered (landed)

Four capabilities exist in `journeyCapability`:

| Tool | Authority default (S1.3 seed) | Surface | suggestTools? |
|------|-------------------------------|---------|----------------|
| `run_dev` | suggest (min_role admin) | dev | yes |
| `publish_mission` | suggest (min_role admin) | admin | yes |
| `publish_guide` | suggest (min_role admin) | admin | yes |
| `run_guided` | autonomous (min_role employee) | runtime_web | NO (autonomous-only) |

The `run_guided` exclusion from `suggestTools` is deliberate and matches the authority seed: tool-selector's `suggest` level returns `readOnlyTools + suggestTools`, so `run_guided` simply never reaches the agent unless authority is `autonomous` or `confirm` (both of which return `capability.tools` in full). Safety posture: a workspace that downgrades `run_guided` to `suggest` loses access entirely — the capability is either on (autonomous) or off (suggest/read_only).

### ADR-0134 — compliance-test pattern for journey capabilities (new row)

Every `execute()` tests three empty-context variants:
1. Both `workspaceId` and `profileId` empty.
2. Only `workspaceId` empty.
3. Only `profileId` empty.

Each must return `{ok: false, error: "missing_context"}` BEFORE any emit side-effect. This is the template for every future capability write: a 3-variant guard test per tool, grep-checked against the Gate A C-5 patterns.

### Implementation notes

- **Return type is `string`, not an object.** `SmartoutTool.execute` is typed `Promise<string>` (see `packages/ai/src/types.ts:20`). The operations capability pattern (return `JSON.stringify(...)`) is mirrored here. The brief's example showed a raw `{ok:true,...}` object but the type system required a JSON-stringified return — tests parse with `JSON.parse()` before asserting.
- **Tool `name` vs `capability` field:** The seed migration uses fully-qualified `journey.run_dev` / `journey.publish_mission` / etc. in `engine_authority_config.capability`. Inside `defineTool()`, `name` is the unprefixed tool name (`run_dev`) and `capability` is the prefixed capability key (`journey.run_dev`) — matches the operations / helpdesk_query precedent. Tool-selector resolves by capability + tool separately; the `CapabilityDefinition.name` is the short key (`journey`) used in the registry map.
- **Intent-classifier entry is hot-path.** The `intentSchema` enum now has 20 members (19 prior + `journey`). The prompt description adds a single `journey:` bullet with 4 NB/EN example phrasings. If future milestones break the journey capability into narrower intents (e.g. dev vs publish vs guided), that's an M3+ decision.

## Learnings

- **L-0094 (phantom emit contracts)** — S1.1 pre-registered `journey run_started` with the FLAT + nested-entity payload; S1.4's emit calls matched exactly. Phase 2.5 grep of `packages/telemetry/src/registry.ts` before writing emit code prevented the 5th occurrence. Pattern confirmed: register event → write mutation code, never the reverse.
- **SmartoutTool return-type constraint.** The brief's pseudo-code suggested an object return. The actual type is `Promise<string>`. When the types disagree with the plan, the types win (CLAUDE.md §Documentation Protocol rule 4: code wins). Noted for any future capability briefs that quote execute-body pseudo-code.
- **Tool-selector `suggest`-level semantics are subtle.** At authority = `suggest`, the agent only sees `readOnlyTools + suggestTools`. `journey` has `readOnlyTools: []`, so a workspace at `suggest` authority sees exactly 3 tools (no `run_guided`) — matches the seed intent. At `autonomous`, all 4 are visible. This inversion (4-or-3 based on authority) is the safety knob; document in ADR-0173 accepted version if not already there.
- **Intent-classifier enum grows in lockstep with capability registry.** Every new capability needs (1) the registry row, (2) the `CapabilityName` union entry, (3) the `intentSchema` enum member, (4) a prompt bullet. All four are required for end-to-end intent routing. Missing any one produces silent tool unavailability at runtime. Add a council-checked gate for future capability adds.

## Verification gate outputs

### Gate 1 — `cat packages/ai/src/capabilities/journey/index.ts | head -40`

First 40 lines show header comment (scope, authority mapping, ADR refs), imports (`SmartoutTool`, `AgentToolContext`, `CapabilityDefinition`, 4 tools + `allTools`), and the `readOnlyTools = [] ... ReadonlyArray<SmartoutTool<AgentToolContext>>` explicit empty array with rationale. (Full text verified in file.)

### Gate 2 — `cat packages/ai/src/capabilities/journey/tools.ts | head -60`

First 60 lines show scope comment, ADR bindings, L-0094 reference with registry line-number verification (`registry.ts:4737+`), imports (`z`, `emit`, `defineTool`, `AgentToolContext`), shared `journeyVersionParam` schema, `MISSING_CONTEXT` constant, and the start of `runDevTool` with `capability: "journey.run_dev"`.

### Gate 3 — `grep -n "journey" packages/ai/src/capabilities/types.ts`

```
24:  | "journey"; // ADR-0173 — journey authoring + runtime (4 tools: run_dev, publish_mission, publish_guide, run_guided)
```

### Gate 4 — `grep -R "actor_id:.*?? \"\"" packages/ai/src/capabilities/journey/` + `grep -R "actor_id: \"\"" packages/ai/src/capabilities/journey/`

**Both return 0 lines.** Gate A C-5 passes.

### Gate 5 — `grep -R "packages/ai/src/journey\b" apps packages scripts`

Returns 0 lines for the raw directory form. The `@smartout/ai/journey` export form has exactly one (grandfathered) hit: `apps/web/src/app/platform-admin/journeys/actions/compile.ts`. Matches the expected M1 state (M2 migration sub-sortie retires it).

### Gate 6 — `pnpm turbo typecheck`

```
Tasks:    33 successful, 33 total
Cached:   27 cached, 33 total
Time:     1m33s
```

`@smartout/ai:typecheck` ran fresh (cache miss from new files) → 0 errors. All 33 downstream tasks pass.

### Gate 7 — `pnpm --filter=@smartout/ai test -- --run src/router src/capabilities`

```
Test Files  12 passed (12)
Tests       125 passed (125)
Duration    1.31s
```

The 22 new journey-capability assertions pass alongside the 103 pre-existing tests (intent-classifier, tool-selector, scoring, min-role, every other capability). No regressions.

### Gate 8 — `grep -Rn "journeyCapability\|\"journey\"" packages/ai/src/ services/stage-engine/src/`

`journeyCapability` imported at `packages/ai/src/capabilities/registry.ts:18` and registered at `registry.ts:36`. `"journey"` appears as (a) the `CapabilityName` entry at `types.ts:24`, (b) the intent-classifier enum member at `intent-classifier.ts:55`, (c) the capability `name` in `journey/index.ts:48`, (d) test assertions. Pre-existing `.from("journey")` Supabase reads in `packages/ai/src/tools/journey/*` and `services/stage-engine/src/core/session-manager.ts` are unrelated (raw table name, unchanged).

### Capability-registry file location (discovered, per brief)

`packages/ai/src/capabilities/registry.ts` — imports every capability's `index.ts`, builds a `Record<string, CapabilityDefinition>`, exports `getCapability(name)` / `getAllCapabilities()` / `getRegisteredCapabilities()`. Added `journey: journeyCapability` row and the import statement. Matches the existing pattern (alphabetically-adjacent to `helpdesk_query`).

### Intent-classifier wiring (Gate A advisory A-5) — DONE, not deferred

- Added `"journey"` to the `intentSchema.capability` enum in `packages/ai/src/router/intent-classifier.ts:55`.
- Added a `journey:` bullet to the system-prompt description with 4 NB/EN example phrasings covering all four tools.
- Existing intent-classifier tests still pass (7 tests) — the added enum member does not regress any prior classification.

## Known issues / debt

- **`gate_action` default-allow** is untouched (L-0066 / L-0097 tracked). Until that RPC flips to default-deny, ANY capability whose `engine_authority_config` row is missing (e.g. a future workspace created without the seed) will be allow-any. S1.3's seed closes the current window; the structural fix is a separate ADR.
- **No eval-harness coverage** for the intent-classifier's new `journey` arm. The existing eval suite has 4 unregistered intents (knowledge/training/memory/payroll) that are known-degenerate; adding `journey` eval cases is M4 work when real journey UX lands.
- **run_guided surface is `runtime_web`** in the emit payload, not `runtime_mobile`. Mobile BFF wiring (ADR-0132) is M5; S1.4 does not exercise the mobile path.

## Next steps (M1 exit + M2 hand-off)

1. Orchestrator: bump ADRs 0172 / 0173 / 0175 / 0176 from `proposed → accepted` in the decision log after merge.
2. M2 sub-sortie plan: create `packages/journey-ir/` package, migrate `packages/ai/src/journey/compile.ts`, flip the grandfathered consumer to the new import path, delete the legacy file + `./journey/compile` export from `packages/ai/package.json`. Then the `grep packages/ai/src/journey\b` gate flips from 1 result to 0.
3. M2 spec v1.7.0: write `actor_id` resolution doc (dev = user session, admin = admin session, runtime = `getProfileContext()`), then unblock #6.
4. M3 generator retarget: `protocolToJourneyIR()` adapter + generator cutover + `docs/protocol/` deletion window.

## Files touched (commit manifest)

- NEW `packages/ai/src/capabilities/journey/index.ts`
- NEW `packages/ai/src/capabilities/journey/tools.ts`
- NEW `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts`
- EDIT `packages/ai/src/capabilities/types.ts`
- EDIT `packages/ai/src/capabilities/registry.ts`
- EDIT `packages/ai/src/router/intent-classifier.ts`
- NEW `docs/HANDOFF-journey-s1-4-capability-skeletons.md`
- NEW `docs/journeys/JOURNEY-journey-s1-4-capability-skeletons.md`
- EDIT `docs/decisions/0000-decision-log.md`
