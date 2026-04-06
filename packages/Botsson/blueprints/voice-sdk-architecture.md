---
title: "Voice SDK & Agent Architecture Blueprint"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: Botsson
tags: [blueprint, voice, sdk, architecture]
---

# Voice SDK & Agent Architecture Blueprint

Reference document for building Botsson. Extracted from the Smartout agent-sdk, stage-engine, and frontend integration layer.

---

## 1. Core Hook API: useAgent

**File:** `packages/agent-sdk/src/hooks/useAgent.ts`

The single hook for all agent interactions (voice and chat). Replaces `useBotsson` (onboarding), `VoiceAssistant` inline session management (dashboard + landing).

### AgentConfig

```typescript
type AgentConfig = {
  missionId: MissionId; // Mission ID from the mission registry
  tools?: ClientToolKit; // Client-side tools the agent can invoke
  provider?: "ultravox" | "livekit"; // Voice provider (default: "ultravox")
  channel?: AgentChannel; // "voice" | "chat" | "phone" (default: "voice")
  autoStart?: boolean; // Auto-start session on mount (default: false)
  apiEndpoint?: string; // Session creation API (default: "/api/wizard/start")
  apiParams?: Record<string, unknown>; // Extra body params for session creation
  onDebug?: (entry: DebugEntry) => void; // Debug event callback
  onStatusChange?: (status: AgentStatus) => void; // Status change callback
  onTranscript?: (transcript: TranscriptEntry[]) => void; // Transcript update callback
};
```

### AgentSession (return type)

```typescript
type AgentSession = {
  status: AgentStatus; // Current agent status
  isConnected: boolean; // true when listening, thinking, or speaking
  isSpeaking: boolean; // true when status === "speaking"
  isMuted: boolean; // Mic mute state
  currentText: string; // Last agent message text
  transcript: TranscriptEntry[]; // Full conversation transcript
  debugLog: DebugEntry[]; // Debug log entries
  startSession: () => Promise<void>; // Start a voice/chat session
  endSession: () => void; // End the current session
  toggleMic: () => void; // Toggle microphone mute
  sendContext: (text: string) => void; // Push context text to the agent
};
```

### AgentStatus Flow

```
idle -> connecting -> listening <-> thinking <-> speaking
                         |                         |
                         v                         v
                    disconnecting -> disconnected -> idle
```

Connected statuses (where `isConnected = true`): `listening`, `thinking`, `speaking`.

### Lifecycle

1. `startSession()` called (or `autoStart` fires on mount)
2. Guard: skip if session already exists or start is in progress
3. Set status to `connecting`
4. Get provider (cached), create `VoiceSession`
5. Register client tool implementations from `config.tools`
6. Wire event listeners: `status`, `transcript`, `mic`, `data`
7. Call `buildSessionRequest()` to build API body
8. POST to `apiEndpoint` (default `/api/wizard/start`)
9. Receive `{ joinUrl }` response
10. Call `session.join(joinUrl)` -- provider connects to voice service
11. On unmount: `session.leave()` cleanup

### Provider Cache

Provider instances are cached in a module-level `Map<string, VoiceProvider>` to avoid re-creation on every render. Factory: `getProvider("ultravox" | "livekit")`.

---

## 2. Chat Hook: useAgentChat

**File:** `packages/agent-sdk/src/hooks/useAgentChat.ts`

Lightweight text-only alternative to `useAgent`. No voice provider, no mic management.

### AgentChatConfig

```typescript
type AgentChatConfig = {
  apiEndpoint?: string; // Default: "/api/agent/chat"
  headers?: Record<string, string>; // Extra headers per request
  onResponse?: (text: string) => void; // Called when agent responds
};
```

### AgentChatSession (return type)

```typescript
type AgentChatSession = {
  status: AgentStatus; // "idle" or "thinking"
  messages: TranscriptEntry[]; // Conversation history
  isLoading: boolean; // Request in-flight
  sendMessage: (text: string) => Promise<string>; // Send text, get response
  clearMessages: () => void; // Reset conversation
};
```

### Pipeline

