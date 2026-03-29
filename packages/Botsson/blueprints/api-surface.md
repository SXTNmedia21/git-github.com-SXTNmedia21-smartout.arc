---
title: "WalkAi Blueprint — API Surface"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: walkAi
tags: [blueprint, api, stage-engine, mcp, walkAi]
---

# WalkAi Blueprint — API Surface

Complete inventory of every API endpoint, WebSocket connection, and MCP tool that WalkAi interacts with. Organized by service.

---

## 1. Stage Engine API (`services/stage-engine/`, port 3000)

The Stage Engine is WalkAi's primary runtime — it manages sessions, stages, data collection, and agent conversations.

### 1.1 Authentication

All endpoints (except `/health` and WebSocket upgrades) require one of:

| Method  | Header                        | Resolution                                                                                      |
| ------- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| API Key | `x-api-key: smo_sk_live_...`  | SHA-256 hash lookup in `platform_api_key`. Returns `{ method: "api_key", workspaceId, scopes }` |
| JWT     | `Authorization: Bearer <jwt>` | Supabase `getUser()` + profile lookup. Returns `{ method: "jwt", workspaceId, userId }`         |
| Dev Key | `x-api-key: <DEV_API_KEY>`    | Bypasses DB lookup. Workspace = `00000000-...`. Scopes = `["*"]`                                |

**AuthContext type:**

```typescript
type AuthContext = {
  method: "api_key" | "jwt";
  workspaceId: string;
  userId?: string; // JWT only
  scopes?: string[]; // API key only
};
```

---

### 1.2 Session Lifecycle

#### `GET /health`

Health check. No auth required.

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Auth            | None                                                                     |
| Response        | `{ status: "ok", service: "stage-engine", version: "0.1.0", timestamp }` |
| WalkAi consumer | Monitoring / connectivity check                                          |

---

#### `POST /sessions`

Create a new mission-mode session (structured stages).

| Field           | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| Auth            | API key or JWT                                                   |
| Request body    | See schema below                                                 |
| Response        | `{ session_id, status, current_stage, progress, system_prompt }` |
| Error 404       | Mission not found or inactive                                    |
| WalkAi consumer | **SessionManager** — starts a structured journey                 |

**Request schema:**

```typescript
{
  mission_id: string;       // Required. References engine_process
  workspace_id: string;     // UUID
  user_id?: string;         // UUID, optional
  profile_id?: string;      // UUID, optional
  channel: "voice" | "sms" | "chat" | "email" | "autonomous";
  callback_url?: string;    // URL for webhook notifications
  context?: Record<string, unknown>;
}
```

**Response shape:**

```typescript
{
  session_id: string;
  status: "active";
  current_stage: {
    stage_id: string;
    goal: string;
    instructions: string;
  } | null;
  progress: { current: number; total: number };
  system_prompt: string;
}
```

**Webhook fired:** `session.started` to `callback_url` if provided.

---

#### `GET /sessions/:id`

Get session status and current state.

| Field           | Value                                    |
| --------------- | ---------------------------------------- |
| Auth            | API key or JWT (workspace-scoped)        |
| Response        | Session details                          |
| Error 404       | Session not found                        |
| Error 403       | Workspace mismatch                       |
| WalkAi consumer | **SessionManager** — polls session state |

**Response shape:**

```typescript
{
  session_id: string;
  status: "active" | "completed" | "abandoned" | "expired";
  current_stage_id: string | null;
  stage_index: number;
  collected_data: Record<string, unknown>;
  context: Record<string, unknown>;
  summary: string | null;
  channel: string;
  expires_at: string;
  created_at: string;
}
```

---

#### `POST /sessions/:id/abandon`

Abandon an active session.

| Field           | Value                                       |
| --------------- | ------------------------------------------- |
| Auth            | API key or JWT                              |
| Response        | `{ session_id, status: "abandoned" }`       |
| Error 409       | Session already completed/abandoned         |
| WalkAi consumer | **SessionManager** — user exits mid-journey |

**Webhook fired:** `session.abandoned` to `callback_url` with `collected_data`.

---

### 1.3 Stage Navigation

