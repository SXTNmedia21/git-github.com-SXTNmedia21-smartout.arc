---
title: "WalkAi Bridge Builder Agent — Design Spec"
status: review
updated: 2026-03-26
created: 2026-03-26
module: walkAi
tags: [agent, walkAi, capabilities, tools, bridge]
---

# WalkAi Bridge Builder Agent

## Problem

WalkAi has two separate tool systems with no automated bridge between them:

1. **Backend capabilities** (`packages/ai/src/capabilities/`) — `SmartoutTool` definitions that run server-side in Stage Engine via Vercel AI SDK
2. **Frontend page tools** (`apps/web/src/app/walkAi/_components/`) — `ClientToolKit` definitions that run client-side in browser via Ultravox

Only 3 of 10 declared capabilities are implemented (profile, ui, guardian). 7 remain stubs: schedule, training, operations, knowledge, communication, memory, payroll. Existing tool implementations exist in `packages/ai/src/tools/` but lack `CapabilityDefinition` wrappers and have no connection to the WalkAi frontend tool system.

Building each new capability requires touching 4-6 files across two packages, following specific type patterns, and wiring registration in multiple places. This is repetitive, error-prone, and needs architectural consistency that a specialized autonomous agent can enforce.

## Solution

A specialized build agent at `.claude/agents/walkai-bridge-builder.md` that autonomously:

1. Creates new `CapabilityDefinition` implementations following the guardian reference pattern
2. Creates `ClientToolKit` page tools following the `walkai-tools.ts` pattern
3. Wires both sides into registries (capability registry + tool registry)
4. Sets up authority config, memory patterns, and telemetry
5. Runs a verification checklist to confirm everything is connected

## Architecture

### Two Tool Systems (the bridge gap)

| Aspect          | Backend (SmartoutTool)                    | Frontend (ClientToolKit)                             |
| --------------- | ----------------------------------------- | ---------------------------------------------------- |
| **Runtime**     | Stage Engine (Node.js, port 5010)         | Browser (WalkAi Provider)                            |
| **Auth**        | `supabaseAdmin` (service role)            | User session cookie                                  |
| **LLM**         | OpenRouter via Vercel AI SDK              | Ultravox cloud                                       |
| **Tool format** | Zod schema + async `execute(params, ctx)` | `temporaryTool` JSON + sync string return            |
| **DB access**   | Direct via `ctx.supabaseAdmin`            | Via `fetch()` to API routes                          |
| **UI control**  | WebSocket broadcast via `ctx.broadcast()` | Direct React state mutation via refs                 |
| **Location**    | `packages/ai/src/capabilities/{name}/`    | `apps/web/src/app/walkAi/_components/` or page-level |

### Capability File Structure (fixed scaffold)

```
packages/ai/src/capabilities/{name}/
  index.ts    — CapabilityDefinition export (tools, readOnlyTools, suggestTools)
  tools.ts    — Individual SmartoutTool definitions using defineTool()
```

### Registration Points

| What                  | Where                                                 | How                                         |
| --------------------- | ----------------------------------------------------- | ------------------------------------------- |
| Capability definition | `packages/ai/src/capabilities/registry.ts`            | Import + add to `capabilities` record       |
| Capability name       | `packages/ai/src/capabilities/types.ts`               | Add to `CapabilityName` union (if new name) |
| Intent routing        | `packages/ai/src/router/intent-classifier.ts`         | Add to hardcoded capability enum            |
| Global client tools   | `apps/web/src/app/walkAi/_components/walkai-tools.ts` | Add to `buildWalkAiToolKit()`               |
| Page-specific tools   | Page component file                                   | Call `useRegisterTools("source", toolkit)`  |

### Authority Flow

1. `loadAuthorityConfig(workspaceId)` returns `Record<string, AuthorityLevel>`
2. `selectTools(intent, authorityConfig)` filters tools by level:
   - `disabled` → no tools
   - `read_only` → `capability.readOnlyTools` only
   - `suggest` → `readOnlyTools + suggestTools`
   - `confirm` / `autonomous` → all `capability.tools`
