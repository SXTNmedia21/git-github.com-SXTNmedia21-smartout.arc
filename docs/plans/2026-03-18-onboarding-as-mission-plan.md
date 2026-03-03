---
title: "Onboarding as Mission — Implementation Plan"
status: draft
updated: 2026-03-18
created: 2026-03-18
module: onboarding
tags: [stage-engine, websocket, agent, mission, journey, ui-interaction]
---

# Onboarding as Mission — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect missions to journeys so the agent always knows the user's path, add WebSocket communication between Stage Engine and frontend, and build UI interaction tools so the agent can drive and react to UI elements during any mission. Onboarding is the first consumer.

**Architecture:** Mission ↔ Journey link via FK. WebSocket on Stage Engine (Hono + @hono/node-ws). UI capability with 5 tools that broadcast typed events. Frontend hook consumes events and reports user actions back. See `docs/plans/2026-03-18-onboarding-as-mission-design.md`.

**Tech Stack:** Hono 4.7 + @hono/node-ws, TypeScript strict, Zod, Supabase migrations, packages/types for shared protocol, packages/ai for capability, React hooks for frontend.

---

### Task 1: Schema Migration — Link Missions to Journeys

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_mission_journey_link.sql`

**Step 1: Write the migration**

```sql
-- Link missions to journeys, stages to steps.
-- A mission references a journey (the user's path).
-- A stage references a journey step (what the user does at that point).

ALTER TABLE engine_missions
  ADD COLUMN journey_id uuid REFERENCES journey(journey_id) ON DELETE SET NULL;

ALTER TABLE engine_stages
  ADD COLUMN journey_step_id uuid REFERENCES journey_step(journey_step_id) ON DELETE SET NULL;

COMMENT ON COLUMN engine_missions.journey_id IS 'The user journey this mission follows. Agent loads journey steps as its roadmap.';
COMMENT ON COLUMN engine_stages.journey_step_id IS 'The journey step this stage corresponds to. Gives agent screen, component, action, expects.';

-- Index for lookup
CREATE INDEX idx_engine_missions_journey ON engine_missions(journey_id) WHERE journey_id IS NOT NULL;
CREATE INDEX idx_engine_stages_journey_step ON engine_stages(journey_step_id) WHERE journey_step_id IS NOT NULL;
```

**Step 2: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 3: Commit**

```bash
git add supabase/migrations/*_mission_journey_link.sql packages/supabase/src/database.types.ts
git commit -m "feat(engine): link missions to journeys, stages to steps

Adds journey_id FK on engine_missions and journey_step_id FK on
engine_stages so the agent can load the user's path as its roadmap."
```

---

### Task 2: Shared Protocol Types

**Files:**

- Create: `packages/types/src/mission-protocol.ts`
- Modify: `packages/types/src/index.ts` (add re-export)

**Step 1: Create the protocol types file**

```typescript
// packages/types/src/mission-protocol.ts
// WebSocket protocol types shared between Stage Engine and frontend.
// Connected to: services/stage-engine/src/ws/ (server side)
// Connected to: apps/web/src/hooks/useJourneySocket.ts (client side)

import { z } from "zod";

// ── Agent → Frontend ─────────────────────────────────────

export const UICommandSchema = z.object({
  type: z.literal("ui_command"),
  sessionId: z.string(),
  command: z.discriminatedUnion("action", [
    z.object({ action: z.literal("navigate"), target: z.string() }),
    z.object({
      action: z.literal("highlight"),
      target: z.string(),
      duration: z.number().optional(),
    }),
    z.object({ action: z.literal("fill_field"), field: z.string(), value: z.string() }),
    z.object({
      action: z.literal("show_panel"),
      panel: z.string(),
      data: z.record(z.unknown()).optional(),
    }),
    z.object({ action: z.literal("hide_panel"), panel: z.string() }),
    z.object({
      action: z.literal("toast"),
      message: z.string(),
      variant: z.enum(["info", "success", "warning"]).optional(),
    }),
    z.object({
      action: z.literal("custom"),
      name: z.string(),
      payload: z.record(z.unknown()),
    }),
  ]),
  timestamp: z.number(),
});
export type UICommand = z.infer<typeof UICommandSchema>;

// ── Frontend → Agent ─────────────────────────────────────

export const UserActionSchema = z.object({
  type: z.literal("user_action"),
  sessionId: z.string(),
  action: z.discriminatedUnion("event", [
    z.object({ event: z.literal("field_changed"), field: z.string(), value: z.string() }),
    z.object({ event: z.literal("step_entered"), stepOrder: z.number(), screen: z.string() }),
    z.object({ event: z.literal("button_clicked"), button: z.string() }),
    z.object({
      event: z.literal("form_submitted"),
      form: z.string(),
      data: z.record(z.unknown()),
    }),
    z.object({
      event: z.literal("custom"),
      name: z.string(),
      payload: z.record(z.unknown()),
    }),
  ]),
  timestamp: z.number(),
});
export type UserAction = z.infer<typeof UserActionSchema>;

// ── System Events ────────────────────────────────────────

export const SystemEventSchema = z.object({
  type: z.enum(["session_state", "agent_typing", "error", "journey_progress"]),
  sessionId: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.number(),
});
export type SystemEvent = z.infer<typeof SystemEventSchema>;

// ── Union for parsing incoming WebSocket messages ────────

export const MissionProtocolMessage = z.discriminatedUnion("type", [
  UICommandSchema,
  UserActionSchema,
  SystemEventSchema,
]);
export type MissionProtocolMessage = z.infer<typeof MissionProtocolMessage>;
```

**Step 2: Add re-export to barrel**

In `packages/types/src/index.ts`, add:

```typescript
export * from "./mission-protocol";
```

**Step 3: Commit**

```bash
git add packages/types/src/mission-protocol.ts packages/types/src/index.ts
git commit -m "feat(types): add mission protocol types for agent-UI WebSocket

Shared types for UICommand, UserAction, SystemEvent used by
Stage Engine (server) and frontend (client) WebSocket communication."
```

---

### Task 3: Install @hono/node-ws

**Files:**

- Modify: `services/stage-engine/package.json`

**Step 1: Install the package**

Run: `cd services/stage-engine && pnpm add @hono/node-ws`

**Step 2: Verify it installed**

Run: `grep node-ws services/stage-engine/package.json`
Expected: `"@hono/node-ws": "^1.x.x"`

**Step 3: Commit**

```bash
git add services/stage-engine/package.json pnpm-lock.yaml
git commit -m "chore(stage-engine): add @hono/node-ws for WebSocket support"
```

---

### Task 4: Connection Manager

**Files:**

- Create: `services/stage-engine/src/ws/connection-manager.ts`

**Step 1: Write the connection manager**

```typescript
// services/stage-engine/src/ws/connection-manager.ts
// Manages WebSocket connections per session.
// Supports broadcasting events to all connections on a session.
// Connected to: src/routes/ws.ts (registers connections)
// Connected to: packages/ai/src/capabilities/ui/ (tools broadcast via this)

import type { WSContext } from "hono/ws";
import type { MissionProtocolMessage } from "@smartout/types";

const connections = new Map<string, Set<WSContext>>();

/** Register a WebSocket connection for a session */
export function addConnection(sessionId: string, ws: WSContext): void {
  if (!connections.has(sessionId)) {
    connections.set(sessionId, new Set());
  }
  connections.get(sessionId)!.add(ws);
  console.log(
    `[ws] Connection added for session ${sessionId} (total: ${connections.get(sessionId)!.size})`,
  );
}

/** Remove a WebSocket connection */
export function removeConnection(sessionId: string, ws: WSContext): void {
  const set = connections.get(sessionId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      connections.delete(sessionId);
    }
    console.log(`[ws] Connection removed for session ${sessionId}`);
  }
}

