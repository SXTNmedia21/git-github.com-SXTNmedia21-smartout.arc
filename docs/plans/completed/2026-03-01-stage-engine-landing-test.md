---
title: "Stage Engine Landing Test"
status: done
updated: 2026-04-10
created: 2026-03-01
module: meta
tags: []
---

# Stage Engine + Landing Page Voice Test — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** Partially implemented — core routing done, missing test key seed and tunnel docs.

**Last verified:** 2026-03-01

**Goal:** Wire the landing page voice agent through the local stage-engine (Docker) and test the full end-to-end flow: landing page → stage-engine → Ultravox → voice call with tools.

## Implementation Status

| Component                        | Status     | Notes                                                |
| -------------------------------- | ---------- | ---------------------------------------------------- |
| Landing voice component          | ✅ Done    | `apps/landing/src/components/voice-assistant.tsx`    |
| `/api/wizard/start` route        | ✅ Done    | Direct Ultravox route                                |
| `/api/wizard/engine-start` route | ✅ Done    | Stage Engine proxy route                             |
| Platform admin tracking          | ✅ Done    | `landing_event` table + tracking route               |
| Test API key seeded              | ❌ Missing | `platform_api_key` table has no test key in seed.sql |
| Tunnel/ngrok documentation       | ❌ Missing | No dev setup docs for Ultravox callback              |

---

**Architecture:** Landing page `/api/wizard/start` calls stage-engine `/adapters/ultravox/create-call` instead of Ultravox directly. Stage-engine creates a session, builds Ultravox tools (store/fetch/advance) pointing back to itself via a public tunnel, then calls Ultravox API. Ultravox returns a joinUrl that the browser joins via WebRTC.

**Tech Stack:** Next.js (landing), Hono (stage-engine), Docker, Ultravox, ngrok, Supabase

---

## Current State & Blockers

| Issue                           | Detail                                                       | Fix                          |
| ------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| Supabase port mismatch          | `.env.local` has port 54331, actual Supabase is on **55331** | Update `.env.local`          |
| Docker can't reach host         | `127.0.0.1` inside container = container itself              | Use `host.docker.internal`   |
| No seed data                    | Local Supabase has no company/workspace/users                | Run `npx supabase db reset`  |
| No API key                      | `platform_api_key` table is empty                            | Seed a test key              |
| Ultravox can't reach localhost  | Stage-engine at localhost:3070 is unreachable from cloud     | ngrok tunnel                 |
| Landing calls Ultravox directly | `/api/wizard/start` bypasses stage-engine                    | New route or modify existing |

---

## Phase 1: Fix Supabase Connection

### Task 1: Reset local Supabase to apply seed data

The seed.sql creates a test company, workspace, departments, and users. Without this data, the stage-engine can't create sessions (no workspace_id to reference).

**Step 1: Reset Supabase**

```bash
cd ~/Dev/smartout_v3
npx supabase db reset
```

Expected: All migrations applied including `20260301200000_engine_tables.sql` and `20260301200100_engine_seed.sql`. Seed data populated.

**Step 2: Verify seed data exists**

```bash
curl -s "http://127.0.0.1:55331/rest/v1/workspace?select=workspace_id,name" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
```

Expected: At least one workspace (`b0000000-0000-0000-0000-000000000000`, "HQ Workspace")

**Step 3: Verify engine data exists**

```bash
curl -s "http://127.0.0.1:55331/rest/v1/engine_missions?select=id,name" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
```

Expected: "discovery-call" mission exists

---

### Task 2: Fix stage-engine Supabase connection

The stage-engine Docker container uses `.env.local` which has the wrong Supabase URL. Two problems:

1. Port 54331 should be **55331**
2. `127.0.0.1` from inside Docker means "the container itself" — need `host.docker.internal`

**Step 1: Update `.env.local` in smartout-infra**

**File:** `C:\Users\sxtnl\Dev\smartout-infra\.env.local`

Change:

```
SUPABASE_URL=http://127.0.0.1:54331
```

To:

```
SUPABASE_URL=http://host.docker.internal:55331
```

