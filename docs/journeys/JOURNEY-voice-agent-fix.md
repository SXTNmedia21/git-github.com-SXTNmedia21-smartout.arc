---
title: "User Journeys — Voice Agent Fix"
status: done
updated: 2026-03-03
created: 2026-03-03
module: stage-engine
tags: [journey, voice, ultravox, agent, fix, systems]
---

# User Journeys — Voice Agent Fix

> Voice agent fix: restored Ultravox HTTP tool definitions (staticParameters), enabled local Vault access, added .env.example configuration.

---

## Journey: Developer Sets Up Stage Engine Locally

**Precondition:** Developer has cloned the repository, Supabase is running locally (`npx supabase start`), and they have Ultravox API key available in 1Password.

**Goal:** Get stage-engine running locally with all required environment variables and secrets properly configured.

### Steps

1. Developer reviews README or INSTALL docs and sees stage-engine requires `.env.local`
   → System provides no `.env.example` (blocker: Task 4)
   → Developer has no clear template for required variables

2. Developer runs `cd services/stage-engine && pnpm dev`
   → System fails with: `Error: ULTRAVOX_API_KEY not found`
   → Developer is blocked without knowing what variables are needed

3. **[AFTER FIX]** Developer finds `.env.example` in `services/stage-engine/`
   → System displays template with all required variables (PORT, ENGINE_URL, LOG_LEVEL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ULTRAVOX_API_KEY, OPENROUTER_API_KEY)
   → Developer copies file: `cp .env.example .env.local`

4. Developer runs `npx supabase status` to get local credentials
   → System outputs connection details and API keys
   → Developer copies values into `.env.local` (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)

5. Developer retrieves secrets from 1Password:
   - `op read op://Development/Ultravox/api-key`
   - `op read op://Development/OpenRouter/api-key`
     → System displays secret values
     → Developer pastes into `.env.local`

6. Developer verifies Vault is enabled locally by checking `supabase/config.toml`
   → System shows `[db.vault]` is uncommented with `secret_key = "env(VAULT_SECRET_KEY)"`
   → Developer knows Vault secrets will load at runtime

7. Developer runs `pnpm dev` again
   → System starts stage-engine on port 3060
   → Console logs: `[secrets] Loaded: ultravox (env)` or `[secrets] Loaded: ultravox (vault)`
   → Developer sees API key loaded successfully

**Postcondition:** Stage-engine is running, all environment variables are configured, Ultravox API key is accessible (from env var or Vault), system is ready for tool testing.

### Error Paths

**Error: `.env.local` not found**

- Developer sees: `Error: ULTRAVOX_API_KEY not found in environment or Vault`
- Recovery: Check that `.env.example` exists and was copied to `.env.local`

**Error: Vault disabled locally**

- Developer tries to load secret from Vault, sees: `Vault not available`
- Recovery: Uncomment `[db.vault]` in `supabase/config.toml`, run `npx supabase db reset`

**Error: Invalid Supabase URL or key**

- Developer sees: `Connection refused` when stage-engine tries to connect to Supabase
- Recovery: Run `npx supabase status` again and verify URL and keys match `.env.local`

---

## Journey: Admin Initiates a Voice Training Session

**Precondition:** Admin is logged into the Smartout dashboard as workspace admin. Voice module is available. A training protocol with voice-guided stages exists (e.g., "Coffee Machine Safety Procedure").

**Goal:** Admin clicks "Start Voice Training" and initializes a voice agent session that has full workspace context.

### Steps

1. Admin navigates to dashboard → Training → Select protocol "Coffee Machine Safety"
   → System displays protocol details with action button "Start Voice Session"
   → Admin sees button ready to click

2. Admin clicks "Start Voice Session"
   → System prepares to create Ultravox call via stage-engine
   → System gathers context: mission_id, workspace_id, admin's user_id, preferred voice

3. **[BEFORE FIX]** Admin clicks button
   → System sends malformed Ultravox HTTP tool definitions (with `headers` on `http` object and query strings in `baseUrlPattern`)
   → Ultravox API rejects call: `Error: has no field named 'headers'`
   → Admin sees: "Failed to start voice session" generic error
   → Session creation fails, no session is created

