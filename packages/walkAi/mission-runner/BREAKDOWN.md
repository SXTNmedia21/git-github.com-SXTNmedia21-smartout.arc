# Stage Engine — BREAKDOWN.md

> **Project:** Smartout Stage Engine (Universal Agent Gateway)
> **Date:** 2026-03-01
> **Input:** DECISIONS.md
> **Status:** Breakdown Complete
> **Next:** Architecture (Mode 3)

---

## Epic Overview

| Epic      | Name                      | Stories        | Depends on |
| --------- | ------------------------- | -------------- | ---------- |
| 1         | Infrastructure            | 4              | —          |
| 2         | Data Model                | 3              | Epic 1     |
| 3         | Session Lifecycle         | 4              | Epic 2     |
| 4         | Store & Fetch Tools       | 3              | Epic 3     |
| 5         | Stage Transitions         | 3              | Epic 3     |
| 6         | Channel Adapter: Ultravox | 3              | Epic 4 + 5 |
| 7         | End-to-End Verification   | 2              | Epic 6     |
| **Total** |                           | **22 stories** |            |

---

## Epic 1: Infrastructure

Set up the runtime environment. After this epic, we have a running Hono server in Docker behind Caddy with HTTPS.

### 1.1 — Hono project scaffold

**What:** Create a new TypeScript project with Hono, configured for Docker deployment.

**Acceptance Criteria:**

- [ ] New repo: `stage-engine/`
- [ ] `package.json` with Hono, TypeScript, tsx (dev), Supabase JS client
- [ ] `tsconfig.json` with strict mode
- [ ] `src/index.ts` — Hono app with `GET /health` returning `{ status: "ok", version: "0.1.0" }`
- [ ] `pnpm dev` starts the server on port 3000
- [ ] All code comments in English explaining what each file does

### 1.2 — Dockerfile and Docker Compose

**What:** Containerize the Hono app and define the Docker network.

**Acceptance Criteria:**

- [ ] `Dockerfile` — multi-stage build (build + runtime), Node 22 Alpine
- [ ] `docker-compose.yml` — stage-engine service on `smartout-internal` network, port 3000
- [ ] `docker compose up` starts the service
- [ ] `docker compose down` stops cleanly
- [ ] Health endpoint responds inside container

### 1.3 — Caddy reverse proxy

**What:** Add Caddy as a reverse proxy with automatic HTTPS.

**Acceptance Criteria:**

- [ ] `Caddyfile` configured for `engine.smartout.ai` → `stage-engine:3000`
- [ ] Caddy service added to `docker-compose.yml` on same network
- [ ] HTTPS works with automatic Let's Encrypt certificate
- [ ] HTTP redirects to HTTPS
- [ ] Health endpoint accessible via `https://engine.smartout.ai/health`

### 1.4 — Auth middleware

**What:** Implement dual-auth middleware that validates service keys and JWTs via Supabase.

**Acceptance Criteria:**

- [ ] `src/middleware/auth.ts` — extracts `x-api-key` header or `Authorization: Bearer` token
- [ ] Service key: SHA-256 hash → lookup against Supabase `platform_api_key` table
- [ ] JWT: validates via Supabase Auth `getUser()`
- [ ] Returns `AuthContext` with `method`, `workspaceId`, `userId`, `scopes`
- [ ] Returns 401 for invalid credentials
- [ ] Health endpoint excluded from auth
- [ ] No custom auth logic — delegates everything to Supabase

---

## Epic 2: Data Model

Create the Supabase tables that power the engine. After this epic, missions, stages, and sessions exist in the database.

### 2.1 — Missions and Stages tables

**What:** Create the mission and stage definition tables in Supabase.

**Acceptance Criteria:**

- [ ] Migration: `engine_missions` table with `id`, `name`, `description`, `mode` (sequential/free/hybrid), `context_source`, `workspace_id` (nullable for global), `is_active`, `created_at`, `updated_at`
- [ ] Migration: `engine_stages` table with `mission_id`, `stage_id`, `stage_order`, `goal`, `personality_override`, `instructions`, `success_criteria`, `escalation_instructions`, `emotion_hint`, `creative_freedom` (float 0-1), `next_stage` (nullable), `is_required`, `created_at`
- [ ] RLS enabled on both tables
- [ ] RLS policies for workspace isolation (dual-auth pattern)
- [ ] Index on `engine_stages(mission_id, stage_order)`
- [ ] At least one seed mission with 3 stages for testing

