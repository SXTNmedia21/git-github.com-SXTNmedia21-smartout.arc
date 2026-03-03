---
title: "Guardian v1 — Real-Time Session Monitor"
status: approved
updated: 2026-03-14
created: 2026-03-14
module: ai
tags: [guardian, monitoring, websocket, stage-engine, real-time]
---

# Guardian v1 — Real-Time Session Monitor

> Guardian is the "second hand on the wheel" — a real-time monitor that watches every conversation through the stage engine, logs reactions, and gives admins control to intervene.

## 1. Vision

Guardian sits above the stage engine. When a chat or voice session starts, the stage engine signals Guardian. Guardian:

1. **Watches** — reads every event and transcript in real-time
2. **Logs reactions** — timestamped facts: "session started", "stage advanced", "agent responded"
3. **Gives admin control** — change stages, whisper to agent
4. **Summarizes** — conclusion of the transcript per session

v1 is a flight recorder with admin controls. v2 adds AI analysis (is the agent following the manuscript? are tasks complete?).

## 2. Architecture

```
┌──────────────────────────────────────────┐
│  /dashboard/guardian (Admin page)         │
│  • Active sessions list (left panel)     │
│  • Live event feed per session (center)  │
│  • Session details + conclusion (right)  │
│  • Controls: change stage, whisper       │
└──────────┬───────────────────┬───────────┘
           │ WebSocket          │ Commands
           ▼                    ▼
┌──────────────────────────────────────────┐
│  Stage Engine /guardian/ws endpoint       │
│  • Broadcasts events to connected admins │
│  • Receives commands from dashboard      │
│  • Logs simple reactions per event        │
│  • Persists events to guardian_log table  │
└──────────────────────────────────────────┘
```

### Approach Decision

| Approach | Description | Decision |
|----------|-------------|----------|
| A: Supabase Realtime | New table + postgres_changes subscription | Rejected — ~200ms latency, indirect |
| **B: Direct WebSocket** | Stage engine serves WebSocket endpoint | **Selected** — true real-time, bidirectional, direct |

## 3. Data Model

### 3.1 `guardian_log` Table

Persists all guardian events for history/replay. The WebSocket broadcasts events live, but they're also written here.

```sql
CREATE TABLE guardian_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  session_id      UUID NOT NULL,
  event_type      TEXT NOT NULL,
  actor           TEXT NOT NULL,      -- 'system' | 'agent' | 'user' | 'guardian' | 'admin'
  summary         TEXT NOT NULL,
  data            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guardian_log_session
  ON guardian_log (session_id, created_at);

CREATE INDEX idx_guardian_log_workspace
  ON guardian_log (workspace_id, created_at DESC);

ALTER TABLE guardian_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view logs" ON guardian_log
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "Service can manage logs" ON guardian_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### 3.2 Event Types

| event_type | actor | summary example | data |
|------------|-------|-----------------|------|
| `session.started` | system | "Session started: onboarding mission" | `{ mission_id, profile_id, channel }` |
| `stage.changed` | system | "Stage: welcome → intake" | `{ from_stage, to_stage, progress }` |
| `user.message` | user | "Hei, jeg har et sporsmal..." | `{ text, channel }` |
| `agent.response` | agent | "Mr. Botsson: Hei! Hva kan..." | `{ text, tools_used }` |
| `data.collected` | agent | "Data collected: person" | `{ entity_type, keys }` |
| `session.completed` | system | "Session complete (5/5 stages)" | `{ duration_s, stages_completed }` |
| `session.abandoned` | system | "Session abandoned after 12m" | `{ duration_s, last_stage }` |
| `admin.stage_change` | admin | "Admin forced stage: welcome → intake" | `{ from_stage, to_stage, admin_id }` |
| `admin.whisper` | admin | "Admin whispered to agent" | `{ message }` |
| `guardian.reaction` | guardian | "Guardian: all stages on track" | `{ type: 'observation' }` |

### 3.3 Existing Tables Used

- `guardian_signal` — already created (Task 1), used for v2 cron-based detection
- `engine_sessions` — read for session context
- `engine_stages` — read for mission/stage data

## 4. WebSocket Protocol

### 4.1 Connection

```
GET /guardian/ws?workspace_id={uuid}
Headers: Authorization: Bearer {jwt_or_api_key}
Upgrade: websocket
```

Auth: Same as existing stage engine auth middleware. Only admin/owner roles can connect.

### 4.2 Server → Client Messages

```typescript
type GuardianEvent = {
  type: "event";
  session_id: string;
  event_type: string;       // from event types table above
  actor: string;
  summary: string;
  data: Record<string, unknown>;
  timestamp: string;         // ISO 8601
};

