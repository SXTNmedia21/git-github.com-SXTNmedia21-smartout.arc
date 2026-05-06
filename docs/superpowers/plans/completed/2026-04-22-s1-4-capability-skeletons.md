---
title: "S1.4 Sub-Sortie Brief — journey capability skeletons (4 capabilities)"
status: approved
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [sub-sortie, m1, capabilities, adr-0173, adr-0078, adr-0134]
---

# S1.4 — Journey capability skeletons

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.4 (final M1 sub-sortie)
> **Predecessors:** S1.1 (`05b827b1`), S1.2 (`eef0b78d`), S1.3 (`fdfe1575`) — all merged + pushed
> **Trust-Gate Unblock closed:** #4 (capability skeletons registered)
> **Binding ADRs:** 0078 (voice forbidden for PII/critical), 0134 (mobile telemetry contract), 0173 (capability model)
> **Gate A conditions applied:** C-3 (actor_id non-null test), C-5 (actor_id grep gate), A-1/A-5 (readOnlyTools + intent-classifier wiring)

---

## Why this is the last M1 piece

S1.1–S1.3 built the foundation (telemetry, table, authority seed). S1.4 plugs the capabilities in. After S1.4 merges, M1 exits with 4/7 Trust-Gate Unblocks closed and ADRs 0172/0173/0175/0176 move `proposed → accepted`. ADRs 0171, 0174, 0177 stay `proposed` (Gate A Steward C-4).

## Scope — exactly what lands

### File structure (mirror `packages/ai/src/capabilities/operations/`)

```
packages/ai/src/capabilities/journey/
├── index.ts        — CapabilityDefinition + exports
└── tools.ts        — 4 defineTool() definitions
```

### Expected exports from `index.ts`

```typescript
import { allTools } from "./tools";
import type { CapabilityDefinition } from "../types";

export const journeyCapability: CapabilityDefinition = {
  name: "journey",
  description: "...", // 1-line: journey authoring + runtime execution surface
  allowedChannels: ["chat"],  // ADR-0078 — no voice for journey mutations
  tools: allTools,
  readOnlyTools: [],          // 4 tools, all mutations (Gate A A-1)
  suggestTools: [runDevTool, publishMissionTool, publishGuideTool],
  // run_guided has no entry in suggestTools → autonomous level (verify with existing pattern)
};
```

The tool-selector's `level` semantics per the AuthorityLevel header comment (S1.1, `types.ts:25`): presence in `suggestTools` → UI-confirm flow; absence from `suggestTools` but presence in `tools` → autonomous direct-execute. Verify this against `packages/ai/src/capabilities/tool-selector.ts` before publishing — if the actual semantics differ, match the code, not the plan.

### Expected exports from `tools.ts`

Four `defineTool()` calls. Each tool:
- Has a unique, deterministic name matching the authority seed row: `run_dev`, `publish_mission`, `publish_guide`, `run_guided` (the `journey.` prefix is the capability namespace, handled outside the tool name).
- `description` — one line per tool.
- `parameters` — Zod schema, minimal for M1 (e.g., `{ journey_version_id: z.string().uuid() }`).
- `execute` — skeleton only. Returns `{ ok: true, note: "S1.4 skeleton; M3/M4/M5 will wire full logic" }` BUT must `emit()` one journey event and verify `ctx.workspaceId` + `ctx.profileId` are non-null first.

Example skeleton for `run_dev`:

```typescript
export const runDevTool = defineTool({
  name: "run_dev",
  description: "Execute a JourneyIR locally against a dev build (Playwright). Dev surface.",
  parameters: z.object({
    journey_version_id: z.string().uuid(),
  }),
  execute: async ({ journey_version_id }, ctx) => {
    // ADR-0134: workspace_id + actor_id must resolve non-null/non-empty BEFORE emit.
    if (!ctx.workspaceId || !ctx.profileId) {
      return {
        ok: false,
        error: "missing_context",
        message: "run_dev requires resolved workspaceId + profileId (ADR-0134)",
      };
    }

    const runId = crypto.randomUUID();

    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.run_dev",
        surface: "dev",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `run_dev/${journey_version_id}`,
        },
      },
    });

    return {
      ok: true,
      run_id: runId,
      note: "S1.4 skeleton — full Playwright wiring lands in M3",
    };
  },
});
```

Same skeleton shape for `publish_mission`, `publish_guide`, `run_guided`. Each emits `journey run_started` with a different `capability` + `surface` value; M3+ wires the downstream events. Do NOT emit `step_reached`, `completed`, `stuck`, or `run_failed` — those are downstream runtime events (M5 adds them where they actually fire).

### `CapabilityName` union update

`packages/ai/src/capabilities/types.ts:5-23` — add one entry:

```typescript
export type CapabilityName =
  | ...
  | "helpdesk_query"
  | "journey";  // ADR-0173 — journey authoring + runtime (4 tools: run_dev, publish_mission, publish_guide, run_guided)
```

### Capability registration (where the router reads capabilities)

Find the capability registry by grep: `grep -Rn "operationsCapability\|capabilities\.operations\|\"operations\"" packages/ai/src/ services/stage-engine/src/ | head -20`. Add `journeyCapability` in the same registry pattern. If this registry lives in a file your grep surfaces, match the existing style (imports + entry).

### Intent-classifier wiring (Gate A advisory A-5)

Find with: `grep -Rn "intent.*classifier\|classifyIntent\|capability:" packages/ai/src/ | head -20`. If intent→capability mapping lives there:
- Add 4 entries mapping common user phrasings to the journey capability. Keep minimal: "run dev", "publish mission", "publish guide", "start guided journey".
- If no such file exists (agent-router uses different pattern), document the finding in the handoff and defer to M2.

### `emit()` import + registry round-trip

- Import `emit` from the telemetry package. Find the right import path by: `grep -Rn "from.*@smartout/telemetry.*emit\|from.*packages/telemetry" packages/ai/src/ | head -5`.
- Confirm all 4 `emit()` calls use the space-named event key `"journey run_started"` (S1.1 convention).

## Out of scope

- **DO NOT** implement `execute()` bodies beyond the ADR-0134 guard + one emit + return skeleton.
- **DO NOT** emit `step_reached`/`completed`/`stuck`/`run_failed` — M5.
- **DO NOT** create `packages/journey-ir/` — M2.
- **DO NOT** touch `packages/ai/src/journey/compile.ts` (legacy, grandfathered).
- **DO NOT** add migrations (authority is seeded in S1.3).
- **DO NOT** add BFF routes for mobile (`/api/journey/guided/...`) — M5.
- **DO NOT** add a 5th tool — exactly 4 per ADR-0173.

## Acceptance criteria (exit gates, Gate A C-5 grep gate is merge-blocker)

- [ ] Files exist: `packages/ai/src/capabilities/journey/index.ts` + `packages/ai/src/capabilities/journey/tools.ts`
- [ ] `CapabilityName` union contains `"journey"`
- [ ] `grep -R "actor_id:.*?? \"\"" packages/ai/src/capabilities/journey/` returns 0 lines **(Gate A C-5, MERGE BLOCKER)**
- [ ] `grep -R "actor_id: \"\"" packages/ai/src/capabilities/journey/` returns 0 lines
- [ ] Every `execute()` in `tools.ts` has the ADR-0134 guard (`if (!ctx.workspaceId || !ctx.profileId) return {ok:false,...}`)
- [ ] Every `execute()` has exactly one `emit({ event: "journey run_started", ... })` call post-guard
- [ ] `allowedChannels: ["chat"]` present on `journeyCapability` (ADR-0078)
- [ ] `readOnlyTools: []` explicit
- [ ] `suggestTools` contains 3 of 4 tools (run_guided excluded → autonomous)
- [ ] `grep -R "packages/ai/src/journey\b" apps packages scripts | grep -v node_modules | grep -v dist` returns only the grandfathered consumer at `apps/web/src/app/platform-admin/journeys/actions/compile.ts` and no new references
- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] Unit test at `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts`:
  - asserts `journeyCapability.allowedChannels === ["chat"]`
  - asserts `journeyCapability.readOnlyTools.length === 0`
  - asserts `journeyCapability.tools.length === 4`
  - asserts tool names are `["run_dev","publish_mission","publish_guide","run_guided"]` (as a set)
  - asserts each `execute()` with `{workspaceId:"",profileId:""}` returns `{ok:false, error:"missing_context"}` — the ADR-0134 compliance test (Gate A C-3)
- [ ] Handoff + User Journey + Decision log updates

## Decision log entries

Add two rows:
- `ADR-0173 landed` — 4 capabilities registered per spec; see `packages/ai/src/capabilities/journey/`.
- `ADR-0134 compliance test added for journey capabilities` — pattern for all future capability builds.

## M1 exit ADR bumps (orchestrator task, NOT S1.4 agent task)

After S1.4 merges, orchestrator bumps the following ADRs `proposed → accepted` in `docs/decisions/`:
- ADR-0172 (enum lifecycle)
- ADR-0173 (capability model)
- ADR-0175 (telemetry contract)
- ADR-0176 (authority seed)

Staying `proposed` at M1 exit:
- ADR-0171 (package path) — unblocks when M2 retires legacy `packages/ai/src/journey/compile.ts`
- ADR-0174 (generator unification) — M3 work
- ADR-0177 (UI contract) — M4 work

## Dispatch

Single build subagent. Return handoff for verification.