#### `POST /sessions/:id/advance`

Advance session to the next stage.

| Field           | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Auth            | API key or JWT                                          |
| WalkAi consumer | **StageController** — progresses through journey stages |

**Request schema:**

```typescript
{
  result?: Record<string, unknown>;  // Data from completed stage
  next_stage_id?: string;            // Force jump to specific stage
  force?: boolean;                   // Skip validation
}
```

**Response shape:**

```typescript
{
  new_stage: {
    stage_id: string;
    goal: string;
    instructions: string;
  } | null;
  progress: { current: number; total: number };
  system_prompt: string;
  complete: boolean;
  summary?: string;
}
```

---

### 1.4 Data Storage & Retrieval

#### `POST /sessions/:id/store`

Agent stores collected data to the engine inbox.

| Field           | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Auth            | API key or JWT                                                 |
| WalkAi consumer | **DataCollector** — persists data gathered during conversation |

**Request schema:**

```typescript
{
  entity_type: string;               // e.g. "employee", "department", "policy"
  data: Record<string, unknown>;     // The collected data
  stage_id?: string;                 // Override current stage
}
```

**Response shape:**

```typescript
{
  inbox_id: string;
  confirmed: true;
  message: string; // Instruction for agent to continue
}
```

**Side effects:**

- Guardian event `data.collected` emitted
- Guardian evaluation triggered (fire-and-forget)

---

#### `POST /sessions/:id/fetch`

Agent requests context or previously stored data.

| Field           | Value                                                    |
| --------------- | -------------------------------------------------------- |
| Auth            | API key or JWT                                           |
| WalkAi consumer | **ContextProvider** — retrieves data for agent reasoning |

**Request schema:**

```typescript
{
  query_type: "context" | "inbox" | "stage" | "history";
  filters?: {
    entity_type?: string;
    stage_id?: string;
  };
}
```

**Response by query_type:**

| query_type | Returns                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| `context`  | Session context object (identity + workspace info)                                        |
| `inbox`    | `{ entries: InboxEntry[] }` — stored data, filtered by entity_type/stage_id               |
| `stage`    | Current stage details: `{ stage_id, goal, instructions, success_criteria, emotion_hint }` |
| `history`  | All `collected_data` across stages                                                        |

**Special behavior:** For `context` and `stage` queries, any pending Guardian whispers are delivered in `_guardian_whispers: string[]` and then cleared from the session.

---

### 1.5 Agent Chat (Free-form Mode)

#### `POST /agent/chat`

Main endpoint for agent-mode conversations (non-mission, free-form).

| Field           | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| Auth            | API key or JWT                                               |
| WalkAi consumer | **AgentRouter** — free-form conversation with intent routing |

**Request schema:**

```typescript
{
  message: string;           // User's message
  session_id?: string;       // Resume existing session (omit to create new)
  profile_id: string;        // UUID of the employee/user
  channel?: "chat" | "voice"; // Default: "chat"
}
```

**Response shape:**

```typescript
{
  session_id: string;
  response: string;          // Agent's reply text
  intent?: {
    capability: string;      // Detected intent category
    confidence: number;      // 0-1 confidence score
  };
}
```

**Side effects:**

- Conversation turns appended to session
- Guardian events emitted: `user.message` and `agent.response`

---

### 1.6 Ultravox Voice Adapter

All Ultravox endpoints wrap core Stage Engine operations for voice call integration. Session ID is passed as `?session_id=` query param (not path param).

#### `POST /adapters/ultravox/create-call`

Creates an Ultravox WebRTC voice call with Stage Engine tools pre-configured.

| Field           | Value                                       |
| --------------- | ------------------------------------------- |
| Auth            | API key or JWT                              |
| WalkAi consumer | **VoiceManager** — initiates voice sessions |

**Request schema:**

```typescript
{
  mission_id: string;
  workspace_id?: string;
  user_id?: string;
  profile_id?: string;
  voice?: string;                          // Ultravox voice ID
  language?: string;                       // Default: "no"
  first_speaker?: "user" | "agent";
  context?: Record<string, unknown>;
  selected_tools?: UltravoxTool[];         // Client-side tools
}
```