Also update the keys if they've changed (check `npx supabase status` output for latest keys).

**Step 2: Rebuild and restart stage-engine**

```bash
cd ~/Dev/smartout-infra
docker compose up -d --build stage-engine
```

**Step 3: Verify connection**

```bash
# Check stage-engine logs for Supabase errors
docker compose logs stage-engine --tail 20
```

Expected: No Supabase connection errors. Health endpoint still returns 200.

**Step 4: Test a real Supabase query from stage-engine**

```bash
curl -s http://localhost:3070/health
```

Expected: `{"status":"ok","service":"stage-engine",...}`

---

## Phase 2: Seed Test Data

### Task 3: Create a test API key for stage-engine auth

The stage-engine requires either an `x-api-key` or JWT for all endpoints except `/health`. For testing, we create a `platform_api_key` record.

**Step 1: Generate a test API key and its SHA-256 hash**

```bash
# The test key (we'll use a fixed one for reproducibility)
# Key: smo_sk_test_local_dev_key_12345678
# SHA-256 hash it:
echo -n "smo_sk_test_local_dev_key_12345678" | sha256sum
```

Note the hash output.

**Step 2: Insert the test API key into platform_api_key**

Using Supabase REST API with service role:

```bash
curl -s -X POST "http://127.0.0.1:55331/rest/v1/platform_api_key" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "b0000000-0000-0000-0000-000000000000",
    "key_hash": "<SHA256_HASH_FROM_STEP_1>",
    "key_prefix": "smo_sk_test_",
    "name": "Local Dev Test Key",
    "version": "current",
    "environment": "test",
    "scopes": ["profiles:read", "training:read"],
    "type": "workspace"
  }'
```

**Step 3: Verify the key works against stage-engine**

```bash
curl -s http://localhost:3070/sessions \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: smo_sk_test_local_dev_key_12345678" \
  -d '{
    "mission_id": "discovery-call",
    "workspace_id": "b0000000-0000-0000-0000-000000000000",
    "channel": "voice"
  }'
```

Expected: Returns `session_id`, `mission`, `current_stage`, `system_prompt` — OR a meaningful error (not 401).

**Step 4: Commit**

```bash
# No code changes — this is database seeding only
```

---

### Task 4: Seed a "landing-demo" mission

The landing page defaults to `mission_id: "landing-demo"`. We need this mission in the engine. Create a 2-stage mission that matches the Lise Botsson personality.

**Step 1: Insert landing-demo mission**

```bash
curl -s -X POST "http://127.0.0.1:55331/rest/v1/engine_missions" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "landing-demo",
    "name": "Lise Botsson — Landing Demo",
    "description": "2-stage demo for landing page: learn about the visitor, then explain Smartout.",
    "mode": "sequential",
    "workspace_id": null,
    "is_active": true
  }'
```

**Step 2: Insert Stage 1 — Learn about the visitor**

```bash
curl -s -X POST "http://127.0.0.1:55331/rest/v1/engine_stages" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz" \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "landing-demo",
    "stage_id": "welcome",
    "stage_order": 1,
    "goal": "Learn who the visitor is and what brought them to Smartout.",
    "instructions": "Du er Lise Botsson, Smartouts AI-ambassadør. Snakk norsk. Vær varm, nysgjerrig og profesjonell. Start med å si hei og spør hva de heter og hva de driver med. Finn ut hva som førte dem til Smartout — er de en leder, HR, nysgjerrig? Bruk store-verktøyet til å lagre navnet og rollen deres.",
    "success_criteria": "Du vet navnet og rollen til personen, og har lagret begge med store-verktøyet.",
    "escalation_instructions": "Hvis de er usikre, forklar at du bare vil forstå bakgrunnen deres for å gi best mulig demo.",
    "personality_override": "Varm, engasjert, norsk. Som en dyktig kollega som brenner for det hun gjør.",
    "emotion_hint": "warmth",
    "creative_freedom": 0.8,
    "next_stage": "explain",
    "is_required": true
  }'
```

