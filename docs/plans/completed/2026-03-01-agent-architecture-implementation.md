---
title: "Agent Architecture Implementation Plan"
status: done
updated: 2026-03-03
created: 2026-03-01
module: ai
tags: [agent, implementation, mr-botsson, stage-engine, plan]
---

# Agent Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the Stage Engine with an Agent Mode that enables Mr. Botsson — a unified, channel-agnostic AI colleague with composable capability layers, persistent memory, and per-workspace authority control.

**Architecture:** The Stage Engine (Hono service on DigitalOcean) gets a new "agent" mode alongside its existing "mission" mode. Agent mode uses an intent-classifying router to dispatch free-form conversations to capability-specific tools via Vercel AI SDK. Shared infrastructure (auth, sessions, context, webhooks) is reused. New tables for memory and authority config.

**Tech Stack:** Hono (existing), Vercel AI SDK + OpenRouter (existing in packages/ai), Supabase (PostgreSQL + pgvector), Zod, SSE streaming, Ultravox adapter extension.

**Design Doc:** `docs/plans/2026-03-01-agent-architecture-design.md`

---

## Phase 0: Development Skill

### Task 0: Create the `smartout-agent-dev` skill

**Files:**

- Create: `~/.claude/skills/smartout-agent-dev/SKILL.md`

**Already completed.** The skill lives at `~/.claude/skills/smartout-agent-dev/SKILL.md` and contains:

- Capability registry (all 8 capabilities with tools and status)
- Adapter registry (all channels with protocols and endpoints)
- Endpoint registry (all Stage Engine + Shift MCP endpoints)
- Database table reference
- Step-by-step guides: how to add a capability, tool, or adapter
- Authority levels reference
- Agent router flow
- Key types and file paths
- Common mistakes

**Rule:** Every task in this plan that adds or modifies capabilities, tools, adapters, or endpoints MUST update the skill's registry tables before committing.

---

## Phase 1: Database Foundation

### Task 1: Add `engine_memory` table migration

**Files:**

- Create: `supabase/migrations/20260302000000_engine_memory.sql`

**Step 1: Write the migration**

```sql
-- 20260302000000_engine_memory.sql
-- Persistent memory for Mr. Botsson — stores employee preferences,
-- facts, and conversation summaries across sessions.
-- Connected to: docs/plans/2026-03-01-agent-architecture-design.md §7

-- Ensure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE engine_memory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES profile(profile_id),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id),
  memory_type       TEXT NOT NULL CHECK (memory_type IN ('preference', 'fact', 'summary')),
  content           TEXT NOT NULL,
  embedding         vector(1536),
  source_session_id UUID REFERENCES engine_sessions(id) ON DELETE SET NULL,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_memory ENABLE ROW LEVEL SECURITY;

-- JWT policy: workspace members can read memories for their workspace
CREATE POLICY "jwt_read_memory" ON engine_memory
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- API key policy: API keys can read memories for their workspace
CREATE POLICY "api_key_read_memory" ON engine_memory
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

-- Service role manages all memory operations (insert/update/delete)
CREATE POLICY "manage_memory" ON engine_memory
FOR ALL USING (
  auth.role() = 'service_role'
);

-- Semantic search index (HNSW for fast approximate search)
CREATE INDEX idx_engine_memory_embedding ON engine_memory
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Lookup by profile within workspace
CREATE INDEX idx_engine_memory_profile ON engine_memory (workspace_id, profile_id, created_at DESC);

-- Expired memory cleanup
CREATE INDEX idx_engine_memory_expiry ON engine_memory (expires_at)
  WHERE expires_at IS NOT NULL;
```

**Step 2: Apply the migration**

Run: `npx supabase migration up` (or `npx supabase db push` for local)
Expected: Table created with RLS policies and indexes.

**Step 3: Commit**

```bash
git add supabase/migrations/20260302000000_engine_memory.sql
git commit -m "feat(db): add engine_memory table for persistent agent memory"
```

---

### Task 2: Add `engine_authority_config` table migration

**Files:**

- Create: `supabase/migrations/20260302000100_engine_authority_config.sql`

**Step 1: Write the migration**

```sql
-- 20260302000100_engine_authority_config.sql
-- Per-workspace, per-capability authority configuration for Mr. Botsson.
-- Controls what the AI agent can do: autonomous, confirm, suggest, read_only, disabled.
-- Connected to: docs/plans/2026-03-01-agent-architecture-design.md §8

CREATE TABLE engine_authority_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id),
  capability    TEXT NOT NULL,
  level         TEXT NOT NULL DEFAULT 'read_only'
                  CHECK (level IN ('autonomous', 'confirm', 'suggest', 'read_only', 'disabled')),
  updated_by    UUID NOT NULL REFERENCES user_identity(user_identity_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_capability UNIQUE (workspace_id, capability)
);

ALTER TABLE engine_authority_config ENABLE ROW LEVEL SECURITY;

-- JWT: workspace admins can read/manage authority config
CREATE POLICY "admin_manage_authority" ON engine_authority_config
FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
  )
);

-- API key: read authority config for workspace
CREATE POLICY "api_key_read_authority" ON engine_authority_config
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

-- Service role: full access
CREATE POLICY "service_manage_authority" ON engine_authority_config
FOR ALL USING (
  auth.role() = 'service_role'
);

CREATE INDEX idx_authority_workspace ON engine_authority_config (workspace_id);
```

**Step 2: Apply the migration**

Run: `npx supabase migration up`
Expected: Table created with RLS policies.

**Step 3: Commit**

```bash
git add supabase/migrations/20260302000100_engine_authority_config.sql
git commit -m "feat(db): add engine_authority_config for per-workspace agent permissions"
```

---

### Task 3: Add `mode` column to `engine_sessions`

**Files:**

- Create: `supabase/migrations/20260302000200_engine_sessions_mode.sql`

**Step 1: Write the migration**

