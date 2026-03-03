---
title: "Guardian v1 Implementation Plan"
status: approved
updated: 2026-03-14
created: 2026-03-14
module: ai
tags: [guardian, plan, implementation]
---

# Guardian v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time session monitoring dashboard that watches every stage engine conversation, logs events, and lets admins intervene (change stages, whisper to agent).

**Architecture:** WebSocket from stage engine → dashboard. Guardian event bus inside stage engine broadcasts lifecycle events to connected admin clients. Events also persisted to `guardian_log` table. Dashboard subscribes and renders live feed with interactive controls.

**Tech Stack:** Hono.js + `ws` (WebSocket), Supabase (persistence), Next.js App Router, TanStack Query, shadcn/ui, Tailwind v4 CSS vars

**Design doc:** `docs/plans/2026-03-14-guardian-v1-design.md`

---

## Task 1: guardian_log DB migration

**Files:**

- Create: `supabase/migrations/20260314100000_guardian_log.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerated)

**Step 1: Create migration file**

```sql
-- supabase/migrations/20260314100000_guardian_log.sql
-- Guardian event log — persists all events from the Guardian event bus.
-- Used for history/replay and as fallback when WebSocket is disconnected.

CREATE TABLE guardian_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  session_id      UUID NOT NULL,
  event_type      TEXT NOT NULL,
  actor           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  data            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session event feed (primary query)
CREATE INDEX idx_guardian_log_session
  ON guardian_log (session_id, created_at);

-- Workspace-wide recent events (dashboard list)
CREATE INDEX idx_guardian_log_workspace
  ON guardian_log (workspace_id, created_at DESC);

-- RLS
ALTER TABLE guardian_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view logs" ON guardian_log
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "Service can manage logs" ON guardian_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

**Step 2: Apply migration and regenerate types**

Run:

```bash
cd /home/sxtnl/dev/wt-1
npx supabase db reset
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 3: Verify types contain guardian_log**

Run: `grep "guardian_log" packages/supabase/src/database.types.ts`
Expected: Row/Insert/Update types for guardian_log

**Step 4: Commit**

```bash
git add supabase/migrations/20260314100000_guardian_log.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add guardian_log table for real-time event persistence"
```

---

## Task 2: Install ws dependency

**Files:**

- Modify: `services/stage-engine/package.json`

**Step 1: Install ws**

Run:

```bash
cd /home/sxtnl/dev/wt-1
pnpm --filter @smartout/stage-engine add ws
pnpm --filter @smartout/stage-engine add -D @types/ws
```

**Step 2: Verify package.json updated**

Run: `grep "ws" services/stage-engine/package.json`
Expected: `"ws": "^8.x.x"` in dependencies, `"@types/ws"` in devDependencies

**Step 3: Commit**

```bash
git add services/stage-engine/package.json pnpm-lock.yaml
git commit -m "feat(stage-engine): add ws dependency for Guardian WebSocket"
```

---

## Task 3: Guardian event bus

The in-process event bus that manages WebSocket connections and broadcasts events.

**Files:**

- Create: `services/stage-engine/src/core/guardian-bus.ts`
- Create: `services/stage-engine/src/types/guardian.ts`

**Step 1: Create guardian types**

```typescript
// services/stage-engine/src/types/guardian.ts

/** Event broadcast from engine to dashboard */
export type GuardianEvent = {
  type: "event";
  session_id: string;
  workspace_id: string;
  event_type: string;
  actor: "system" | "agent" | "user" | "guardian" | "admin";
  summary: string;
  data: Record<string, unknown>;
  timestamp: string;
};

/** Active session summary sent on connect / periodically */
export type GuardianSessionList = {
  type: "sessions";
  sessions: Array<{
    session_id: string;
    mission_id: string | null;
    profile_name: string;
    channel: string;
    status: string;
    current_stage: string | null;
    started_at: string;
  }>;
};

/** Command from dashboard to engine */
export type GuardianCommand =
  | { type: "subscribe"; session_id: string }
  | { type: "unsubscribe"; session_id: string }
  | { type: "change_stage"; session_id: string; target_stage_id: string }
  | { type: "whisper"; session_id: string; message: string };

