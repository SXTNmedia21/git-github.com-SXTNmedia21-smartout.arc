---
title: Agent Harness Foundation — Design Spec
status: ready-for-plan
updated: 2026-04-09
created: 2026-04-09
module: ai-agent
tags: [agent-harness, hooks, context-engine, subagent, durability, botsson, stage-engine]
---

# Agent Harness Foundation — Design Spec

> Smartout som Agent Harness. Tre faser som gjor Stage Engine til en fullverdig
> agent-orkestreringsplattform — med hooks, context management, session
> durability, og subagent-delegering. Inspirert av Anthropic's Brain/Hands/Session
> arkitektur og OpenClaw's plugin/hook-modell.

## Source Material

Denne specen bygger pa research og brainstorm i session 2026-04-09:

- **Anthropic Agent Harness research** — Brain/Hands/Session separation, hook architecture,
  context compaction, subagent patterns, managed agents decoupling
- **OpenClaw architecture research** — Gateway hook system (before_tool_call/after_tool_call),
  plugin registry, context engine (assemble/compact/persist), session-lane serialization
- **Smartout codebase analysis** — Stage Engine (45 filer, ~6500 LOC), Process Engine
  (allerede har subprocess spawning via start_process + parent_state_id + depth),
  packages/ai (capability registry, tool selector, intent classifier)
- **ADR-0073** — AI Eval Harness (baselines for intent classifier, tool selection)
- **ADR-0077/0078** — PII handling, channel restrictions
- **Council review 2026-04-09** — system-steward, supervisor, system-agent-coordinator,
  frontend-designer. All four approved with changes. 15 items resolved below.
  ADR-0083 to be written at implementation.

**Existing infrastructure leveraged (not rebuilt):**

- Process Engine subprocess spawning (parent_state_id, depth, start_process action)
- Guardian-bus event broadcasting
- Authority model (5 levels per capability per workspace)
- Capability registry in @smartout/ai
- VoiceProvider abstraction in agent-sdk

---

## Vision

Botsson er en personlig AI-agent per bruker — pa lik linje med Claude Code eller
OpenClaw. Admin far subagent-orkestrering forst (synlige agenter som jobber
parallelt). Ansatte far gradvis tilgang etter hvert som authority-modellen
utvides.

**Designprinsipp:** Harness-arkitekturen definerer oppforselen — UI-en bare
reflekterer det som skjer. Hvert lag er additivt. Ingenting bryter eksisterende
funksjonalitet.

---

## Scope

### In scope (denne specen)

| Fase | Leveranse | Synlig for bruker? |
|------|-----------|-------------------|
| 1 — Foundation | Hook registry, Context Engine, Session durability | Nei |
| 2 — Subagent | parent_session_id, delegate_task tool, Process Engine bro | Delvis (admin ser status) |
| 3 — Arena UI | "Agenter"-view, Orb working-glyph, delegerings-logg | Ja |

### Out of scope

- LiveKit voice switch (separat beslutning, uavhengig av harness)
- MCP server integration i agent runtime (Fase 4+)
- Multi-agent orchestration med lead/worker pattern (Fase 4+)
- Evaluator-optimizer loop (Fase 4+)
- Memory consolidation/"dreaming" (Fase 4+)
- Ansatt-tilgang til subagent-features (authority-gated, aktiveres senere)
- Voice/Ultravox hook integration (hooks are chat-pipeline only in Phase 1;
  voice sessions go through /adapters/ultravox/ which bypasses routeAgentMessage.
  PII/budget/telemetry for voice remains via ADR-0077/0078 at process/capability
  level. Voice hook integration = Phase 4+)

---

## Architecture: Brain / Hands / Session

Smartout adopterer Anthropic's trelagsmodell, tilpasset vart domene:

```
BRAIN (stateless, packages/ai + stage-engine core)
  Agent Loop: classify intent -> collect context -> select tools -> run LLM
  Hook Registry: intercept pa 7 punkter i pipelinen
  Context Engine: assemble -> compact -> persist
  Capability Registry: tools gruppert per domene + authority

HANDS (swappable, adapters + providers)
  Voice: Ultravox (na) / LiveKit (fremtid)
  Chat: WebSocket + REST
  SMS/Email: Twilio + SendGrid
  Process Engine: bakgrunnsjobber, subprocess spawning

SESSION (durable, engine_sessions + ny event log)
  Append-only event log per session
  Resumable: crash -> replay events -> fortsett
  Parent/child: subagent-sessioner med parent_session_id
  Budget: max_turns, max_tokens per session
  Lane serialization: per-session queue, ingen race conditions
```

### Mapping til eksisterende kode