```sql
-- 20260302000200_engine_sessions_mode.sql
-- Adds mode column to engine_sessions to distinguish mission vs agent sessions.
-- Existing sessions default to 'mission'. New agent conversations use 'agent'.

ALTER TABLE engine_sessions
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'mission'
    CHECK (mode IN ('mission', 'agent'));

-- Agent sessions don't need mission_id (they use the router instead)
-- Make mission_id nullable for agent mode
ALTER TABLE engine_sessions
  ALTER COLUMN mission_id DROP NOT NULL;

-- Add constraint: mission mode requires mission_id
ALTER TABLE engine_sessions
  ADD CONSTRAINT chk_mission_mode_requires_mission
    CHECK (mode = 'agent' OR mission_id IS NOT NULL);

-- Index for querying agent sessions by profile
CREATE INDEX idx_engine_sessions_agent_profile
  ON engine_sessions (workspace_id, profile_id, created_at DESC)
  WHERE mode = 'agent';
```

**Step 2: Apply and verify**

Run: `npx supabase migration up`
Verify: `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'engine_sessions' AND column_name IN ('mode', 'mission_id');`
Expected: mode NOT NULL default 'mission', mission_id now nullable.

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Commit**

```bash
git add supabase/migrations/20260302000200_engine_sessions_mode.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add mode column to engine_sessions, support agent mode"
```

---

## Phase 2: Capability Layer Framework

### Task 4: Create capability type definitions

**Files:**

- Create: `packages/ai/src/capabilities/types.ts`

**Step 1: Write the types**

```typescript
// packages/ai/src/capabilities/types.ts
// Type definitions for the capability layer system.
// Each capability provides domain-specific tools that the Agent Router can load.
// Connected to: docs/plans/2026-03-01-agent-architecture-design.md §4

import type { SmartoutTool } from "../types.js";

/** All available capability names */
export type CapabilityName =
  | "knowledge"
  | "schedule"
  | "training"
  | "operations"
  | "profile"
  | "communication"
  | "memory"
  | "payroll";

/** Authority levels from most permissive to most restrictive */
export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";

/** Context passed to all capability tools */
export type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: unknown; // SupabaseClient — typed loosely to avoid import coupling
};

/**
 * A capability definition — a named group of tools for a specific domain.
 * The router loads capabilities based on intent classification and authority level.
 */
export type CapabilityDefinition = {
  name: CapabilityName;
  description: string;
  /** All tools (used at 'autonomous' and 'confirm' authority levels) */
  tools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  /** Read-only subset (used at 'read_only' authority level) */
  readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  /** Suggest tools — can request actions but not execute them (used at 'suggest' level) */
  suggestTools?: ReadonlyArray<SmartoutTool<AgentToolContext>>;
};
```

**Step 2: Export from package**

Add to `packages/ai/package.json` exports:

```json
"./capabilities/types": {
  "types": "./dist/capabilities/types.d.ts",
  "default": "./dist/capabilities/types.js"
}
```

**Step 3: Verify types compile**

Run: `cd packages/ai && pnpm typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add packages/ai/src/capabilities/types.ts packages/ai/package.json
git commit -m "feat(ai): add capability layer type definitions"
```

---

### Task 5: Implement the Profile capability (first capability — proves the pattern)

**Files:**

- Create: `packages/ai/src/capabilities/profile/index.ts`
- Create: `packages/ai/src/capabilities/profile/tools.ts`

**Step 1: Write the profile tools**

```typescript
// packages/ai/src/capabilities/profile/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const getProfile = defineTool({
  name: "get_profile",
  description:
    "Get the current employee's profile information including name, role, department, team, and status.",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const { data, error } = await supabase
      .from("profile")
      .select(
        "profile_id, first_name, last_name, role, status, department:department_id(name), team:team_id(name)",
      )
      .eq("profile_id", ctx.profileId)
      .single();

    if (error || !data) return "Could not load profile.";
    return JSON.stringify(data);
  },
});

export const getTeam = defineTool({
  name: "get_team",
  description: "Get information about the employee's team including team members and team leader.",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Get profile's team_id first
    const { data: profile } = await supabase
      .from("profile")
      .select("team_id")
      .eq("profile_id", ctx.profileId)
      .single();

    if (!profile?.team_id) return "Employee is not assigned to a team.";

    const { data: team, error } = await supabase
      .from("team")
      .select("name, leader_profile_id")
      .eq("team_id", profile.team_id)
      .single();

    if (error || !team) return "Could not load team information.";

    // Get team members
    const { data: members } = await supabase
      .from("profile")
      .select("profile_id, first_name, last_name, role")
      .eq("team_id", profile.team_id)
      .eq("is_active", true);

    return JSON.stringify({ team, members: members ?? [] });
  },
});

export const getContractStatus = defineTool({
  name: "get_contract_status",
  description: "Get the current status of the employee's employment contract.",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const { data, error } = await supabase
      .from("employment_contract")
      .select("contract_id, status, signed_at, starts_at, ends_at")
      .eq("profile_id", ctx.profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return "No contract found for this employee.";
    return JSON.stringify(data);
  },
});
```

**Step 2: Write the capability definition**

```typescript
// packages/ai/src/capabilities/profile/index.ts
import type { CapabilityDefinition } from "../types.js";
import { getProfile, getTeam, getContractStatus } from "./tools.js";

export const profileCapability: CapabilityDefinition = {
  name: "profile",
  description: "Employee profile data, team membership, and contract status",
  tools: [getProfile, getTeam, getContractStatus],
  readOnlyTools: [getProfile, getTeam, getContractStatus], // all read-only by nature
};
```

**Step 3: Verify it compiles**

Run: `cd packages/ai && pnpm typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add packages/ai/src/capabilities/profile/
git commit -m "feat(ai): add profile capability layer with 3 tools"
```

---

### Task 6: Create the capability registry

**Files:**

- Create: `packages/ai/src/capabilities/registry.ts`

**Step 1: Write the registry**