/** Messages sent from server to client */
export type GuardianServerMessage = GuardianEvent | GuardianSessionList;
```

**Step 2: Create guardian-bus.ts**

```typescript
// services/stage-engine/src/core/guardian-bus.ts

import type { WebSocket } from "ws";
import { supabaseAdmin } from "../lib/supabase.js";
import type { GuardianEvent, GuardianServerMessage } from "../types/guardian.js";

type ClientInfo = {
  ws: WebSocket;
  workspaceId: string;
  subscribedSessions: Set<string>;
};

const clients: Set<ClientInfo> = new Set();

/**
 * Register a new WebSocket client for a workspace.
 */
export function addClient(ws: WebSocket, workspaceId: string): ClientInfo {
  const client: ClientInfo = { ws, workspaceId, subscribedSessions: new Set() };
  clients.add(client);
  return client;
}

/**
 * Remove a disconnected client.
 */
export function removeClient(client: ClientInfo): void {
  clients.delete(client);
}

/**
 * Subscribe a client to events for a specific session.
 */
export function subscribeSession(client: ClientInfo, sessionId: string): void {
  client.subscribedSessions.add(sessionId);
}

/**
 * Unsubscribe a client from a session.
 */
export function unsubscribeSession(client: ClientInfo, sessionId: string): void {
  client.subscribedSessions.delete(sessionId);
}

/**
 * Emit a guardian event. Broadcasts to subscribed WebSocket clients
 * and persists to guardian_log (async, non-blocking).
 */
export function emitGuardianEvent(event: Omit<GuardianEvent, "type" | "timestamp">): void {
  const fullEvent: GuardianEvent = {
    ...event,
    type: "event",
    timestamp: new Date().toISOString(),
  };

  // Broadcast to subscribed clients
  for (const client of clients) {
    if (client.workspaceId !== event.workspace_id) continue;

    // Send if client subscribes to this session OR has no subscriptions (gets all)
    if (client.subscribedSessions.size === 0 || client.subscribedSessions.has(event.session_id)) {
      send(client.ws, fullEvent);
    }
  }

  // Persist to guardian_log (fire-and-forget)
  persistEvent(fullEvent).catch((err) => {
    console.error("[guardian-bus] Failed to persist event:", err);
  });
}

/**
 * Send active sessions list to a client.
 */
export async function sendSessionList(client: ClientInfo): Promise<void> {
  const { data: sessions } = await supabaseAdmin
    .from("engine_sessions")
    .select("id, mission_id, channel, status, current_stage_id, created_at, context")
    .eq("workspace_id", client.workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!sessions) return;

  const msg: GuardianServerMessage = {
    type: "sessions",
    sessions: sessions.map((s) => ({
      session_id: s.id,
      mission_id: s.mission_id,
      profile_name: (s.context as Record<string, unknown>)?.profile
        ? ((s.context as Record<string, Record<string, string>>).profile.first_name ?? "Unknown")
        : "Unknown",
      channel: s.channel ?? "unknown",
      status: s.status,
      current_stage: s.current_stage_id,
      started_at: s.created_at,
    })),
  };

  send(client.ws, msg);
}