**Response shape:**

```typescript
{
  session_id: string;
  call_id: string;
  join_url: string; // WebRTC join URL for ultravox-client SDK
}
```

**Note:** In local dev (non-HTTPS), HTTP tools are skipped. Client tools always work.

---

#### `POST /adapters/ultravox/store?session_id=<id>`

Ultravox tool wrapper for data storage. Returns plain text (Ultravox tool result format).

| Field           | Value                                                    |
| --------------- | -------------------------------------------------------- |
| Auth            | API key or JWT                                           |
| Request         | `{ entity_type: string, data: Record<string, unknown> }` |
| Response        | Plain text: `"Stored {entity_type} successfully..."`     |
| WalkAi consumer | **VoiceDataCollector** — voice agent stores data         |

---

#### `POST /adapters/ultravox/fetch?session_id=<id>`

Ultravox tool wrapper for data retrieval. Returns JSON as plain text.

| Field           | Value                         |
| --------------- | ----------------------------- | ------- | ------- | ------------ |
| Auth            | API key or JWT                |
| Request         | `{ query_type: "context"      | "inbox" | "stage" | "history" }` |
| Response        | Plain text (JSON stringified) |
| WalkAi consumer | **VoiceContextProvider**      |

---

#### `POST /adapters/ultravox/advance?session_id=<id>`

Advances to next stage. Returns Ultravox new-stage response with `X-Ultravox-Response-Type: new-stage` header for seamless voice transitions.

| Field           | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Auth            | API key or JWT                                                 |
| Request         | `{ result?: Record<string, unknown>, next_stage_id?: string }` |
| WalkAi consumer | **VoiceStageController**                                       |

**Response (not complete):**

```typescript
// Header: X-Ultravox-Response-Type: new-stage
{
  systemPrompt: string;
  toolResultText: string;
  selectedTools?: UltravoxTool[];
  temperature?: number;
  voice?: string;
  languageHint?: string;
}
```

**Response (mission complete):** Plain text farewell message.

---

## 2. WebSocket Contracts

### 2.1 Session WebSocket — `/ws/:sessionId`

Bidirectional real-time communication between agent and frontend UI.

| Field           | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| URL             | `ws://<host>:3000/ws/:sessionId?token=<jwt>`                   |
| Auth            | JWT as `?token=` query param, validated on connect             |
| WalkAi consumer | **RealtimeBridge** — live UI commands and user action tracking |

**Connection lifecycle:**

1. Client connects with `?token=<jwt>`
2. Server validates JWT via `supabase.auth.getUser()`
3. Server verifies user has access to session's workspace via profile lookup
4. Connection registered in connection manager

**Close codes:**
| Code | Meaning |
|------|---------|
| 4001 | Missing or invalid token |
| 4003 | Forbidden (no workspace access) |
| 4004 | Session not found |

#### Messages: Server -> Client (`MissionProtocolMessage`)

Three message types, discriminated by `type` field:

**UICommand** — Agent instructs the UI:

```typescript
{
  type: "ui_command";
  sessionId: string;
  command:
    | { action: "navigate"; target: string }
    | { action: "highlight"; target: string; duration?: number }
    | { action: "fill_field"; field: string; value: string }
    | { action: "show_panel"; panel: string; data?: Record<string, unknown> }
    | { action: "hide_panel"; panel: string }
    | { action: "toast"; message: string; variant?: "info" | "success" | "warning" }
    | { action: "custom"; name: string; payload: Record<string, unknown> };
  timestamp: number;
}
```

**SystemEvent** — Session state updates:

```typescript
{
  type: "session_state" | "agent_typing" | "error" | "journey_progress";
  sessionId: string;
  data: Record<string, unknown>;
  timestamp: number;
}
```

#### Messages: Client -> Server (`UserAction`)

```typescript
{
  type: "user_action";
  sessionId: string;
  action:
    | { event: "field_changed"; field: string; value: string }
    | { event: "step_entered"; stepOrder: number; screen: string }
    | { event: "button_clicked"; button: string }
    | { event: "form_submitted"; form: string; data: Record<string, unknown> }
    | { event: "custom"; name: string; payload: Record<string, unknown> };
  timestamp: number;
}
```