3. Default when no config row exists: `read_only`

### Memory Pattern

- Server-side tools: call `saveMemory()` via `memory-manager.ts` directly
- Client-side tools: use existing `/api/emma/memory` route via `fetch()`
- Context injection: `collectContext()` loads memories into system prompt automatically

## Agent Definition

### Identity

| Field      | Value                                     |
| ---------- | ----------------------------------------- |
| **Name**   | `walkai-bridge-builder`                   |
| **File**   | `.claude/agents/walkai-bridge-builder.md` |
| **Model**  | opus                                      |
| **Color**  | cyan                                      |
| **Memory** | project                                   |

### Scope — Files Agent CREATES

```
packages/ai/src/capabilities/{name}/index.ts
packages/ai/src/capabilities/{name}/tools.ts
```

Page-level tool files are flexible in location (depend on which dashboard page).

### Scope — Files Agent MODIFIES

```
packages/ai/src/capabilities/registry.ts          — register new capability
packages/ai/src/capabilities/types.ts              — add to CapabilityName union
packages/ai/src/router/intent-classifier.ts        — add to capability enum
apps/web/src/app/walkAi/_components/walkai-tools.ts — add global client tools
```

### Scope — Files Agent READS (reference only)

```
packages/ai/src/capabilities/guardian/             — reference implementation
packages/ai/src/capabilities/profile/              — reference implementation
packages/ai/src/capabilities/ui/                   — reference (broadcast pattern)
packages/ai/src/types.ts                           — SmartoutTool, defineTool
packages/ai/src/capabilities/types.ts              — CapabilityDefinition, AgentToolContext
packages/ai/src/tools/**                           — existing tool implementations to wrap
packages/agent-sdk/src/types.ts                    — ClientToolKit types
apps/web/src/app/walkAi/_components/tool-registry.ts — registration pattern
apps/web/src/app/walkAi/_components/WalkAiProvider.tsx — tool merging logic
services/stage-engine/src/core/authority.ts         — authority gating
services/stage-engine/src/core/memory-manager.ts    — memory patterns
packages/ai/src/router/tool-selector.ts             — authority-based filtering
```

### Scope — Files Agent MUST NOT TOUCH

```
# WalkAi UI components (frontend-designer territory)
apps/web/src/app/walkAi/_components/WalkAiArena.tsx
apps/web/src/app/walkAi/_components/WalkAiOrb.tsx
apps/web/src/app/walkAi/_components/WalkAiShell.tsx
apps/web/src/app/walkAi/_components/WalkAiSticky.tsx
apps/web/src/app/walkAi/_components/EmmaProfile.tsx
apps/web/src/app/walkAi/_components/walkai.css
apps/web/src/app/walkAi/page.tsx

# WalkAi infrastructure (read-only reference)
apps/web/src/app/walkAi/_components/WalkAiProvider.tsx
apps/web/src/app/walkAi/_components/persona-engine.ts
apps/web/src/app/walkAi/_components/emma-awareness.ts

# Agent SDK core
packages/agent-sdk/src/hooks/useAgent.ts
packages/agent-sdk/src/types.ts
packages/agent-sdk/src/providers/*

# Stage Engine (system-agent-coordinator territory)
services/stage-engine/**/*

# Database migrations, other packages, docs
```

### Relationship to Other Agents

| Agent                        | Relationship                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **system-agent-coordinator** | Parent authority. Owns capability contracts. Bridge builder operates within coordinator's domain. Coordinator reviews changes to `registry.ts` and `types.ts`.                              |
| **system-steward**           | Verifies plans before bridge builder starts. Checks ADR compliance, schema placement, cross-cutting concerns. Should delegate walkAi bridge verification tasks to this agent when relevant. |
| **supervisor**               | Reviews bridge builder output for scope compliance, pattern adherence, and integration correctness.                                                                                         |
| **frontend-designer**        | Owns WalkAi UI components. Bridge builder creates the plumbing; frontend-designer controls the visual layer.                                                                                |