```typescript
// packages/ai/src/capabilities/registry.ts
// Central registry of all capability layers.
// The Agent Router uses this to look up capabilities by name.

import type { CapabilityDefinition, CapabilityName } from "./types.js";
import { profileCapability } from "./profile/index.js";

/** All registered capabilities. Add new ones here as they're built. */
const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  // TODO: Add as implemented:
  // knowledge: knowledgeCapability,
  // schedule: scheduleCapability,
  // training: trainingCapability,
  // operations: operationsCapability,
  // communication: communicationCapability,
  // memory: memoryCapability,
  // payroll: payrollCapability,
};

/** Get a single capability by name. Returns undefined if not registered. */
export function getCapability(name: CapabilityName): CapabilityDefinition | undefined {
  return capabilities[name];
}

/** Get all registered capabilities. */
export function getAllCapabilities(): CapabilityDefinition[] {
  return Object.values(capabilities);
}

/** Get capability names that are currently registered. */
export function getRegisteredCapabilities(): CapabilityName[] {
  return Object.keys(capabilities) as CapabilityName[];
}
```

**Step 2: Add package exports**

Add to `packages/ai/package.json` exports:

```json
"./capabilities": {
  "types": "./dist/capabilities/registry.d.ts",
  "default": "./dist/capabilities/registry.js"
},
"./capabilities/types": {
  "types": "./dist/capabilities/types.d.ts",
  "default": "./dist/capabilities/types.js"
}
```

**Step 3: Verify and commit**

Run: `cd packages/ai && pnpm typecheck`

```bash
git add packages/ai/src/capabilities/registry.ts packages/ai/package.json
git commit -m "feat(ai): add capability registry for agent routing"
```

---

## Phase 3: Agent Router

### Task 7: Intent classifier

**Files:**

- Create: `packages/ai/src/router/intent-classifier.ts`

**Step 1: Write the intent classifier**

```typescript
// packages/ai/src/router/intent-classifier.ts
// Classifies user intent using a cheap LLM call (generateObject).
// Returns the matched capability and confidence score.
// Connected to: docs/plans/2026-03-01-agent-architecture-design.md §5

import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { getRegisteredCapabilities } from "../capabilities/registry.js";
import type { CapabilityName } from "../capabilities/types.js";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

/** Schema for the intent classification result */
export const intentSchema = z.object({
  intent: z.string().describe("Specific intent, e.g. 'schedule:query', 'training:status'"),
  capability: z.enum([
    "knowledge",
    "schedule",
    "training",
    "operations",
    "profile",
    "communication",
    "memory",
    "payroll",
    "general",
  ] as const),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().describe("Brief explanation of why this classification was chosen"),
});

export type IntentResult = z.infer<typeof intentSchema>;

/**
 * Classifies a user message into an intent + capability using a fast LLM call.
 * Uses generateObject() for structured output — no tool calling needed.
 *
 * @param message - The user's message text
 * @param context - Brief context about the employee (role, department, etc.)
 * @returns Intent classification result
 */
export async function classifyIntent(message: string, context: string): Promise<IntentResult> {
  const registered = getRegisteredCapabilities();

  const { object } = await generateObject({
    model: openrouter("anthropic/claude-haiku-3"),
    schema: intentSchema,
    system: `You are an intent classifier for a Norwegian employee assistant called Mr. Botsson.
Classify the user's message into one of these capabilities: ${registered.join(", ")}, general.

Capabilities:
- knowledge: Questions about company policies, procedures, rules, FAQs
- schedule: Shift queries, schedule changes, availability, swap requests
- training: Protocol assignments, readiness status, knowledge tests, learning
- operations: Department sessions, checklists, routines, daily ops
- profile: Employee info, team membership, contract status
- communication: Sending messages, notifications
- memory: Asking about past conversations or preferences
- payroll: Salary, overtime, deductions, pay period
- general: Greetings, small talk, unclear intent, meta-questions

The user writes in Norwegian or English. Classify based on intent, not language.
Set confidence 0.0-1.0: high (>0.7) when intent is clear, low (<0.7) when ambiguous.`,
    prompt: `Employee context: ${context}\n\nMessage: "${message}"`,
  });

  return object;
}
```

**Step 2: Verify it compiles**

Run: `cd packages/ai && pnpm typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add packages/ai/src/router/intent-classifier.ts
git commit -m "feat(ai): add intent classifier for agent routing"
```

---

### Task 8: Tool selector with authority enforcement

**Files:**

- Create: `packages/ai/src/router/tool-selector.ts`

**Step 1: Write the tool selector**

```typescript
// packages/ai/src/router/tool-selector.ts
// Selects tools based on intent classification and workspace authority level.
// Implements the confidence escape hatch: >= 0.7 = focused, < 0.7 = all tools.
// Connected to: docs/plans/2026-03-01-agent-architecture-design.md §5.3, §8

import type { SmartoutTool } from "../types.js";
import type {
  AgentToolContext,
  AuthorityLevel,
  CapabilityDefinition,
  CapabilityName,
} from "../capabilities/types.js";
import { getCapability, getAllCapabilities } from "../capabilities/registry.js";
import type { IntentResult } from "./intent-classifier.js";

/** Authority config loaded from engine_authority_config */
export type AuthorityConfig = Record<string, AuthorityLevel>;

/**
 * Filters a capability's tools based on authority level.
 * Returns empty array for 'disabled'.
 */
function getToolsForAuthority(
  capability: CapabilityDefinition,
  level: AuthorityLevel,
): ReadonlyArray<SmartoutTool<AgentToolContext>> {
  switch (level) {
    case "disabled":
      return [];
    case "read_only":
      return capability.readOnlyTools;
    case "suggest":
      return [...capability.readOnlyTools, ...(capability.suggestTools ?? [])];
    case "confirm":
    case "autonomous":
      return capability.tools;
  }
}

/**
 * Selects tools based on intent classification and authority config.
 *
 * Confidence escape hatch:
 *   >= 0.7 → load only the matched capability's tools
 *   <  0.7 → load ALL capabilities' tools (let the model decide)
 *
 * Authority filtering always applies regardless of confidence.
 *
 * @returns Array of tools to give to the agent, possibly empty if all disabled
 */
export function selectTools(
  intent: IntentResult,
  authorityConfig: AuthorityConfig,
): ReadonlyArray<SmartoutTool<AgentToolContext>> {
  const defaultLevel: AuthorityLevel = "read_only";

  if (intent.confidence >= 0.7 && intent.capability !== "general") {
    // Focused routing — single capability
    const capability = getCapability(intent.capability as CapabilityName);
    if (!capability) return [];

    const level = authorityConfig[capability.name] ?? defaultLevel;
    return getToolsForAuthority(capability, level);
  }

  // Escape hatch — load all capabilities
  const allTools: SmartoutTool<AgentToolContext>[] = [];
  for (const capability of getAllCapabilities()) {
    const level = authorityConfig[capability.name] ?? defaultLevel;
    const tools = getToolsForAuthority(capability, level);
    allTools.push(...tools);
  }
  return allTools;
}
```