**Buffering:** User actions are buffered per session and drained by the agent on its next turn (via `getBufferedActions(sessionId)`).

---

### 2.2 Guardian WebSocket — `/guardian/ws`

Dashboard monitoring and control of active agent sessions.

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| URL             | `ws://<host>:3000/guardian/ws?token=<jwt>`                         |
| Auth            | JWT as `?token=` query param. Must be **admin** or **owner** role. |
| WalkAi consumer | **GuardianDashboard** — real-time session monitoring               |

**Close codes:**
| Code | Meaning |
|------|---------|
| 4001 | Missing or invalid token |
| 4003 | Forbidden (not admin/owner) |

#### Messages: Server -> Client

**GuardianSessionList** — sent on connect and periodically:

```typescript
{
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
}
```

**GuardianEvent** — real-time session events:

```typescript
{
  type: "event";
  session_id: string;
  workspace_id: string;
  event_type: string; // e.g. "user.message", "agent.response", "data.collected",
  // "admin.stage_change", "admin.whisper"
  actor: "system" | "agent" | "user" | "guardian" | "admin";
  summary: string;
  data: Record<string, unknown>;
  timestamp: string;
}
```

#### Commands: Client -> Server (`GuardianCommand`)

```typescript
| { type: "subscribe"; session_id: string }
| { type: "unsubscribe"; session_id: string }
| { type: "change_stage"; session_id: string; target_stage_id: string }
| { type: "whisper"; session_id: string; message: string }
```

| Command        | Effect                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| `subscribe`    | Start receiving events for a specific session                                               |
| `unsubscribe`  | Stop receiving events for a session                                                         |
| `change_stage` | Force-advance session to a target stage                                                     |
| `whisper`      | Inject a hidden message into `collected_data._whispers[]`, delivered to agent on next fetch |

---

## 3. Interview MCP (External Service)

Hosted at `https://intervju-mcp.vercel.app`. Optional session tracking service.

| Field           | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| WalkAi consumer | **VoiceSessionTracker** — logs voice conversation sessions |

### 3.1 Endpoints

#### `POST /api/interview/start`

Register a new interview session for tracking.

| Field    | Value                                    |
| -------- | ---------------------------------------- |
| Auth     | `INTERVJU_MCP_WEBHOOK_SECRET` (optional) |
| Response | `{ session_id: string }`                 |

### 3.2 Mission System (`@smartout/ai/missions`)

Missions are defined in-repo at `packages/ai/src/missions/`. The Interview MCP consumes them via `startMissionCall()`.

**Available missions:**

| Mission ID             | Agent           | Language | Purpose                      |
| ---------------------- | --------------- | -------- | ---------------------------- |
| `onboarding-interview` | Mr. Botsson     | NO       | Maps org structure via voice |
| `landing-demo`         | Lise Botsson    | NO       | Landing page demo            |
| `mr-botsson`           | Mr. Botsson     | NO       | General workspace assistant  |
| `haccp-inspector`      | HACCP Inspector | NO       | Food safety checks           |
| `shift-assistant`      | Shift Assistant | NO       | Shift planning help          |

**`startMissionCall()` usage:**

```typescript
import { startMissionCall } from "@smartout/ai/missions";
const result = await startMissionCall({
  missionId: "mr-botsson",
  apiKey: process.env.ULTRAVOX_API_KEY,
});
// result: { callId, joinUrl }
```

---

## 4. Edge Functions (AI/Agent-Related)

All Edge Functions are invoked via `POST https://<supabase-url>/functions/v1/<function-name>`.

### 4.1 `engine-dispatch`

Universal workflow engine dispatcher. Receives events, matches triggers, creates engine_state instances, and executes steps.

| Field           | Value                                               |
| --------------- | --------------------------------------------------- |
| Auth            | Service role key (JWT)                              |
| WalkAi consumer | **WorkflowEngine** — drives all automated workflows |

**Request:**

```typescript
{
  event_type: string;                    // e.g. "session.hook.fired", "assignment.started"
  payload?: Record<string, unknown>;
  workspace_id?: string;
  idempotency_key?: string;
}
```