| Anthropic-konsept | Smartout-fil | Status |
|---|---|---|
| Agent Loop | stage-engine/src/core/agent-router.ts | Eksisterer, utvides |
| Tool Registry | packages/ai/src/capabilities/registry.ts | Eksisterer, beholdes |
| Permission Model | stage-engine/src/core/authority.ts | Eksisterer, beholdes |
| Prompt Builder | packages/ai/src/prompts/mr-botsson.ts | Eksisterer, beholdes |
| Context Collector | packages/ai/src/context/collector.ts | Eksisterer, abstraheres |
| Event Bus | stage-engine/src/core/guardian-bus.ts | Eksisterer, utvides |
| Session Store | stage-engine/src/core/session-manager.ts | Eksisterer, utvides |
| Subprocess Spawn | supabase/functions/engine-dispatch/index.ts | Eksisterer (start_process) |
| Hook Registry | **NY** | Fase 1 |
| Context Engine | **NY** | Fase 1 |
| Session Event Log | **NY** | Fase 1 |
| delegate_task tool | **NY** | Fase 2 |

---

## Fase 1: Foundation

### 1.1 Hook Registry

**Fil:** `services/stage-engine/src/hooks/registry.ts` (ny)

Hook-registeret er en enkel, prioritetsbasert event-dispatcher. Hooks kjorer
synkront i prioritetsrekkefolge. En hook kan blokkere videre eksekverelse ved
a returnere `{ block: true, reason: string }`.

**Hook-punkter i agent pipeline:**

```
message:received    -> Innkommende melding (for klassifisering)
intent:classified   -> Intent + confidence + capability bestemt
context:collected   -> Full AgentContext tilgjengelig
tools:selected      -> Verktoy valgt basert pa intent + authority
llm:before          -> Rett for LLM-kall (siste sjanse til a endre prompt/tools)
llm:after           -> LLM-respons mottatt (for tool-result transformasjon)
session:completing  -> Sesjon avsluttes (for opprydding, memory-save)
```

**Hook-typer:**

| Type | Formaal | Eksempel |
|------|---------|---------|
| Guard | Blokkerer eksekverering | PII channel guard: blokker voice for sensitiv data |
| Transform | Endrer payload | Context enrichment: legg til real-time skiftdata |
| Observe | Logger/tracker uten a endre | Telemetri: log tool-kall til PostHog |

**Interface (with typed payloads per council R4):**

```typescript
type HookPayloadMap = {
  "message:received": { message: string; sessionId: string; channel: SessionChannel };
  "intent:classified": { intent: IntentResult; sessionId: string };
  "context:collected": { context: AgentContext; sessionId: string };
  "tools:selected": { tools: ReadonlyArray<SmartoutTool>; intent: IntentResult };
  "llm:before": { systemPrompt: string; tools: Record<string, unknown>; messages: Array<unknown> };
  "llm:after": { result: GenerateTextResult; sessionId: string; tokensUsed: number };
  "session:completing": { sessionId: string; summary?: string };
};

type HookName = keyof HookPayloadMap;

type HookResult =
  | { block: false }
  | { block: true; reason: string };

type HookHandler<N extends HookName> = (
  payload: HookPayloadMap[N]
) => Promise<HookResult | void> | HookResult | void;

interface Hook<N extends HookName = HookName> {
  name: N;
  handler: HookHandler<N>;
  priority: number;   // Higher runs first. Default 0.
  type: "guard" | "transform" | "observe";
}

class HookRegistry {
  register<N extends HookName>(hook: Hook<N>): void;
  unregister<N extends HookName>(name: N, handler: HookHandler<N>): void;
  async run<N extends HookName>(name: N, payload: HookPayloadMap[N]): Promise<{
    blocked: boolean;
    reason?: string;
    payload: HookPayloadMap[N];
  }>;
}
```

**Observe hook execution semantics (council clarification):**

Guard and Transform hooks are awaited sequentially. Observe hooks are
**fire-and-forget** — `run()` detaches their promises and does NOT await them.
This means observe hooks cannot block the pipeline and add zero latency.
Transform hooks compose via last-writer-wins on the payload object (shallow merge).
If two transforms modify different fields, both apply. If they modify the same
field, the higher-priority hook wins (runs first, subsequent transform sees its output).

**Integrasjon i agent-router.ts:**

```typescript
// Eksisterende kode (forenklet):
async function routeAgentMessage(params) {
  // NY: message:received hook
  const msgResult = await hooks.run("message:received", { message, sessionId });
  if (msgResult.blocked) return { text: msgResult.reason };

  const intent = await classifyIntent(message);
  // NY: intent:classified hook
  await hooks.run("intent:classified", { intent, sessionId });

  const context = await contextProvider.collect({ workspaceId, profileId });
  // NY: context:collected hook
  const ctxResult = await hooks.run("context:collected", { context });

  const tools = selectTools(intent, authorityConfig);
  // NY: tools:selected hook
  await hooks.run("tools:selected", { tools, intent });

  // NY: llm:before hook
  await hooks.run("llm:before", { systemPrompt, tools, messages });

  const result = await generateText({ ... });

  // NY: llm:after hook
  await hooks.run("llm:after", { result, sessionId });

  return result;
}
```

**Innebyggde hooks (registreres ved oppstart):**