**Step 2: Verify and commit**

Run: `cd packages/ai && pnpm typecheck`

```bash
git add packages/ai/src/router/tool-selector.ts
git commit -m "feat(ai): add authority-aware tool selector with confidence escape hatch"
```

---

### Task 9: Mr. Botsson system prompt builder

**Files:**

- Create: `packages/ai/src/prompts/mr-botsson.ts`

**Step 1: Write the prompt builder**

```typescript
// packages/ai/src/prompts/mr-botsson.ts
// Builds the system prompt for Mr. Botsson conversations.
// Includes employee context, recent memories, and available tool descriptions.

export type BotssonPromptInput = {
  workspaceName: string;
  employeeName: string;
  employeeRole: string;
  departmentName: string;
  teamName: string;
  teamLeader: string;
  status: string;
  readinessScore: number | null;
  recentMemories: string[];
  toolDescriptions: string[];
  language: "no" | "en";
};

/**
 * Builds the Mr. Botsson system prompt.
 * The prompt is in Norwegian by default — Mr. Botsson speaks the employee's language.
 */
export function buildBotssonPrompt(input: BotssonPromptInput): string {
  const memorySection =
    input.recentMemories.length > 0
      ? input.recentMemories.map((m) => `- ${m}`).join("\n")
      : "Ingen tidligere samtaler registrert.";

  const toolSection =
    input.toolDescriptions.length > 0
      ? input.toolDescriptions.map((t) => `- ${t}`).join("\n")
      : "Ingen verktoy tilgjengelig. Du kan bare svare pa generelle sporsmal.";

  const lang = input.language === "en" ? "English" : "Norwegian";

  return `# Mr. Botsson — AI-kollega hos ${input.workspaceName}

Du er Mr. Botsson, en hjelpsom AI-kollega. Du snakker ${lang === "Norwegian" ? "norsk" : "engelsk"} med ${input.employeeName}.

## Din personlighet
- Vennlig, direkte, profesjonell
- Tilpass tonen til konteksten (casual for daglige sporsmal, formell for HR-saker)
- Aldri lat som du vet noe du ikke vet
- Hold svarene korte og konsise med mindre brukeren ber om detaljer

## Om ${input.employeeName}
- Rolle: ${input.employeeRole} i ${input.departmentName}
- Team: ${input.teamName} (teamleder: ${input.teamLeader})
- Status: ${input.status}${input.readinessScore !== null ? `\n- Readiness: ${input.readinessScore}%` : ""}

## Nylige samtaler
${memorySection}

## Tilgjengelige handlinger
${toolSection}

## Regler
- Svar alltid pa ${lang === "Norwegian" ? "norsk" : "engelsk"} med mindre brukeren skifter sprak
- Bruk verktoyene dine for a sla opp informasjon — aldri gjett
- Hvis du er usikker, si det og foresla hvem de kan kontakte
- Aldri del sensitiv informasjon om andre ansatte
- Hvis et verktoy feiler, si fra og foresla en alternativ losning`;
}
```

**Step 2: Verify and commit**

Run: `cd packages/ai && pnpm typecheck`

```bash
git add packages/ai/src/prompts/mr-botsson.ts
git commit -m "feat(ai): add Mr. Botsson system prompt builder"
```

---

### Task 10: Add package exports for router and prompts

**Files:**

- Modify: `packages/ai/package.json`

**Step 1: Add exports**

Add these to the `exports` object in `packages/ai/package.json`:

```json
"./router/intent-classifier": {
  "types": "./dist/router/intent-classifier.d.ts",
  "default": "./dist/router/intent-classifier.js"
},
"./router/tool-selector": {
  "types": "./dist/router/tool-selector.d.ts",
  "default": "./dist/router/tool-selector.js"
},
"./prompts/mr-botsson": {
  "types": "./dist/prompts/mr-botsson.d.ts",
  "default": "./dist/prompts/mr-botsson.js"
}
```

**Step 2: Verify full package builds**

Run: `cd packages/ai && pnpm build`
Expected: No errors, all files emitted to dist/.

**Step 3: Commit**

```bash
git add packages/ai/package.json
git commit -m "feat(ai): export router and prompt modules from @smartout/ai"
```

---

## Phase 4: Stage Engine — Agent Mode Routes

### Task 11: Add agent mode types to Stage Engine

**Files:**

- Modify: `services/stage-engine/src/types/session.ts`
- Create: `services/stage-engine/src/types/agent.ts`

**Step 1: Update session types to include mode**

Add to `services/stage-engine/src/types/session.ts`:

```typescript
/** Session mode: mission (structured stages) or agent (free-form conversation) */
export type SessionMode = "mission" | "agent";
```

Update the `Session` type to include the new `mode` field:

```typescript
export type Session = {
  id: string;
  mode: SessionMode; // NEW
  mission_id: string | null; // was: string (now nullable for agent mode)
  // ... rest stays the same
};
```

**Step 2: Create agent-specific types**