**Step 3: Insert Stage 2 — Explain Smartout**

```bash
curl -s -X POST "http://127.0.0.1:55331/rest/v1/engine_stages" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz" \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "landing-demo",
    "stage_id": "explain",
    "stage_order": 2,
    "goal": "Explain Smartout tailored to the visitors background and needs.",
    "instructions": "Basert på hva du lærte i forrige steg, forklar Smartout tilpasset deres situasjon. Smartout er et Employee Readiness System for skiftbaserte bedrifter i Norge. Det hjelper ansatte å bli klare fra dag én: onboarding, opplæring, daglig støtte. Bruk fetch-verktøyet for å hente kontekst om hva du allerede vet om dem. Avslutt med å spørre om de vil booke en demo eller har spørsmål.",
    "success_criteria": "Personen har fått en tilpasset forklaring av Smartout og vet hvordan de kan gå videre.",
    "escalation_instructions": "Hvis de spør om noe du ikke vet, vær ærlig og si at teamet kan svare på det i en demo.",
    "personality_override": "Selvsikker men ydmyk. Entusiastisk om produktet uten å være pushy.",
    "emotion_hint": "confidence",
    "creative_freedom": 0.7,
    "next_stage": null,
    "is_required": true
  }'
```

**Step 4: Verify mission and stages**

```bash
curl -s "http://127.0.0.1:55331/rest/v1/engine_stages?select=stage_id,stage_order,goal&mission_id=eq.landing-demo&order=stage_order" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
```

Expected: Two stages — "welcome" (1) and "explain" (2)

---

## Phase 3: Tunnel Setup

### Task 5: Set up ngrok tunnel for Ultravox callbacks

Ultravox runs in the cloud and needs to call stage-engine tool endpoints (store, fetch, advance) via HTTP. The stage-engine is at localhost:3070 which Ultravox can't reach. We expose it via ngrok.

**Step 1: Install ngrok (if not installed)**

```bash
# Windows (via winget)
winget install ngrok.ngrok

# Or download from https://ngrok.com/download
```

**Step 2: Start ngrok tunnel**

```bash
ngrok http 3070
```

Expected output includes a public URL like:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3070
```

Copy the `https://...ngrok-free.app` URL.

**Step 3: Verify the tunnel works**

```bash
curl -s https://abc123.ngrok-free.app/health
```

Expected: Same response as `curl localhost:3070/health`

---

### Task 6: Update ENGINE_URL and restart stage-engine

The stage-engine uses `ENGINE_URL` to build Ultravox tool callback URLs. It must be the public tunnel URL so Ultravox can reach it.

**Step 1: Update `docker-compose.override.yml`**

**File:** `C:\Users\sxtnl\Dev\smartout-infra\docker-compose.override.yml`

Change the `ENGINE_URL` environment variable for stage-engine:

```yaml
environment:
  - LOG_LEVEL=debug
  - NODE_ENV=development
  - ENGINE_URL=https://abc123.ngrok-free.app # ← ngrok URL
```

**Step 2: Restart stage-engine**

```bash
cd ~/Dev/smartout-infra
docker compose up -d stage-engine
```

**Step 3: Verify ENGINE_URL is set**

```bash
docker compose exec stage-engine env | grep ENGINE_URL
```

Expected: `ENGINE_URL=https://abc123.ngrok-free.app`

**Note:** Do NOT commit the ngrok URL. It changes every session. Revert before committing.

---

## Phase 4: Landing Page Integration

### Task 7: Add STAGE_ENGINE_URL env var to landing app

**Step 1: Add to env config**

**File:** `apps/landing/src/env.ts`

Add a new server-side env var:

```typescript
STAGE_ENGINE_URL: z.string().url().optional(),
STAGE_ENGINE_API_KEY: z.string().optional(),
```

**Step 2: Add to `.env.local` for landing**

**File:** `apps/landing/.env.local` (or wherever landing reads env)

```
STAGE_ENGINE_URL=http://localhost:3070
STAGE_ENGINE_API_KEY=smo_sk_test_local_dev_key_12345678
```

**Step 3: Commit**

