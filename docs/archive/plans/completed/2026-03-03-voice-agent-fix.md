---
title: Voice Agent Fix — Get Ultravox Working End-to-End
status: done
updated: 2026-03-03
created: 2026-03-03
module: voice-ai
tags: [ultravox, stage-engine, voice, plan]
---

# Voice Agent Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all blockers preventing the Ultravox voice agent from working — broken tool definitions, missing API keys, and vault configuration — so both the direct path (landing/dashboard) and Stage Engine path produce working voice calls.

**Architecture:** Two call paths exist: (A) Direct — `startMissionCall()` calls Ultravox API, returns joinUrl, no tools needed. (B) Stage Engine — creates engine session, builds Ultravox HTTP tools for store/fetch/advance callbacks, creates call with tools attached. Path A works once the API key is set. Path B is broken due to invalid tool definitions (Learning-0013).

**Tech Stack:** Hono (stage-engine), Ultravox API, Supabase Vault, TypeScript, Next.js API routes

**Blockers identified (3):**

1. `buildUltravoxTools()` uses `headers` on `http` object and query strings in `baseUrlPattern` — both rejected by Ultravox API (Learning-0013)
2. No API keys set — neither Vault secrets nor env vars for `ULTRAVOX_API_KEY` / `OPENROUTER_API_KEY`
3. Supabase Vault disabled locally — `[db.vault]` commented out in `supabase/config.toml`

---

## Task 1: Fix UltravoxHttpTool Type Definition

**Files:**

- Modify: `services/stage-engine/src/types/ultravox.ts:25-41`

**Step 1: Update the UltravoxHttpTool type**

Replace the current `UltravoxHttpTool` type with one that supports `staticParameters` and removes the invalid `headers` field from `http`:

```typescript
/** Parameter location for Ultravox tool parameters */
export type UltravoxParameterLocation =
  | "PARAMETER_LOCATION_BODY"
  | "PARAMETER_LOCATION_QUERY"
  | "PARAMETER_LOCATION_HEADER"
  | "PARAMETER_LOCATION_PATH";

/** A static parameter passed with every tool invocation (invisible to the AI) */
export type UltravoxStaticParameter = {
  name: string;
  location: UltravoxParameterLocation;
  value: string;
};

/** Ultravox tool definition for HTTP tools */
export type UltravoxHttpTool = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: "PARAMETER_LOCATION_BODY";
      schema: Record<string, unknown>;
      required: boolean;
    }>;
    staticParameters?: UltravoxStaticParameter[];
    http: {
      baseUrlPattern: string;
      httpMethod: "POST";
    };
  };
};
```

**Step 2: Run typecheck to verify**

Run: `cd services/stage-engine && pnpm typecheck`
Expected: Errors in `src/lib/ultravox.ts` (references removed `headers` field). This is expected — we fix that in Task 2.

**Step 3: Commit**

```bash
git add services/stage-engine/src/types/ultravox.ts
git commit -m "fix(stage-engine): update UltravoxHttpTool type with staticParameters support"
```

---

## Task 2: Fix buildUltravoxTools() to Use staticParameters

**Files:**

- Modify: `services/stage-engine/src/lib/ultravox.ts:59-140`

**Reference:** `docs/learnings/0013-ultravox-http-tool-parameters.md`

The Ultravox API rejects:

- `headers` on the `http` object → "has no field named 'headers'"
- Query strings in `baseUrlPattern` → "Base URL pattern must not contain a query string"

**Step 1: Rewrite buildUltravoxTools()**

Replace the entire function body. The fix: use `staticParameters` with `PARAMETER_LOCATION_QUERY` for `session_id` and `PARAMETER_LOCATION_HEADER` for `x-api-key`. Remove `headers` from `http` objects. Remove query strings from `baseUrlPattern`.

