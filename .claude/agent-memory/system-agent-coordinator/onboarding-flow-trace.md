# Onboarding "Lise" Flow Trace (2026-03-04)

## Full Request Path

1. User clicks "Start" on `/onboarding` page
2. `useBotsson.ts:353` → `fetch("/api/wizard/start", {...})`
3. `apps/web/src/app/api/wizard/start/route.ts` reads `STAGE_ENGINE_URL` and `STAGE_ENGINE_API_KEY` from env
4. Route calls `${STAGE_ENGINE_URL}/adapters/ultravox/create-call` with `x-api-key` header
5. Stage Engine auth middleware (`src/middleware/auth.ts`) hashes the API key with SHA-256
6. Looks up hash in `platform_api_key` table via Supabase admin client
7. If auth passes: `session-manager.ts:createSession()` loads mission from `engine_missions` DB table
8. Creates Ultravox call via `lib/ultravox.ts:createUltravoxCall()`
9. Returns `join_url` to frontend
10. Frontend calls `session.joinCall(joinUrl)` on Ultravox client

## This is VOICE-ONLY via Ultravox

- NOT a text chat flow
- `useBotsson` uses Ultravox client SDK for WebRTC voice
- Client tools (updateBusiness, etc.) run IN THE BROWSER, not on server
- The `/api/onboarding-agent/route.ts` is a SEPARATE text-chat system (unused in current flow)

## Three Blocking Issues Found (2026-03-04)

### 1. STAGE_ENGINE_URL points to wrong port

- `.env.local` line 123: `STAGE_ENGINE_URL=http://localhost:3070`
- Stage Engine actually runs on port **5010** (docker-compose.yml + override)
- Next.js wizard/start route reads this env var directly
- Result: `fetch` to `http://localhost:3070/adapters/ultravox/create-call` fails (nothing on 3070)

### 2. No API key in platform_api_key table

- `STAGE_ENGINE_API_KEY` in `.env.local` is `7a2d2e33...`
- Stage Engine auth hashes this with SHA-256 and looks up in `platform_api_key`
- Table is EMPTY — query returns `[]`
- Result: Even if port is fixed, auth returns 401

### 3. Docker container can't reach local Supabase

- Container env: `SUPABASE_URL=http://127.0.0.1:54321`
- Inside Docker, `127.0.0.1` = the container itself, not the host
- Need `host.docker.internal:54321` or Docker network address
- Confirmed: startup logs show `fetch failed` for Vault, and cleanup loop shows `ECONNREFUSED 127.0.0.1:54321`
- API key validation also fails because it can't query Supabase

### 4. engine_missions table is empty

- Migration `20260314300000` seeds the mission, but table query returns `[]`
- Possible: migration not applied, or DB was reset after migration

## "fetch failed" Cleanup Error Explained

- `session-manager.ts:expireStaleSession()` runs every 5 min
- Calls `supabaseAdmin.from("engine_sessions").update(...)`
- supabaseAdmin uses `SUPABASE_URL=http://127.0.0.1:54321`
- Inside Docker, this is unreachable → `TypeError: fetch failed`