```typescript
// services/stage-engine/src/types/agent.ts
// Types specific to Agent Mode (Mr. Botsson conversations).

export type AgentChatRequest = {
  message: string;
  session_id?: string; // omit to create new session
  profile_id: string;
  channel?: "chat" | "voice"; // defaults to "chat"
};

export type AgentChatResponse = {
  session_id: string;
  response: string;
  intent?: {
    capability: string;
    confidence: number;
  };
};

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/types/session.ts services/stage-engine/src/types/agent.ts
git commit -m "feat(engine): add agent mode types and update session type"
```

---

### Task 12: Authority config loader

**Files:**

- Create: `services/stage-engine/src/core/authority.ts`

**Step 1: Write the authority loader**

```typescript
// services/stage-engine/src/core/authority.ts
// Loads and caches workspace authority configuration from engine_authority_config.
// Used by the agent router to determine which tools are available.

import { supabaseAdmin } from "../lib/supabase.js";

export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";

export type AuthorityConfig = Record<string, AuthorityLevel>;

/**
 * Loads the authority configuration for a workspace.
 * Returns a map of capability name → authority level.
 * Missing capabilities default to 'read_only'.
 */
export async function loadAuthorityConfig(workspaceId: string): Promise<AuthorityConfig> {
  const { data, error } = await supabaseAdmin
    .from("engine_authority_config")
    .select("capability, level")
    .eq("workspace_id", workspaceId);

  if (error || !data) return {};

  const config: AuthorityConfig = {};
  for (const row of data) {
    config[row.capability] = row.level as AuthorityLevel;
  }
  return config;
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/authority.ts
git commit -m "feat(engine): add authority config loader"
```

---

### Task 13: Memory manager

**Files:**

- Create: `services/stage-engine/src/core/memory-manager.ts`

**Step 1: Write the memory manager**

```typescript
// services/stage-engine/src/core/memory-manager.ts
// Manages persistent memories for Mr. Botsson conversations.
// Loads recent memories at session start, saves extracted memories at session end.

import { supabaseAdmin } from "../lib/supabase.js";

export type Memory = {
  id: string;
  memory_type: "preference" | "fact" | "summary";
  content: string;
  created_at: string;
};

/**
 * Loads the most recent memories for a profile, ordered by recency.
 * Returns up to `limit` memories (default 5).
 */
export async function loadRecentMemories(
  workspaceId: string,
  profileId: string,
  limit = 5,
): Promise<Memory[]> {
  const { data, error } = await supabaseAdmin
    .from("engine_memory")
    .select("id, memory_type, content, created_at")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", profileId)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Memory[];
}

/**
 * Saves a memory for a profile. Used after memory extraction at session end.
 */
export async function saveMemory(params: {
  workspaceId: string;
  profileId: string;
  memoryType: "preference" | "fact" | "summary";
  content: string;
  sourceSessionId?: string;
  expiresAt?: string;
}): Promise<void> {
  await supabaseAdmin.from("engine_memory").insert({
    workspace_id: params.workspaceId,
    profile_id: params.profileId,
    memory_type: params.memoryType,
    content: params.content,
    source_session_id: params.sourceSessionId ?? null,
    expires_at: params.expiresAt ?? null,
  });
}

/**
 * Cleans up expired memories. Run periodically.
 */
export async function cleanExpiredMemories(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("engine_memory")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .not("expires_at", "is", null)
    .select("id");

  if (error) return 0;
  return data?.length ?? 0;
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/memory-manager.ts
git commit -m "feat(engine): add memory manager for persistent agent memory"
```

---

### Task 14: Agent router core

**Files:**

- Create: `services/stage-engine/src/core/agent-router.ts`

**Step 1: Write the agent router**

This is the core file — it ties together intent classification, tool selection, authority, memory, and the Vercel AI SDK agent loop.

