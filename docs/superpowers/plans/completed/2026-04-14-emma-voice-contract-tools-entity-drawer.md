---
title: "Emma Voice-Mode: Contract Tools + Entity Drawer Fix"
status: draft
created: 2026-04-14
updated: 2026-04-14
module: ai
tags: [emma, voice, contracts, entity-drawer, security, council-approved]
---

# Emma Voice-Mode: Contract Tools + Entity Drawer Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs in Emma voice-mode: (1) Emma creates a notepad note instead of a contract because no contract tools exist in voice, (2) entity drawer shows infinite skeleton because Emma can't resolve employee names to UUIDs. Additionally, close the ADR-0078 security gap where `allowedChannels` is declared but never enforced.

**Architecture:** The fix adds `allowedChannels` enforcement to the tool-selector (security), a `search_profiles_by_name` server-side capability tool (data lookup), UUID validation in the entity drawer voice tool (bug fix), and `emit()` telemetry on mutating client tools (debt fix). Contract mutation tools remain chat-only per ADR-0077/0078 — voice gets read-only contract info through the existing chat pipeline.

**Tech Stack:** TypeScript, Zod, Vitest, Supabase (profile table), @smartout/ai capabilities, @smartout/telemetry

**Council:** Approved with conditions (2026-04-14). All 4 agents reviewed. ADR-0089 to be written.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/ai/src/router/tool-selector.ts` | Modify | Add `channel` parameter, filter by `allowedChannels` |
| `packages/ai/src/router/__tests__/tool-selector.test.ts` | Modify | Add channel enforcement tests |
| `services/stage-engine/src/core/agent-router.ts` | Modify | Pass `channel` to `selectTools()` |
| `packages/ai/src/capabilities/contract/index.ts` | Modify | Add `allowedChannels: ["chat"]` |
| `packages/ai/src/capabilities/profile/tools.ts` | Modify | Add `searchProfilesByName` tool |
| `packages/ai/src/capabilities/profile/index.ts` | Modify | Register new tool in `readOnlyTools` |
| `apps/web/src/app/Botsson/_components/BotssonTools.ts` | Modify | UUID validation + `emit()` on mutations |

---

### Task 1: Enforce `allowedChannels` in tool-selector (Security Fix)

**Files:**
- Modify: `packages/ai/src/router/tool-selector.ts`
- Modify: `packages/ai/src/router/__tests__/tool-selector.test.ts`

- [ ] **Step 1: Write the failing test for channel filtering on confident path**

Add to `packages/ai/src/router/__tests__/tool-selector.test.ts`, inside a new `describe` block after the existing two:

```typescript
describe("selectTools — channel filtering (ADR-0078)", () => {
  it("excludes capability when channel is not in allowedChannels", () => {
    // Temporarily add allowedChannels to schedule capability
    const original = scheduleCapability.allowedChannels;
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = ["chat"];

    const auth: AuthorityConfig = { schedule: "autonomous" };
    const tools = selectTools(intent("schedule", 0.9), auth, "voice");
    expect(tools).toEqual([]);

    // Restore
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = original;
  });

  it("includes capability when channel matches allowedChannels", () => {
    const original = scheduleCapability.allowedChannels;
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = ["chat"];

    const auth: AuthorityConfig = { schedule: "autonomous" };
    const tools = selectTools(intent("schedule", 0.9), auth, "chat");
    expect(names(tools)).toEqual(["schedule.read", "schedule.suggest", "schedule.write"]);

    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = original;
  });

  it("includes capability when no allowedChannels is defined (backwards compat)", () => {
    const auth: AuthorityConfig = { schedule: "autonomous" };
    const tools = selectTools(intent("schedule", 0.9), auth, "voice");
    expect(names(tools)).toEqual(["schedule.read", "schedule.suggest", "schedule.write"]);
  });

  it("includes capability when no channel is provided (backwards compat)", () => {
    const original = scheduleCapability.allowedChannels;
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = ["chat"];

    const auth: AuthorityConfig = { schedule: "autonomous" };
    // No channel argument — should include (backwards compat)
    const tools = selectTools(intent("schedule", 0.9), auth);
    expect(names(tools)).toEqual(["schedule.read", "schedule.suggest", "schedule.write"]);

    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = original;
  });

  it("filters by channel in fallback path (low confidence)", () => {
    const original = scheduleCapability.allowedChannels;
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = ["chat"];

    const auth: AuthorityConfig = { schedule: "autonomous", training: "autonomous" };
    const tools = selectTools(intent("general", 0.5), auth, "voice");
    // schedule excluded (chat-only), training included (no restriction)
    expect(names(tools)).toEqual(["training.read", "training.write"]);

    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = original;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/ai && pnpm vitest run src/router/__tests__/tool-selector.test.ts`
Expected: FAIL — `selectTools` does not accept a third argument yet.

- [ ] **Step 3: Implement channel filtering in selectTools**

In `packages/ai/src/router/tool-selector.ts`, add the `SessionChannel` import and `channel` parameter:

```typescript
import type {
  AgentToolContext,
  AuthorityLevel,
  CapabilityDefinition,
  CapabilityName,
  SessionChannel,
} from "../capabilities/types.js";
```

Update the `selectTools` function signature and add channel guards:

```typescript
export function selectTools(
  intent: IntentResult,
  authorityConfig: AuthorityConfig,
  channel?: SessionChannel,
): ReadonlyArray<SmartoutTool<AgentToolContext>> {
  const defaultLevel: AuthorityLevel = "read_only";

  if (intent.confidence >= 0.7 && intent.capability !== "general") {
    const capability = getCapability(intent.capability as CapabilityName);
    if (!capability) return [];

    // ADR-0078: skip capability if channel is restricted
    if (channel && capability.allowedChannels && !capability.allowedChannels.includes(channel)) {
      return [];
    }

    const level = authorityConfig[capability.name] ?? defaultLevel;
    return getToolsForAuthority(capability, level);
  }

  const allTools: SmartoutTool<AgentToolContext>[] = [];
  for (const capability of getAllCapabilities()) {
    // ADR-0078: skip capabilities restricted to other channels
    if (channel && capability.allowedChannels && !capability.allowedChannels.includes(channel)) {
      continue;
    }

    const level = authorityConfig[capability.name] ?? defaultLevel;
    const tools = getToolsForAuthority(capability, level);
    allTools.push(...tools);
  }
  return allTools;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/ai && pnpm vitest run src/router/__tests__/tool-selector.test.ts`
Expected: ALL PASS (existing + new channel tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/router/tool-selector.ts packages/ai/src/router/__tests__/tool-selector.test.ts
git commit -m "feat(ai): enforce allowedChannels in tool-selector (ADR-0078)

selectTools() now accepts an optional channel parameter.
Capabilities with allowedChannels are excluded when the session
channel is not in the allowed list. Backwards compatible — no
channel means no filtering.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pass `channel` to selectTools in agent-router

**Files:**
- Modify: `services/stage-engine/src/core/agent-router.ts:113`

- [ ] **Step 1: Update the selectTools call**

In `services/stage-engine/src/core/agent-router.ts`, line 113, change:

```typescript
  const selectedTools = selectTools(intent, authorityConfig);
```

to:

```typescript
  const selectedTools = selectTools(intent, authorityConfig, channel);
```

The `channel` variable is already destructured from `input` at line 72. The import of `selectTools` at line 12 already works — the new parameter is optional so no import changes needed.

- [ ] **Step 2: Typecheck**

Run: `cd services/stage-engine && pnpm tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts
git commit -m "feat(stage-engine): pass channel to selectTools for ADR-0078 enforcement

The channel from AgentRouterInput is now forwarded to selectTools()
so capabilities with allowedChannels restrictions are filtered out
based on the session channel (chat vs voice).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add `allowedChannels` to contractCapability

**Files:**
- Modify: `packages/ai/src/capabilities/contract/index.ts:35-41`

- [ ] **Step 1: Add allowedChannels to the capability definition**

In `packages/ai/src/capabilities/contract/index.ts`, change:

```typescript
export const contractCapability: CapabilityDefinition = {
  name: "contract",
  description: "Manage employee contracts — create, send for signing, and track status",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
```

to:

```typescript
export const contractCapability: CapabilityDefinition = {
  name: "contract",
  description: "Manage employee contracts — create, send for signing, and track status",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"],
};
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/ai && pnpm tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/contract/index.ts
git commit -m "fix(ai): restrict contract capability to chat channel (ADR-0078)

Contract tools (create, send, list, check) are now chat-only.
This closes the ADR-0078 gap where contract_intake and shift_swap
had allowedChannels but contract capability did not.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add `searchProfilesByName` capability tool

**Files:**
- Modify: `packages/ai/src/capabilities/profile/tools.ts`
- Modify: `packages/ai/src/capabilities/profile/index.ts`

- [ ] **Step 1: Add the searchProfilesByName tool**

Append to `packages/ai/src/capabilities/profile/tools.ts`, after the `getContractStatus` tool:

```typescript
export const searchProfilesByName = defineTool({
  name: "search_profiles_by_name",
  description:
    "Search for employees by name (partial match). Returns profile IDs, display names, roles, " +
    "statuses, and department names. Use to resolve a human name to a profile UUID before " +
    "opening entity drawers or creating contracts. Max 10 results. No PII returned.",
  schema: z.object({
    query: z
      .string()
      .min(1)
      .describe("Name or partial name to search for, e.g. 'Lise' or 'Hansen'"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    const { data, error } = await supabase
      .from("profile")
      .select(
        "profile_id, display_name, role, status, department:department_id(name)",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("is_active", true)
      .ilike("display_name", `%${params.query}%`)
      .order("display_name")
      .limit(10);

    if (error) return `Error searching profiles: ${error.message}`;
    if (!data || data.length === 0) {
      return `No employees found matching "${params.query}" in this workspace.`;
    }
    return JSON.stringify(data);
  },
});
```

- [ ] **Step 2: Register the tool in the profile capability**

In `packages/ai/src/capabilities/profile/index.ts`, update the import and tools array:

```typescript
import { getProfile, getTeam, getContractStatus, searchProfilesByName } from "./tools.js";

const tools = [getProfile, getTeam, getContractStatus, searchProfilesByName] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/ai && pnpm tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/capabilities/profile/tools.ts packages/ai/src/capabilities/profile/index.ts
git commit -m "feat(ai): add search_profiles_by_name capability tool

Enables Botsson to resolve employee names to profile UUIDs.
Searches by display_name (ILIKE), workspace-scoped, max 10 results.
Returns only non-PII fields: profile_id, display_name, role, status,
department name. Registered as read-only in the profile capability.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Add UUID validation to `open_entity_drawer` voice tool

**Files:**
- Modify: `apps/web/src/app/Botsson/_components/BotssonTools.ts:632-651`

- [ ] **Step 1: Add UUID regex constant**

At the top of `BotssonTools.ts`, after the `SILENT_INSTRUCTION` and `COLLAPSE_INSTRUCTION` constants (around line 73), add:

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

- [ ] **Step 2: Add UUID validation to the open_entity_drawer implementation**

In the `implementations` record, find the `open_entity_drawer` implementation (around line 632) and change:

```typescript
    open_entity_drawer: (params) => {
      const actions = actionsRef.current;
      if (!actions?.openEntityDrawer) return "Entity drawer not available";

      const entityType = String(params.entity_type ?? "").trim();
      const entityId = String(params.entity_id ?? "").trim();

      if (!VALID_ENTITY_TYPES.has(entityType)) {
        const valid = [...VALID_ENTITY_TYPES].join(", ");
        return `Unknown entity type "${entityType}". Valid: ${valid}`;
      }
      if (!entityId) return "entity_id is required";

      actions.openEntityDrawer(entityType, entityId);

      return (
        `Opened entity drawer for ${entityType} ${entityId}. ` +
        "The user can now see the entity details in the side panel. " +
        "Do NOT describe what is in the drawer — the user can see it."
      );
    },
```

to:

```typescript
    open_entity_drawer: (params) => {
      const actions = actionsRef.current;
      if (!actions?.openEntityDrawer) return "Entity drawer not available";

      const entityType = String(params.entity_type ?? "").trim();
      const entityId = String(params.entity_id ?? "").trim();

      if (!VALID_ENTITY_TYPES.has(entityType)) {
        const valid = [...VALID_ENTITY_TYPES].join(", ");
        return `Unknown entity type "${entityType}". Valid: ${valid}`;
      }
      if (!entityId) return "entity_id is required";

      if (!UUID_RE.test(entityId)) {
        return (
          `entity_id "${entityId}" is not a valid UUID. ` +
          "Use search_profiles_by_name to find the correct profile_id first, " +
          "then call open_entity_drawer with the UUID."
        );
      }

      actions.openEntityDrawer(entityType, entityId);

      return (
        `Opened entity drawer for ${entityType} ${entityId}. ` +
        "The user can now see the entity details in the side panel. " +
        "Do NOT describe what is in the drawer — the user can see it."
      );
    },
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/Botsson/_components/BotssonTools.ts
git commit -m "fix(botsson): validate UUID before opening entity drawer

Prevents skeleton bug where LLM sends a name string or fabricated
UUID to open_entity_drawer. Now returns an error message guiding
the LLM to use search_profiles_by_name first.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Add `emit()` to mutating client tools

**Files:**
- Modify: `apps/web/src/app/Botsson/_components/BotssonTools.ts`

- [ ] **Step 1: Add emit import**

At the top of `BotssonTools.ts`, add the import after the existing imports (around line 10-16):

```typescript
import { emit } from "@smartout/telemetry";
```

- [ ] **Step 2: Add emit to schedule_task implementation**

In the `schedule_task` implementation (around line 675), after the `actions.scheduleTask(...)` call and before the DB persistence comment, add the emit call. Find:

```typescript
      // DB persistence handled by scheduleTask in BotssonProvider

      const timeStr = dueAt
```

and change to:

```typescript
      // Telemetry
      void emit({
        event: "emma_task scheduled",
        workspace_id: actions.getWorkspaceId?.() ?? "",
        actor_id: "",
        properties: {
          data: { title, priority, has_deadline: !!dueAt },
        },
      });

      // DB persistence handled by scheduleTask in BotssonProvider

      const timeStr = dueAt
```

- [ ] **Step 3: Add emit to complete_task implementation**

In the `complete_task` implementation (around line 726), after `actions.completeTask(task.id)`, add:

```typescript
    complete_task: (params) => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";
      const title = String(params.title ?? "");
      const allTasks = actions.getTasks();
      const task = findTaskByTitle(allTasks, title);
      if (!task) return `Fant ingen ventende oppgave med "${title}".`;
      actions.completeTask(task.id);

      void emit({
        event: "emma_task completed",
        workspace_id: actions.getWorkspaceId?.() ?? "",
        actor_id: "",
        properties: {
          data: { task_id: task.id, title: task.title },
        },
      });

      return `Fullfort: "${task.title}". Bekreft kort til brukeren.`;
    },
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/Botsson/_components/BotssonTools.ts
git commit -m "fix(botsson): add emit() telemetry to task mutation tools

schedule_task and complete_task now emit telemetry events per the
'no mutation without emit' rule. Other client tools are view-morphing
(not mutations) and do not need emit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Write ADR-0089 — WalkAi Bridge Architecture

**Files:**
- Create: `docs/decisions/0089-walkai-bridge-architecture.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Write the ADR**

Create `docs/decisions/0089-walkai-bridge-architecture.md`:

```markdown
---
title: "ADR-0089: WalkAi Bridge Architecture — Client vs Server Tools"
status: accepted
created: 2026-04-14
updated: 2026-04-14
module: ai
tags: [adr, architecture, walkai, botsson, voice, tools]
---

# ADR-0089: WalkAi Bridge Architecture — Client vs Server Tools

## Context

Botsson/Emma operates through two independent tool execution models:

1. **Client-side tools** (Ultravox `temporaryTool` format in `BotssonTools.ts`) — run in browser, manipulate UI state, fire-and-forget to `/api/emma/*` for persistence.
2. **Server-side capabilities** (`packages/ai/src/capabilities/`) — run server-side via stage-engine with `supabaseAdmin`, authority gating, and `emit()` telemetry.

These systems evolved independently and have no shared abstraction. When a user asks Emma via voice to perform a server-side operation (e.g., create a contract), the voice LLM has no tool for it and falls back to incorrect behavior (creating a notepad note).

## Decision

The bridge between client-side and server-side tools operates through the **existing stage-engine chat pipeline** (`/api/botsson/chat` -> stage-engine `/agent/chat`). There is no direct bridge between the two tool systems.

### Rules

1. **Client-side tools:** NEVER access database directly, NEVER mutate business state. They morph views, navigate pages, open drawers, manage local state (notes, tasks).
2. **Server-side tools:** NEVER touch UI state, NEVER assume browser APIs exist. They access database, call external services, enforce authority.
3. **Contract mutations:** Chat-only, enforced by `allowedChannels: ["chat"]` on capabilities and filtered in `selectTools()`.
4. **New data access needs:** Add to existing server-side capabilities, not new API endpoints. Exception: lightweight client tools that call `/api/emma/*` endpoints for local-state persistence (tasks, notes, memory).
5. **PII in voice:** Absolutely forbidden per ADR-0077 and ADR-0078. No intake tools in voice channel.

### Future Extension

If voice needs server-side read-only data (e.g., contract status), the recommended approach is a "capability proxy" API route that authenticates, allow-lists specific tools, enforces channel restrictions, and returns the result. This is NOT implemented yet — defer until concrete demand exists.

## Consequences

- Voice Emma cannot create contracts directly. The admin uses chat mode for contract operations.
- Voice Emma CAN look up employees (via `search_profiles_by_name` in chat pipeline) and open entity drawers with correct UUIDs.
- Each new voice tool is a deliberate, reviewed addition — no auto-generation from server capabilities.
```

- [ ] **Step 2: Register in decision log**

Append to `docs/decisions/0000-decision-log.md`:

```markdown
| 0089 | WalkAi Bridge Architecture — Client vs Server Tools | accepted | 2026-04-14 | ai |
```

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/0089-walkai-bridge-architecture.md docs/decisions/0000-decision-log.md
git commit -m "docs(decisions): ADR-0089 WalkAi bridge architecture

Documents the separation between client-side Botsson tools (UI morphing)
and server-side capability tools (DB access, mutations). Chat pipeline
is the bridge. No direct client-to-server tool proxy.

Council approved 2026-04-14.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Log council session + learning

**Files:**
- Modify: `docs/council/COUNCIL-LOG.md`

- [ ] **Step 1: Append council session entry**

Append to `docs/council/COUNCIL-LOG.md`:

```markdown
## 2026-04-14 — Emma Voice-Mode: Contract Tools + Entity Drawer Fix
**Type:** feature + bug
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer
**Key decisions:**
- Contract mutation tools restricted to chat-only via `allowedChannels` (ADR-0078 enforcement)
- `search_profiles_by_name` added to profile capability for name-to-UUID resolution
- Entity drawer `open_entity_drawer` tool gets UUID validation
- No direct client-to-server tool bridge — use existing chat pipeline
- `emit()` added to mutating client tools (task schedule/complete)
**ADR created:** 0089 — WalkAi Bridge Architecture
**Learning:** `allowedChannels` was declared on `CapabilityDefinition` type and set on 2 capabilities (`contract_intake`, `shift_swap`) but never enforced in `selectTools()`. Defence-in-depth requires verification at every layer, not just declaration.
```

- [ ] **Step 2: Commit**

```bash
git add docs/council/COUNCIL-LOG.md
git commit -m "docs(council): log 2026-04-14 Emma voice-mode council session

Council approved contract tools + entity drawer fix with conditions.
ADR-0089 created. allowedChannels enforcement gap discovered and fixed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Final Typecheck

After all tasks are complete:

```bash
pnpm turbo typecheck
```

Expected: 0 errors across all packages.
