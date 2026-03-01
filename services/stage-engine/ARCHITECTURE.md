# Stage Engine — ARCHITECTURE.md

> **Project:** Smartout Stage Engine (Universal Agent Gateway)
> **Date:** 2026-03-01
> **Input:** DECISIONS.md + BREAKDOWN.md
> **Status:** Architecture Complete
> **Next:** PRD (Mode 4)

---

## 1. System Overview

```
                         ┌─────────────┐
                         │   Caddy      │
                         │  (HTTPS)     │
                         │  :443        │
                         └──────┬───────┘
                                │
                    ┌───────────▼────────────┐
                    │    Stage Engine (Hono)   │
                    │    :3000                 │
                    │                          │
                    │  ┌──────────────────┐    │
                    │  │  Auth Middleware  │    │
                    │  │  (JWT + API Key) │    │
                    │  └────────┬─────────┘    │
                    │           │               │
                    │  ┌────────▼─────────┐    │
                    │  │  Route Layer      │    │
                    │  │  /sessions        │    │
                    │  │  /sessions/:id/*  │    │
                    │  │  /adapters/uv/*   │    │
                    │  └────────┬─────────┘    │
                    │           │               │
                    │  ┌────────▼─────────┐    │
                    │  │  Engine Core      │    │
                    │  │  - SessionManager │    │
                    │  │  - StageManager   │    │
                    │  │  - PromptBuilder  │    │
                    │  │  - WebhookSender  │    │
                    │  └────────┬─────────┘    │
                    │           │               │
                    └───────────┼───────────────┘
                                │
               Docker network: smartout-internal
                                │
                    ┌───────────▼────────────┐
                    │      Supabase          │
                    │  (external, managed)    │
                    │                         │
                    │  engine_missions        │
                    │  engine_stages          │
                    │  engine_sessions        │
                    │  engine_inbox           │
                    │  platform_api_key       │
                    └─────────────────────────┘
```

---

## 2. Data Flows

### 2.1 Start Session

```
1. Client → POST /sessions { mission_id, workspace_id, channel }
2. Auth middleware → validate x-api-key or JWT via Supabase
3. SessionManager → load mission + stages from engine_missions/engine_stages
4. SessionManager → load identity context (profile, workspace) from Supabase
5. SessionManager → create row in engine_sessions (status: active)
6. PromptBuilder → build initial system prompt from agent + stage 1
7. WebhookSender → fire session.started (async)
8. → Response { session_id, mission, current_stage, context, progress }
```

### 2.2 Store Data

```
1. Client → POST /sessions/:id/store { entity_type, data }
2. Auth middleware → validate
3. SessionManager → verify session is active + not expired
4. Validation → check entity_type, data size, format
5. Write → insert into engine_inbox
6. → Response { inbox_id, confirmed: true, message: "Stored. Next: [instruction]" }
```

### 2.3 Fetch Context

```
1. Client → POST /sessions/:id/fetch { query_type, filters? }
2. Auth middleware → validate
3. SessionManager → verify session exists
4. Router → based on query_type:
   - "context"  → read profile + workspace from Supabase
   - "inbox"    → read engine_inbox for this session
   - "stage"    → read current stage details
   - "history"  → read collected_data from session
5. → Response { data }
```

### 2.4 Advance Stage

```
1. Client → POST /sessions/:id/advance { result?, next_stage_id? }
2. Auth middleware → validate
3. SessionManager → verify session is active
4. If result → save to collected_data[current_stage_id]
5. StageManager → determine next stage:
   - Sequential: use stage.next_stage
   - Free: use next_stage_id from request
   - Hybrid: required stages sequential, optional stages free
6. If no next stage → mark session complete
7. Update engine_sessions (current_stage_id, stage_index, status)
8. PromptBuilder → build new system prompt
9. WebhookSender → fire stage.changed or session.completed (async)
10. → Response { new_stage, progress, complete, system_prompt }
```

### 2.5 Ultravox Adapter Flow

```
1. Client → POST /adapters/ultravox/create-call { mission_id, workspace_id, voice? }
2. Engine → start session (flow 2.1)
3. Engine → build Ultravox call payload:
   - systemPrompt from PromptBuilder
   - selectedTools: [store, fetch, advance] as HTTP tools pointing back to engine
   - voice, languageHint, initialState with session_id
4. Engine → POST https://api.ultravox.ai/api/calls
5. → Response { session_id, call_id, join_url }

--- During call ---

6. Ultravox agent calls store tool → POST /adapters/ultravox/store
7. Engine stores data, returns tool result text
8. Ultravox agent calls advance → POST /adapters/ultravox/advance
9. Engine advances stage, returns with header X-Ultravox-Response-Type: new-stage
10. Ultravox seamlessly transitions to new system prompt
```