| Hook | Punkt | Type | Formaal |
|------|-------|------|---------|
| pii-channel-guard | tools:selected | Guard | Fjern PII-tools i voice-kanal (ADR-0078) |
| telemetry-observer | llm:after | Observe | Log tool-kall + token-bruk til telemetri |
| memory-save | session:completing | Observe | Lagre preference/fact til engine_memory |
| budget-guard | llm:before | Guard | Blokker om session token-budget er brukt opp |
| context-cache | context:collected | Transform | Cache context mellom turns i samme session |

### 1.2 Context Engine

**Fil:** `services/stage-engine/src/core/context-engine.ts` (ny)

Context Engine styrer hva som gar inn i LLM context window. Tre faser:

**Assemble:** Samler context fra flere kilder med prioritetsranking.

```typescript
interface ContextSource {
  name: string;
  priority: number;          // Higher = more important = survives compaction
  tokenEstimate: number;     // Approximate tokens this source contributes
  collect(params: ContextParams): Promise<ContextFragment>;
}

interface ContextFragment {
  content: string | object;
  tokens: number;
  priority: number;
  compactable: boolean;      // Can this be summarized?
}
```

**Kilder (prioritetsrekkefølge):**

| Prioritet | Kilde | Compactable? | Merknad |
|-----------|-------|-------------|---------|
| 100 | System prompt (identity, authority rules) | Nei | Overlever alltid |
| 90 | Active stage instructions | Nei | Bare i mission-mode |
| 80 | Tool descriptions | Nei | Nødvendig for tool-bruk |
| 70 | Collected data (current session) | Nei | Session state |
| 60 | Relevant memories (engine_memory) | Ja | Top 5 |
| 50 | Relationship data | Ja | Familiarity/trust/sentiment |
| 40 | Active shift info | Ja | Nåværende vaktdata |
| 30 | Conversation history (recent 5 turns) | Nei | Siste turns alltid med |
| 20 | Conversation history (older turns) | Ja | Komprimeres |
| 10 | Background context (workspace, team) | Ja | Generell info |

**Compact:** Nar total tokens overskrider budget, komprimer lavprioritets-fragmenter.

```typescript
class ContextEngine {
  private sources: ContextSource[] = [];
  private tokenBudget: number;             // Default: 12000 tokens
  private compactionThreshold: number;     // Default: 0.8 (80% av budget)

  registerSource(source: ContextSource): void;

  async assemble(params: ContextParams): Promise<AssembledContext> {
    // 1. Collect all fragments in parallel
    // 2. Sort by priority (descending)
    // 3. Check total tokens vs budget
    // 4. If over threshold: compact lowest-priority compactable fragments
    // 5. Return assembled context
  }

  async compact(fragments: ContextFragment[]): Promise<ContextFragment[]> {
    // Summarize compactable fragments using claude-haiku-4-5 (fast, cheap)
    // Preserve non-compactable fragments verbatim
    // Return compacted set within budget
  }
}
```

**Compaction-strategi (async per council R5):**

Compaction runs AFTER the current turn's response is returned. The compacted
context is stored and used starting from the NEXT turn. This means the first
turn that exceeds budget may slightly overshoot, but user experience is not
degraded by 200-400ms extra latency.

- Conversation history eldre enn 5 turns -> sammenfattes til 1-2 setninger
- Memories med lav importance -> droppes
- Relationship data -> komprimeres til en setning
- System prompt, tools, stage instructions -> ALDRI komprimert
- Token counting: approximate (chars/4). Not exact tokenizer — sufficient for budget gating.

**Integrasjon med eksisterende collectContext():**

```typescript
// packages/ai/src/context/collector.ts forblir uendret
// Den blir EN av kildene i Context Engine:
class SmartoutContextSource implements ContextSource {
  name = "smartout-context";
  priority = 60;
  async collect(params) {
    return collectContext(params); // Eksisterende funksjon
  }
}
```

### 1.3 Session Durability

**Maal:** Crash recovery + budget tracking + lane serialization.

**Database-endringer (Fase 1 migration):**

```sql
-- Session event log (append-only, internal replay journal)
-- NOTE: This is NOT a duplicate of guardian_log. Boundary:
--   guardian_log = external audit trail (what users see in guardian panel)
--   engine_session_event = internal crash-recovery journal (replay log, never surfaced to users)
CREATE TABLE engine_session_event (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id),
  session_id    UUID NOT NULL REFERENCES engine_sessions(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_event_session ON engine_session_event(session_id, created_at);

-- Dual RLS (per convention)
ALTER TABLE engine_session_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members can view session events"
  ON engine_session_event FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM company_member WHERE user_id = auth.uid()));

-- Budget tracking on existing table
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS
  total_turns INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS
  total_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS
  max_turns INTEGER;            -- NULL = unlimited
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS
  max_tokens INTEGER;           -- NULL = unlimited
```

**Event log pattern:**

Hver interaksjon appendes som event. Ved crash: replay events for a rekonstruere
session state.