/** Broadcast an event to all connections on a session */
export function broadcastToSession(sessionId: string, event: MissionProtocolMessage): void {
  const set = connections.get(sessionId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify(event);
  for (const ws of set) {
    try {
      ws.send(payload);
    } catch {
      // Connection dead — will be cleaned up on close
    }
  }
}

/** Check if a session has any active connections */
export function hasConnections(sessionId: string): boolean {
  const set = connections.get(sessionId);
  return set !== undefined && set.size > 0;
}

/** Get count of connections for a session */
export function getConnectionCount(sessionId: string): number {
  return connections.get(sessionId)?.size ?? 0;
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/ws/connection-manager.ts
git commit -m "feat(stage-engine): add WebSocket connection manager

In-memory Map<sessionId, Set<WSContext>> with broadcast support.
Used by UI capability tools to push events to frontend."
```

---

### Task 5: WebSocket Route

**Files:**

- Create: `services/stage-engine/src/routes/ws.ts`
- Modify: `services/stage-engine/src/index.ts` (register route, wire up node-ws)

**Step 1: Create the WebSocket route**

```typescript
// services/stage-engine/src/routes/ws.ts
// WebSocket endpoint for bidirectional agent-UI communication.
// Frontend connects with JWT token as query param.
// Connected to: src/ws/connection-manager.ts
// Connected to: src/middleware/auth.ts (reuses validateJwt logic)

import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { createNodeWebSocket } from "@hono/node-ws";
import { addConnection, removeConnection } from "../ws/connection-manager.js";
import { getSession } from "../core/session-manager.js";
import { createUserClient } from "../lib/supabase.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { UserActionSchema } from "@smartout/types";

// Buffer of user actions per session, drained by agent on next turn
const userActionBuffer = new Map<string, Array<{ action: unknown; timestamp: number }>>();

export function getBufferedActions(
  sessionId: string,
): Array<{ action: unknown; timestamp: number }> {
  const actions = userActionBuffer.get(sessionId) ?? [];
  userActionBuffer.delete(sessionId);
  return actions;
}

export function createWsRoute(
  upgradeWebSocket: ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"],
) {
  const ws = new Hono();

  ws.get(
    "/ws/:sessionId",
    upgradeWebSocket((c) => {
      const sessionId = c.req.param("sessionId");

      return {
        async onOpen(_event, wsCtx) {
          // Validate auth — JWT in query param
          const token = c.req.query("token");
          if (!token) {
            wsCtx.close(4001, "Missing token");
            return;
          }

          // Validate JWT
          const client = createUserClient(token);
          const {
            data: { user },
            error,
          } = await client.auth.getUser();
          if (error || !user) {
            wsCtx.close(4001, "Invalid token");
            return;
          }

          // Validate session exists and belongs to user's workspace
          const session = await getSession(sessionId);
          if (!session) {
            wsCtx.close(4004, "Session not found");
            return;
          }

          // Check user has access to this workspace
          const { data: profile } = await supabaseAdmin
            .from("profile")
            .select("workspace_id")
            .eq("user_id", user.id)
            .eq("workspace_id", session.workspace_id)
            .eq("is_active", true)
            .limit(1)
            .single();

          if (!profile) {
            wsCtx.close(4003, "Forbidden");
            return;
          }

          addConnection(sessionId, wsCtx);
        },

        onMessage(event, wsCtx) {
          try {
            const raw = typeof event.data === "string" ? event.data : event.data.toString();
            const parsed = JSON.parse(raw);

            // Validate as UserAction
            const result = UserActionSchema.safeParse(parsed);
            if (result.success) {
              // Buffer for agent's next turn
              if (!userActionBuffer.has(sessionId)) {
                userActionBuffer.set(sessionId, []);
              }
              userActionBuffer.get(sessionId)!.push({
                action: result.data.action,
                timestamp: result.data.timestamp,
              });
            }
          } catch {
            // Ignore malformed messages
          }
        },

        onClose(_event, wsCtx) {
          removeConnection(sessionId, wsCtx);
        },
      };
    }),
  );

  return ws;
}
```

**Step 2: Wire up in index.ts**

Replace the `serve()` call and add the WebSocket route. Key changes to `services/stage-engine/src/index.ts`:

1. Import `createNodeWebSocket` from `@hono/node-ws`
2. Create WebSocket instance with `createNodeWebSocket({ app })`
3. Register ws route (BEFORE auth middleware for `/ws/` path)
4. Use `injectWebSocket` on the server

```typescript
// Add these imports at top:
import { createNodeWebSocket } from "@hono/node-ws";
import { createWsRoute } from "./routes/ws.js";

// After creating app:
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Add skip for /ws in auth middleware (WebSocket auth is handled in the route):
// Before app.use("*", authMiddleware), add:
app.use("/ws/*", async (c, next) => next()); // WS auth handled in route handler

// Register WebSocket route BEFORE other routes:
app.route("/", createWsRoute(upgradeWebSocket));

// Change serve() to capture server reference:
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stage Engine running on port ${info.port}`);
});

// Inject WebSocket handler:
injectWebSocket(server);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/routes/ws.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add WebSocket route for agent-UI communication

GET /ws/:sessionId upgrades to WebSocket. Auth via JWT query param.
Validates session ownership. Buffers user actions for agent's next turn."
```

---

### Task 6: UI Capability — Tools That Broadcast

**Files:**

- Create: `packages/ai/src/capabilities/ui/index.ts`
- Create: `packages/ai/src/capabilities/ui/tools.ts`
- Modify: `packages/ai/src/capabilities/types.ts` (add "ui" to CapabilityName)
- Modify: `packages/ai/src/capabilities/registry.ts` (register ui capability)

**Step 1: Add "ui" to CapabilityName**

In `packages/ai/src/capabilities/types.ts`, update the union:

```typescript
export type CapabilityName =
  | "knowledge"
  | "schedule"
  | "training"
  | "operations"
  | "profile"
  | "communication"
  | "memory"
  | "payroll"
  | "ui";
```

**Step 2: Create UI tools**

The tools need access to the `broadcastToSession` function. Since `packages/ai` shouldn't depend on `services/stage-engine`, the tools return a structured command string. The Stage Engine's agent router intercepts the return value and broadcasts it.

Alternative approach: extend `AgentToolContext` with a `broadcast` callback that the Stage Engine provides when setting up tools.

```typescript
// packages/ai/src/capabilities/ui/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// Extended context — Stage Engine provides the broadcast callback
export type UIToolContext = AgentToolContext & {
  broadcast?: (event: unknown) => void;
};

export const navigateTool = defineTool({
  name: "navigate_to",
  description:
    "Navigate the user's screen to a specific section or step. Use when the user should move to a different part of the interface.",
  schema: z.object({
    target: z
      .string()
      .describe("The section or step ID to navigate to, e.g. 'departments', 'season'"),
  }),
  execute: async ({ target }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "navigate", target },
      timestamp: Date.now(),
    });
    return `Navigated to ${target}`;
  },
});

export const fillFieldTool = defineTool({
  name: "fill_field",
  description:
    "Fill a form field on the user's screen with a value. Use when you have information to populate into the UI.",
  schema: z.object({
    field: z.string().describe("The field name to fill, e.g. 'businessName', 'orgNumber'"),
    value: z.string().describe("The value to set"),
  }),
  execute: async ({ field, value }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "fill_field", field, value },
      timestamp: Date.now(),
    });
    return `Set ${field} to "${value}"`;
  },
});

export const highlightTool = defineTool({
  name: "highlight_element",
  description:
    "Highlight a UI element to draw the user's attention. Use to guide the user visually.",
  schema: z.object({
    target: z.string().describe("CSS selector or element ID to highlight"),
    duration: z.number().optional().describe("Duration in milliseconds (default: 3000)"),
  }),
  execute: async ({ target, duration }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "highlight", target, duration },
      timestamp: Date.now(),
    });
    return `Highlighted ${target}`;
  },
});

export const showPanelTool = defineTool({
  name: "show_panel",
  description:
    "Show a UI panel with data. Use for key facts, help text, or contextual information.",
  schema: z.object({
    panel: z.string().describe("Panel name, e.g. 'keyFacts', 'help', 'contract'"),
    data: z.record(z.unknown()).optional().describe("Data to display in the panel"),
  }),
  execute: async ({ panel, data }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "show_panel", panel, data },
      timestamp: Date.now(),
    });
    return `Showed panel ${panel}`;
  },
});

export const toastTool = defineTool({
  name: "show_toast",
  description: "Show a brief notification message on the user's screen.",
  schema: z.object({
    message: z.string().describe("The notification text"),
    variant: z
      .enum(["info", "success", "warning"])
      .optional()
      .describe("Toast style (default: info)"),
  }),
  execute: async ({ message, variant }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "toast", message, variant },
      timestamp: Date.now(),
    });
    return `Showed toast: "${message}"`;
  },
});
```

**Step 3: Create UI capability definition**

```typescript
// packages/ai/src/capabilities/ui/index.ts
import type { CapabilityDefinition } from "../types.js";
import { navigateTool, fillFieldTool, highlightTool, showPanelTool, toastTool } from "./tools.js";

export const uiCapability: CapabilityDefinition = {
  name: "ui",
  description:
    "Interact with the user's screen: navigate, fill forms, highlight elements, show panels, send notifications",
  tools: [
    navigateTool as never,
    fillFieldTool as never,
    highlightTool as never,
    showPanelTool as never,
    toastTool as never,
  ],
  readOnlyTools: [],
};
```

**Step 4: Register in capability registry**

In `packages/ai/src/capabilities/registry.ts`, add:

```typescript
import { uiCapability } from "./ui/index.js";

const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  ui: uiCapability,
};
```

**Step 5: Commit**

```bash
git add packages/ai/src/capabilities/ui/ packages/ai/src/capabilities/types.ts packages/ai/src/capabilities/registry.ts
git commit -m "feat(ai): add UI capability with 5 tools for agent-UI interaction

navigate_to, fill_field, highlight_element, show_panel, show_toast.
Tools broadcast UICommand events via context callback.
Registered in capability registry alongside profile."
```

---

### Task 7: Wire Broadcast Into Agent Router

**Files:**

- Modify: `services/stage-engine/src/core/agent-router.ts`

**Step 1: Inject broadcast into tool context**

When `routeAgentMessage` builds tool context, add the `broadcast` callback that routes through the connection manager:

```typescript
import { broadcastToSession } from "../ws/connection-manager.js";

// In routeAgentMessage, when building toolContext (before toVercelTools):
const toolContext = {
  workspaceId: input.workspaceId,
  profileId: input.profileId,
  userId: input.userId,
  sessionId: input.sessionId,
  supabaseAdmin,
  broadcast: (event: unknown) =>
    broadcastToSession(input.sessionId, event as MissionProtocolMessage),
};
```

**Step 2: Inject buffered user actions into conversation context**

```typescript
import { getBufferedActions } from "../routes/ws.js";

// In routeAgentMessage, after collecting context:
const bufferedActions = getBufferedActions(input.sessionId);
if (bufferedActions.length > 0) {
  // Inject as system context so the agent knows what the user did
  const actionSummary = bufferedActions.map((a) => JSON.stringify(a.action)).join(", ");
  // Prepend to the user message or add as system context
  input.message = `[UI events since last turn: ${actionSummary}]\n\n${input.message}`;
}
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts
git commit -m "feat(stage-engine): wire broadcast and user actions into agent router

Agent tools can now broadcast UICommand events to frontend.
Buffered user actions injected as context into agent's next turn."
```

---

### Task 8: Load Journey Data With Mission

**Files:**

- Modify: `services/stage-engine/src/core/session-manager.ts`
- Modify: `services/stage-engine/src/core/stage-manager.ts`

**Step 1: Extend loadMission to include journey data**

In `session-manager.ts`, update `loadMission()`:

```typescript
export async function loadMission(missionId: string) {
  // ... existing mission + stages query ...

  // If mission has a linked journey, load it with steps
  let journey = null;
  let journeySteps: JourneyStep[] = [];

  if (mission.journey_id) {
    const { data: j } = await supabaseAdmin
      .from("journey")
      .select("*")
      .eq("journey_id", mission.journey_id)
      .single();

    if (j) {
      journey = j;
      const { data: steps } = await supabaseAdmin
        .from("journey_step")
        .select("*")
        .eq("journey_id", j.journey_id)
        .order("step_order", { ascending: true });
      journeySteps = steps ?? [];
    }
  }

  return { mission, stages, journey, journeySteps };
}
```

**Step 2: Include journey step context in stage prompt**

In `stage-manager.ts`, when building the stage prompt, include the linked journey step data:

```typescript
// In advanceStage or wherever buildStagePrompt is called:
if (stage.journey_step_id && journeySteps.length > 0) {
  const linkedStep = journeySteps.find((s) => s.journey_step_id === stage.journey_step_id);
  if (linkedStep) {
    // Add to stage context so the agent knows the user's expected action
    stageContext.journeyStep = {
      action: linkedStep.action,
      expects: linkedStep.expects,
      screen: linkedStep.screen,
      component: linkedStep.component,
      dataReads: linkedStep.data_reads,
      dataWrites: linkedStep.data_writes,
    };
  }
}
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts services/stage-engine/src/core/stage-manager.ts
git commit -m "feat(stage-engine): load journey data with mission

loadMission() now returns journey + journeySteps when linked.
Stage prompt includes journey step context (screen, action, expects)."
```

---

### Task 9: Onboarding Mission Seed Data

**Files:**

- Create: `supabase/seed/onboarding-mission.sql`

**Step 1: Write the seed data**

This inserts the onboarding mission and its 6 stages into `engine_missions` and `engine_stages`. The `journey_id` and `journey_step_id` values must be filled in after the onboarding journey exists in the journey table (they can be NULL initially).

```sql
-- Onboarding mission: 6 stages, sequential mode
-- Linked to the onboarding journey once it exists in journey table.

INSERT INTO engine_missions (id, name, description, mode, is_active)
VALUES (
  'onboarding-workspace',
  'Workspace Onboarding',
  'Guides a new admin through workspace creation: business info, branding, season, structure, operations, activation.',
  'sequential',
  true
) ON CONFLICT (id) DO NOTHING;

-- Stage 1: Hero / Welcome
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, personality_override, creative_freedom, next_stage)
VALUES (
  'onboarding-workspace', 'hero', 1,
  'Greet the user warmly and explain the onboarding process',
  'Welcome them to Smartout. Explain that you will guide them through setting up their workspace. Be warm, enthusiastic, and reassuring. Mention that they can speak or type.',
  'User has acknowledged and is ready to begin',
  '{"warmth": 0.9, "formality": 0.3, "humor": 0.4}',
  0.5,
  'business'
);

-- Stage 2: Business Info
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, personality_override, creative_freedom, next_stage)
VALUES (
  'onboarding-workspace', 'business', 2,
  'Collect company information: name, org number, website, industry',
  'Ask for their company name first. Offer to scan their website or look up their org number in Brønnøysund. Use fill_field to populate the form as you learn information. Use show_panel("keyFacts") to display confirmed facts. Be data-focused but warm.',
  'Company name, org number, and industry are filled',
  '{"warmth": 0.7, "assertiveness": 0.5}',
  0.4,
  'branding'
);

-- Stage 3: Branding + Season Education
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, personality_override, creative_freedom, next_stage)
VALUES (
  'onboarding-workspace', 'branding', 3,
  'Configure branding and introduce the Seasons concept',
  'Help them set up branding (logo, colors, tone). Then explain what Seasons are in Smartout — time periods that wrap operations, gamification, and revenue planning. Make it clear and simple. Use navigate_to to move between branding and season sections.',
  'Branding configured and user understands Seasons',
  '{"warmth": 0.8, "verbosity": 0.6}',
  0.5,
  'structure'
);

-- Stage 4: Organizational Structure
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, personality_override, creative_freedom, next_stage)
VALUES (
  'onboarding-workspace', 'structure', 4,
  'Set up season, departments, teams, and locations',
  'Guide them through creating their first season, then departments, teams, and locations. Use fill_field to help populate forms. Suggest sensible defaults based on their industry. Navigate between sections as needed.',
  'At least 1 season, 1 department created',
  '{"assertiveness": 0.6, "warmth": 0.6}',
  0.3,
  'operations'
);

-- Stage 5: Operations
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, personality_override, creative_freedom, next_stage)
VALUES (
  'onboarding-workspace', 'operations', 5,
  'Create operational procedures and review all configuration',
  'Help create key procedures (opening, closing, cleaning, etc.). Then navigate to the review step where they can see everything configured. Use show_panel to display summaries.',
  'At least 1 procedure created and review step visited',
  '{"assertiveness": 0.7, "formality": 0.4}',
  0.3,
  'activation'
);

-- Stage 6: Activation
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, personality_override, creative_freedom, next_stage)
VALUES (
  'onboarding-workspace', 'activation', 6,
  'Activate workspace and invite team members',
  'Guide them to click "Activate Workspace". Celebrate the moment! Then help them invite team members via email, SMS, or link. Use show_toast for celebration messages. Offer to help with anything else.',
  'Workspace activated',
  '{"warmth": 0.95, "humor": 0.5}',
  0.6,
  NULL
);
```

**Step 2: Run seed**

Run: `psql $DATABASE_URL -f supabase/seed/onboarding-mission.sql`
Or via the Supabase dashboard SQL editor.

**Step 3: Commit**

```bash
git add supabase/seed/onboarding-mission.sql
git commit -m "feat(engine): add onboarding mission seed data

6 stages: hero, business, branding, structure, operations, activation.
Sequential mode. journey_id/journey_step_id to be linked once journey exists."
```

---

### Task 10: Frontend Hook — useJourneySocket

**Files:**

- Create: `apps/web/src/hooks/useJourneySocket.ts`

**Step 1: Write the generic WebSocket hook**

```typescript
// apps/web/src/hooks/useJourneySocket.ts
// Generic hook for WebSocket communication with Stage Engine.
// Connects to /ws/:sessionId, receives UICommands, sends UserActions.
// Connected to: packages/types/src/mission-protocol.ts
// Connected to: services/stage-engine/src/routes/ws.ts

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { UICommand, UserAction } from "@smartout/types";

type UseJourneySocketOptions = {
  sessionId: string;
  token: string;
  stageEngineUrl?: string;
  onCommand?: (command: UICommand) => void;
};

type UseJourneySocketReturn = {
  sendAction: (action: UserAction["action"]) => void;
  isConnected: boolean;
  lastCommand: UICommand | null;
};

export function useJourneySocket({
  sessionId,
  token,
  stageEngineUrl = "ws://localhost:3000",
  onCommand,
}: UseJourneySocketOptions): UseJourneySocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastCommand, setLastCommand] = useState<UICommand | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (!sessionId || !token) return;

    const url = `${stageEngineUrl}/ws/${sessionId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ui_command") {
          setLastCommand(data as UICommand);
          onCommandRef.current?.(data as UICommand);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, token, stageEngineUrl]);

  const sendAction = useCallback(
    (action: UserAction["action"]) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const message: UserAction = {
        type: "user_action",
        sessionId,
        action,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    },
    [sessionId],
  );

  return { sendAction, isConnected, lastCommand };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/useJourneySocket.ts
git commit -m "feat(web): add useJourneySocket hook for agent-UI WebSocket

Generic hook connecting to Stage Engine WebSocket. Receives UICommands,
sends UserActions. Reusable by any mission-driven UI page."
```

---

### Task 11: Typecheck

**Step 1: Run typecheck**

Run: `pnpm turbo typecheck`

Expected: 0 errors. Fix any issues.

**Step 2: Run lint**

Run: `pnpm lint`

Expected: No new warnings. Fix any issues from changed files.

**Step 3: Commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues from mission-journey implementation"
```

---

## Summary

| Task | What                             | Files                                    |
| ---- | -------------------------------- | ---------------------------------------- |
| 1    | Schema: mission → journey FK     | Migration SQL                            |
| 2    | Shared protocol types            | packages/types                           |
| 3    | Install @hono/node-ws            | package.json                             |
| 4    | Connection manager               | stage-engine/src/ws/                     |
| 5    | WebSocket route                  | stage-engine/src/routes/ws.ts + index.ts |
| 6    | UI capability + 5 tools          | packages/ai/src/capabilities/ui/         |
| 7    | Wire broadcast into agent router | stage-engine/src/core/agent-router.ts    |
| 8    | Load journey data with mission   | session-manager.ts + stage-manager.ts    |
| 9    | Onboarding mission seed data     | supabase/seed/                           |
| 10   | Frontend useJourneySocket hook   | apps/web/src/hooks/                      |
| 11   | Typecheck + lint                 | Verify everything compiles               |

**Total: 11 tasks, 11 commits. Foundation for agent-UI interaction.**

After this, the next phase is integrating the hook into the actual onboarding page (bridging `useJourneySocket` with `WizardContext` + section components). That's a separate plan.