---

## 3. Database Schema

### 3.1 engine_missions

```sql
CREATE TABLE engine_missions (
  id              TEXT PRIMARY KEY,                    -- e.g. "discovery-call", "schedule-assistant"
  name            TEXT NOT NULL,
  description     TEXT,
  mode            TEXT NOT NULL DEFAULT 'sequential'
                    CHECK (mode IN ('sequential', 'free', 'hybrid')),
  context_source  TEXT,                                -- e.g. "/dashboard/schedule", "phone:+47..."
  workspace_id    UUID REFERENCES workspace(workspace_id),  -- NULL = global mission
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_missions ENABLE ROW LEVEL SECURITY;

-- Global missions readable by all, workspace missions by workspace members
CREATE POLICY "read_missions" ON engine_missions
FOR SELECT USING (
  workspace_id IS NULL
  OR workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

CREATE INDEX idx_engine_missions_context ON engine_missions (context_source)
  WHERE is_active = true;
CREATE INDEX idx_engine_missions_workspace ON engine_missions (workspace_id)
  WHERE is_active = true;
```

### 3.2 engine_stages

```sql
CREATE TABLE engine_stages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id              TEXT NOT NULL REFERENCES engine_missions(id) ON DELETE CASCADE,
  stage_id                TEXT NOT NULL,               -- e.g. "greeting", "problem", "confirm"
  stage_order             INTEGER NOT NULL,

  -- Agent instruction layer
  goal                    TEXT NOT NULL,                -- What to achieve in this stage
  instructions            TEXT NOT NULL,                -- How to achieve it
  success_criteria        TEXT NOT NULL,                -- When is this stage done
  escalation_instructions TEXT,                         -- What to do if stuck

  -- Personality overlay (overrides agent defaults for this stage)
  personality_override    TEXT,                         -- e.g. "Be extra warm and patient"
  emotion_hint            TEXT,                         -- e.g. "frustration", "joy", "urgency"
  creative_freedom        REAL NOT NULL DEFAULT 0.7
                            CHECK (creative_freedom >= 0 AND creative_freedom <= 1),

  -- Navigation
  next_stage              TEXT,                         -- stage_id of next stage (sequential mode)
  is_required             BOOLEAN NOT NULL DEFAULT true,

  -- Deferred message templates (sent by Director)
  deferred_templates      JSONB DEFAULT '[]',          -- [{ trigger: "sentiment < 0.3", message: "..." }]

  -- Inline instruction templates
  inline_instructions     JSONB DEFAULT '[]',          -- [{ after: "store", message: "Good. Now ask about..." }]

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_mission_stage UNIQUE (mission_id, stage_id),
  CONSTRAINT uq_mission_order UNIQUE (mission_id, stage_order)
);

ALTER TABLE engine_stages ENABLE ROW LEVEL SECURITY;

-- Stages inherit mission's visibility
CREATE POLICY "read_stages" ON engine_stages
FOR SELECT USING (
  mission_id IN (SELECT id FROM engine_missions)  -- leverages mission RLS
);

CREATE INDEX idx_engine_stages_mission ON engine_stages (mission_id, stage_order);
```

### 3.3 engine_sessions

```sql
CREATE TABLE engine_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id      TEXT NOT NULL REFERENCES engine_missions(id),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),

  -- Identity
  user_id         UUID,                                -- Supabase auth user
  profile_id      UUID,                                -- Smartout profile
  channel         TEXT NOT NULL
                    CHECK (channel IN ('voice', 'sms', 'chat', 'email', 'autonomous')),

  -- State
  current_stage_id TEXT,                               -- Current stage_id
  stage_index      INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'complete', 'expired', 'abandoned')),

  -- Data
  context          JSONB NOT NULL DEFAULT '{}',        -- Identity + workspace context loaded at start
  collected_data   JSONB NOT NULL DEFAULT '{}',        -- { "greeting": {...}, "problem": {...} }
  summary          TEXT,                                -- Rolling summary from Director

  -- Callbacks
  callback_url     TEXT,

  -- Timestamps
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_sessions" ON engine_sessions
FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

CREATE INDEX idx_engine_sessions_workspace_status
  ON engine_sessions (workspace_id, status)
  WHERE status = 'active';
CREATE INDEX idx_engine_sessions_expiry
  ON engine_sessions (expires_at)
  WHERE status = 'active';
CREATE INDEX idx_engine_sessions_context_source
  ON engine_sessions (mission_id, workspace_id, status);
```

### 3.4 engine_inbox

