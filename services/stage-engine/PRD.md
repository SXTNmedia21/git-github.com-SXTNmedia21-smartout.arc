# Stage Engine — PRD.md

> **Project:** Smartout Stage Engine (Universal Agent Gateway)
> **Date:** 2026-03-01
> **Input:** DECISIONS.md + BREAKDOWN.md + ARCHITECTURE.md
> **Status:** Implementation-Ready

---

## 1. Product Summary

The Stage Engine is a universal, channel-agnostic gateway that orchestrates AI agents through defined missions and stages. It solves the problem of every agent needing its own state management, context loading, and stage logic. Instead, any agent — voice, SMS, chat, email, or autonomous — connects to the engine and receives instructions, stores data, and advances through workflows.

One engine to rule them all.

---

## 2. Users and Roles

| Role                   | Interacts via      | What they do                                   |
| ---------------------- | ------------------ | ---------------------------------------------- |
| Voice Agent (Ultravox) | HTTP tool calls    | Receives prompts, stores data, advances stages |
| SMS Agent (n8n)        | HTTP API           | Same as voice but text-based                   |
| Chat Agent (web)       | HTTP API           | Same, embedded in dashboard                    |
| Python Agent           | HTTP API           | Autonomous agent running missions              |
| Director Agent         | Internal (future)  | Monitors sessions, sends deferred messages     |
| Dashboard Backend      | HTTP API (JWT)     | Creates sessions, monitors progress            |
| External Integrations  | HTTP API (API key) | Third-party systems triggering missions        |

---

## 3. Data Model

### 3.1 engine_missions

| Field          | Type        | Required | Notes                              |
| -------------- | ----------- | -------- | ---------------------------------- |
| id             | TEXT (PK)   | Yes      | Human-readable: "discovery-call"   |
| name           | TEXT        | Yes      | Display name                       |
| description    | TEXT        | No       | What this mission does             |
| mode           | TEXT        | Yes      | "sequential", "free", "hybrid"     |
| context_source | TEXT        | No       | URL/phone pattern for auto-loading |
| workspace_id   | UUID (FK)   | No       | NULL = global mission              |
| is_active      | BOOLEAN     | Yes      | Default true                       |
| created_at     | TIMESTAMPTZ | Yes      | Auto                               |
| updated_at     | TIMESTAMPTZ | Yes      | Auto                               |

### 3.2 engine_stages

| Field                   | Type        | Required | Notes                           |
| ----------------------- | ----------- | -------- | ------------------------------- |
| id                      | UUID (PK)   | Yes      | Auto-generated                  |
| mission_id              | TEXT (FK)   | Yes      | References engine_missions      |
| stage_id                | TEXT        | Yes      | Human-readable: "greeting"      |
| stage_order             | INTEGER     | Yes      | 1, 2, 3...                      |
| goal                    | TEXT        | Yes      | What to achieve                 |
| instructions            | TEXT        | Yes      | How to achieve it               |
| success_criteria        | TEXT        | Yes      | When is it done                 |
| escalation_instructions | TEXT        | No       | What to do if stuck             |
| personality_override    | TEXT        | No       | Override agent personality      |
| emotion_hint            | TEXT        | No       | "frustration", "joy", "urgency" |
| creative_freedom        | REAL        | Yes      | 0.0–1.0, default 0.7            |
| next_stage              | TEXT        | No       | Next stage_id (sequential)      |
| is_required             | BOOLEAN     | Yes      | Default true                    |
| deferred_templates      | JSONB       | No       | Director trigger templates      |
| inline_instructions     | JSONB       | No       | Post-action instructions        |
| created_at              | TIMESTAMPTZ | Yes      | Auto                            |

### 3.3 engine_sessions

| Field            | Type        | Required | Notes                             |
| ---------------- | ----------- | -------- | --------------------------------- |
| id               | UUID (PK)   | Yes      | Auto-generated                    |
| mission_id       | TEXT (FK)   | Yes      | References engine_missions        |
| workspace_id     | UUID (FK)   | Yes      | Workspace isolation               |
| user_id          | UUID        | No       | Supabase auth user                |
| profile_id       | UUID        | No       | Smartout profile                  |
| channel          | TEXT        | Yes      | voice/sms/chat/email/autonomous   |
| current_stage_id | TEXT        | No       | Current stage (null if free mode) |
| stage_index      | INTEGER     | Yes      | Default 0                         |
| status           | TEXT        | Yes      | active/complete/expired/abandoned |
| context          | JSONB       | Yes      | Identity + workspace context      |
| collected_data   | JSONB       | Yes      | Per-stage results                 |
| summary          | TEXT        | No       | Rolling summary                   |
| callback_url     | TEXT        | No       | Webhook URL                       |
| expires_at       | TIMESTAMPTZ | Yes      | Default now() + 24h               |
| completed_at     | TIMESTAMPTZ | No       | When finished                     |
| created_at       | TIMESTAMPTZ | Yes      | Auto                              |
| updated_at       | TIMESTAMPTZ | Yes      | Auto                              |