```typescript
// I agent-router.ts, etter hver operasjon:
await appendSessionEvent(sessionId, "tool_called", {
  tool: toolName,
  args: toolArgs,
  result: toolResult,
  tokens_used: usage.totalTokens,
});

// Budget check (via hook):
async function budgetGuardHook(payload) {
  const session = await getSession(payload.sessionId);
  if (session.max_turns && session.total_turns >= session.max_turns) {
    return { block: true, reason: "Session turn limit reached" };
  }
  if (session.max_tokens && session.total_tokens >= session.max_tokens) {
    return { block: true, reason: "Session token budget exhausted" };
  }
}
```

**Lane serialization:**

Forhindrer race conditions nar flere meldinger ankommer samtidig for
samme session.

```typescript
// services/stage-engine/src/core/session-lane.ts (ny)
class SessionLane {
  private queues = new Map<string, Promise<unknown>>();

  async run<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(sessionId) ?? Promise.resolve();
    const next = prev.then(() => fn()).catch((err) => { throw err; });
    this.queues.set(sessionId, next.catch(() => {}));
    // Cleanup: delete key after promise resolves to prevent memory leak
    next.finally(() => {
      if (this.queues.get(sessionId) === next) this.queues.delete(sessionId);
    });
    return next;
  }
}

// NOTE: SessionLane is in-memory only. On process restart, queue state is lost.
// This is acceptable for single-instance stage-engine. Crash recovery relies
// on engine_session_event replay, not on SessionLane state.

// Brukes i route handler:
const lane = c.get("sessionLane");
const result = await lane.run(sessionId, () =>
  routeAgentMessage({ message, sessionId, ... })
);
```

---

## Fase 2: Subagent Mechanism

### 2.1 Session Forking

**Database-endring (Fase 2 migration — separat fra Fase 1):**

```sql
-- ENUM for delegation status (per convention, not TEXT CHECK)
CREATE TYPE delegation_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'cancelled'
);

ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS
  parent_session_id UUID REFERENCES engine_sessions(id) ON DELETE SET NULL;
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS
  depth INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS
  delegation_status delegation_status;
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS
  delegation_result JSONB;

CREATE INDEX idx_session_parent
  ON engine_sessions(parent_session_id) WHERE parent_session_id IS NOT NULL;
```

**Parent expiry propagation (council R6):** When a parent session expires or is
abandoned (`expires_at` reached), a cleanup job marks all active children with
`delegation_status = 'cancelled'`. The ON DELETE SET NULL FK prevents cascade
delete but allows orphan detection.

**Regler:**

- Max depth = 2 (parent -> child -> grandchild). Forhindrer uendelig nesting.
- Child arver workspace_id og profile_id fra parent.
- Child arver IKKE conversation history (isolert context, som Claude Code subagents).
- Child far en fokusert instruction og relevante tools for sin oppgave.
- Child sessions bruk `mode = 'agent'` (ikke mission-mode) med `mission_id = NULL`.
- Resultat lagres i delegation_result pa child, og appendes som event pa parent.

### 2.2 delegate_task Tool

**Fil:** `services/stage-engine/src/tools/delegation.ts` (ny)

> **Council correction (C2):** Tool lives in stage-engine, NOT packages/ai.
> It needs direct access to createSubagentSession(), appendSessionEvent(),
> broadcastToSession() — all stage-engine internals. Registered as a
> stage-engine-provided tool injected via toolContext (existing pattern).

Uses `createSubagentSession()` (ny funksjon i session-manager.ts, council C1)
instead of `createSession()` — subagent sessions are mission-less, mode="agent":