```sql
CREATE TABLE engine_inbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES engine_sessions(id) ON DELETE CASCADE,
  stage_id        TEXT NOT NULL,
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),

  entity_type     TEXT NOT NULL,                       -- "department", "shift", "note", etc.
  data            JSONB NOT NULL,                      -- Freeform data

  validated       BOOLEAN NOT NULL DEFAULT false,
  processed       BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_inbox" ON engine_inbox
FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

CREATE INDEX idx_engine_inbox_session ON engine_inbox (session_id, stage_id);
CREATE INDEX idx_engine_inbox_processing ON engine_inbox (workspace_id, processed)
  WHERE processed = false;
```

---

## 4. API Design

Base URL: `https://engine.smartout.ai`

All endpoints except `/health` require auth via `x-api-key` or `Authorization: Bearer`.

### 4.1 Core Endpoints

```
GET  /health
POST /sessions
GET  /sessions/:id
POST /sessions/:id/store
POST /sessions/:id/fetch
POST /sessions/:id/advance
POST /sessions/:id/abandon
```

### 4.2 Ultravox Adapter Endpoints

```
POST /adapters/ultravox/create-call
POST /adapters/ultravox/store
POST /adapters/ultravox/fetch
POST /adapters/ultravox/advance
```

### 4.3 Endpoint Specifications

#### POST /sessions

```typescript
// Request
{
  mission_id: string,          // "discovery-call"
  workspace_id: string,        // UUID
  user_id?: string,            // UUID — who initiated
  profile_id?: string,         // UUID — Smartout profile
  channel: "voice" | "sms" | "chat" | "email" | "autonomous",
  callback_url?: string,       // Webhook URL for events
  context?: Record<string, unknown>  // Additional context to inject
}

// Response 200
{
  session_id: string,
  mission: {
    id: string,
    name: string,
    mode: "sequential" | "free" | "hybrid"
  },
  current_stage: {             // null if free mode
    stage_id: string,
    goal: string,
    instructions: string,
    success_criteria: string,
    emotion_hint?: string
  },
  stages?: StageDefinition[],  // All stages if free mode
  context: Record<string, unknown>,
  progress: string,            // "1/3"
  system_prompt: string        // Ready-to-use prompt for LLM
}

// Errors
// 404: Mission not found
// 401: Auth failed
// 400: Missing required fields
```

#### POST /sessions/:id/store

```typescript
// Request
{
  entity_type: string,         // "department", "shift", "note"
  data: Record<string, unknown>,
  stage_id?: string            // Override current stage
}

// Response 200
{
  inbox_id: string,
  confirmed: true,
  message: string              // Tool result instruction for agent
}

// Errors
// 404: Session not found or expired
// 400: Validation error
```

#### POST /sessions/:id/fetch

```typescript
// Request
{
  query_type: "context" | "inbox" | "stage" | "history",
  filters?: {
    entity_type?: string,
    stage_id?: string
  }
}

// Response 200
{
  data: Record<string, unknown>  // Shape depends on query_type
}

// Errors
// 404: Session not found
```

#### POST /sessions/:id/advance

```typescript
// Request
{
  result?: Record<string, unknown>,  // Data to save for current stage
  next_stage_id?: string,            // Required for free mode
  force?: boolean                     // Skip success criteria check
}

// Response 200
{
  new_stage?: {
    stage_id: string,
    goal: string,
    instructions: string,
    success_criteria: string,
    emotion_hint?: string
  },
  progress: string,
  complete: boolean,
  system_prompt?: string,      // New prompt if stage changed
  summary?: string             // Final summary if complete
}

// Errors
// 409: Session not active
// 404: Session not found
// 400: next_stage_id required for free mode
```

#### POST /adapters/ultravox/create-call

```typescript
// Request
{
  mission_id: string,
  workspace_id: string,
  user_id?: string,
  voice?: string,              // Ultravox voice ID
  language?: string            // "no", "sv", "en"
}

// Response 200
{
  session_id: string,
  call_id: string,             // Ultravox call ID
  join_url: string             // WebRTC join URL for frontend
}
```

#### POST /adapters/ultravox/advance

```typescript
// Same request as /sessions/:id/advance
// Session ID extracted from Ultravox call state

// Response — Ultravox new-stage format
// Header: X-Ultravox-Response-Type: new-stage
{
  systemPrompt: string,
  toolResultText: string,
  selectedTools?: UltravoxTool[]  // Updated tools if needed
}
```

---

## 5. File Structure