### 2.2 — Sessions table

**What:** Create the session table that tracks active conversations.

**Acceptance Criteria:**

- [ ] Migration: `engine_sessions` table with `id`, `mission_id`, `workspace_id`, `user_id` (who started it), `profile_id`, `channel` (voice/sms/chat/email/autonomous), `current_stage_id`, `stage_index`, `status` (active/complete/expired/abandoned), `context` (JSONB — identity + loaded context), `collected_data` (JSONB — per-stage results), `summary` (TEXT — rolling summary from Director), `callback_url`, `expires_at`, `created_at`, `updated_at`
- [ ] RLS enabled with workspace isolation
- [ ] Index on `(workspace_id, status)` for active session lookups
- [ ] Index on `(expires_at)` for cleanup
- [ ] Expiry default: 24 hours

### 2.3 — Inbox table

**What:** Create the generic inbox where all agent-stored data lands.

**Acceptance Criteria:**

- [ ] Migration: `engine_inbox` table with `id`, `session_id`, `stage_id`, `workspace_id`, `entity_type` (TEXT — freeform like "department", "shift", "note"), `data` (JSONB), `validated` (BOOLEAN default false), `processed` (BOOLEAN default false), `created_at`
- [ ] RLS enabled with workspace isolation
- [ ] Index on `(session_id, stage_id)`
- [ ] Index on `(workspace_id, processed)` for batch processing

---

## Epic 3: Session Lifecycle

The core engine logic. After this epic, sessions can be started, queried, and expired.

### 3.1 — Start session endpoint

**What:** `POST /sessions` — creates a new session, loads identity and context, returns first stage.

**Acceptance Criteria:**

- [ ] Accepts: `{ mission_id, workspace_id, user_id?, profile_id?, channel, callback_url?, context? }`
- [ ] Loads mission + stages from database
- [ ] If mission mode is sequential: sets first stage as current
- [ ] If mission mode is free: returns all stages, no current set
- [ ] Loads identity context (profile data, workspace data) from Supabase
- [ ] Creates session row in `engine_sessions`
- [ ] Returns: `{ session_id, mission, current_stage, stages (if free mode), context, progress }`
- [ ] Returns 404 if mission not found
- [ ] Returns 401 if auth fails

### 3.2 — Get session status endpoint

**What:** `GET /sessions/:id` — returns current session state.

**Acceptance Criteria:**

- [ ] Returns: `{ session_id, status, current_stage, stage_index, progress, collected_data, context, summary }`
- [ ] Returns 404 if session not found
- [ ] Returns 403 if workspace mismatch
- [ ] Checks expiry — if expired, updates status and returns expired state

### 3.3 — Session expiry cleanup

**What:** Background job that marks expired sessions.

**Acceptance Criteria:**

- [ ] Runs on a configurable interval (default: every 5 minutes)
- [ ] Updates `status = 'expired'` for sessions where `expires_at < now()` and `status = 'active'`
- [ ] Logs count of expired sessions
- [ ] Does not affect completed or abandoned sessions

### 3.4 — Abandon session endpoint

**What:** `POST /sessions/:id/abandon` — manually marks a session as abandoned.

**Acceptance Criteria:**

- [ ] Updates status to `abandoned`
- [ ] Saves current collected_data as-is
- [ ] Returns confirmation
- [ ] Returns 404 if not found, 409 if already complete/expired

---

## Epic 4: Store & Fetch Tools

The two MVP tools. After this epic, agents can save and retrieve data through the engine.

### 4.1 — Store endpoint

**What:** `POST /sessions/:id/store` — agent sends data to the inbox.

**Acceptance Criteria:**