1. `sendMessage(text)` called
2. Abort any pending request (via `AbortController`)
3. Add `{ role: "user", text }` to messages
4. POST `{ message: text }` to `apiEndpoint`
5. Receive `{ response: string }`
6. Add `{ role: "agent", text: response }` to messages
7. Call `onResponse?.(response)`
8. Return the response string

---

## 3. Voice Provider Abstraction

**File:** `packages/agent-sdk/src/providers/voice-provider.ts` (re-export), types in `packages/agent-sdk/src/types.ts`

### VoiceSession Interface

```typescript
type VoiceSession = {
  join(url: string): void;
  leave(): void;
  muteMic(): void;
  unmuteMic(): void;
  isMicMuted: boolean;
  sendText(text: string): void;
  registerTool(name: string, impl: ClientToolImplementation): void;
  on(event: VoiceSessionEvent, handler: VoiceSessionEventHandler): void;
  off(event: VoiceSessionEvent, handler: VoiceSessionEventHandler): void;
};
```

### VoiceProvider Type

```typescript
type VoiceProvider = {
  name: string;
  createSession(): VoiceSession;
};
```

### Events

```typescript
type VoiceSessionEvent = "status" | "transcript" | "data" | "mic";
type VoiceSessionEventHandler = (data: unknown) => void;
```

| Event        | Payload                   | Description                                  |
| ------------ | ------------------------- | -------------------------------------------- |
| `status`     | `AgentStatus`             | Provider status mapped to agent status       |
| `transcript` | `TranscriptEntry[]`       | Full transcript array (user + agent turns)   |
| `mic`        | `{ muted: boolean }`      | Microphone state change                      |
| `data`       | `Record<string, unknown>` | Raw data messages (tool calls, events, etc.) |

### Ultravox Implementation

**File:** `packages/agent-sdk/src/providers/ultravox.ts`

`UltravoxVoiceSession` wraps `UltravoxSession` from `ultravox-client`:

- `join(url)` -> `session.joinCall(url)`
- `leave()` -> `session.leaveCall()`
- `muteMic()` / `unmuteMic()` -> direct delegation
- `sendText(text)` -> `session.sendText(text)`
- `registerTool(name, impl)` -> `session.registerToolImplementation(name, wrapper)`
- Event forwarding: `status` -> maps `UltravoxSessionStatus` enum to `AgentStatus`, `transcripts` -> maps `Role.USER/AGENT` to `TranscriptEntry[]`, `mic` -> mic state, `data_message` -> raw data

Status mapping:

| UltravoxSessionStatus | AgentStatus   |
| --------------------- | ------------- |
| IDLE                  | idle          |
| CONNECTING            | connecting    |
| LISTENING             | listening     |
| THINKING              | thinking      |
| SPEAKING              | speaking      |
| DISCONNECTING         | disconnecting |
| DISCONNECTED          | disconnected  |

### LiveKit Stub

**File:** `packages/agent-sdk/src/providers/livekit.ts`

All methods log `console.warn` -- placeholder for future LiveKit integration. Same `VoiceSession` interface, same `VoiceProvider` factory.

---

## 4. Client Tool System

**Files:** `packages/agent-sdk/src/tools/types.ts`, `packages/agent-sdk/src/tools/registry.ts`

### ClientTool Type

```typescript
type ClientTool = {
  name: string; // Must match modelToolName
  description: string; // Human-readable for the LLM
  parameters: ClientToolParameter[]; // Parameter definitions
  implementation: ClientToolImplementation; // Runtime function
};
```

### ClientToolParameter

```typescript
type ClientToolParameter = {
  name: string;
  location: "PARAMETER_LOCATION_BODY"; // Always body for client tools
  schema: Record<string, unknown>; // JSON Schema fragment
  required?: boolean;
};
```

### ClientToolKit

```typescript
type ClientToolKit = {
  definitions: ClientToolDefinition[]; // Sent to Ultravox
  implementations: Record<string, ClientToolImplementation>; // Registered locally
};

type ClientToolDefinition = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: ClientToolParameter[];
    client: Record<string, never>; // Empty object = client-side tool
  };
};

type ClientToolImplementation = (params: Record<string, unknown>) => string | Promise<string>;
```