/** Helper: send JSON to WebSocket */
function send(ws: WebSocket, msg: GuardianServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/** Persist event to guardian_log table */
async function persistEvent(event: GuardianEvent): Promise<void> {
  await supabaseAdmin.from("guardian_log").insert({
    workspace_id: event.workspace_id,
    session_id: event.session_id,
    event_type: event.event_type,
    actor: event.actor,
    summary: event.summary,
    data: event.data,
  });
}
```

**Step 3: Verify typecheck**

Run: `cd /home/sxtnl/dev/wt-1 && pnpm --filter @smartout/stage-engine typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add services/stage-engine/src/types/guardian.ts services/stage-engine/src/core/guardian-bus.ts
git commit -m "feat(stage-engine): add guardian event bus and types"
```

---

## Task 4: Guardian WebSocket endpoint

**Files:**

- Create: `services/stage-engine/src/routes/guardian.ts`
- Modify: `services/stage-engine/src/index.ts` (attach WebSocketServer)
- Modify: `services/stage-engine/src/middleware/auth.ts` (skip auth for WS upgrade — handled in WS handler)

**Step 1: Create guardian route**

```typescript
// services/stage-engine/src/routes/guardian.ts

import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { supabaseAdmin, createUserClient } from "../lib/supabase.js";
import { hashApiKey } from "../lib/crypto.js";
import {
  addClient,
  removeClient,
  subscribeSession,
  unsubscribeSession,
  sendSessionList,
  emitGuardianEvent,
} from "../core/guardian-bus.js";
import { loadAuthorizedSession } from "../core/session-manager.js";
import { advanceStage } from "../core/stage-manager.js";
import type { GuardianCommand } from "../types/guardian.js";

/**
 * Attaches the Guardian WebSocket server to the HTTP server.
 * Handles auth on upgrade, then routes commands from clients.
 */
export function attachGuardianWs(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade manually for auth
  server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (url.pathname !== "/guardian/ws") return;

    // Authenticate
    const workspaceId = await authenticateUpgrade(req.headers);
    if (!workspaceId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, workspaceId);
    });
  });

  wss.on("connection", (ws: WebSocket, workspaceId: string) => {
    const client = addClient(ws, workspaceId);
    console.log(`[guardian-ws] Client connected for workspace ${workspaceId}`);

    // Send current active sessions on connect
    sendSessionList(client);

    ws.on("message", async (raw) => {
      try {
        const cmd = JSON.parse(raw.toString()) as GuardianCommand;
        await handleCommand(cmd, workspaceId, client);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        ws.send(JSON.stringify({ type: "error", message: msg }));
      }
    });

    ws.on("close", () => {
      removeClient(client);
      console.log(`[guardian-ws] Client disconnected`);
    });
  });
}

/** Auth for WebSocket upgrade — checks x-api-key or Authorization header */
async function authenticateUpgrade(
  headers: Record<string, string | string[] | undefined>,
): Promise<string | null> {
  const apiKey = headers["x-api-key"] as string | undefined;
  const authHeader = headers["authorization"] as string | undefined;

  if (apiKey) {
    const hash = hashApiKey(apiKey);
    const { data } = await supabaseAdmin
      .from("platform_api_key")
      .select("workspace_id")
      .eq("key_hash", hash)
      .eq("version", "current")
      .single();
    return data?.workspace_id ?? null;
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const client = createUserClient(token);
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabaseAdmin
      .from("profile")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();
    return profile?.workspace_id ?? null;
  }

  return null;
}

/** Handle incoming commands from dashboard */
async function handleCommand(
  cmd: GuardianCommand,
  workspaceId: string,
  client: ReturnType<typeof addClient>,
): Promise<void> {
  switch (cmd.type) {
    case "subscribe":
      subscribeSession(client, cmd.session_id);
      break;

    case "unsubscribe":
      unsubscribeSession(client, cmd.session_id);
      break;

    case "change_stage": {
      // Load session and force-advance to target stage
      const result = await loadAuthorizedSession(cmd.session_id, {
        method: "jwt",
        workspaceId,
      });
      if (!result.ok) break;

      const advanceResult = await advanceStage(result.session, {
        next_stage_id: cmd.target_stage_id,
      });

      if (advanceResult) {
        emitGuardianEvent({
          session_id: cmd.session_id,
          workspace_id: workspaceId,
          event_type: "admin.stage_change",
          actor: "admin",
          summary: `Admin forced stage change to "${cmd.target_stage_id}"`,
          data: { target_stage_id: cmd.target_stage_id },
        });
      }
      break;
    }

    case "whisper": {
      // Store whisper in session collected_data._whispers[]
      const { data: session } = await supabaseAdmin
        .from("engine_sessions")
        .select("collected_data")
        .eq("id", cmd.session_id)
        .single();

      if (!session) break;

      const collected = (session.collected_data ?? {}) as Record<string, unknown>;
      const whispers = (collected._whispers as string[] | undefined) ?? [];
      whispers.push(cmd.message);

      await supabaseAdmin
        .from("engine_sessions")
        .update({
          collected_data: { ...collected, _whispers: whispers },
          updated_at: new Date().toISOString(),
        })
        .eq("id", cmd.session_id);

      emitGuardianEvent({
        session_id: cmd.session_id,
        workspace_id: workspaceId,
        event_type: "admin.whisper",
        actor: "admin",
        summary: "Admin whispered to agent",
        data: { message: cmd.message },
      });
      break;
    }
  }
}
```

**Step 2: Modify index.ts to attach WebSocket server**

In `services/stage-engine/src/index.ts`, change the server startup to capture the HTTP server and attach the Guardian WebSocket:

Replace the `serve()` call (line 50) and the export:

```typescript
// OLD:
// serve({ fetch: app.fetch, port }, (info) => {
//   console.log(`Stage Engine running on port ${info.port}`);
// });