```typescript
export function buildUltravoxTools(
  engineUrl: string,
  sessionId: string,
  apiKey: string,
): UltravoxHttpTool[] {
  // Auth and session routing via staticParameters — invisible to the AI model.
  // Never put secrets in baseUrlPattern (leaks via logs and referrer headers).
  // See: docs/learnings/0013-ultravox-http-tool-parameters.md
  const staticParams: UltravoxStaticParameter[] = [
    { name: "session_id", location: "PARAMETER_LOCATION_QUERY", value: sessionId },
    ...(apiKey
      ? [{ name: "x-api-key", location: "PARAMETER_LOCATION_HEADER" as const, value: apiKey }]
      : []),
  ];

  return [
    {
      temporaryTool: {
        modelToolName: "store",
        description:
          "Store data that you have collected from the conversation. Call this whenever you learn something important — a name, a problem, a preference, a decision.",
        dynamicParameters: [
          {
            name: "entity_type",
            location: "PARAMETER_LOCATION_BODY",
            schema: { type: "string", description: "Category: 'person', 'problem', 'note', etc." },
            required: true,
          },
          {
            name: "data",
            location: "PARAMETER_LOCATION_BODY",
            schema: { type: "object", description: "The data to store as key-value pairs" },
            required: true,
          },
        ],
        staticParameters: staticParams,
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/store`,
          httpMethod: "POST",
        },
      },
    },
    {
      temporaryTool: {
        modelToolName: "fetch",
        description:
          "Retrieve information you need. Use query_type 'context' for user/workspace info, 'inbox' for previously stored data, 'history' for all collected data.",
        dynamicParameters: [
          {
            name: "query_type",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              type: "string",
              enum: ["context", "inbox", "stage", "history"],
              description: "What to retrieve",
            },
            required: true,
          },
        ],
        staticParameters: staticParams,
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/fetch`,
          httpMethod: "POST",
        },
      },
    },
    {
      temporaryTool: {
        modelToolName: "advance",
        description:
          "Call this when you have completed the current stage and are ready to move to the next one. Include a summary of what you collected as 'result'.",
        dynamicParameters: [
          {
            name: "result",
            location: "PARAMETER_LOCATION_BODY",
            schema: { type: "object", description: "Summary data for the completed stage" },
            required: false,
          },
        ],
        staticParameters: staticParams,
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/advance`,
          httpMethod: "POST",
        },
      },
    },
  ];
}
```

**Step 2: Update imports**

At the top of the file, add `UltravoxStaticParameter` to the import:

```typescript
import type {
  UltravoxCreateCallPayload,
  UltravoxCreateCallApiResponse,
  UltravoxHttpTool,
  UltravoxStaticParameter,
} from "../types/ultravox.js";
```

**Step 3: Run typecheck**

Run: `cd services/stage-engine && pnpm typecheck`
Expected: PASS (0 errors)

**Step 4: Commit**

```bash
git add services/stage-engine/src/lib/ultravox.ts
git commit -m "fix(stage-engine): use staticParameters for Ultravox tool auth and session routing

Fixes Learning-0013: Ultravox http object does not support headers field
and baseUrlPattern must not contain query strings. Auth is now passed via
PARAMETER_LOCATION_HEADER and session_id via PARAMETER_LOCATION_QUERY."
```

---

## Task 3: Enable Supabase Vault Locally

**Files:**

- Modify: `supabase/config.toml:51-52`

The `[db.vault]` section is commented out, which means Vault functions (`get_secret`, `upsert_secret`, `delete_vault_secret`) don't work locally.

**Step 1: Uncomment the vault config**

Change:

```toml
# [db.vault]
# secret_key = "env(SECRET_VALUE)"
```

To:

```toml
[db.vault]
secret_key = "env(VAULT_SECRET_KEY)"
```

Note: Supabase CLI generates a default vault key for local dev. The `env(VAULT_SECRET_KEY)` reference will use the `VAULT_SECRET_KEY` environment variable if set, or Supabase CLI's default.

**Step 2: Verify Vault works**

Run: `npx supabase db reset` (this restarts DB with vault enabled)

Then test:

```bash
npx supabase sql "SELECT vault.create_secret('test-key', 'test-value');"
npx supabase sql "SELECT * FROM vault.decrypted_secrets WHERE name = 'test-key';"
```

Expected: Both commands succeed, second returns the test secret with decrypted value.

**Step 3: Clean up test secret**

```bash
npx supabase sql "DELETE FROM vault.secrets WHERE name = 'test-key';"
```

**Step 4: Commit**

```bash
git add supabase/config.toml
git commit -m "fix(supabase): enable Vault locally for secret management"
```

---

## Task 4: Set API Keys via Environment Variables

**Files:**

- Create: `services/stage-engine/.env.example`
- Create: `services/stage-engine/.env.local` (gitignored)

The stage-engine has no `.env` files at all. The user needs to provide their Ultravox API key from 1Password.

**Step 1: Create .env.example**

```bash
# Stage Engine — Environment Variables
# Copy to .env.local and fill in real values

PORT=3060
ENGINE_URL=http://localhost:3060
LOG_LEVEL=debug

# Supabase (from `npx supabase status`)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>