### Verification Checklist (post-build)

After building a capability + bridge, the agent must verify:

1. `CapabilityDefinition` exported from `{name}/index.ts`
2. All tools use `defineTool()` with Zod schemas
3. `readOnlyTools` is a proper subset of `tools`
4. `suggestTools` defined for mutation tools that should be gated
5. Capability registered in `registry.ts`
6. `CapabilityName` union includes the name
7. Intent classifier enum includes the name
8. Tool names are `snake_case` and unique across ALL capabilities
9. Every tool's `execute()` scopes queries by `ctx.workspaceId`
10. No hardcoded secrets or credentials in tool implementations
11. TypeScript compiles: `pnpm turbo typecheck` passes
12. Page tools (if created) use `useRegisterTools()` hook
13. No files outside scope were modified

### Patterns Embedded in Agent Prompt

The agent's system prompt will include these patterns inline (not as references):

**1. `defineTool()` pattern** — from `packages/ai/src/types.ts`:

```typescript
export const getMyShifts = defineTool({
  name: "get_my_shifts",
  description: "...",
  schema: z.object({ days: z.number().optional() }),
  execute: async (params, ctx: AgentToolContext) => {
    // scope by ctx.workspaceId
    return JSON.stringify(result);
  },
});
```

**2. CapabilityDefinition pattern** — from `guardian/index.ts`:

```typescript
export const scheduleCapability: CapabilityDefinition = {
  name: "schedule",
  description: "...",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
```

**3. Type cast** — required due to SmartoutTool type invariance:

```typescript
const allTools = [tool1, tool2] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
```

**4. Page tool registration** — from `tool-registry.ts`:

```typescript
useRegisterTools("schedule", useMemo(() => ({
  definitions: [{ temporaryTool: { modelToolName: "...", ... } }],
  implementations: { tool_name: (params) => "result string" },
}), [deps]));
```

**5. ViewActions ref pattern** — for client tools that morph UI:

```typescript
const viewActionsRef = useRef<ViewActions | null>(null);
const tools = buildToolKit(viewActionsRef); // impls read from ref lazily
```

**6. SILENT_INSTRUCTION pattern** — voice tools that morph UI:

```typescript
description: "... After calling this tool, do NOT speak. Wait for the user.";
```

## Known Gaps and Debt

1. **No telemetry in existing capabilities** — none of the 3 built capabilities call `emit()`. New capabilities should include `emit()` for mutations.
2. **Memory system split** — server uses `memory-manager.ts`, client uses `/api/emma/memory`. These should converge but are not this agent's responsibility.
3. **i18n debt in walkai-tools.ts** — Norwegian strings hardcoded in tool return messages. New tools should avoid this.
4. **`packages/walkAi/mission-runner/`** — appears to be a copy/fork of `services/stage-engine/`. Canonical Stage Engine is `services/stage-engine/` at port 5010. This agent should NOT reference the mission-runner copy.

## Steward Integration

The system-steward agent should reference the bridge builder in its relationship table and delegate walkAi-related verification to it. Specifically:

- When a plan touches `packages/ai/src/capabilities/` AND `apps/web/src/app/walkAi/`, the steward should note that walkai-bridge-builder is the specialist for this domain
- When reviewing capability additions, the steward should verify the bridge builder's checklist was followed

## Success Criteria

- Agent can autonomously build a new capability from scratch following the guardian pattern
- Agent can create page-specific ClientToolKit and wire registration
- Agent enforces authority gating, workspace isolation, and Zod schemas
- Agent runs verification checklist and catches wiring mistakes
- Agent stays within its file scope boundaries
- Existing agents (coordinator, steward, supervisor) know how to delegate to and review this agent