// NEW:
import { attachGuardianWs } from "./routes/guardian.js";

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stage Engine running on port ${info.port}`);
});

// Attach Guardian WebSocket to the same HTTP server
attachGuardianWs(server);
```

**Step 3: Skip auth middleware for WebSocket upgrade**

In `services/stage-engine/src/middleware/auth.ts`, the WebSocket upgrade is handled by the `ws` library before Hono sees it (via the `upgrade` event on the HTTP server). No changes needed — the auth middleware only runs for HTTP requests routed through Hono.

**Step 4: Verify typecheck**

Run: `cd /home/sxtnl/dev/wt-1 && pnpm --filter @smartout/stage-engine typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add services/stage-engine/src/routes/guardian.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add Guardian WebSocket endpoint"
```

---

## Task 5: Wire guardian-bus into existing code

Add `emitGuardianEvent()` calls in all session lifecycle points.

**Files:**

- Modify: `services/stage-engine/src/core/session-manager.ts`
- Modify: `services/stage-engine/src/core/stage-manager.ts`
- Modify: `services/stage-engine/src/routes/sessions.ts`
- Modify: `services/stage-engine/src/routes/agent/chat.ts`
- Modify: `services/stage-engine/src/routes/store.ts`
- Modify: `services/stage-engine/src/routes/adapters/ultravox.ts`

**Step 1: session-manager.ts — emit on session creation**

Add import at top:

```typescript
import { emitGuardianEvent } from "./guardian-bus.js";
```

In `createSession()`, after the successful DB insert (after line 168, before building stageInfo), add:

```typescript
emitGuardianEvent({
  session_id: session.id,
  workspace_id: req.workspace_id,
  event_type: "session.started",
  actor: "system",
  summary: `Session started: ${req.mission_id}`,
  data: {
    mission_id: req.mission_id,
    channel: req.channel,
    profile_id: req.profile_id ?? null,
  },
});
```

In `abandonSession()`, after the successful DB update (after line 258, before return), add:

```typescript
if (updated) {
  emitGuardianEvent({
    session_id: sessionId,
    workspace_id: updated.workspace_id,
    event_type: "session.abandoned",
    actor: "system",
    summary: `Session abandoned`,
    data: { last_stage: updated.current_stage_id },
  });
}
```

**Step 2: stage-manager.ts — emit on stage change + completion**

Add import at top:

```typescript
import { emitGuardianEvent } from "./guardian-bus.js";
```

In `advanceStage()`, after session completion (after line 75, before the return), add:

```typescript
emitGuardianEvent({
  session_id: session.id,
  workspace_id: session.workspace_id,
  event_type: "session.completed",
  actor: "system",
  summary: `Session complete (${stages.length}/${stages.length} stages)`,
  data: { stages_completed: stages.length },
});
```

After stage advance (after line 112, after the webhook, before building stageInfo), add:

```typescript
emitGuardianEvent({
  session_id: session.id,
  workspace_id: session.workspace_id,
  event_type: "stage.changed",
  actor: "system",
  summary: `Stage: ${session.current_stage_id ?? "start"} → ${nextStage.stage_id}`,
  data: {
    from_stage: session.current_stage_id,
    to_stage: nextStage.stage_id,
    progress: `${nextIndex + 1}/${stages.length}`,
  },
});
```

**Step 3: agent/chat.ts — emit user message + agent response**

Add import at top:

```typescript
import { emitGuardianEvent } from "../../core/guardian-bus.js";
```

After appending user turn (after line 96), add:

```typescript
emitGuardianEvent({
  session_id: sessionId,
  workspace_id: auth.workspaceId,
  event_type: "user.message",
  actor: "user",
  summary: body.message.length > 100 ? body.message.slice(0, 100) + "…" : body.message,
  data: { text: body.message, channel: body.channel },
});
```

After appending assistant turn (after line 114), add:

```typescript
emitGuardianEvent({
  session_id: sessionId,
  workspace_id: auth.workspaceId,
  event_type: "agent.response",
  actor: "agent",
  summary:
    response.response.length > 100 ? response.response.slice(0, 100) + "…" : response.response,
  data: { text: response.response, intent: response.intent },
});
```

**Step 4: store.ts — emit data collected**

Add import at top:

```typescript
import { emitGuardianEvent } from "../core/guardian-bus.js";
```

After successful writeToInbox (after line 73, before the return), add:

```typescript
emitGuardianEvent({
  session_id: sessionId,
  workspace_id: session.workspace_id,
  event_type: "data.collected",
  actor: "agent",
  summary: `Data collected: ${body.entity_type}`,
  data: { entity_type: body.entity_type, inbox_id: entry.id },
});
```

**Step 5: ultravox.ts — emit for voice paths**

Add import at top:

```typescript
import { emitGuardianEvent } from "../../core/guardian-bus.js";
```

In the store handler (after line 150, before the return), add:

```typescript
emitGuardianEvent({
  session_id: sessionId,
  workspace_id: session.workspace_id,
  event_type: "data.collected",
  actor: "agent",
  summary: `Voice data collected: ${body.entity_type}`,
  data: { entity_type: body.entity_type },
});
```

In the advance handler, after successful advance (after line 270, before the complete check), add:

```typescript
emitGuardianEvent({
  session_id: sessionId,
  workspace_id: session.workspace_id,
  event_type: result.complete ? "session.completed" : "stage.changed",
  actor: "system",
  summary: result.complete
    ? "Voice session complete"
    : `Voice stage → ${result.new_stage?.stage_id ?? "unknown"}`,
  data: result.complete
    ? { summary: result.summary }
    : { to_stage: result.new_stage?.stage_id, progress: result.progress },
});
```

**Step 6: Verify typecheck**

Run: `cd /home/sxtnl/dev/wt-1 && pnpm --filter @smartout/stage-engine typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts services/stage-engine/src/core/stage-manager.ts services/stage-engine/src/routes/sessions.ts services/stage-engine/src/routes/agent/chat.ts services/stage-engine/src/routes/store.ts services/stage-engine/src/routes/adapters/ultravox.ts
git commit -m "feat(stage-engine): wire guardian event bus into all session lifecycle points"
```

---

## Task 6: useGuardianSocket hook

**Files:**

- Create: `apps/web/src/app/dashboard/guardian/_hooks/useGuardianSocket.ts`

**Step 1: Create the hook**