type SessionList = {
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
```

### 4.3 Client → Server Commands

```typescript
type ChangeStageCommand = {
  type: "change_stage";
  session_id: string;
  target_stage_id: string;
};

type WhisperCommand = {
  type: "whisper";
  session_id: string;
  message: string;          // system instruction injected to agent
};

type SubscribeCommand = {
  type: "subscribe";
  session_id: string;       // subscribe to events for this session
};

type UnsubscribeCommand = {
  type: "unsubscribe";
  session_id: string;
};
```

### 4.4 Whisper Mechanism

When admin sends a whisper:
1. Engine stores whisper text in session context (`collected_data._whispers[]`)
2. On next agent response cycle, whisper is prepended as a system message
3. Agent sees it as internal instruction (invisible to user)
4. Whisper is consumed (one-shot) after agent processes it

## 5. Stage Engine Changes

### 5.1 New Route: `/guardian/ws`

```typescript
// services/stage-engine/src/routes/guardian.ts
// WebSocket endpoint for Guardian dashboard
// Hono WebSocket upgrade using @hono/node-ws adapter
```

### 5.2 Guardian Event Bus (in-process)

```typescript
// services/stage-engine/src/core/guardian-bus.ts
// Simple EventEmitter that:
// 1. Broadcasts events to connected WebSocket clients
// 2. Writes events to guardian_log table (async, non-blocking)

type GuardianBus = {
  emit(event: GuardianEvent): void;
  subscribe(workspaceId: string, ws: WebSocket): void;
  unsubscribe(ws: WebSocket): void;
};
```

### 5.3 Integration Points

Add `guardianBus.emit()` calls in existing code:

| File | Where | Event emitted |
|------|-------|---------------|
| `session-manager.ts` | `createSession()` | `session.started` |
| `stage-manager.ts` | `advanceStage()` | `stage.changed` |
| `stage-manager.ts` | on completion | `session.completed` |
| `session-manager.ts` | `abandonSession()` | `session.abandoned` |
| `agent/chat.ts` | before LLM call | `user.message` |
| `agent/chat.ts` | after LLM response | `agent.response` |
| `store.ts` | on data stored | `data.collected` |
| `adapters/ultravox.ts` | on voice events | `user.message`, `agent.response` |

## 6. Dashboard

### 6.1 Route: `/dashboard/guardian`

Server component wrapping a client component that manages the WebSocket.

### 6.2 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Guardian Monitor                              [● Live] │
├──────────────┬──────────────────────┬───────────────────┤
│ Sessions     │ Event Feed           │ Details           │
│              │                      │                   │
│ ● Ola N.     │ 14:32:01 [system]    │ Mission:          │
│   onboarding │ Session started      │  onboarding_14d   │
│   3/5 stages │                      │                   │
│              │ 14:32:05 [user]      │ Profile:          │
│ ○ Kari S.    │ "Hei, jeg er ny"     │  Ola Nordmann     │
│   mr-botsson │                      │                   │
│   agent mode │ 14:32:07 [agent]     │ Channel: voice    │
│              │ "Velkommen! La oss   │                   │
│              │  starte med..."      │ Stage: 3/5        │
│              │                      │  intake_confirm   │
│              │ 14:33:12 [system]    │                   │
│              │ Stage: welcome →     │ ─────────────     │
│              │  intake              │ Conclusion:       │
│              │                      │ On track. All     │
│              │ 14:33:15 [guardian]   │ stages completed  │
│              │ Guardian: stage      │ in sequence.      │
│              │ transition OK        │                   │
│              ├──────────────────────┤ [Change Stage ▾]  │
│              │ > Whisper to agent   │ [Whisper      ▾]  │
│              │ [________________________] [Send]        │
└──────────────┴──────────────────────┴───────────────────┘
```

### 6.3 Components

| File | Type | Purpose |
|------|------|---------|
| `page.tsx` | Server | Layout + auth check |
| `_components/GuardianMonitor.tsx` | Client | WebSocket manager, main layout |
| `_components/SessionList.tsx` | Client | Active sessions sidebar |
| `_components/EventFeed.tsx` | Client | Scrolling event log |
| `_components/SessionDetails.tsx` | Client | Right panel with session info + controls |
| `_components/WhisperInput.tsx` | Client | Text input for admin whispers |
| `_hooks/useGuardianSocket.ts` | Hook | WebSocket connection + message handling |

### 6.4 Sidebar Navigation

Add under AI section in DashboardShell.tsx:
```
AI
├── Mr. Botsson (/dashboard/ai)
├── Onboarding Copilot (/dashboard/onboarding-assistant)
└── Guardian (/dashboard/guardian)  ← NEW, with live indicator
```

## 7. File Map

```
services/stage-engine/src/
├── routes/
│   └── guardian.ts                    ← NEW: WebSocket endpoint
├── core/
│   └── guardian-bus.ts                ← NEW: Event bus + persistence
├── session-manager.ts                 ← MODIFIED: emit guardian events
├── stage-manager.ts                   ← MODIFIED: emit guardian events
├── routes/agent/chat.ts               ← MODIFIED: emit user.message + agent.response
├── routes/store.ts                    ← MODIFIED: emit data.collected
└── routes/adapters/ultravox.ts        ← MODIFIED: emit voice events

supabase/migrations/
└── 20260314100000_guardian_log.sql     ← NEW: guardian_log table

apps/web/src/app/dashboard/guardian/
├── page.tsx                           ← NEW: Server component
├── _components/
│   ├── GuardianMonitor.tsx            ← NEW: Main client component
│   ├── SessionList.tsx                ← NEW: Active sessions
│   ├── EventFeed.tsx                  ← NEW: Live event log
│   ├── SessionDetails.tsx             ← NEW: Details + controls
│   └── WhisperInput.tsx               ← NEW: Whisper input
└── _hooks/
    └── useGuardianSocket.ts           ← NEW: WebSocket hook

apps/web/src/components/dashboard/
└── DashboardShell.tsx                 ← MODIFIED: Add Guardian nav item
```

## 8. Dependencies

| Dependency | Status |
|------------|--------|
| `guardian_signal` table | Already created (migration 20260314000000) |
| `guardian_log` table | New migration needed |
| `@hono/node-ws` | New dependency for stage engine |
| `engine_sessions` table | Exists |
| `engine_stages` table | Exists |
| Guardian capability in AI package | Being added by engine-architect agent |

## 9. v2 Roadmap (NOT v1)

| Feature | Description |
|---------|-------------|
| AI transcript analysis | Guardian uses LLM to evaluate if agent follows manuscript |
| Proactive intervention | Guardian auto-whispers corrections to agent |
| Cron-based signal detection | Original design — trainee risk, readiness stall, etc. |
| Stage engine triggers | Guardian triggers missions based on detected signals |
| Notification delivery | Email/SMS alerts for critical signals |
| Historical analytics | Trend charts, session quality scores |