### Tool Registry

`createToolRegistry()` returns a mutable registry with:

| Method        | Signature                                   | Description              |
| ------------- | ------------------------------------------- | ------------------------ |
| `register`    | `(tool: ClientTool) => void`                | Register one tool        |
| `registerAll` | `(tools: ClientTool[]) => void`             | Register multiple tools  |
| `get`         | `(name: string) => ClientTool \| undefined` | Lookup by name           |
| `has`         | `(name: string) => boolean`                 | Check existence          |
| `getAll`      | `() => ClientTool[]`                        | All registered tools     |
| `toToolKit`   | `() => ClientToolKit`                       | Build kit from all tools |
| `remove`      | `(name: string) => boolean`                 | Remove a tool            |
| `clear`       | `() => void`                                | Clear all                |

### buildToolKit

```typescript
function buildToolKit(tools: ClientTool[]): ClientToolKit;
```

Converts `ClientTool[]` into `{ definitions, implementations }` shape. Definitions use the Ultravox `temporaryTool` format with `client: {}` marker.

---

## 5. Onboarding Tools

**File:** `packages/agent-sdk/src/tools/onboarding.ts`

`createOnboardingTools(actionsRef)` returns 11 `ClientTool` instances. The `actionsRef` pattern (React ref) ensures tools always call the latest callbacks.

### OnboardingActions Interface

```typescript
type OnboardingActions = {
  getState: () => Record<string, unknown>;
  updateBusiness: (partial: Record<string, unknown>) => void;
  updateSeason: (partial: Record<string, unknown>) => void;
  addDepartments: (names: string[]) => void;
  addLocations: (locs: { name: string; type?: string }[]) => void;
  addZones: (locationName: string, zones: { name: string }[]) => void;
  addProcedures: (names: string[]) => void;
  triggerScrape: (
    url: string,
    orgNumber: string,
    companyName?: string,
    city?: string,
  ) => Promise<void>;
  advanceToNextSection: () => void;
  addKeyFact: (label: string, value: string) => void;
  saveMemory: (content: string, memoryType: string, expiresAt?: string) => Promise<void>;
};
```

### Tool Catalog

| Tool Name              | Parameters                                    | Description                                             |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `getOnboardingState`   | none                                          | Returns current state as JSON                           |
| `updateBusiness`       | `fields` (JSON string)                        | Update business fields (name, orgNumber, website, etc.) |
| `updateSeason`         | `fields` (JSON string)                        | Update season fields (name, startDate, endDate)         |
| `addDepartments`       | `names` (JSON array string)                   | Add departments by name                                 |
| `addLocations`         | `locations` (JSON array string)               | Add locations with name + optional type                 |
| `addZones`             | `locationName`, `zones` (JSON array string)   | Add zones within a location                             |
| `addProcedures`        | `names` (JSON array string)                   | Add/enable procedures by name                           |
| `triggerScrape`        | `url?`, `orgNumber?`, `companyName?`, `city?` | Trigger business website scan (fire-and-forget)         |
| `advanceToNextSection` | none                                          | Scroll UI to next section                               |
| `addKeyFact`           | `label`, `value`                              | Add fact to visual panel (builds trust)                 |
| `saveMemory`           | `content`, `memoryType`, `expiresAt?`         | Save persistent memory (constant/temporal)              |

All tools return JSON string results: `{ success: true, ... }` or `{ success: false, error: "..." }`.

**Note:** The legacy `useBotsson` hook has 3 additional tools not yet ported to the SDK: `searchCompany`, `identifyCompany`, `scrapeWebsite`, `finalizeOnboarding`. These are defined inline in `useBotsson.ts`.

---

## 6. Dashboard Tools

**File:** `packages/agent-sdk/src/tools/dashboard.ts`

`createDashboardTools(actionsRef)` returns 2 `ClientTool` instances.

### DashboardActions Interface