```typescript
const delegateTask: SmartoutTool<AgentToolContext> = {
  name: "delegate_task",
  description:
    "Delegate a subtask to a specialized subagent. " +
    "Use when a task can run independently — e.g., " +
    "creating a contract for one employee while you " +
    "continue working on others.",
  schema: z.object({
    capability: z.enum([
      "contract", "schedule", "operations",
      "communication", "profile", "guardian",
    ]),
    instruction: z.string().describe(
      "Clear instruction for the subagent. " +
      "Include entity IDs and expected outcome."
    ),
    entity_id: z.string().uuid().optional(),
    blocking: z.boolean().default(false).describe(
      "If true, wait for result before continuing. " +
      "If false, subagent runs in background."
    ),
  }),
  execute: async (params, ctx) => {
    // 1. Sjekk depth limit
    const parentSession = await getSession(ctx.sessionId);
    if (parentSession.depth >= 2) {
      return "Cannot delegate: max depth reached. Complete this task directly.";
    }

    // 2. Sjekk authority: delegation krever minst 'confirm' pa capability
    const authorityLevel = await getAuthorityLevel(
      ctx.workspaceId, params.capability
    );
    if (authorityLevel === "disabled" || authorityLevel === "read_only") {
      return `Cannot delegate: ${params.capability} authority is ${authorityLevel}.`;
    }

    // 3. Opprett child session
    const childSession = await createSession({
      workspace_id: ctx.workspaceId,
      profile_id: ctx.profileId,
      channel: "autonomous",
      parent_session_id: ctx.sessionId,
      depth: parentSession.depth + 1,
      context: {
        capability: params.capability,
        instruction: params.instruction,
        entity_id: params.entity_id,
        inherited_authority: authorityLevel,
      },
      delegation_status: "pending",
    });

    // 4. Emit event til Process Engine
    await supabase.from("engine_event").insert({
      event_type: "agent.task_delegated",
      payload: {
        parent_session_id: ctx.sessionId,
        child_session_id: childSession.id,
        capability: params.capability,
        instruction: params.instruction,
        entity_id: params.entity_id,
      },
      workspace_id: ctx.workspaceId,
    });

    // 5. Append event pa parent session
    await appendSessionEvent(ctx.sessionId, "subagent_spawned", {
      child_session_id: childSession.id,
      capability: params.capability,
      instruction: params.instruction,
      blocking: params.blocking,
    });

    // 6. Broadcast til Arena UI
    broadcastToSession(ctx.sessionId, {
      type: "subagent:spawned",
      data: {
        child_session_id: childSession.id,
        capability: params.capability,
        instruction: params.instruction,
        status: "pending",
      },
    });

    if (params.blocking) {
      // Venter pa resultat via Supabase Realtime subscription pa
      // engine_sessions.delegation_status (med 60s timeout).
      // Subscription opprettes, venter pa status !== 'pending'/'running',
      // deretter unsubscribes.
      const result = await waitForChildCompletion(childSession.id, {
        timeout: 60_000,
      });
      return result
        ? `Subtask completed: ${JSON.stringify(result)}`
        : "Subtask timed out. Check status later.";
    }

    return `Subtask delegated (ID: ${childSession.id}). ` +
           `I'll notify you when it's done.`;
  },
};
```

### 2.3 poll_subagent Tool

For ikke-blokkerende delegering:

```typescript
const pollSubagent: SmartoutTool<AgentToolContext> = {
  name: "poll_subagent_status",
  description: "Check the status of a previously delegated subtask.",
  schema: z.object({
    child_session_id: z.string().uuid(),
  }),
  execute: async (params, ctx) => {
    const child = await getSession(params.child_session_id);
    if (!child || child.parent_session_id !== ctx.sessionId) {
      return "Subtask not found or not owned by this session.";
    }
    if (child.delegation_status === "completed") {
      return `Completed: ${JSON.stringify(child.delegation_result)}`;
    }
    return `Status: ${child.delegation_status}`;
  },
};
```

### 2.4 Subagent Execution

Child sessions kjores av en ny executor i stage-engine:

**Fil:** `services/stage-engine/src/core/subagent-executor.ts` (ny)

```typescript
async function executeSubagent(childSessionId: string): Promise<void> {
  const session = await getSession(childSessionId);
  const { capability, instruction, entity_id } = session.context;

  // 1. Hent capability tools (filtrert pa inherited authority)
  const tools = getCapabilityTools(capability, session.context.inherited_authority);

  // 2. Bygg fokusert system prompt
  const systemPrompt = buildSubagentPrompt({
    capability,
    instruction,
    entity_id,
    workspace_id: session.workspace_id,
  });

  // 3. Kjoer LLM med verktoy (maks 5 steg, som vanlig)
  // NOTE: Model string must match agent-router.ts. Currently "anthropic/claude-sonnet-4"
  // but should be bumped to "anthropic/claude-sonnet-4.6" per ADR-0073 Phase 5.
  // Both agent-router.ts and subagent-executor.ts must use the same model.
  const result = await generateText({
    model: getOpenRouter()("anthropic/claude-sonnet-4.6"),
    system: systemPrompt,
    messages: [{ role: "user", content: instruction }],
    tools: toVercelTools(tools, toolContext),
    stopWhen: stepCountIs(5),
  });

  // 4. Lagre resultat
  await updateSession(childSessionId, {
    delegation_status: "completed",
    delegation_result: { text: result.text, toolCalls: result.toolCalls },
  });

  // 5. Notify parent session
  broadcastToSession(session.parent_session_id, {
    type: "subagent:completed",
    data: {
      child_session_id: childSessionId,
      capability,
      result: result.text,
    },
  });

  // 6. Append event pa parent
  await appendSessionEvent(session.parent_session_id, "subagent_completed", {
    child_session_id: childSessionId,
    result: result.text,
  });
}
```

### 2.5 Subagent Execution Trigger (council Q3)

`delegate_task` calls `executeSubagent()` directly (option a). For non-blocking
delegation, the call is fire-and-forget (detached promise). For blocking, it
awaits the result. The subagent runs in the SAME stage-engine process — no
cross-service calls needed.

```typescript
// In delegate_task execute():
if (params.blocking) {
  await executeSubagent(childSession.id);  // awaited
} else {
  executeSubagent(childSession.id);         // fire-and-forget
}
```