```
stage-engine/
├── src/
│   ├── index.ts                    # Hono app entry point, route registration
│   │
│   ├── routes/
│   │   ├── health.ts               # GET /health
│   │   ├── sessions.ts             # POST /sessions, GET /sessions/:id
│   │   ├── store.ts                # POST /sessions/:id/store
│   │   ├── fetch.ts                # POST /sessions/:id/fetch
│   │   ├── advance.ts              # POST /sessions/:id/advance
│   │   ├── abandon.ts              # POST /sessions/:id/abandon
│   │   └── adapters/
│   │       └── ultravox.ts         # All /adapters/ultravox/* endpoints
│   │
│   ├── core/
│   │   ├── session-manager.ts      # Create, load, expire, abandon sessions
│   │   ├── stage-manager.ts        # Stage navigation, mode logic
│   │   ├── prompt-builder.ts       # Build system prompts from agent + stage
│   │   ├── webhook-sender.ts       # Async webhook with retry
│   │   └── inbox-writer.ts         # Validate and write to inbox
│   │
│   ├── middleware/
│   │   ├── auth.ts                 # Dual-auth: API key + JWT via Supabase
│   │   └── error-handler.ts        # Global error handling
│   │
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client factory
│   │   ├── ultravox.ts             # Ultravox API client
│   │   └── crypto.ts               # SHA-256 helper for key validation
│   │
│   └── types/
│       ├── session.ts              # Session, Mission, Stage types
│       ├── api.ts                  # Request/response types
│       ├── auth.ts                 # AuthContext type
│       └── ultravox.ts             # Ultravox-specific types
│
├── supabase/
│   └── migrations/
│       ├── 001_engine_tables.sql   # All 4 tables + enums
│       ├── 002_engine_indexes.sql  # All indexes
│       ├── 003_engine_rls.sql      # All RLS policies
│       └── 004_engine_seed.sql     # Test mission + stages
│
├── test/
│   └── e2e.ts                      # End-to-end lifecycle test
│
├── Dockerfile
├── docker-compose.yml
├── Caddyfile
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 6. Integration Points

| External System       | Integration                                         | Direction          |
| --------------------- | --------------------------------------------------- | ------------------ |
| Supabase Auth         | JWT validation via `getUser()`                      | Engine → Supabase  |
| Supabase DB           | CRUD on engine\_\* tables + platform_api_key lookup | Engine → Supabase  |
| Ultravox API          | Create calls, register tools                        | Engine → Ultravox  |
| Ultravox Runtime      | Tool calls during active voice calls                | Ultravox → Engine  |
| n8n                   | Webhook receiver for session events                 | Engine → n8n       |
| Dashboard (Next.js)   | Start sessions, create calls                        | Dashboard → Engine |
| Future: LiveKit       | Same adapter pattern as Ultravox                    | LiveKit → Engine   |
| Future: Python agents | Direct HTTP calls to /sessions/\*                   | Python → Engine    |

---

## 7. Deployment

### 7.1 Docker Compose (Production)

```yaml
version: "3.8"

networks:
  smartout-internal:
    driver: bridge

services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - smartout-internal
    restart: unless-stopped

  stage-engine:
    build: .
    environment:
      - PORT=3000
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - ULTRAVOX_API_KEY=${ULTRAVOX_API_KEY}
      - ENGINE_URL=https://engine.smartout.ai
    networks:
      - smartout-internal
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

### 7.2 Caddyfile

```
engine.smartout.ai {
  reverse_proxy stage-engine:3000
}
```

### 7.3 Dockerfile

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime stage
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## 8. Security

| Concern             | Solution                                                     |
| ------------------- | ------------------------------------------------------------ |
| Auth                | Dual-auth via Supabase (JWT + API key hash lookup)           |
| Workspace isolation | RLS on all engine\_\* tables + set_config for API key auth   |
| Secrets             | No secrets in code — all via env vars, validated at startup  |
| HTTPS               | Caddy auto-TLS with Let's Encrypt                            |
| Network             | Docker internal network — only Caddy exposed to internet     |
| Input validation    | Zod schemas on all request bodies                            |
| Rate limiting       | Future: Upstash Redis (not MVP, uses Supabase rate limiting) |
| Key format          | Existing `smo_svc_live_*` — no new prefixes                  |

---

## 9. Environment Variables

```bash
# .env.example

# Server
PORT=3000
ENGINE_URL=https://engine.smartout.ai

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-REPLACE_ME

# Ultravox
ULTRAVOX_API_KEY=your-ultravox-key-REPLACE_ME

# Optional
LOG_LEVEL=info
SESSION_EXPIRY_HOURS=24
CLEANUP_INTERVAL_MINUTES=5
```

---

_Every table referenced by at least one story. Every endpoint maps to a story. Every integration has a trigger and payload. Ready for PRD._