4. **[AFTER FIX]** Admin clicks button
   → System calls `buildUltravoxTools(engineUrl, sessionId, apiKey)` in stage-engine
   → Function returns valid tool definitions with `staticParameters` (session_id in QUERY, x-api-key in HEADER)
   → Tools have correct HTTP structure: baseUrlPattern has NO query string, http object has NO headers field
   → System creates engine session with these tools

5. System creates Ultravox call via API
   → Passes valid UltravoxCreateCallPayload with sessionId and apiKey as staticParameters
   → Ultravox API accepts call and returns callId and joinUrl
   → System stores session_id in engine_sessions table with reference to mission

6. System returns session details to admin
   → Admin sees: Session ID, Call ID, Voice widget with join URL
   → Admin clicks "Join Call" button
   → Browser opens WebSocket connection to Ultravox (joinUrl)

7. Voice agent connects and loads system prompt for this stage
   → Admin hears Lise's greeting (e.g., "Hi! Let's make sure the coffee machine is safe to use")
   → Agent has access to three tools: store, fetch, advance

8. Admin (or employee) speaks to agent
   → Agent understands context (knows workspace, session, user)
   → When agent calls "store" tool → request includes workspace context via staticParameters
   → When agent calls "fetch" tool → request includes workspace context via staticParameters
   → When agent calls "advance" tool → request includes workspace context via staticParameters

**Postcondition:** Voice training session is active, agent has workspace context, tool callbacks receive session_id and api-key via staticParameters, data is properly stored in workspace isolation.

### Error Paths

**Error: Tool invocation fails**

- Agent calls store/fetch/advance
- System receives request but staticParameters missing or malformed
- Recovery: Verify `buildUltravoxTools()` is called with valid sessionId and apiKey parameters before creating call

**Error: Session context lost**

- Agent asks for user information but gets wrong context
- Happens if staticParameters weren't passed (pre-fix behavior)
- Recovery: Ensure Ultravox call is created with tools that include staticParameters

**Error: API key not found**

- System tries to build tools with null/undefined apiKey
- Recovery: Verify ULTRAVOX_API_KEY is set in stage-engine .env.local or Vault

---

## Journey: Employee Completes a Voice-Guided Protocol Training

**Precondition:** Employee is assigned a training protocol with voice-guided stages. Manager has initiated a voice training session. Session ID is shared with employee via SMS or email link.

**Goal:** Employee connects to voice agent and completes a multi-stage training protocol via voice conversation, with agent collecting data and advancing stages.

### Steps

1. Employee receives SMS: "Click here to start your training: http://smartout.ai/join/session-xyz"
   → System provides link with session_id as query parameter
   → Employee's device opens training session page

2. System loads session context from engine
   → Query: `SELECT * FROM engine_sessions WHERE session_id = 'xyz'`
   → System retrieves: mission_id, workspace_id, employee_id, current_stage
   → System is now isolated to this workspace via workspace_id (RLS protection)

3. System initializes Ultravox call with this session context
   → Calls stage-engine `/adapters/ultravox/create-call` with session*id and workspace_id
   → Engine retrieves mission definition from `engine_missions`
   → Engine builds Ultravox tools with staticParameters: { session_id: 'xyz', x-api-key: 'smo_svc*...' }
   → **[CRITICAL FIX]** Tools are now valid: no headers field, no query strings in baseUrlPattern

4. Employee clicks "Start Training Call"
   → System opens WebSocket to Ultravox joinUrl
   → Voice connects and loads Stage 1 system prompt

5. **Stage 1: Introduction** — Agent collects basic information
   → Agent says: "Hi! I'm here to help you learn about food safety. What's your name?"
   → Employee speaks: "My name is Anders"
   → Agent calls `store` tool with entity_type="person", data={name: "Anders"}
   → **[WITH FIX]** Request includes staticParameters (session_id, x-api-key)
   → Engine endpoint `/adapters/ultravox/store` receives request with session context
   → System stores data in engine_memory with workspace_id isolation (RLS)