# API keys — loaded from Vault at runtime, env var is fallback for local dev
# Get from 1Password: op://Development/Ultravox/api-key
ULTRAVOX_API_KEY=
# Get from 1Password: op://Development/OpenRouter/api-key
OPENROUTER_API_KEY=
```

**Step 2: Create .env.local with real Supabase values**

Run `npx supabase status` to get the local credentials, then create `.env.local`:

```bash
PORT=3060
ENGINE_URL=http://localhost:3060
LOG_LEVEL=debug
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<paste from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<paste from supabase status>
ULTRAVOX_API_KEY=<USER PROVIDES FROM 1PASSWORD>
OPENROUTER_API_KEY=<USER PROVIDES FROM 1PASSWORD>
```

**Step 3: Verify .env.local is gitignored**

```bash
grep -q '.env.local' services/stage-engine/.gitignore 2>/dev/null || grep -q '.env.local' .gitignore
```

If not found in either, add to root `.gitignore`.

**Step 4: Commit .env.example only**

```bash
git add services/stage-engine/.env.example
git commit -m "docs(stage-engine): add .env.example with all required variables"
```

---

## Task 5: Verify Direct Voice Path (Path A)

**Files:** No changes — verification only.

This tests the direct Ultravox path used by the dashboard and landing page. No stage-engine needed.

**Step 1: Check env vars in web app**

Verify `ULTRAVOX_API_KEY` is set in `apps/web/.env.local`:

```bash
grep ULTRAVOX_API_KEY apps/web/.env.local
```

If missing, add it (same key as stage-engine).

**Step 2: Start the web app**

```bash
pnpm --filter web dev
```

**Step 3: Test via curl**

```bash
curl -s -X POST http://localhost:3050/api/wizard/start \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie-from-browser>" \
  -d '{"mission_id": "landing-demo"}' | jq .
```

Expected: `{ "joinUrl": "wss://...", "callId": "...", "mission": {...}, "voiceFallbackUsed": false }`

If `voiceFallbackUsed: true`, the "tina" voice isn't available — that's OK, the call still works.

**Step 4: Test from landing page**

```bash
pnpm --filter landing dev
```

Open `http://localhost:3055` and click the voice widget. It should connect and you should hear Lise's greeting.

---

## Task 6: Verify Stage Engine Path (Path B)

**Files:** No changes — verification only.

This tests the full Stage Engine round-trip: create-call → Ultravox → tool callbacks → store/fetch/advance.

**Step 1: Start Supabase + Stage Engine**

```bash
npx supabase start
cd services/stage-engine && pnpm dev
```

Expected: Console shows `[secrets] Loaded: ultravox (env)` (or `(vault)` if Vault has the key).

**Step 2: Seed a test mission in the database**

The stage-engine's `createSession()` loads missions from the DB (`engine_missions` table). We need at least one mission seeded.

```bash
npx supabase sql "
INSERT INTO engine_missions (id, workspace_id, name, description, stages, created_by)
VALUES (
  'landing-demo',
  '00000000-0000-0000-0000-000000000000',
  'Landing Demo',
  'Lise Botsson landing page demo',
  '[{\"stage_id\": \"greeting\", \"goal\": \"Greet the visitor and explain Smartout\", \"instructions\": \"Be friendly and informative about Smartout features\"}]'::jsonb,
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;
"
```

Note: If `engine_missions` uses a different primary key or schema, check the migration first:

```bash
grep -l 'engine_missions' supabase/migrations/*.sql
```

**Step 3: Test create-call endpoint**

```bash
curl -s -X POST http://localhost:3060/adapters/ultravox/create-call \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "mission_id": "landing-demo",
    "workspace_id": "00000000-0000-0000-0000-000000000000"
  }' | jq .
```

Expected: `{ "session_id": "...", "call_id": "...", "join_url": "wss://..." }`

If auth fails (403): the stage-engine needs a valid API key. Either disable auth for local testing or seed a test key.

**Step 4: Test landing page engine path**

In `apps/landing/.env.local`, set:

```
STAGE_ENGINE_URL=http://localhost:3060
STAGE_ENGINE_API_KEY=test-key
```

Then in the landing VoiceAssistant component, enable `useEngine={true}` and test the voice widget.

---

## Task 7: Update Learning Log

**Files:**

- Modify: `docs/learnings/0000-learning-log.md`

**Step 1: Register the fix**

Add entry to the learning log:

```markdown
| 1 | 2026-03-03 | Ultravox staticParameters fix applied (Learning-0013) | Voice agent now works with correct tool definitions |
```

**Step 2: Commit**

```bash
git add docs/learnings/0000-learning-log.md
git commit -m "docs(learnings): register Ultravox staticParameters fix"
```

---

## Summary

| Task | What                      | Risk                   | Time   |
| ---- | ------------------------- | ---------------------- | ------ |
| 1    | Fix UltravoxHttpTool type | Low — type-only change | 2 min  |
| 2    | Fix buildUltravoxTools()  | Medium — core change   | 5 min  |
| 3    | Enable Supabase Vault     | Low — config change    | 3 min  |
| 4    | Set API keys              | Low — env vars         | 3 min  |
| 5    | Verify direct path        | None — read-only test  | 5 min  |
| 6    | Verify engine path        | None — read-only test  | 10 min |
| 7    | Update learning log       | None — docs            | 1 min  |

**Tasks 1-2** are the code fixes. **Task 3-4** are infrastructure. **Tasks 5-6** are verification. **Task 7** is documentation.

The critical fix is in Tasks 1-2: replacing `headers` and query-string patterns with `staticParameters`. Everything else is supporting infrastructure to make the fix testable.