```typescript
// services/stage-engine/src/core/agent-router.ts
// Core agent router for Mr. Botsson conversations.
// Handles: context loading → intent classification → tool selection → agent loop → response.
// Connected to: docs/plans/2026-03-01-agent-architecture-design.md §5

import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { stepCountIs } from "ai";
import { classifyIntent } from "@smartout/ai/router/intent-classifier";
import { selectTools, type AuthorityConfig } from "@smartout/ai/router/tool-selector";
import { buildBotssonPrompt, type BotssonPromptInput } from "@smartout/ai/prompts/mr-botsson";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import type { SmartoutTool } from "@smartout/ai";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import { supabaseAdmin } from "../lib/supabase.js";
import { loadAuthorityConfig } from "./authority.js";
import { loadRecentMemories } from "./memory-manager.js";
import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";
import type { AuthContext } from "../types/auth.js";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

type AgentRouterInput = {
  message: string;
  sessionId: string;
  workspaceId: string;
  profileId: string;
  userId?: string;
  conversationHistory: ConversationTurn[];
  auth: AuthContext;
};

/**
 * Runs the agent router for a single message turn.
 *
 * Flow:
 * 1. Load employee context + memories
 * 2. Classify intent (cheap LLM call)
 * 3. Select tools (authority-filtered, confidence escape hatch)
 * 4. Run agent loop (Vercel AI SDK generateText with tools)
 * 5. Return response
 */
export async function routeAgentMessage(input: AgentRouterInput): Promise<AgentChatResponse> {
  // 1. Load context
  const [profileData, memories, authorityConfig] = await Promise.all([
    loadProfileContext(input.profileId),
    loadRecentMemories(input.workspaceId, input.profileId),
    loadAuthorityConfig(input.workspaceId),
  ]);

  const contextSummary = buildContextSummary(profileData);

  // 2. Classify intent
  const intent = await classifyIntent(input.message, contextSummary);

  // 3. Select tools based on intent + authority
  const selectedTools = selectTools(intent, authorityConfig);

  // 4. Build system prompt
  const promptInput: BotssonPromptInput = {
    workspaceName: profileData.workspaceName ?? "Smartout",
    employeeName: profileData.firstName ?? "ansatt",
    employeeRole: profileData.role ?? "ansatt",
    departmentName: profileData.departmentName ?? "ukjent avdeling",
    teamName: profileData.teamName ?? "ukjent team",
    teamLeader: profileData.teamLeader ?? "ukjent",
    status: profileData.status ?? "aktiv",
    readinessScore: null, // TODO: load from training capability when implemented
    recentMemories: memories.map((m) => m.content),
    toolDescriptions: selectedTools.map((t) => `${t.name}: ${t.description}`),
    language: "no",
  };
  const systemPrompt = buildBotssonPrompt(promptInput);

  // 5. Build conversation messages
  const messages = input.conversationHistory.map((turn) => ({
    role: turn.role as "user" | "assistant",
    content: turn.content,
  }));
  messages.push({ role: "user", content: input.message });

  // 6. Run agent loop
  const toolContext: AgentToolContext = {
    workspaceId: input.workspaceId,
    profileId: input.profileId,
    userId: input.userId,
    sessionId: input.sessionId,
    supabaseAdmin,
  };

  const vercelTools =
    selectedTools.length > 0
      ? toVercelTools(
          selectedTools as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>,
          toolContext,
        )
      : {};

  const result = await generateText({
    model: openrouter("anthropic/claude-sonnet-4"),
    system: systemPrompt,
    messages,
    tools: vercelTools,
    maxSteps: 5,
  });

  return {
    session_id: input.sessionId,
    response: result.text,
    intent: {
      capability: intent.capability,
      confidence: intent.confidence,
    },
  };
}

// --- Private helpers ---

type ProfileContext = {
  firstName: string | null;
  role: string | null;
  status: string | null;
  departmentName: string | null;
  teamName: string | null;
  teamLeader: string | null;
  workspaceName: string | null;
};

async function loadProfileContext(profileId: string): Promise<ProfileContext> {
  const { data } = await supabaseAdmin
    .from("profile")
    .select(
      "first_name, role, status, department:department_id(name), team:team_id(name, leader_profile_id), workspace:workspace_id(name)",
    )
    .eq("profile_id", profileId)
    .single();

  if (!data) {
    return {
      firstName: null,
      role: null,
      status: null,
      departmentName: null,
      teamName: null,
      teamLeader: null,
      workspaceName: null,
    };
  }

  // Load team leader name if available
  let teamLeader: string | null = null;
  const team = data.team as { name: string; leader_profile_id: string | null } | null;
  if (team?.leader_profile_id) {
    const { data: leader } = await supabaseAdmin
      .from("profile")
      .select("first_name, last_name")
      .eq("profile_id", team.leader_profile_id)
      .single();
    if (leader) teamLeader = `${leader.first_name} ${leader.last_name}`;
  }

  return {
    firstName: data.first_name,
    role: data.role,
    status: data.status,
    departmentName: (data.department as { name: string } | null)?.name ?? null,
    teamName: team?.name ?? null,
    teamLeader,
    workspaceName: (data.workspace as { name: string } | null)?.name ?? null,
  };
}

function buildContextSummary(profile: ProfileContext): string {
  const parts = [
    profile.firstName && `Name: ${profile.firstName}`,
    profile.role && `Role: ${profile.role}`,
    profile.departmentName && `Department: ${profile.departmentName}`,
    profile.teamName && `Team: ${profile.teamName}`,
    profile.status && `Status: ${profile.status}`,
  ].filter(Boolean);
  return parts.join(", ");
}
```

**Step 2: Add @smartout/ai as dependency to stage-engine**

Add to `services/stage-engine/package.json` dependencies:

```json
"@smartout/ai": "workspace:*",
"@openrouter/ai-sdk-provider": "^2.2.3",
"ai": "^6.0.103"
```

**Step 3: Verify it compiles**

Run: `cd services/stage-engine && pnpm install && pnpm typecheck`

**Step 4: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts services/stage-engine/package.json
git commit -m "feat(engine): add core agent router with intent classification and tool execution"
```

---

### Task 15: Agent session manager

**Files:**

- Create: `services/stage-engine/src/core/agent-session.ts`

**Step 1: Write the agent session manager**

```typescript
// services/stage-engine/src/core/agent-session.ts
// Manages agent-mode sessions (creation, loading, conversation turn storage).
// Separate from mission sessions — no stages, no mission_id.

import { supabaseAdmin } from "../lib/supabase.js";
import type { Session, SessionChannel } from "../types/session.js";
import type { ConversationTurn } from "../types/agent.js";
import type { AuthContext } from "../types/auth.js";

/**
 * Creates a new agent-mode session for Mr. Botsson.
 */
export async function createAgentSession(params: {
  workspaceId: string;
  profileId: string;
  userId?: string;
  channel: SessionChannel;
}): Promise<string> {
  // Load basic identity context
  const context: Record<string, unknown> = {};

  const { data: profile } = await supabaseAdmin
    .from("profile")
    .select("first_name, last_name, role, status")
    .eq("profile_id", params.profileId)
    .single();

  if (profile) context.profile = profile;

  const { data: session, error } = await supabaseAdmin
    .from("engine_sessions")
    .insert({
      mode: "agent",
      mission_id: null,
      workspace_id: params.workspaceId,
      user_id: params.userId ?? null,
      profile_id: params.profileId,
      channel: params.channel,
      current_stage_id: null,
      stage_index: -1,
      status: "active",
      context,
      collected_data: { conversation: [] },
    })
    .select("id")
    .single();

  if (error || !session) {
    throw new Error(`Failed to create agent session: ${error?.message}`);
  }

  return session.id;
}

/**
 * Loads an agent session and verifies workspace access.
 */
export async function loadAgentSession(
  sessionId: string,
  auth: AuthContext,
): Promise<{ session: Session; conversation: ConversationTurn[] } | null> {
  const { data: session, error } = await supabaseAdmin
    .from("engine_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("mode", "agent")
    .eq("status", "active")
    .single();

  if (error || !session) return null;

  // Workspace authorization
  if (auth.workspaceId && auth.workspaceId !== session.workspace_id) return null;

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await supabaseAdmin.from("engine_sessions").update({ status: "expired" }).eq("id", sessionId);
    return null;
  }

  const conversation = ((session.collected_data as Record<string, unknown>)?.conversation ??
    []) as ConversationTurn[];

  return { session: session as Session, conversation };
}