- [ ] Accepts: `{ entity_type, data, stage_id? }`
- [ ] If `stage_id` not provided, uses session's `current_stage_id`
- [ ] Writes to `engine_inbox` with session context (workspace_id, session_id, stage_id)
- [ ] Returns: `{ inbox_id, confirmed: true, message: "Data stored successfully" }`
- [ ] The response message is designed as a tool response instruction (tells agent what to do next)
- [ ] Returns 404 if session not found or expired
- [ ] Returns 400 if entity_type or data missing

### 4.2 — Fetch endpoint

**What:** `POST /sessions/:id/fetch` — agent requests context or data.

**Acceptance Criteria:**

- [ ] Accepts: `{ query_type, filters? }` where query_type is one of: "context" (identity + workspace), "inbox" (stored data), "stage" (current stage details), "history" (collected_data so far)
- [ ] `context`: returns identity info, workspace info, relevant profile data
- [ ] `inbox`: returns inbox items for this session, optionally filtered by entity_type
- [ ] `stage`: returns current stage with goal, instructions, success criteria
- [ ] `history`: returns all collected_data across stages
- [ ] Returns 404 if session not found

### 4.3 — Store validation hooks

**What:** Basic validation on incoming store data before writing to inbox.

**Acceptance Criteria:**

- [ ] Validates `entity_type` is a non-empty string
- [ ] Validates `data` is a non-empty object
- [ ] Validates `data` JSON is under 100KB
- [ ] Logs validation failures
- [ ] Returns 400 with clear error message on validation failure
- [ ] Extensible — hook interface for future per-entity-type validators

---

## Epic 5: Stage Transitions

Stage management. After this epic, sessions can advance through stages.

### 5.1 — Advance stage endpoint

**What:** `POST /sessions/:id/advance` — moves to the next stage.

**Acceptance Criteria:**

- [ ] Accepts: `{ result?, force? }`
- [ ] If `result` provided: saves to `collected_data[current_stage_id]`
- [ ] Sequential mode: advances to `next_stage` defined in stage definition
- [ ] Free mode: requires `next_stage_id` in request body
- [ ] Hybrid mode: follows sequential for required stages, free for optional
- [ ] If last stage: marks session as `complete`
- [ ] Returns: `{ new_stage, progress, complete }` (designed as agent instruction)
- [ ] If complete: returns `{ complete: true, summary }`
- [ ] Returns 409 if session not active
- [ ] Fires webhook to `callback_url` if set (async, fire-and-forget)

### 5.2 — Stage prompt builder

**What:** Builds the system prompt for a stage by combining agent config + stage config.

**Acceptance Criteria:**

- [ ] Function: `buildStagePrompt(agent, stage, context, collectedData)` → string
- [ ] Includes agent personality, name, tone from agent config
- [ ] Includes stage goal, instructions, success criteria, emotion hint
- [ ] Includes session context (who they're talking to, what's been collected so far)
- [ ] Includes creative freedom setting as temperature guidance
- [ ] Includes escalation instructions
- [ ] Output is a single system prompt string ready for any LLM
- [ ] Prompt is channel-agnostic — works for voice, chat, SMS

### 5.3 — Webhook callback system

**What:** Async webhook notifications on stage transitions and session completion.

**Acceptance Criteria:**

- [ ] Sends POST to `callback_url` with event payload
- [ ] Events: `session.started`, `stage.changed`, `stage.progress`, `session.completed`
- [ ] Payload: `{ event, session_id, stage_id, progress, collected_data, timestamp }`
- [ ] Exponential backoff retry: 3 attempts (1s, 4s, 16s)
- [ ] Fire-and-forget — does not block the response to the agent
- [ ] Logs failures but does not crash

---

## Epic 6: Channel Adapter — Ultravox

Connect the engine to Ultravox voice calls. After this epic, a voice agent can run a mission through the Stage Engine.

### 6.1 — Ultravox tool endpoints

**What:** HTTP endpoints formatted for Ultravox tool calling conventions.

**Acceptance Criteria:**