```typescript
// apps/web/src/app/dashboard/guardian/_hooks/useGuardianSocket.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// Mirror the server types
type GuardianEvent = {
  type: "event";
  session_id: string;
  workspace_id: string;
  event_type: string;
  actor: "system" | "agent" | "user" | "guardian" | "admin";
  summary: string;
  data: Record<string, unknown>;
  timestamp: string;
};

type SessionInfo = {
  session_id: string;
  mission_id: string | null;
  profile_name: string;
  channel: string;
  status: string;
  current_stage: string | null;
  started_at: string;
};

type GuardianSessionList = {
  type: "sessions";
  sessions: SessionInfo[];
};

type ServerMessage = GuardianEvent | GuardianSessionList;

export type { GuardianEvent, SessionInfo };

const STAGE_ENGINE_URL = process.env.NEXT_PUBLIC_STAGE_ENGINE_URL ?? "http://localhost:3000";

export function useGuardianSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [events, setEvents] = useState<GuardianEvent[]>([]);
  const [subscribedSession, setSubscribedSession] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    async function connect() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const wsUrl = STAGE_ENGINE_URL.replace(/^http/, "ws") + "/guardian/ws";
      ws = new WebSocket(wsUrl, ["bearer", session.access_token]);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as ServerMessage;

        if (msg.type === "sessions") {
          setSessions(msg.sessions);
        } else if (msg.type === "event") {
          setEvents((prev) => [...prev.slice(-200), msg]); // Keep last 200
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect after 3s
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((cmd: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  const subscribe = useCallback(
    (sessionId: string) => {
      send({ type: "subscribe", session_id: sessionId });
      setSubscribedSession(sessionId);
      setEvents([]); // Clear events when switching sessions
    },
    [send],
  );

  const unsubscribe = useCallback(
    (sessionId: string) => {
      send({ type: "unsubscribe", session_id: sessionId });
      setSubscribedSession(null);
    },
    [send],
  );

  const changeStage = useCallback(
    (sessionId: string, targetStageId: string) => {
      send({ type: "change_stage", session_id: sessionId, target_stage_id: targetStageId });
    },
    [send],
  );

  const whisper = useCallback(
    (sessionId: string, message: string) => {
      send({ type: "whisper", session_id: sessionId, message });
    },
    [send],
  );

  return {
    connected,
    sessions,
    events,
    subscribedSession,
    subscribe,
    unsubscribe,
    changeStage,
    whisper,
  };
}
```

**Step 2: Verify typecheck**

Run: `cd /home/sxtnl/dev/wt-1 && pnpm --filter web typecheck`
Expected: No errors (or only pre-existing errors unrelated to this file)

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/guardian/_hooks/useGuardianSocket.ts
git commit -m "feat(web): add useGuardianSocket hook for Guardian dashboard"
```

---

## Task 7: Guardian dashboard page and components

**Files:**

- Create: `apps/web/src/app/dashboard/guardian/page.tsx`
- Create: `apps/web/src/app/dashboard/guardian/_components/GuardianMonitor.tsx`
- Create: `apps/web/src/app/dashboard/guardian/_components/SessionList.tsx`
- Create: `apps/web/src/app/dashboard/guardian/_components/EventFeed.tsx`
- Create: `apps/web/src/app/dashboard/guardian/_components/SessionDetails.tsx`
- Create: `apps/web/src/app/dashboard/guardian/_components/WhisperInput.tsx`

**Reference docs for implementer:**

- Design doc: `docs/plans/2026-03-14-guardian-v1-design.md` (section 6 — layout mockup)
- shadcn/ui components: Card, Badge, Button, Tabs, ScrollArea, Input
- CSS variables: `bg-background`, `text-foreground`, `border-border` — NEVER hardcoded colors
- Icons: lucide-react (Shield, Radio, MessageSquare, Eye, ArrowRight, Send)
- DashboardShell pattern: `apps/web/src/components/dashboard/DashboardShell.tsx`
- Existing dashboard page pattern: `apps/web/src/app/dashboard/ai/page.tsx`

**Step 1: Create page.tsx**

Server component. Minimal — just wraps the client component.

```tsx
// apps/web/src/app/dashboard/guardian/page.tsx
import { GuardianMonitor } from "./_components/GuardianMonitor";