```bash
cd ~/Dev/smartout_v3
git add apps/landing/src/env.ts
git commit -m "feat(landing): add STAGE_ENGINE_URL env var for engine integration"
```

---

### Task 8: Create `/api/wizard/engine-start` route

New API route that calls stage-engine instead of Ultravox directly. Keep the old route unchanged as fallback.

**Step 1: Create the route file**

**File:** `apps/landing/src/app/api/wizard/engine-start/route.ts`

```typescript
// ============================================
// engine-start/route.ts
// Initiates a voice session through the Stage Engine.
// Stage Engine creates the session, builds Ultravox tools,
// and calls Ultravox API — returning a joinUrl.
// Connected to: stage-engine /adapters/ultravox/create-call
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const engineUrl = process.env.STAGE_ENGINE_URL;
  const apiKey = process.env.STAGE_ENGINE_API_KEY;

  if (!engineUrl || !apiKey) {
    console.error("[engine-start] STAGE_ENGINE_URL or STAGE_ENGINE_API_KEY not set");
    return NextResponse.json(
      { error: "Stage Engine is not configured. Set STAGE_ENGINE_URL and STAGE_ENGINE_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = body.mission_id || "landing-demo";

    // Call stage-engine's Ultravox adapter
    const res = await fetch(`${engineUrl}/adapters/ultravox/create-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        mission_id: missionId,
        workspace_id: "b0000000-0000-0000-0000-000000000000",
        language: "no",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[engine-start] Stage Engine error: ${res.status} ${errText}`);
      return NextResponse.json(
        { error: "Stage Engine call failed", details: errText },
        { status: res.status },
      );
    }

    const data = await res.json();

    return NextResponse.json({
      joinUrl: data.join_url,
      callId: data.call_id,
      sessionId: data.session_id,
      mission: missionId,
      engine: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[engine-start] Failed:", message);
    return NextResponse.json(
      { error: "Failed to start engine session", details: message },
      { status: 502 },
    );
  }
}
```

**Step 2: Commit**

```bash
cd ~/Dev/smartout_v3
git add apps/landing/src/app/api/wizard/engine-start/route.ts
git commit -m "feat(landing): add /api/wizard/engine-start route for stage-engine integration"
```

---

### Task 9: Update voice-assistant to support engine route

Add a prop to switch between direct Ultravox (`/api/wizard/start`) and stage-engine (`/api/wizard/engine-start`).

**Step 1: Update VoiceAssistant component**

**File:** `apps/landing/src/components/voice-assistant.tsx`

Add `useEngine` prop:

```typescript
interface VoiceAssistantProps {
  onClose?: () => void;
  autoStart?: boolean;
  missionId?: MissionId;
  useEngine?: boolean; // ← NEW: route through stage-engine
}
```

In the `startSession` function, change the fetch URL:

```typescript
const apiEndpoint = useEngine ? "/api/wizard/engine-start" : "/api/wizard/start";

const res = await fetch(apiEndpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mission_id: missionId }),
});
```

**Step 2: Commit**

```bash
cd ~/Dev/smartout_v3
git add apps/landing/src/components/voice-assistant.tsx
git commit -m "feat(landing): add useEngine prop to VoiceAssistant for stage-engine routing"
```

---

## Phase 5: End-to-End Test

### Task 10: Test the full flow

**Prerequisites checklist:**

- [ ] Local Supabase running with seed data (`npx supabase status`)
- [ ] Docker containers running (`docker compose ps` in smartout-infra)
- [ ] ngrok tunnel active (`ngrok http 3070`)
- [ ] ENGINE_URL in docker-compose.override.yml = ngrok URL
- [ ] Stage-engine restarted after ENGINE_URL change
- [ ] Landing app running (`pnpm --filter landing dev`)
- [ ] `.env.local` has `STAGE_ENGINE_URL` and `STAGE_ENGINE_API_KEY`

**Step 1: Verify stage-engine can create a session**