```typescript
type DashboardActions = {
  navigateTo: (path: string) => void;
  showModule: (module: string) => void;
};
```

### Tool Catalog

| Tool Name             | Parameters        | Description                                                |
| --------------------- | ----------------- | ---------------------------------------------------------- |
| `navigateToDashboard` | `path` (string)   | Navigate to dashboard path (e.g. `/dashboard/schedule`)    |
| `showModule`          | `module` (string) | Show a specific module panel (e.g. `schedule`, `training`) |

---

## 7. Session Context Builder

**File:** `packages/agent-sdk/src/context/session-context.ts`

### SessionIdentity

```typescript
type SessionIdentity = {
  userId?: string;
  profileId?: string;
  workspaceId?: string;
  channel: AgentChannel; // "voice" | "chat" | "phone"
};
```

### buildSessionRequest

```typescript
function buildSessionRequest(params: {
  missionId: string;
  tools?: { definitions: unknown[] };
  identity?: SessionIdentity;
  extraParams?: Record<string, unknown>;
}): Record<string, unknown>;
```

Builds the API request body:

```json
{
  "mission_id": "onboarding-interview",
  "selected_tools": [
    /* ClientToolDefinition[] */
  ],
  "user_id": "...",
  "profile_id": "...",
  "workspace_id": "...",
  "channel": "voice",
  "...extraParams": {}
}
```

- `selected_tools` only included if definitions array is non-empty
- Identity fields only included if `identity` is provided and fields are truthy
- `extraParams` are spread into the body (e.g. `voice`, `first_speaker`, `context`)

---

## 8. Backend: Stage Engine API

**Service:** `services/stage-engine/` (Hono framework, port 3000)

### Session Endpoints

**File:** `services/stage-engine/src/routes/sessions.ts`

| Endpoint                     | Method | Description                 |
| ---------------------------- | ------ | --------------------------- |
| `POST /sessions`             | POST   | Create a new engine session |
| `GET /sessions/:id`          | GET    | Get session status and data |
| `POST /sessions/:id/abandon` | POST   | Abandon an active session   |

#### POST /sessions

Request:

```typescript
{
  mission_id: string;          // Required
  workspace_id: string;        // Required (UUID)
  user_id?: string;            // UUID
  profile_id?: string;         // UUID
  channel: "voice" | "sms" | "chat" | "email" | "autonomous";
  callback_url?: string;       // Webhook URL
  context?: Record<string, unknown>;
}
```

Response:

```json
{
  "session_id": "uuid",
  "current_stage": { "stage_id": "...", "goal": "..." },
  "progress": { "current": 0, "total": 5 },
  "system_prompt": "..."
}
```

#### GET /sessions/:id

Response:

```json
{
  "session_id": "uuid",
  "status": "active",
  "current_stage_id": "...",
  "stage_index": 0,
  "collected_data": {},
  "context": {},
  "summary": null,
  "channel": "voice",
  "expires_at": "...",
  "created_at": "..."
}
```

### Store Endpoint

**File:** `services/stage-engine/src/routes/store.ts`

#### POST /sessions/:id/store

Request:

```typescript
{
  entity_type: string;                  // Category: "person", "problem", "note", etc.
  data: Record<string, unknown>;        // Key-value data
  stage_id?: string;                    // Override current stage
}
```

Response:

```json
{
  "inbox_id": "uuid",
  "confirmed": true,
  "message": "Data stored successfully. Type: person. Continue with the conversation."
}
```

Side effects: Guardian event emitted (`data.collected`), fire-and-forget guardian evaluation.

### Fetch Endpoint

**File:** `services/stage-engine/src/routes/fetch.ts`

#### POST /sessions/:id/fetch

Request:

```typescript
{
  query_type: "context" | "inbox" | "stage" | "history";
  filters?: {
    entity_type?: string;
    stage_id?: string;
  };
}
```

Response varies by `query_type`:

| query_type | Returns                                              |
| ---------- | ---------------------------------------------------- |
| `context`  | Session context (identity, workspace info)           |
| `inbox`    | `{ entries: [...] }` -- stored inbox items           |
| `stage`    | Current stage details (goal, instructions, criteria) |
| `history`  | All `collected_data` across stages                   |