### 3.4 engine_inbox

| Field        | Type        | Required | Notes                           |
| ------------ | ----------- | -------- | ------------------------------- |
| id           | UUID (PK)   | Yes      | Auto-generated                  |
| session_id   | UUID (FK)   | Yes      | References engine_sessions      |
| stage_id     | TEXT        | Yes      | Which stage produced this       |
| workspace_id | UUID (FK)   | Yes      | Workspace isolation             |
| entity_type  | TEXT        | Yes      | Freeform: "department", "shift" |
| data         | JSONB       | Yes      | The actual data                 |
| validated    | BOOLEAN     | Yes      | Default false                   |
| processed    | BOOLEAN     | Yes      | Default false                   |
| created_at   | TIMESTAMPTZ | Yes      | Auto                            |

---

## 4. Core Workflows

### 4.1 Complete Session Lifecycle

```
START
  │
  ├── POST /sessions
  │   Auth validates → Mission loaded → Context loaded → Session created
  │   Returns: session_id + first stage + system_prompt
  │
  ├── LOOP (per stage):
  │   │
  │   ├── Agent talks to user using system_prompt
  │   │
  │   ├── POST /sessions/:id/store (0-N times per stage)
  │   │   Agent saves data → Inbox receives → Confirmation returned
  │   │
  │   ├── POST /sessions/:id/fetch (0-N times per stage)
  │   │   Agent requests context → Engine returns data
  │   │
  │   └── POST /sessions/:id/advance
  │       Result saved → Next stage determined → New prompt built
  │       Returns: new stage + new system_prompt
  │
  ├── LAST STAGE → advance returns { complete: true }
  │   Session marked complete → Webhook fires → Summary saved
  │
  └── OR: expires_at reached → status = expired
      OR: POST /sessions/:id/abandon → status = abandoned
```

### 4.2 Ultravox Voice Call Lifecycle

```
DASHBOARD
  │
  ├── POST /adapters/ultravox/create-call
  │   Engine starts session → Builds Ultravox payload → Creates call
  │   Returns: join_url
  │
  ├── Frontend: <BrowserCall joinUrl={joinUrl} />
  │   WebRTC connects → Agent starts speaking
  │
  ├── DURING CALL:
  │   Ultravox agent → calls store tool → Engine stores → returns instruction
  │   Ultravox agent → calls fetch tool → Engine returns context
  │   Ultravox agent → calls advance tool → Engine returns new-stage
  │     Header: X-Ultravox-Response-Type: new-stage
  │     Body: { systemPrompt, toolResultText }
  │     Ultravox transitions seamlessly
  │
  └── CALL ENDS:
      Session complete or abandoned
      Webhook fires to callback_url
```

---

## 5. API Specification

### 5.1 Authentication

All endpoints except `GET /health` require one of:

- `x-api-key: smo_svc_live_*` — service key, validated via SHA-256 hash lookup
- `Authorization: Bearer <jwt>` — Supabase JWT, validated via `getUser()`

### 5.2 Error Format

```json
{
  "error": "SESSION_NOT_FOUND",
  "message": "Session abc-123 does not exist or has expired",
  "status": 404
}
```

### 5.3 Error Codes

| Code               | Status | When                                |
| ------------------ | ------ | ----------------------------------- |
| AUTH_FAILED        | 401    | Invalid or missing credentials      |
| FORBIDDEN          | 403    | Workspace mismatch                  |
| NOT_FOUND          | 404    | Session or mission not found        |
| VALIDATION_ERROR   | 400    | Bad request body                    |
| SESSION_NOT_ACTIVE | 409    | Advance/store on non-active session |
| INTERNAL_ERROR     | 500    | Unexpected server error             |

### 5.4 Endpoint Summary

| Method | Path                           | Auth | Purpose                                  |
| ------ | ------------------------------ | ---- | ---------------------------------------- |
| GET    | /health                        | None | Health check                             |
| POST   | /sessions                      | Yes  | Start new session                        |
| GET    | /sessions/:id                  | Yes  | Get session status                       |
| POST   | /sessions/:id/store            | Yes  | Store data to inbox                      |
| POST   | /sessions/:id/fetch            | Yes  | Fetch context/data                       |
| POST   | /sessions/:id/advance          | Yes  | Advance to next stage                    |
| POST   | /sessions/:id/abandon          | Yes  | Abandon session                          |
| POST   | /adapters/ultravox/create-call | Yes  | Create Ultravox call with engine session |
| POST   | /adapters/ultravox/store       | Yes  | Store (Ultravox tool format)             |
| POST   | /adapters/ultravox/fetch       | Yes  | Fetch (Ultravox tool format)             |
| POST   | /adapters/ultravox/advance     | Yes  | Advance (returns new-stage header)       |

---

## 6. Tech Stack Summary