**Response:**

```typescript
{
  event_id: string;
  triggers_matched: number;
  results: Array<{
    trigger_id: string;
    action: "started" | "delayed" | "error";
    state_id?: string;
    delayed_trigger_id?: string;
  }>;
  waiting_resumed: number;
}
```

**Supported action_types:**
`wait_for_event`, `assign_task`, `send_notification`, `update_entity`, `create_deviation`, `validate_settlement`, `lock_checkout`, `schedule_control`, `start_process`, `upsert_session`, `create_session_task`, `generate_steps`, `present_content`, `administer_test`, `collect_signature`, `check_readiness`

---

### 4.2 `gather-workspace-intelligence`

Multi-phase intelligence pipeline: scrapes website, queries Brreg, Google Places, web search, and provisions workspace.

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| Auth            | JWT (optional — unauthenticated callers get data without workspace provisioning) |
| WalkAi consumer | **OnboardingIntelligence** — automated company discovery                         |

**Request:**

```typescript
{
  url?: string;              // Company website
  orgNumber?: string;        // Norwegian org number (Brreg)
  companyName?: string;      // Company name for search
  city?: string;             // City hint for disambiguation
}
```

**Response:**

```typescript
{
  success: boolean;
  workspaceId: string | null;  // null if unauthenticated
  scrapedData: Record<string, unknown> | null;
  brregData: {
    matched: boolean;
    orgNumber: string | null;
    legalName: string | null;
    website: string | null;
    naceCode: string | null;
    naceDescription: string | null;
    address: { street, postalCode, city, municipality } | null;
    dagligLeder: string | null;
    employeeCount: number | null;
    // ... more fields
  };
  placesData: Record<string, unknown> | null;
  webSearchData: {
    rating: number | null;
    reviewCount: number | null;
    website: string | null;
    email: string | null;
    phone: string | null;
    externalRatings: ExternalRating[];
    newsArticles: Array<{ title, url, snippet }>;
    seasonalPatterns: string[];
    mentions: string[];
    jobListings: string[];
  };
}
```

---

### 4.3 `analyze-setup-documents`

Downloads uploaded documents, extracts text/images via Scrapling, then analyzes with Claude for structured workplace data.

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| Auth            | JWT (Authorization header required)                                              |
| WalkAi consumer | **DocumentAnalyzer** — extracts policies, employees, shift patterns from uploads |

**Request:**

```typescript
{
  workspace_id: string;
  storage_paths: string[];   // Paths in "setup-documents" storage bucket
}
```

**Response:**

```typescript
{
  result: {
    policies?: Array<{ name, content, source }>;
    payroll?: { tariff?, supplements?, source };
    employees?: Array<{ firstName, lastName, email?, phone?, department?, position?, source }>;
    shiftPatterns?: Array<{ name, startTime, endTime, department?, source }>;
    employmentTerms?: { noticePeriod?, probation?, source };
    handbookSections?: Array<{ chapterKey, content, source }>;
  };
  files: Array<{
    storagePath: string;
    fileName: string;
    status: "analyzed" | "failed";
    error?: string;
    characters?: number;
  }>;
}
```

---

### 4.4 `analyze-workspace`

AI analysis of scraped + web search data to suggest workspace configuration. Currently uses mock data (Claude integration placeholder).

| Field           | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Auth            | JWT (user context)                                             |
| WalkAi consumer | **WorkspaceConfigurator** — suggests departments, teams, zones |

**Request:**

```typescript
{
  sessionId: string;           // onboarding_session ID
  companyName?: string;
  scrapedData?: Record<string, unknown>;
  webSearchData?: Record<string, unknown>;
}
```

**Response:**

```typescript
{
  success: boolean;
  ai_analysis: {
    suggested_departments: Array<{ id; name; roles; description; recommendedReason }>;
    suggested_teams: Array<{ name; department; isSeasonal; recommendedReason }>;
    suggested_zones: Array<{ name; location; capacity; isSeasonal; recommendedReason }>;
    suggested_branding: {
      (slogan, shortDescription, tone);
    }
  }
}
```

---