### 2.6 Process Engine Bro

Subagent-delegering kan ogsa trigge Process Engine workflows:

```typescript
// engine_trigger i database:
// event_type: "agent.task_delegated"
// condition: { "match": { "capability": "contract" } }
// process_id: "contract-creation-workflow"
```

Dette lar subagenter delegere videre til bakgrunnsprosesser som allerede
eksisterer i Process Engine (f.eks. kontrakt-opprettelse, varsling, compliance-sjekk).

**Completion callback (council R7):** When a Process Engine workflow (engine_state)
completes, it emits an `engine_event` with `event_type: "process.completed"`.
Stage-engine listens for this event type and maps it back to the parent
`engine_sessions` via `engine_state.context.parent_session_id` (passed through
at spawn time). The parent session receives a `subagent_completed` broadcast.

---

## Fase 3: Arena UI

### 3.1 Ny ContentViewType: "agents"

**Fil:** `apps/web/src/app/Botsson/_components/types.ts`

Legg til "agents" i `ContentViewType` union:

```typescript
type ContentViewType =
  | "visualizer" | "chat" | "admin-chat" | "notepad"
  | "calculator" | "settings" | "tasks" | "form"
  | "video" | "log" | "memory" | "history"
  | "agents";  // NY
```

VIEW_TITLES i BotssonArena.tsx:
```typescript
agents: "Agenter",
```

### 3.2 AgentsView Component (council-redesigned)

**Fil:** `apps/web/src/app/Botsson/_components/AgentsView.tsx` (ny)

Status-kort bruker glassmorphism micro-surfaces (ikke bordered rectangles):

```
Background: bg-muted/60 (warm, 60% opacity)
Border: 1px gradient border (top-left light edge)
Blur: backdrop-blur-sm (subtle — nested inside already-blurred Arena)
Corner radius: rounded-lg (8px)
Padding: p-3 (12px)
```

Status indicator: 8px colored dot:
- Running: `var(--brand-orange)` with slow pulse animation
- Completed: `var(--color-success)` (green), static
- Failed: `var(--color-destructive)`, static

Scrollable: `overflow-y: auto`, max-height ~360px, fade-out gradient at bottom
edge when content overflows. Staggered entrance: `staggerChildren: 0.06` with
fadeInUp variant. `prefers-reduced-motion`: cards appear instantly without stagger.

**Empty state:** Ghost card with dashed border + i18n key `botsson.agents.empty`.
**Max visible:** Scrollable, no hard cap. Completed cards auto-collapse after 60s.
**Result field:** Free-form text from agent (truncated to 100 chars in card).

**All strings via i18n keys:**
- `botsson.agents.title`, `botsson.agents.status.running`,
  `botsson.agents.status.completed`, `botsson.agents.status.failed`,
  `botsson.agents.summary.completed` / `.active` / `.failed`

**Data-kilde:** WebSocket events (`subagent:spawned`, `subagent:completed`,
`subagent:failed`) + REST fallback for historikk.

### 3.3 Orb Status Glyph: "working" (council-redesigned)

**Fil:** `apps/web/src/app/Botsson/_components/BotssonOrb.tsx`

> **Council correction:** Replace orbiting electrons with concentric pulse rings.
> Electrons are mechanical and unbounded. Pulse rings are ambient, bounded,
> consistent with existing notification glyph's ripple-ring language.

Ny OrbStatus: `"working"` — vises nar subagenter er aktive.

Visuelt: 1-3 konsentriske pulse-ringer som sprer seg utover (som ripples i vann).
`min(activeSubagents, 3)` synlige ringer. Farge: `var(--brand-orange)` ved lav
opacity. CSS-animasjon pa opacity + scale (ingen per-frame JS).
Spring: `stiffness: 30, damping: 24, mass: 2.5` — langsomme enden av Nordic Split.
`prefers-reduced-motion`: ringer vises statisk ved full opacity.

**Orb state priority stack (council recommendation):**

1. `speaking` (hoyest — bruker horer output)
2. `listening` (bruker gir input)
3. `notification` (krever oppmerksomhet)
4. `working` (bakgrunnsaktivitet)
5. `thinking` (prosesserer)
6. `idle` (lavest)

Orb viser den hoyest-prioriterte aktive tilstanden. Hvis Botsson snakker mens
subagenter jobber, vises `speaking`. `working` vises bare nar ingenting med
hoyere prioritet er aktivt.

### 3.4 Arena Tab Badge

```typescript
// I EmmaMenuOverlay (all labels via i18n):
{
  id: "agents" as ContentViewType,
  label: t("botsson.agents.tab"),
  description: t("botsson.agents.tab_description"),
  badge: activeSubagentCount > 0 ? activeSubagentCount : undefined,
}
```

Badge styling: `bg-brand-orange text-white h-4 min-w-4 text-[10px]` pill.
Entrance: scale spring 0→1 (stiffness: 40, damping: 20).
Count change: brief pulse to 1.15x.
Zero active: badge exits via AnimatePresence (opacity: 0, scale: 0.8, 250ms).