```bash
curl -s http://localhost:3070/adapters/ultravox/create-call \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: smo_sk_test_local_dev_key_12345678" \
  -d '{
    "mission_id": "landing-demo",
    "workspace_id": "b0000000-0000-0000-0000-000000000000",
    "language": "no"
  }'
```

Expected: Returns `session_id`, `call_id`, `join_url`

**Step 2: Verify landing API route works**

```bash
curl -s http://localhost:3055/api/wizard/engine-start \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"mission_id": "landing-demo"}'
```

Expected: Returns `joinUrl`, `callId`, `sessionId`, `engine: true`

**Step 3: Open landing page and test voice call**

1. Open `http://localhost:3055` in browser
2. Find the voice assistant (may need to pass `useEngine={true}` in the page)
3. Click "Start samtale"
4. Wait for connection — the agent (Lise) should speak first in Norwegian
5. Talk to the agent:
   - Say your name and what you do
   - Agent should call `store` tool (check stage-engine logs)
   - Agent should eventually call `advance` tool
   - New stage: Agent explains Smartout
   - Agent calls `advance` again → mission complete

**Step 4: Verify data in database**

```bash
# Check session was created
curl -s "http://127.0.0.1:55331/rest/v1/engine_sessions?select=id,status,mission_id,collected_data&limit=5&order=created_at.desc" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"

# Check inbox entries
curl -s "http://127.0.0.1:55331/rest/v1/engine_inbox?select=entity_type,data,stage_id&limit=10&order=created_at.desc" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
```

Expected:

- Session with status "complete" and `collected_data` containing stage results
- Inbox entries with entity_type "person" (name, role) stored by the agent

---

### Task 11: Monitor and debug

**Step 1: Watch stage-engine logs during the call**

```bash
cd ~/Dev/smartout-infra
docker compose logs -f stage-engine
```

Look for:

- `POST /adapters/ultravox/create-call` — session created
- `POST /adapters/ultravox/store?session_id=...` — agent storing data
- `POST /adapters/ultravox/fetch?session_id=...` — agent fetching context
- `POST /adapters/ultravox/advance?session_id=...` — stage transitions

**Step 2: Watch ngrok traffic**

Open `http://127.0.0.1:4040` in browser (ngrok inspector). Shows all HTTP requests from Ultravox to the tunnel.

**Step 3: Common issues and fixes**

| Symptom                           | Cause                                     | Fix                                           |
| --------------------------------- | ----------------------------------------- | --------------------------------------------- |
| 401 on create-call                | Bad API key or missing `platform_api_key` | Verify key hash matches                       |
| 404 on create-call                | Mission not found                         | Check `engine_missions` has "landing-demo"    |
| Ultravox tools fail               | ENGINE_URL not public                     | Verify ngrok URL is set and tunnel is active  |
| Stage-engine can't reach Supabase | Wrong SUPABASE_URL in container           | Use `host.docker.internal:55331`              |
| No voice (text only)              | Voice not enabled on Ultravox account     | OK — still tests the flow, just without audio |
| Landing page fetch fails          | STAGE_ENGINE_URL not set                  | Check `.env.local`                            |

---

## Cleanup After Testing

### Task 12: Revert temporary changes

**Step 1: Revert ENGINE_URL in docker-compose.override.yml**

Change back to:

```yaml
- ENGINE_URL=http://localhost:3070
```

**Step 2: Stop ngrok**

Ctrl+C in the ngrok terminal.

**Step 3: Keep the landing page changes**

The `/api/wizard/engine-start` route and `useEngine` prop are valuable for future testing. Keep them committed.

---

## Summary

| Phase | Tasks       | What it does                               |
| ----- | ----------- | ------------------------------------------ |
| 1     | Tasks 1-2   | Fix Supabase seed + Docker networking      |
| 2     | Tasks 3-4   | Create test API key + landing-demo mission |
| 3     | Tasks 5-6   | ngrok tunnel + ENGINE_URL                  |
| 4     | Tasks 7-9   | Landing page env + route + component       |
| 5     | Tasks 10-11 | End-to-end voice test + debugging          |
| —     | Task 12     | Cleanup temporary config                   |