6. **Stage 2: Knowledge test** — Agent asks questions
   → Agent asks: "Why is glove hygiene important?"
   → Employee speaks answer
   → Agent calls `fetch` tool with query_type="context" to understand workplace rules
   → **[WITH FIX]** Request includes sessionParameters so engine knows which workspace context to retrieve
   → Engine returns: "In this workplace, gloves must be changed every 4 hours and after handling raw meat"
   → Agent uses this context to validate employee's answer

7. **Stage 3: Practical scenario** — Agent walks through procedure
   → Agent says: "Let's walk through the safe procedure. First, you need to..."
   → Employee confirms understanding at each step
   → Agent collects responses via `store` tool

8. **Stage Complete** — Agent calls `advance` tool
   → Agent says: "Great work! You've completed stage 3. Let's move to the next stage."
   → Agent calls `advance` with result: { stage_completed: "Stage 3", score: 95, timestamp: ... }
   → **[WITH FIX]** Request includes sessionParameters
   → Engine `/adapters/ultravox/advance` endpoint receives request with session context
   → System fetches next stage from mission definition
   → System loads Stage 4 data from `engine_sessions` → mission → stages
   → Engine returns new stage system prompt via `X-Ultravox-Response-Type: new-stage` header
   → Ultravox seamlessly transitions to Stage 4 without dropping connection

9. Employee completes all stages
   → Final stage agent says: "Congratulations! You've completed the training."
   → Agent calls `advance` with result: { training_complete: true, final_score: 92 }
   → System updates `protocol_assignment` status to "completed" in dashboard
   → Employee sees: "Training Complete - Certificate Available"

10. Manager sees completion
    → Dashboard shows employee's training progress and results
    → Manager can review collected data: responses, scores, timestamps (all stored in engine_memory)

**Postcondition:** Employee has completed voice-guided training, all data is collected in workspace-isolated engine_memory, manager can review results, employee is marked as trained in protocol_assignment.

### Error Paths

**Error: Session context not found**

- Employee's session_id is invalid or expired
- System receives 404: session_id not in engine_sessions
- Recovery: Resend training link or create new session

**Error: Stage advancement fails**

- Agent calls `advance` but system doesn't find next stage
- Happens if mission definition is incomplete or stages are malformed
- Recovery: Verify engine_missions.stages is valid JSON array with consecutive stage_id values

**Error: Data not persisted**

- Agent stores data but employee doesn't see it in dashboard later
- Happens if engine_memory or RLS policy is blocking writes
- Recovery: Check RLS policies on engine_memory table, verify workspace_id is being set correctly

**Error: Audio connection drops**

- WebSocket closes during conversation
- System reconnects but loses conversation context
- Recovery: Employee can rejoin with same session_id; conversation resumes from last advance() call

---

## Journey: System Loads Secrets from Vault for Ultravox API Calls

**Precondition:** Stage-engine is running. Supabase Vault is enabled locally (`[db.vault]` uncommented in config.toml). Secret key is available (default or env var).

**Goal:** System loads API keys (Ultravox, OpenRouter) from Vault at startup and uses them for outbound API calls.

### Steps

1. **[BEFORE FIX]** Developer checks `supabase/config.toml`
   → Sees: `# [db.vault]` is commented out
   → Vault is disabled
   → System cannot access `vault.decrypted_secrets` view

2. Developer tries to use `getSecrets()` in stage-engine
   → Function tries to call Vault function: `SELECT * FROM vault.decrypted_secrets`
   → Database returns: `Error: relation vault.decrypted_secrets does not exist` (Vault is off)
   → getSecrets() falls back to reading from env vars only

3. **[AFTER FIX]** Developer uncomments `[db.vault]` in `supabase/config.toml`
   → Changes: `# [db.vault]` → `[db.vault]`
   → Runs: `npx supabase db reset` to restart DB with Vault enabled
   → Supabase CLI initializes Vault with default secret key

4. Developer (or ops) uploads secrets to Vault
   → Option A (production): Use Supabase dashboard UI → Vault → Create secret
   → Option B (local manual): Run SQL: `SELECT vault.create_secret('ultravox_api_key', 'sk-xxxx...')`
   → Secret is encrypted and stored in `vault.secrets` table