/**
 * Appends a conversation turn to an agent session.
 */
export async function appendConversationTurn(
  sessionId: string,
  turn: ConversationTurn,
): Promise<void> {
  // Load current conversation
  const { data: session } = await supabaseAdmin
    .from("engine_sessions")
    .select("collected_data")
    .eq("id", sessionId)
    .single();

  if (!session) return;

  const collectedData = session.collected_data as Record<string, unknown>;
  const conversation = (collectedData?.conversation ?? []) as ConversationTurn[];
  conversation.push(turn);

  await supabaseAdmin
    .from("engine_sessions")
    .update({
      collected_data: { ...collectedData, conversation },
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/agent-session.ts
git commit -m "feat(engine): add agent session manager for conversation tracking"
```

---

### Task 16: Chat route (SSE endpoint)

**Files:**

- Create: `services/stage-engine/src/routes/agent/chat.ts`

**Step 1: Write the chat route**

```typescript
// services/stage-engine/src/routes/agent/chat.ts
// POST /agent/chat — Mr. Botsson text conversation endpoint.
// Returns JSON response (SSE streaming is Phase 2 optimization).

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../../types/auth.js";
import {
  createAgentSession,
  loadAgentSession,
  appendConversationTurn,
} from "../../core/agent-session.js";
import { routeAgentMessage } from "../../core/agent-router.js";
import type { ConversationTurn } from "../../types/agent.js";

export const agentChat = new Hono();

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  profile_id: z.string().uuid(),
  channel: z.enum(["chat", "voice"]).default("chat"),
});

/**
 * POST /agent/chat
 * Send a message to Mr. Botsson and get a response.
 * If session_id is omitted, a new session is created.
 */
agentChat.post("/agent/chat", zValidator("json", chatRequestSchema), async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = c.req.valid("json");

  let sessionId = body.session_id;
  let conversationHistory: ConversationTurn[] = [];

  // Load existing session or create new one
  if (sessionId) {
    const loaded = await loadAgentSession(sessionId, auth);
    if (!loaded) {
      return c.json({ error: "SESSION_NOT_FOUND", message: "Session not found or expired" }, 404);
    }
    conversationHistory = loaded.conversation;
  } else {
    sessionId = await createAgentSession({
      workspaceId: auth.workspaceId,
      profileId: body.profile_id,
      userId: auth.userId,
      channel: body.channel,
    });
  }

  // Store user message
  const userTurn: ConversationTurn = {
    role: "user",
    content: body.message,
    timestamp: new Date().toISOString(),
  };
  await appendConversationTurn(sessionId, userTurn);

  // Route through agent
  const result = await routeAgentMessage({
    message: body.message,
    sessionId,
    workspaceId: auth.workspaceId,
    profileId: body.profile_id,
    userId: auth.userId,
    conversationHistory,
    auth,
  });

  // Store assistant response
  const assistantTurn: ConversationTurn = {
    role: "assistant",
    content: result.response,
    timestamp: new Date().toISOString(),
  };
  await appendConversationTurn(sessionId, assistantTurn);

  return c.json(result);
});
```

**Step 2: Register the route in index.ts**

Add to `services/stage-engine/src/index.ts`:

```typescript
import { agentChat } from "./routes/agent/chat.js";
// ... after existing routes:
app.route("/", agentChat);
```

**Step 3: Verify it compiles**

Run: `cd services/stage-engine && pnpm typecheck`

**Step 4: Commit**

```bash
git add services/stage-engine/src/routes/agent/chat.ts services/stage-engine/src/index.ts
git commit -m "feat(engine): add POST /agent/chat endpoint for Mr. Botsson"
```

---

### Task 17: Add OPENROUTER_API_KEY to Stage Engine config

**Files:**

- Modify: `services/stage-engine/src/config.ts`
- Modify: `services/stage-engine/.env.example` (if exists)

**Step 1: Update config.ts**

Add to the `envSchema` in `services/stage-engine/src/config.ts`:

```typescript
/** OpenRouter API key for LLM calls (intent classification + agent loop) */
OPENROUTER_API_KEY: z.string().min(1),
```

**Step 2: Update docker-compose.yml**

Add to `infra/docker-compose.yml` stage-engine environment:

```yaml
OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/config.ts infra/docker-compose.yml
git commit -m "feat(engine): add OPENROUTER_API_KEY to config and docker-compose"
```

---

## Phase 5: Integration Testing

### Task 18: End-to-end agent chat test

**Files:**

- Create: `services/stage-engine/test/agent-chat.e2e.ts`

**Step 1: Write the E2E test**

```typescript
// services/stage-engine/test/agent-chat.e2e.ts
// End-to-end test for the agent chat endpoint.
// Requires: running Stage Engine + Supabase + valid API key.
// Run with: tsx test/agent-chat.e2e.ts

const BASE_URL = process.env.ENGINE_URL ?? "http://localhost:3000";
const API_KEY = process.env.TEST_API_KEY; // workspace API key for testing

if (!API_KEY) {
  console.error("Set TEST_API_KEY env var to a valid workspace API key");
  process.exit(1);
}