### 4.5 `web-search-intelligence`

Searches the web for company information using Serper API (Google search + news).

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Auth            | Service role key (called internally by `gather-workspace-intelligence`) |
| WalkAi consumer | **WebSearchProvider** — company reputation and contact data             |

**Request:**

```typescript
{
  companyName: string;
  city?: string;
}
```

**Response:**

```typescript
{
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  externalRatings: Array<{ source, rating, reviewCount, priceRange, url }>;
  newsArticles: Array<{ title, url, snippet }>;
  seasonalPatterns: string[];
  mentions: string[];
  jobListings: string[];
}
```

---

### 4.6 `extract-workspace-data`

Scrapes a URL via Scrapling and provisions a workspace with extracted data.

| Field           | Value                                       |
| --------------- | ------------------------------------------- |
| Auth            | JWT (user must be authenticated)            |
| WalkAi consumer | **QuickSetup** — one-URL workspace creation |

**Request:**

```typescript
{
  url: string;
  config?: Record<string, unknown>;
}
```

**Response:**

```typescript
{
  success: boolean;
  workspaceId: string;
  data: Record<string, unknown>; // Raw Scrapling extraction
}
```

---

### 4.7 `leader-pulse`

Cron function (every 3 days). Generates contextual coaching questions for leaders using Claude Haiku.

| Field           | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Auth            | `WATCHDOG_CRON_SECRET` bearer token                        |
| WalkAi consumer | **ProactiveCoach** — generates leader reflection questions |

**Response:**

```typescript
{
  status: "ok" | "partial";
  questions_generated: number;
  leaders_skipped: number;
  workspaces_processed: number;
  errors?: string[];
  timestamp: string;
}
```

---

### 4.8 `guardian-actions`

Admin REST API for managing Guardian signals (acknowledge, resolve, dismiss).

| Field           | Value                                             |
| --------------- | ------------------------------------------------- |
| Auth            | JWT (must be admin/owner in signal's workspace)   |
| WalkAi consumer | **GuardianManager** — signal lifecycle management |

**Request:**

```typescript
{
  action: "acknowledge" | "resolve" | "dismiss";
  signalId: string;         // UUID
  resolution?: string;
  reason?: string;
  note?: string;
}
```

---

## 5. Background Processes (Stage Engine)

These run as intervals inside the Stage Engine process, not as API endpoints.

| Process                         | Interval                                  | Purpose                                                      |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| Session expiry + memory cleanup | Configurable (`CLEANUP_INTERVAL_MINUTES`) | Expires stale sessions, cleans expired memories              |
| Guardian evaluation loop        | 30 seconds                                | Evaluates all active sessions against guardian rules         |
| Calendar guardian               | 60 seconds                                | Checks season-lifecycle sessions against time-based triggers |

---

## 6. Shared Types Reference

### Key packages

| Package           | Exports used                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `@smartout/types` | `MissionProtocolMessage`, `UICommand`, `UserAction`, `SystemEvent`, `UserActionSchema`, `UICommandSchema` |

### Auth flow summary

```
Browser (JWT) ──┐
                 ├──> Stage Engine auth middleware ──> AuthContext ──> Route handler
API Key ────────┘

Browser (JWT) ──> ?token= query param ──> WebSocket onOpen handler ──> Connection registered
```

### Data flow: Mission session

```
POST /sessions (create) ──> POST /sessions/:id/store (collect data)
                         ──> POST /sessions/:id/fetch (get context)
                         ──> POST /sessions/:id/advance (next stage)
                         ──> WS /ws/:sessionId (real-time UI sync)
                         ──> POST /sessions/:id/abandon (exit)
```

### Data flow: Agent chat session

```
POST /agent/chat { message, profile_id }
  ──> Creates or resumes agent session
  ──> Routes through agent pipeline (intent detection + capability routing)
  ──> Returns response + detected intent
```

### Data flow: Voice session

```
POST /adapters/ultravox/create-call
  ──> Creates engine session
  ──> Builds Ultravox tools pointing to /adapters/ultravox/{store,fetch,advance}
  ──> Creates Ultravox WebRTC call
  ──> Returns join_url for browser
```