- [ ] `POST /adapters/ultravox/store` — wraps store endpoint, returns Ultravox-compatible tool response
- [ ] `POST /adapters/ultravox/fetch` — wraps fetch endpoint, returns Ultravox-compatible tool response
- [ ] `POST /adapters/ultravox/advance` — wraps advance endpoint, returns `X-Ultravox-Response-Type: new-stage` header with new system prompt
- [ ] Tool responses include `toolResultText` for agent instruction
- [ ] All endpoints accept Ultravox's `KNOWN_PARAM_CALL_STATE` for session tracking

### 6.2 — Stage transition as Ultravox Call Stage

**What:** When advance is called via Ultravox adapter, return a proper Ultravox new-stage response.

**Acceptance Criteria:**

- [ ] Advance response includes `systemPrompt` (from buildStagePrompt)
- [ ] Response header: `X-Ultravox-Response-Type: new-stage`
- [ ] Optionally includes updated `selectedTools` if stage changes available tools
- [ ] Includes `toolResultText` as transition message for the agent
- [ ] Agent smoothly transitions to new stage without conversation break

### 6.3 — Ultravox call creation helper

**What:** Helper endpoint that creates an Ultravox call pre-configured with Stage Engine tools.

**Acceptance Criteria:**

- [ ] `POST /adapters/ultravox/create-call` — accepts `{ mission_id, workspace_id, user_id, voice?, language? }`
- [ ] Starts a session in the engine
- [ ] Builds initial system prompt from first stage
- [ ] Registers store, fetch, advance as `selectedTools` in Ultravox format
- [ ] Calls Ultravox Create Call API
- [ ] Returns `{ session_id, call_id, join_url }`
- [ ] Ready to pass `join_url` to frontend BrowserCall component

---

## Epic 7: End-to-End Verification

Prove it works. After this epic, we have a verified working system.

### 7.1 — Seed test mission: "discovery-call"

**What:** A complete 3-stage mission for testing the full flow.

**Acceptance Criteria:**

- [ ] Mission: "discovery-call" (sequential, 3 stages)
- [ ] Stage 1: "greeting" — goal: learn the person's name and role
- [ ] Stage 2: "problem" — goal: understand their main challenge
- [ ] Stage 3: "confirm" — goal: summarize and confirm understanding
- [ ] Each stage has goal, instructions, success_criteria, emotion_hint
- [ ] Seeded in Supabase via migration

### 7.2 — End-to-end test script

**What:** A script that runs through the complete lifecycle via HTTP calls.

**Acceptance Criteria:**

- [ ] Starts a session with discovery-call mission
- [ ] Calls fetch to get context
- [ ] Calls store to save data for stage 1
- [ ] Calls advance to move to stage 2
- [ ] Calls store for stage 2
- [ ] Calls advance to move to stage 3
- [ ] Calls store for stage 3
- [ ] Calls advance — session completes
- [ ] Verifies session status is "complete"
- [ ] Verifies collected_data has all 3 stages
- [ ] Verifies inbox has all stored items
- [ ] All assertions pass
- [ ] Can run via `pnpm test:e2e`

---

## Build Order

```
Epic 1 (Infrastructure)     ████░░░░░░░░  Week 1
Epic 2 (Data Model)         ░░██░░░░░░░░  Week 1-2
Epic 3 (Session Lifecycle)  ░░░███░░░░░░  Week 2
Epic 4 (Store & Fetch)      ░░░░██░░░░░░  Week 2-3
Epic 5 (Stage Transitions)  ░░░░░██░░░░░  Week 3
Epic 6 (Ultravox Adapter)   ░░░░░░██░░░░  Week 3-4
Epic 7 (Verification)       ░░░░░░░██░░░  Week 4
```

Estimated total: **3-4 weeks** for a solo developer with AI assistance.

---

## Summary

| Metric     | Count                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| Epics      | 7                                                                               |
| Stories    | 22                                                                              |
| Endpoints  | 9 (health, start, status, abandon, store, fetch, advance, + 3 Ultravox adapter) |
| Tables     | 4 (missions, stages, sessions, inbox)                                           |
| Migrations | 3 (tables + indexes + RLS + seed)                                               |

---

_Every story traces to a decision in DECISIONS.md. Every story is independently deliverable. Ready for Architecture._