| Technology     | Purpose               | Version       |
| -------------- | --------------------- | ------------- |
| Hono           | HTTP framework        | Latest        |
| TypeScript     | Language              | 5.x           |
| Node.js        | Runtime               | 22 LTS        |
| Docker         | Containerization      | Latest        |
| Docker Compose | Orchestration         | 3.8           |
| Caddy          | Reverse proxy + HTTPS | 2.x           |
| Supabase JS    | Database client       | 2.49.4        |
| Zod            | Request validation    | 3.x           |
| DigitalOcean   | Hosting               | Droplet $6/mo |
| Supabase       | Database + Auth       | Managed       |
| Ultravox       | Voice AI              | Latest        |

---

## 7. Build Order

All epics delivered in one phase. Claude Code Opus 4.6 runs agent teams in parallel.

| Epic                                                     | Stories | Dependency |
| -------------------------------------------------------- | ------- | ---------- |
| 1. Infrastructure (scaffold, Docker, Caddy, auth)        | 1.1–1.4 | None       |
| 2. Data Model (missions, stages, sessions, inbox)        | 2.1–2.3 | Epic 1     |
| 3. Session Lifecycle (start, status, expiry, abandon)    | 3.1–3.4 | Epic 2     |
| 4. Store & Fetch (store, fetch, validation)              | 4.1–4.3 | Epic 3     |
| 5. Stage Transitions (advance, prompt builder, webhooks) | 5.1–5.3 | Epic 3     |
| 6. Ultravox Adapter (tools, new-stage, create-call)      | 6.1–6.3 | Epic 4+5   |
| 7. Verification (seed mission, e2e test)                 | 7.1–7.2 | Epic 6     |

Epics 4 and 5 can run in parallel (both depend on Epic 3 only).

---

## 8. Out of Scope

| Feature                               | Revisit when                 |
| ------------------------------------- | ---------------------------- |
| Named tools (create_department, etc.) | After inbox model validated  |
| Output generation (docs from data)    | After store/fetch proven     |
| Director Agent (observer/regissör)    | After MVP sessions running   |
| UI control from Director              | After Director MVP works     |
| LiveKit adapter                       | After Ultravox adapter works |
| Python agent adapter                  | After one adapter works      |
| Multi-language prompts                | After EN/NO works            |
| Analytics/tracking                    | After sessions running       |
| Mission template marketplace          | After custom missions work   |
| Rate limiting (Upstash)               | After traffic justifies it   |
| Smartout MCP (read/write Smartout DB) | First expansion post-MVP     |

---

## 9. Success Criteria

| Criterion                  | Measurement                                                 |
| -------------------------- | ----------------------------------------------------------- |
| Engine starts and responds | /health returns 200 in < 50ms                               |
| Session lifecycle works    | E2E test passes: start → store → advance → complete         |
| Ultravox integration works | Voice call completes a 3-stage mission                      |
| Data is stored correctly   | Inbox contains all stored items with correct session/stage  |
| Auth works                 | Invalid key returns 401, wrong workspace returns 403        |
| Webhook fires              | callback_url receives events on stage change and completion |
| HTTPS works                | engine.smartout.ai responds with valid certificate          |

---

## 10. Risks and Mitigations

| Risk                                              | Impact              | Mitigation                                                           |
| ------------------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| Ultravox new-stage header not working as expected | Adapter broken      | Test with Ultravox sandbox first, fallback to inline instructions    |
| Supabase connection limits                        | Timeouts under load | Connection pooling in Supabase client, single client instance        |
| Docker networking issues on DO                    | Cannot deploy       | Test docker-compose locally first, simple Caddy config               |
| Session expiry race conditions                    | Data loss           | Check expiry before every operation, use DB timestamps not app time  |
| Webhook delivery failures                         | Lost events         | Exponential backoff retry, log all failures, events are non-blocking |

---

## 11. Document Index

| Document        | Purpose                                 | Location                     |
| --------------- | --------------------------------------- | ---------------------------- |
| DECISIONS.md    | All locked decisions (15)               | stage-engine/DECISIONS.md    |
| BREAKDOWN.md    | Epics and stories (7 epics, 22 stories) | stage-engine/BREAKDOWN.md    |
| ARCHITECTURE.md | System design, schema, API, deployment  | stage-engine/ARCHITECTURE.md |
| PRD.md          | This document — implementation spec     | stage-engine/PRD.md          |

### Referenced Documents

| Document                     | Why                                                          |
| ---------------------------- | ------------------------------------------------------------ |
| Security Protocol            | Auth patterns, key format, microservice checklist            |
| Secret API Infrastructure    | Dual-auth middleware, key validation, RLS via set_config     |
| V1 Revised Architecture      | Existing voice infrastructure, Ultravox integration patterns |
| Interview MCP source         | Reference implementation for session/stage logic             |
| Ultravox Call Stages docs    | Stage transition API, new-stage header format                |
| Ultravox Guiding Agents docs | Deferred messages, tool state, inline instructions           |

---

_All four documents complete. This specification is implementation-ready. Hand to Claude Code Opus 4.6 with agent teams for parallel execution._
