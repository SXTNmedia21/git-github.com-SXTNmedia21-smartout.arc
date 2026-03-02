---
title: "User Journeys — Stage Engine Local Runtime"
status: done
updated: 2026-03-02
created: 2026-03-02
module: ai
tags: [stage-engine, agent, voice, ultravox, local-dev]
---

# User Journeys — Stage Engine Local Runtime

## Journey: Developer starts stage engine locally

**Precondition:** Supabase running locally, pnpm dependencies installed, `.env` configured with Supabase keys

1. Developer runs `supabase db reset` → System applies all migrations (including engine_memory, engine_authority_config, engine_sessions_mode) → Developer sees "Finished supabase db reset"
2. Developer runs `pnpm turbo build --filter=@smartout/ai...` → System builds AI package and dependencies → Developer sees "Tasks: 3 successful"
3. Developer creates `services/stage-engine/.env` with PORT, ENGINE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY → File created
4. Developer creates `services/stage-engine/.env.local` (optionally with OPENROUTER_API_KEY, ULTRAVOX_API_KEY) → File created
5. Developer runs `pnpm --filter @smartout/stage-engine dev` → System loads secrets (warns if missing), starts Hono server → Developer sees "Stage Engine running on port 3060"

**Postcondition:** Stage engine running, health endpoint accessible, ready to receive requests

**Error paths:**

- Port already in use → Error `EADDRINUSE` → Developer changes PORT in .env or kills conflicting process
- Supabase not running → Config validation fails (SUPABASE_URL unreachable) → Start Supabase first
- Migration timestamp collision → `db reset` stops mid-way → Rename conflicting migrations to unique timestamps

---

## Journey: Developer tests agent chat endpoint

**Precondition:** Stage engine running, Supabase running with seed data, OpenRouter API key in .env.local

1. Developer signs in via Supabase Auth → Gets JWT access token
2. Developer sends `POST /agent/chat` with JWT, message, and profile_id → System validates JWT, resolves workspace from profile
3. System creates agent session (mode="agent") in engine_sessions → Session ID returned
4. System loads profile context, memories, and authority config in parallel → Context built
5. System classifies intent via OpenRouter LLM → Intent result (capability + confidence)
6. System selects tools based on intent + authority level → Tool set resolved
7. System builds Mr. Botsson system prompt with context → Prompt constructed
8. System calls LLM with prompt, tools, and conversation history → Response generated
9. System appends user + assistant turns to session → Conversation persisted
10. Developer receives JSON response with session_id, response text, and intent classification

**Postcondition:** Agent session active, conversation stored, response delivered

**Error paths:**

- No auth header → 401 `AUTH_FAILED: Missing x-api-key or Authorization header`
- Invalid/expired JWT → 401 `AUTH_FAILED: Invalid or expired JWT`
- No profile for user → 401 (auth middleware can't resolve workspace)
- No OpenRouter API key → 500 `OpenRouter API key not available`
- Invalid session_id → 404 `NOT_FOUND`
- Session not active → 409 `SESSION_NOT_ACTIVE`

---

## Journey: Developer tests Ultravox voice call creation

**Precondition:** Stage engine running, Ultravox API key in .env.local, a mission seeded in engine_missions

1. Developer sends `POST /adapters/ultravox/create-call` with mission_id, workspace_id, auth header → System validates auth
2. System creates engine session (mode="mission") for the mission → Session created
3. System builds Ultravox HTTP tools (store, fetch, advance) pointing back to engine → 3 tool definitions
4. System calls Ultravox Create Call API with system prompt + tools → Ultravox returns call_id and join_url
5. Developer receives session_id, call_id, and join_url → Can connect to voice call

**Postcondition:** Ultravox call active, stage engine tools registered as HTTP callbacks

**Error paths:**

- No Ultravox API key → Ultravox API call fails → 500 `Failed to create Ultravox call`
- Invalid mission_id → 404 `Mission not found`
- No auth header → 401 `AUTH_FAILED`

---

## Journey: Developer runs health check

**Precondition:** Stage engine running

1. Developer sends `GET /health` → No auth required (public endpoint)
2. System returns `{"status":"ok","service":"stage-engine","version":"0.1.0","timestamp":"..."}`

**Postcondition:** Developer confirms engine is running

**Error paths:**

- Engine not running → Connection refused