async function testAgentChat() {
  console.log("=== Agent Chat E2E Test ===\n");

  // Get a valid profile_id from the test workspace
  // (This would need to be set up in seed data or test fixtures)
  const PROFILE_ID = process.env.TEST_PROFILE_ID;
  if (!PROFILE_ID) {
    console.error("Set TEST_PROFILE_ID env var to a valid profile UUID");
    process.exit(1);
  }

  // Test 1: Create new session + send message
  console.log("Test 1: New conversation...");
  const res1 = await fetch(`${BASE_URL}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      message: "Hei! Hvem er jeg?",
      profile_id: PROFILE_ID,
    }),
  });

  if (!res1.ok) {
    console.error(`FAIL: ${res1.status} ${await res1.text()}`);
    process.exit(1);
  }

  const data1 = await res1.json();
  console.log(`  Session: ${data1.session_id}`);
  console.log(`  Intent: ${data1.intent?.capability} (${data1.intent?.confidence})`);
  console.log(`  Response: ${data1.response.slice(0, 100)}...`);
  console.log("  PASS\n");

  // Test 2: Continue same session
  console.log("Test 2: Follow-up in same session...");
  const res2 = await fetch(`${BASE_URL}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      message: "Hvilket team er jeg pa?",
      session_id: data1.session_id,
      profile_id: PROFILE_ID,
    }),
  });

  if (!res2.ok) {
    console.error(`FAIL: ${res2.status} ${await res2.text()}`);
    process.exit(1);
  }

  const data2 = await res2.json();
  console.log(`  Session: ${data2.session_id} (same: ${data2.session_id === data1.session_id})`);
  console.log(`  Intent: ${data2.intent?.capability} (${data2.intent?.confidence})`);
  console.log(`  Response: ${data2.response.slice(0, 100)}...`);
  console.log("  PASS\n");

  console.log("=== All tests passed ===");
}

testAgentChat().catch(console.error);
```

**Step 2: Add test script to package.json**

Add to `services/stage-engine/package.json` scripts:

```json
"test:agent": "tsx test/agent-chat.e2e.ts"
```

**Step 3: Commit**

```bash
git add services/stage-engine/test/agent-chat.e2e.ts services/stage-engine/package.json
git commit -m "test(engine): add E2E test for agent chat endpoint"
```

---

## Phase 6: Documentation & ADR

### Task 19: Write ADR for agent architecture

**Files:**

- Create: `docs/decisions/ADR-0041-agent-architecture.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Step 1: Write the ADR**

Use the decision template. Key decisions to record:

- Vercel AI SDK chosen over Anthropic Agent SDK
- Stage Engine extended with Agent Mode (not separate service)
- Capability layers replace Module 12's engine model
- Intent classification with confidence escape hatch
- Persistent memory with fresh sessions (not continuous conversation)
- Authority configurable per workspace per capability

**Step 2: Register in decision log**

Add entry to `docs/decisions/0000-decision-log.md`:

```markdown
| 0041 | Agent Architecture | Extend Stage Engine with Agent Mode, capability layers, intent router | 2026-03-01 | Accepted |
```

**Step 3: Commit**

```bash
git add docs/decisions/ADR-0041-agent-architecture.md docs/decisions/0000-decision-log.md
git commit -m "docs: add ADR-0041 agent architecture design decisions"
```

---

### Task 20: Update CLAUDE.md and reference docs

**Files:**

- Modify: `CLAUDE.md`
- Modify: `docs/reference/DATABASE.md`
- Modify: `docs/INDEX.md`

**Step 1: Update CLAUDE.md**

Add to the Database — Critical Traps section:

```markdown
- `engine_memory` — Persistent agent memories with pgvector embeddings. RLS: workspace isolation.
- `engine_authority_config` — Per-workspace, per-capability authority levels. UNIQUE(workspace_id, capability).
- `engine_sessions.mode` — 'mission' (structured stages) or 'agent' (free-form conversation). Agent sessions have NULL mission_id.
```

Add to Monorepo Structure:

```markdown
│ ├── capabilities/ → 8 domain capability layers (knowledge, schedule, training, etc.)
│ ├── router/ → Intent classifier + tool selector
│ └── prompts/ → Mr. Botsson system prompt builder
```

**Step 2: Update DATABASE.md with new tables**

**Step 3: Commit**

```bash
git add CLAUDE.md docs/reference/DATABASE.md docs/INDEX.md
git commit -m "docs: update reference docs with agent architecture additions"
```

---

## Future Phases (not in this plan)

These are documented but NOT implemented yet:

### Phase 7: Additional Capability Layers

- Schedule capability (connects to Shift MCP)
- Training capability (protocol assignments, readiness)
- Knowledge capability (pgvector RAG)
- Operations capability (department sessions)
- Communication capability (notifications)
- Payroll capability (salary calculations)
- Memory capability (conversation history retrieval)

### Phase 8: SSE Streaming

- Upgrade `/agent/chat` from JSON response to SSE streaming
- Token-by-token streaming for real-time chat experience
- React component integration in `apps/web`

### Phase 9: Voice Adapter Extension

- `POST /adapters/ultravox/agent-call` endpoint
- Free-form voice conversation via Agent Router (not missions)
- Ultravox STT → Agent Router → TTS

### Phase 10: Memory Extraction Pipeline

- Post-session LLM call to extract durable memories
- Embedding generation for semantic memory search
- Memory deduplication and expiry management

### Phase 11: Authority Admin UI

- Settings page in dashboard for workspace admins
- Per-capability authority level configuration
- Activity log showing what Mr. Botsson has done

### Phase 12: Chat Widget UI

- React component for the employee dashboard
- Message history, typing indicators, session management
- Mobile-responsive for React Native parity

---

## Summary

| Phase           | Tasks | What it delivers                                                                              |
| --------------- | ----- | --------------------------------------------------------------------------------------------- |
| 0: Dev Skill    | 0     | `smartout-agent-dev` skill — registry + development guide for all agents                      |
| 1: Database     | 1-3   | 2 new tables + mode column migration                                                          |
| 2: Capabilities | 4-6   | Type system, Profile capability, registry                                                     |
| 3: Router       | 7-10  | Intent classifier, tool selector, prompt builder, exports                                     |
| 4: Routes       | 11-17 | Agent types, authority loader, memory manager, router, session manager, chat endpoint, config |
| 5: Testing      | 18    | E2E test for the full flow                                                                    |
| 6: Docs         | 19-20 | ADR + reference doc updates                                                                   |

**Total: 21 tasks across 7 phases.**

After this plan: Mr. Botsson can receive text messages, classify intent, route to the Profile capability, check authority, and respond with employee information. One capability works end-to-end — the pattern is proven for adding the remaining 7.