Guardian whispers are delivered on `context` and `stage` queries, then cleared.

### Advance Endpoint

**File:** `services/stage-engine/src/routes/advance.ts`

#### POST /sessions/:id/advance

Request:

```typescript
{
  result?: Record<string, unknown>;   // Summary data for completed stage
  next_stage_id?: string;             // Optional explicit next stage
  force?: boolean;                    // Force advance
}
```

Response:

```json
{
  "complete": false,
  "new_stage": { "stage_id": "...", "goal": "..." },
  "system_prompt": "...",
  "progress": { "current": 2, "total": 5 }
}
```

Or if mission complete:

```json
{
  "complete": true,
  "summary": "All stages finished."
}
```

### Ultravox Adapter Endpoints

**File:** `services/stage-engine/src/routes/adapters/ultravox.ts`

These wrap the core endpoints in Ultravox-compatible format (text responses, query param session routing, new-stage headers).

| Endpoint                              | Method | Description                                    |
| ------------------------------------- | ------ | ---------------------------------------------- |
| `POST /adapters/ultravox/create-call` | POST   | Create session + Ultravox call, return joinUrl |
| `POST /adapters/ultravox/store`       | POST   | Store data (session_id via query param)        |
| `POST /adapters/ultravox/fetch`       | POST   | Fetch data (session_id via query param)        |
| `POST /adapters/ultravox/advance`     | POST   | Advance stage, return new-stage response       |

#### POST /adapters/ultravox/create-call

Request:

```typescript
{
  mission_id: string;
  workspace_id?: string;
  user_id?: string;
  profile_id?: string;
  voice?: string;
  language?: string;                             // Default: "no"
  first_speaker?: "user" | "agent";
  context?: Record<string, unknown>;
  selected_tools?: Array<Record<string, unknown>>; // Client tool definitions
}
```

Response:

```json
{
  "session_id": "uuid",
  "call_id": "ultravox-call-id",
  "join_url": "wss://..."
}
```

Flow:

1. Create engine session via `createSession()`
2. Build HTTP tools pointing to engine adapter endpoints (skipped in local dev -- no HTTPS)
3. Merge HTTP tools + client tools from `selected_tools`
4. Call Ultravox Create Call API with system prompt + tools
5. Return session_id, call_id, join_url

#### POST /adapters/ultravox/advance (new-stage response)

When advancing to a new stage, returns:

```typescript
// Header: X-Ultravox-Response-Type: new-stage
{
  systemPrompt: string; // New stage system prompt
  toolResultText: string; // "Stage transition: now in ..."
}
```

This triggers Ultravox to seamlessly swap the system prompt mid-call without dropping the WebSocket connection.

When mission is complete, returns plain text (no new-stage header).

### Agent Chat Endpoint

**File:** `services/stage-engine/src/routes/agent/chat.ts`

#### POST /agent/chat

Request:

```typescript
{
  message: string;                       // User message (min 1 char)
  session_id?: string;                   // Resume existing session (UUID)
  profile_id: string;                    // Required (UUID)
  channel?: "chat" | "voice";           // Default: "chat"
}
```

Response:

```typescript
{
  session_id: string;
  response: string;
  intent?: {
    capability: string;
    confidence: number;
  };
}
```

Flow:

1. Load existing session or create new agent session
2. Append user turn to conversation history
3. Emit guardian event (`user.message`)
4. Route through `routeAgentMessage()` pipeline
5. Append assistant turn
6. Emit guardian event (`agent.response`)

---

## 9. Frontend API Routes

**File:** `apps/web/src/app/api/wizard/start/route.ts`

### POST /api/wizard/start

Next.js API route that proxies voice call creation to the Stage Engine.

**Auth:** Optional for onboarding (`onboarding-interview` mission) and showcase voice. Required for all other missions.

**Flow:**