---

## Database Migrations (split per phase, council recommendation)

**Fase 1 migration:** See Section 1.3 above (engine_session_event + budget columns).
**Fase 2 migration:** See Section 2.1 above (parent_session_id, depth, delegation_status enum).

Each phase ships its own migration. Fase 2 columns only deploy when Fase 2 code ships.

**Retention policy for engine_session_event:** Events older than 30 days are
pruned by a scheduled cleanup job (same pattern as existing session expiry in
session-manager.ts). This prevents unbounded table growth.

---

## Nye filer (komplett liste)

### Fase 1

| Fil | LOC (estimat) | Formaal |
|-----|--------------|---------|
| `stage-engine/src/hooks/registry.ts` | ~100 | Hook registry with typed payloads |
| `stage-engine/src/hooks/builtin.ts` | ~80 | Innebyggde hooks (PII guard, telemetri, budget) |
| `stage-engine/src/core/context-engine.ts` | ~120 | Context assembly + async compaction |
| `stage-engine/src/core/session-lane.ts` | ~35 | Per-session serialization queue + cleanup |
| `stage-engine/src/core/session-events.ts` | ~40 | appendSessionEvent() helper |
| `supabase/migrations/YYYYMMDD_agent_harness_foundation.sql` | ~40 | Fase 1 migration |

### Fase 2

| Fil | LOC (estimat) | Formaal |
|-----|--------------|---------|
| `stage-engine/src/tools/delegation.ts` | ~120 | delegate_task + poll_subagent tools (i stage-engine, ikke packages/ai) |
| `stage-engine/src/core/subagent-executor.ts` | ~80 | Child session LLM executor |
| `stage-engine/src/core/subagent-prompt.ts` | ~40 | Focused subagent prompt builder |
| `supabase/migrations/YYYYMMDD_agent_harness_subagent.sql` | ~20 | Fase 2 migration (enum + columns) |

### Fase 3

| Fil | LOC (estimat) | Formaal |
|-----|--------------|---------|
| `apps/web/src/app/Botsson/_components/AgentsView.tsx` | ~120 | Subagent status UI |
| `apps/web/src/app/Botsson/_components/useSubagents.ts` | ~60 | WebSocket hook for subagent events |

**Total:** ~780 LOC ny kode over 12 filer + 1 migration.

---

## Endringer i eksisterende filer

### Fase 1 (foundation)

| Fil | Endring | Omfang |
|-----|---------|--------|
| `stage-engine/src/index.ts` | Instansier HookRegistry, ContextEngine, SessionLane. Sett pa Hono context. | +15 linjer |
| `stage-engine/src/core/agent-router.ts` | Legg til 7 hook call sites. Bruk contextEngine.assemble() i stedet for direkte collectContext(). Wrap i sessionLane.run(). Bump model to claude-sonnet-4.6. | ~50 linjer endret |
| `stage-engine/src/core/stage-manager.ts` | Legg til session:completing hook. | +3 linjer |
| `stage-engine/src/routes/agent/chat.ts` | Wrap handler i sessionLane.run(). | +3 linjer |

### Fase 2 (subagent)

| Fil | Endring | Omfang |
|-----|---------|--------|
| `stage-engine/src/core/session-manager.ts` | Add createSubagentSession() function (mode=agent, no mission). | +30 linjer |
| `stage-engine/src/core/agent-router.ts` | Register delegation tools via toolContext injection. | +5 linjer |
| `stage-engine/src/routes/agent/chat.ts` | Trigger subagent executor for nye child sessions. | +10 linjer |
| `packages/telemetry/src/registry.ts` | Register 6 new agent events. | +20 linjer |

### Fase 3 (Arena UI)

| Fil | Endring | Omfang |
|-----|---------|--------|
| `apps/web/src/app/Botsson/_components/types.ts` | Legg til "agents" i ContentViewType, "working" i OrbStatus. | +2 linjer |
| `apps/web/src/app/Botsson/_components/BotssonArena.tsx` | Legg til agents view title + render AgentsView. | +5 linjer |
| `apps/web/src/app/Botsson/_components/BotssonOrb.tsx` | Legg til "working" glyph med orbiting particles. | +30 linjer |

---

## Authority Integration

Subagent-delegering mapper direkte til eksisterende authority-modell:

| Authority Level | Delegering tillatt? | Synlighet i Arena |
|---|---|---|
| `disabled` | Nei | Capability ikke synlig |
| `read_only` | Nei | Kan se delegerings-historikk |
| `suggest` | Ja, men krever admin-godkjenning | "Botsson foreslar..." |
| `confirm` | Ja, men krever admin-godkjenning for mutasjoner | Default for admin |
| `autonomous` | Ja, fullt autonomt | Subagenter kjorer uten sporsmal |

