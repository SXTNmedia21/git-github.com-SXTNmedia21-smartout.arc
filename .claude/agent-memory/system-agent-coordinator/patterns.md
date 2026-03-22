# Code Patterns

## Tool/Capability Pattern

```typescript
// 1. Define tool with defineTool() + Zod schema
export const myTool = defineTool({
  name: "tool_name",
  description: "...",
  schema: z.object({ input: z.string() }),
  execute: async ({ input }, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    // ... workspace-scoped query using ctx.workspaceId
    return JSON.stringify(result);
  },
});

// 2. Register in capability definition
export const myCapability: CapabilityDefinition = {
  name: "capability_name",
  description: "...",
  tools: [myTool], // all tools (confirm/autonomous)
  readOnlyTools: [myTool], // tools for read_only authority
  suggestTools: [], // additional tools for suggest authority
};

// 3. Register in registry.ts
const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  // add here
};
```

## Agent Router Pipeline (agent-router.ts)

1. `loadAuthorityConfig(workspaceId)` -> Record<capability, level>
2. `classifyIntent(message, context)` -> { capability, confidence, intent, reasoning }
3. `collectContext({workspaceId, profileId, situation, authority})` -> AgentContext
4. `selectTools(intent, authorityConfig)` -> SmartoutTool[]
5. `buildBotssonPromptFromContext(ctx, toolDescriptions)` -> system prompt string
6. `generateText({ model, system, messages, tools })` -> response

## Posture Resolution

Base personality (from agent_profile) -> role adjustment -> situation adjustment -> authority adjustment -> relationship adjustment -> clamped 0-1

## Vercel AI SDK Adapter

`toVercelTools(tools, ctx)` wraps SmartoutTool[] into Vercel AI SDK `tool()` calls.
Each tool's execute gets the ctx passed through closure.

## Ultravox Integration

Two paths:

1. **Stage Engine adapter** (`/adapters/ultravox/`): creates Ultravox call with server-side tools pointing back to engine endpoints
2. **Direct client tools** (`useBotsson.ts`): registers tools as Ultravox `temporaryTool` with `client: {}`, executed in browser

## Session Lifecycle

- Create: POST /sessions (mission) or POST /agent/chat (auto-creates agent session)
- Active -> complete (all stages done or session ended)
- Active -> expired (past expires_at, cleaned by interval)
- Active -> abandoned (manual POST /sessions/:id/abandon)
- Cleanup job runs every CLEANUP_INTERVAL_MINUTES (default 5)

## Memory System

- Load: recent non-expired, ordered by importance DESC then created_at DESC, limit 10
- Save: workspace + profile scoped, optional embedding, optional expiry
- Clean: periodic deletion of expired memories
- Embedding: pgvector 1536 dimensions, HNSW index, cosine similarity
- Note: memory-manager.ts only does recency-based retrieval (no vector search yet)