1. Try to get authenticated user from Supabase
2. Look up profile + workspace for authenticated users
3. Build `CreateCallPayload`
4. POST to `${STAGE_ENGINE_URL}/adapters/ultravox/create-call`
5. If mission not found (404), fallback to `mr-botsson` mission
6. Return `{ sessionId, joinUrl, callId, requestId }`

**Environment:**

- `STAGE_ENGINE_URL` -- required
- `STAGE_ENGINE_API_KEY` -- required, sent as `x-api-key` header

**Response:**

```json
{
  "sessionId": "uuid",
  "joinUrl": "wss://...",
  "callId": "ultravox-call-id",
  "requestId": "uuid"
}
```

**Error codes:** 401 (unauthorized), 400 (no workspace), 503 (not configured), 502 (stage engine error).

---

## 10. Session Lifecycle (Backend Flow)

```
1. Frontend calls POST /api/wizard/start
2. Next.js route proxies to Stage Engine POST /adapters/ultravox/create-call
3. Stage Engine:
   a. createSession() -- loads mission, builds system prompt, inserts engine_sessions row
   b. buildUltravoxTools() -- creates HTTP tools (store, fetch, advance, getJourneyContext)
   c. Merges HTTP tools + client tools from request
   d. createUltravoxCall() -- calls Ultravox API with prompt + tools
   e. Returns { session_id, call_id, join_url }
4. Frontend receives joinUrl
5. useAgent calls session.join(joinUrl)
6. Ultravox WebSocket connects (browser <-> Ultravox voice service)
7. During conversation:
   - Agent invokes HTTP tools (store/fetch/advance) -> calls Stage Engine endpoints
   - Agent invokes client tools -> runs in browser via registered implementations
   - Stage transitions: advance tool returns X-Ultravox-Response-Type: new-stage
8. Session ends: session.leave() disconnects WebSocket
```

---

## 11. Message Routing (Chat Mode)

```
1. Frontend calls useAgentChat.sendMessage(text)
2. POST { message, session_id?, profile_id } to /api/agent/chat (proxied to Stage Engine)
3. Stage Engine POST /agent/chat:
   a. Load or create agent session (mode: "agent", not "mission")
   b. Append user turn to conversation history
   c. Emit guardian event: user.message
   d. routeAgentMessage() -- processes through agent router pipeline
   e. Append assistant turn
   f. Emit guardian event: agent.response
4. Return { session_id, response, intent? }
5. useAgentChat adds response to messages array
```

---

## 12. Ultravox HTTP Tools

**File:** `services/stage-engine/src/lib/ultravox.ts`

`buildUltravoxTools(engineUrl, sessionId, apiKey)` creates 4 HTTP tools that the Ultravox-hosted LLM calls server-side during a voice call:

### Tool Definitions

| Tool Name           | Target Endpoint                              | Description                                           |
| ------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `store`             | `POST {engineUrl}/adapters/ultravox/store`   | Store collected data to engine inbox                  |
| `fetch`             | `POST {engineUrl}/adapters/ultravox/fetch`   | Retrieve context, inbox, stage, or history            |
| `advance`           | `POST {engineUrl}/adapters/ultravox/advance` | Advance to next stage (new-stage response)            |
| `getJourneyContext` | `POST {engineUrl}/adapters/ultravox/fetch`   | Get current journey step (pre-set query_type=context) |

### Static Parameters (invisible to AI)

All tools include these static parameters for auth and session routing:

- `session_id` in `PARAMETER_LOCATION_QUERY` -- routes to correct session
- `x-api-key` in `PARAMETER_LOCATION_HEADER` -- authenticates with Stage Engine

These never appear in the LLM's tool schema -- only in the HTTP request. Secrets stay out of `baseUrlPattern` to avoid leaking via logs/referrer headers.

### Local Dev Caveat

HTTP tools are **skipped** when `ENGINE_URL` starts with `http://` (no HTTPS). Ultravox requires HTTPS for tool callbacks. Client tools (with `client: {}`) always work since they run in the browser.

---

## 13. Data Flow Diagram