**Ansatte (fremtid):** Nar ansatte far tilgang, far de `read_only` eller
`suggest` pa delegation capability. De ser ikke AgentsView — bare resultater.

---

## Error Handling

| Feil | Haandtering |
|------|-------------|
| Subagent LLM-feil | delegation_status = "failed", parent notifiseres, admin ser feilmelding i AgentsView |
| Subagent timeout | delegation_status = "failed" etter 60s, parent far timeout-melding |
| Depth limit (>2) | delegate_task returnerer feilmelding, ingen child opprettes |
| Budget brukt opp | budget-guard hook blokkerer LLM-kall, returnerer forklaring |
| Race condition | SessionLane serialiserer — andre meldinger venter |
| Crash mid-execution | Session event log muliggjor replay ved restart |

---

## Testing Strategy

| Type | Hva | Hvor |
|------|-----|------|
| Unit | HookRegistry (registrer, prioritet, blokkering) | `stage-engine/src/hooks/__tests__/` |
| Unit | ContextEngine (assemble, compact, budget) | `stage-engine/src/core/__tests__/` |
| Unit | SessionLane (serialization, concurrent requests) | `stage-engine/src/core/__tests__/` |
| Unit | delegate_task tool (depth limit, authority check) | `packages/ai/src/capabilities/delegation/__tests__/` |
| Eval | Subagent delegation end-to-end (mocked LLM) | `packages/ai/src/capabilities/delegation/__evals__/` |
| E2E | Admin delegerer kontrakt-opprettelse via Arena | `apps/e2e/agent-harness/` |

---

## Success Criteria

### Fase 1

- [ ] Hook registry kjorer 7 hooks uten merkbar latency (<5ms overhead)
- [ ] Context Engine holder samtaler innenfor token-budget (12K default)
- [ ] Session event log muliggjor state-rekonstruksjon etter restart
- [ ] Budget guard blokkerer nar grenser nas
- [ ] SessionLane forhindrer race conditions i concurrent requests
- [ ] Alle eksisterende tester passerer (ingen regresjoner)

### Fase 2

- [ ] Admin kan si "Lag kontrakter for alle nyanstaatte" og se subagenter spawne
- [ ] Subagenter kjorer isolert (eget context, egne tools)
- [ ] Resultater aggregeres tilbake til parent session
- [ ] Depth limit forhindrer uendelig nesting
- [ ] Authority-modellen styrer hvem som kan delegere

### Fase 3

- [ ] AgentsView viser real-time status for aktive subagenter
- [ ] Orb "working" glyph animerer nar subagenter er aktive
- [ ] Tab badge viser antall aktive subagenter
- [ ] WebSocket events oppdaterer UI uten polling

---

## Risks & Mitigations

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|--------------|------------|------------|
| Hook-overhead forsinker responstid | Lav | Medium | Hooks er async, observe-type hooks kjorer fire-and-forget |
| Context compaction mister viktig info | Medium | Hoy | Non-compactable priority for kritisk context. Logg hva som komprimeres. |
| Subagent-kostnader eskalerer | Medium | Medium | Budget guard per session + workspace-level token cap |
| Race conditions i subagent completion | Lav | Medium | SessionLane + idempotency pa events |
| Uendelig delegering | Lav | Hoy | Hard depth limit (2) + delegation count per session |

---

## Telemetry Events (council R2)

Register in `packages/telemetry/src/registry.ts`:

| Event | Destinations | Trigger |
|-------|-------------|---------|
| `agent.hook_blocked` | PostHog, activity_trail | Guard hook blocks pipeline |
| `agent.context_compacted` | PostHog | Context Engine runs compaction |
| `agent.subagent_spawned` | PostHog, activity_trail | delegate_task creates child session |
| `agent.subagent_completed` | PostHog, activity_trail | Subagent finishes successfully |
| `agent.subagent_failed` | PostHog, activity_trail, Logger | Subagent fails or times out |
| `agent.budget_exhausted` | PostHog, activity_trail | Budget guard blocks session |

**Telemetry path:** The `telemetry-observer` builtin hook calls `emit()` from
`@smartout/telemetry` (CLAUDE.md mandate), NOT `emitGuardianEvent()`.
Guardian-bus remains for WebSocket broadcasting to UI. These are separate concerns:
emit() = analytics/audit, guardian-bus = live UI updates.

---

## ADR Required

**ADR-0083: Agent Harness Foundation** — documents this extension to ADR-0042
(Agent Architecture). Covers: hook registry, context engine, session durability,
subagent delegation. To be written at implementation start.

---

## Non-Goals (eksplisitte avgrensninger)

- Denne specen endrer IKKE Ultravox-integrasjonen
- Denne specen endrer IKKE capability registry i @smartout/ai (bare legger til)
- Denne specen endrer IKKE authority-tabellen (bruker eksisterende)
- Denne specen endrer IKKE frontend build eller deploy pipeline
- Denne specen introduserer IKKE ny ekstern avhengighet (bruker eksisterende Vercel AI SDK, Hono, Supabase)