export default function GuardianPage() {
  return <GuardianMonitor />;
}
```

**Step 2: Create GuardianMonitor.tsx**

Main client component. Three-panel layout using the useGuardianSocket hook.

- Left: `<SessionList>` — list of active sessions, click to subscribe
- Center: `<EventFeed>` — scrolling event log for selected session + `<WhisperInput>` at bottom
- Right: `<SessionDetails>` — session info + stage controls
- Top: connection status indicator (green dot = connected, red = disconnected)

Use `grid grid-cols-[280px_1fr_320px]` for the three-panel layout. Full height `h-[calc(100vh-4rem)]`.

**Step 3: Create SessionList.tsx**

Props: `{ sessions, subscribedSession, onSelect }`

- Each session: profile name, channel badge, mission name, current stage, time ago
- Selected session highlighted with `bg-accent`
- Use `<ScrollArea>` for overflow

**Step 4: Create EventFeed.tsx**

Props: `{ events }`

- Scrolling list, auto-scroll to bottom on new events
- Each event: timestamp, actor badge (color-coded), summary
- Actor colors: system=`text-muted-foreground`, agent=`text-blue-400`, user=`text-emerald-400`, admin=`text-amber-400`, guardian=`text-purple-400`
- For `user.message` and `agent.response` — show full text from `data.text`
- Use `<ScrollArea>` with `ref` for auto-scroll

**Step 5: Create SessionDetails.tsx**

Props: `{ session, events, onChangeStage, onWhisper }`

- Session info: mission_id, channel, started_at, current_stage
- Stage list (if mission mode) with ability to click-to-change
- Event summary counts: total events, user messages, agent responses

**Step 6: Create WhisperInput.tsx**

Props: `{ sessionId, onWhisper }`

- Text input + Send button
- Placeholder: "Whisper to agent..."
- On submit: call `onWhisper(sessionId, message)`, clear input
- Disabled when no session selected

**Step 7: Verify typecheck**

Run: `cd /home/sxtnl/dev/wt-1 && pnpm --filter web typecheck`

**Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/guardian/
git commit -m "feat(web): add Guardian dashboard page with live monitoring UI"
```

---

## Task 8: Sidebar navigation + route mapping

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

**Step 1: Add Guardian NavItem**

In `DashboardShell.tsx`, add after the Onboarding Copilot NavItem (after line 578):

```tsx
<NavItem
  href="/dashboard/guardian"
  icon={Shield}
  label="Guardian"
  isDark={isDark}
  ai
  active={isActive("/dashboard/guardian")}
  isCollapsed={isSidebarCollapsed}
/>
```

Add `Shield` to the lucide-react import at the top of the file.

**Step 2: Add route mapping**

In `ROUTE_MISSION_MAP` (around line 8), add:

```typescript
"/dashboard/guardian": "mr-botsson",
```

**Step 3: Verify typecheck**

Run: `cd /home/sxtnl/dev/wt-1 && pnpm --filter web typecheck`

**Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(web): add Guardian to sidebar navigation"
```

---

## Task 9: Update WORKLOG + docs

**Files:**

- Modify: `docs/worklogs/WORKLOG-guardian.md`
- Modify: `docs/decisions/0000-decision-log.md`
- Modify: `docs/learnings/0000-learning-log.md`

**Step 1: Update WORKLOG with all completed tasks**

**Step 2: Write ADR for WebSocket decision**

Decision: "Use direct WebSocket from stage engine instead of Supabase Realtime for Guardian dashboard"
Reason: True real-time, bidirectional commands, no polling latency

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: update guardian worklog, decision log, and learning log"
```

---

## Acceptance Criteria

- [ ] `guardian_log` table exists with RLS
- [ ] Stage engine emits events on: session create, stage change, completion, abandon, user message, agent response, data collected
- [ ] WebSocket at `/guardian/ws` authenticates and broadcasts events
- [ ] Admin can send `change_stage` and `whisper` commands via WebSocket
- [ ] Dashboard at `/dashboard/guardian` shows live session list
- [ ] Dashboard shows live event feed for selected session
- [ ] Dashboard has whisper input that sends to agent
- [ ] Guardian visible in sidebar navigation
- [ ] `pnpm --filter @smartout/stage-engine typecheck` passes
- [ ] `pnpm --filter web typecheck` passes