5. Stage-engine starts and calls `getSecrets()`
   → Function executes: `SELECT secret FROM vault.decrypted_secrets WHERE name = 'ultravox_api_key'`
   → **[WITH FIX]** Vault is enabled, function succeeds
   → Function returns decrypted secret value
   → Console logs: `[secrets] Loaded: ultravox (vault)`

6. Stage-engine creates Ultravox call
   → Calls `fetch('https://api.ultravox.ai/api/calls', { headers: { 'X-API-Key': getSecrets().ultravoxApiKey } })`
   → getSecrets() returns value loaded from Vault (or env var fallback)
   → API call succeeds, Ultravox returns valid callId and joinUrl

7. **[CRITICAL FIX]** Tools are built with this apiKey
   → staticParameters include: `{ name: "x-api-key", location: "PARAMETER_LOCATION_HEADER", value: apiKey }`
   → When tools are invoked later, header is passed invisibly to engine callbacks
   → Engine endpoints can validate the key and verify request is from authorized service

**Postcondition:** Secrets are loaded from Vault (or env var fallback), API calls succeed, tool invocations carry authentication headers, system can manage secrets without hardcoding.

### Error Paths

**Error: Vault not enabled**

- System tries to access vault.decrypted_secrets
- Database returns: relation does not exist
- Recovery: Uncomment `[db.vault]` in config.toml, run `npx supabase db reset`

**Error: Secret key mismatch**

- Vault is enabled but secret_key is wrong
- System can see vault.secrets table but cannot decrypt values (returns NULL)
- Recovery: Verify VAULT_SECRET_KEY env var matches the key used to encrypt secrets, or let Supabase use default

**Error: Secret not found**

- `vault.decrypted_secrets` query returns 0 rows
- System falls back to env var, but ULTRAVOX_API_KEY is also empty
- Recovery: Either upload secret to Vault using vault.create_secret() or set env var

**Error: API call fails with 401 Unauthorized**

- Vault loaded the secret, but it's invalid or expired
- System sends request to Ultravox with wrong API key
- Recovery: Verify secret value in Vault matches active Ultravox API key in 1Password

---

## Summary

| Role      | Journey                          | Outcome                                                               |
| --------- | -------------------------------- | --------------------------------------------------------------------- |
| Developer | Sets up stage-engine locally     | Environment configured, secrets accessible                            |
| Admin     | Initiates voice training session | Session created with valid tool definitions, workspace context passed |
| Employee  | Completes voice-guided training  | Data collected and persisted, protocol marked complete                |
| System    | Loads secrets from Vault         | API calls authenticated, tools receive context via staticParameters   |

### Critical Fixes Applied

1. **staticParameters for tool auth** — Tools now use `PARAMETER_LOCATION_HEADER` for x-api-key and `PARAMETER_LOCATION_QUERY` for session_id, instead of invalid headers field and query strings in baseUrlPattern
2. **Vault enabled locally** — Uncommented `[db.vault]` in supabase/config.toml so secrets can be decrypted at runtime
3. **.env.example provided** — Stage-engine now has template for all required variables (PORT, SUPABASE_URL, ULTRAVOX_API_KEY, etc.)

### Files Changed

- `services/stage-engine/src/types/ultravox.ts` — Added UltravoxStaticParameter type, updated UltravoxHttpTool to support staticParameters
- `services/stage-engine/src/lib/ultravox.ts` — Rewrote buildUltravoxTools() to use staticParameters instead of invalid headers/query patterns
- `supabase/config.toml` — Uncommented [db.vault] section to enable Vault locally
- `services/stage-engine/.env.example` — Created with all required variables

### References

- Learning-0013: Ultravox HTTP Tool Parameter Constraints — `docs/learnings/0013-ultravox-http-tool-parameters.md`
- Voice Agent Fix Plan — `docs/plans/completed/2026-03-03-voice-agent-fix.md`
- Ultravox API Docs — https://docs.ultravox.ai/tools/custom/parameters