```
                              FRONTEND (Browser)
 +------------------------------------------------------------------------+
 |                                                                        |
 |  useAgent(config)                                                      |
 |    |                                                                   |
 |    +-- buildSessionRequest() --> POST /api/wizard/start                |
 |    |                                  |                                |
 |    |                                  v                                |
 |    |                         Next.js API Route                         |
 |    |                           (auth + proxy)                          |
 |    |                                  |                                |
 |    |                                  | POST /adapters/ultravox/       |
 |    |                                  |       create-call              |
 |    |                                  v                                |
 |    |                      +-------------------+                        |
 |    |                      |   STAGE ENGINE    |                        |
 |    |                      |   (Hono, :3000)   |                        |
 |    |                      |                   |                        |
 |    |                      | 1. createSession  |                        |
 |    |                      | 2. buildTools     |                        |
 |    |                      | 3. createCall     |------> Ultravox API    |
 |    |                      |                   |<------ { joinUrl }     |
 |    |                      +-------------------+                        |
 |    |                              |                                    |
 |    |<---- { joinUrl } -----------+                                     |
 |    |                                                                   |
 |    +-- session.join(joinUrl)                                           |
 |    |                                                                   |
 |    v                                                                   |
 |  UltravoxVoiceSession <========= WebSocket =========> Ultravox Voice   |
 |    |                                                    Service        |
 |    |  Events:                                             |            |
 |    |  - status -> setStatus()                             |            |
 |    |  - transcript -> setTranscript()                     |            |
 |    |  - mic -> setIsMuted()                               |            |
 |    |  - data -> addDebug()                                |            |
 |    |                                                      |            |
 |    |  Client Tools (in-browser):                          |            |
 |    |  - getOnboardingState()                              |            |
 |    |  - updateBusiness(fields)           HTTP Tools       |            |
 |    |  - addKeyFact(label, value)       (server-side):     |            |
 |    |  - advanceToNextSection()            |                |            |
 |    |  - saveMemory(...)                   +-- store -----> Stage Engine |
 |    |  - ...                               +-- fetch -----> Stage Engine |
 |    |                                      +-- advance ---> Stage Engine |
 |    |                                      +-- getCtx ----> Stage Engine |
 |    |                                                      |            |
 +------------------------------------------------------------------------+
                                                             |
                                                             v
                                                      +-----------+
                                                      | Supabase  |
                                                      | (PG + RLS)|
                                                      +-----------+
                                                      | engine_   |
                                                      | sessions  |
                                                      | engine_   |
                                                      | inbox     |
                                                      | engine_   |
                                                      | memory    |
                                                      +-----------+
```

### Two Tool Execution Paths

1. **Client Tools** (`client: {}` marker): Executed in the browser via `session.registerTool()`. The Ultravox SDK intercepts the tool call and runs the registered implementation. Used for UI mutations (update forms, scroll, navigate).

2. **HTTP Tools** (`http: { baseUrlPattern, httpMethod }` marker): Executed server-side by Ultravox. The voice service makes an HTTP POST to the Stage Engine endpoint. Used for data persistence (store, fetch, advance). Require HTTPS in production.

### Key Architectural Decision

The frontend never calls store/fetch/advance directly. The Ultravox-hosted LLM decides when to call these tools based on the conversation. The browser only handles UI-side tools. This separation keeps data persistence on the server while allowing real-time UI updates from the browser.

---

## Appendix: Legacy useBotsson

**File:** `apps/web/src/app/onboarding/hooks/useBotsson.ts`

The original onboarding hook that `useAgent` replaces. Contains inline tool definitions and implementations. Notable differences from the SDK version:

- Uses `UltravoxSession` directly (no provider abstraction)
- Has 14 tools vs SDK's 11 (includes `searchCompany`, `identifyCompany`, `scrapeWebsite`, `finalizeOnboarding`)
- Tool definitions are inline objects (not built via `buildToolKit`)
- Hard-coded to `mission_id: "onboarding-interview"`, voice `"Mark"`, `first_speaker: "agent"`
- Uses `toast` for error display

These 4 extra tools should be migrated to the SDK's `createOnboardingTools` when Botsson fully replaces `useBotsson`.
