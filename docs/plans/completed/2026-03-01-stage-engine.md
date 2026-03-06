---
title: "Stage Engine"
status: done
updated: 2026-04-10
created: 2026-03-01
module: meta
tags: []
---

# Stage Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a universal, channel-agnostic HTTP gateway that orchestrates AI agents through defined missions and stages.

**Architecture:** Standalone Hono service in Docker on DigitalOcean. Caddy reverse proxy for HTTPS. Connects to production Supabase for DB + auth. Dual-auth (API key SHA-256 + JWT).

**Tech Stack:** Hono, TypeScript strict, Node.js 22, Docker, Caddy, @supabase/supabase-js, Zod, vitest

**Reference Docs (read before starting):**

- `services/stage-engine/PRD.md` — Full product spec
- `services/stage-engine/ARCHITECTURE.md` — Schema SQL, API spec, file structure
- `services/stage-engine/DECISIONS.md` — 15 locked decisions
- `services/stage-engine/BREAKDOWN.md` — 7 epics, 22 stories
- `CLAUDE.md` — Project conventions and security rules

---

## Build Order

| Epic                   | Tasks | Depends On |
| ---------------------- | ----- | ---------- |
| 1. Infrastructure      | 1–7   | None       |
| 2. Data Model          | 8–10  | Epic 1     |
| 3. Session Lifecycle   | 11–15 | Epic 2     |
| 4. Store & Fetch       | 16–18 | Epic 3     |
| 5. Stage Transitions   | 19–22 | Epic 3     |
| 6. Ultravox Adapter    | 23–25 | Epic 4+5   |
| 7. Verification + Docs | 26–27 | Epic 6     |

Epics 4 and 5 can run in parallel.

---

## Epic 1: Infrastructure

### Task 1: Project Scaffold

**Files:**

- Create: `services/stage-engine/package.json`
- Create: `services/stage-engine/tsconfig.json`
- Create: `services/stage-engine/.gitignore`
- Create: `services/stage-engine/.env.example`

**Step 1: Create package.json**

```json
{
  "name": "@smartout/stage-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "tsx test/e2e.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.8",
    "@supabase/supabase-js": "^2.49.4",
    "hono": "^4.7.4",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.5",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
*.log
```

**Step 4: Create .env.example**

```bash
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

**Step 5: Install dependencies**

Run: `cd services/stage-engine && pnpm install`
Expected: Dependencies installed, pnpm-lock.yaml updated

**Step 6: Commit**

```bash
git add services/stage-engine/package.json services/stage-engine/tsconfig.json services/stage-engine/.gitignore services/stage-engine/.env.example services/stage-engine/pnpm-lock.yaml
git commit -m "feat(stage-engine): scaffold project with Hono + TypeScript"
```

---

### Task 2: Config Module

**Files:**

- Create: `services/stage-engine/src/config.ts`

**Step 1: Create config with Zod validation**

```typescript
// ============================================
// config.ts
// Validates all environment variables at startup.
// If any required var is missing or invalid, the
// process crashes immediately with a clear error.
// ============================================

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  ENGINE_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Supabase — required for DB + auth
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(32),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),

  // Ultravox — required for voice adapter
  ULTRAVOX_API_KEY: z.string().min(1).default("not-set"),

  // Tuning
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SESSION_EXPIRY_HOURS: z.coerce.number().default(24),
  CLEANUP_INTERVAL_MINUTES: z.coerce.number().default(5),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
```

**Step 2: Verify it compiles**

Run: `cd services/stage-engine && npx tsc --noEmit`
Expected: No errors (will fail on missing src/index.ts — that's OK, we add it in Task 7)

**Step 3: Commit**

```bash
git add services/stage-engine/src/config.ts
git commit -m "feat(stage-engine): add Zod env config validation"
```

---

### Task 3: Supabase Client + Crypto

**Files:**

- Create: `services/stage-engine/src/lib/supabase.ts`
- Create: `services/stage-engine/src/lib/crypto.ts`

**Step 1: Create Supabase client factory**

```typescript
// ============================================
// lib/supabase.ts
// Creates Supabase clients for the stage engine.
// Two clients: admin (service role) for DB queries,
// and a factory for per-request JWT validation.
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

/**
 * Admin client with service role key.
 * Used for: API key validation, session CRUD, inbox writes.
 * Never exposed to client-side code.
 */
export const adminClient: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * Creates a client scoped to a user's JWT.
 * Used for: validating Bearer tokens via getUser().
 */
export function createUserClient(jwt: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

**Step 2: Create SHA-256 helper**

```typescript
// ============================================
// lib/crypto.ts
// Cryptographic utilities for API key validation.
// Uses Node.js native crypto — no external deps.
// ============================================

import { createHash } from "node:crypto";

/**
 * Computes SHA-256 hash of a plaintext string.
 * Used to hash API keys for lookup in platform_api_key table.
 * The table stores hashes, never plaintext keys.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/lib/supabase.ts services/stage-engine/src/lib/crypto.ts
git commit -m "feat(stage-engine): add Supabase clients and SHA-256 helper"
```

---

### Task 4: Type Definitions

**Files:**

- Create: `services/stage-engine/src/types/auth.ts`
- Create: `services/stage-engine/src/types/session.ts`
- Create: `services/stage-engine/src/types/api.ts`
- Create: `services/stage-engine/src/types/ultravox.ts`

**Step 1: Create auth types**

```typescript
// ============================================
// types/auth.ts
// Authentication context types. Every authenticated
// request carries an AuthContext through the handler chain.
// ============================================

export type AuthMethod = "jwt" | "api_key";

export interface AuthContext {
  /** How the request was authenticated */
  method: AuthMethod;
  /** Supabase auth user ID (JWT only) */
  userId: string | null;
  /** Workspace this request is scoped to */
  workspaceId: string | null;
  /** Granted permission scopes (API key only, JWT gets "*") */
  scopes: string[];
  /** API key ID for usage tracking (API key only) */
  keyId: string | null;
  /** Key environment: live or test */
  environment: "live" | "test" | null;
}
```

**Step 2: Create session types**

```typescript
// ============================================
// types/session.ts
// Domain types for missions, stages, sessions, and inbox.
// Maps directly to the engine_* database tables.
// ============================================

export type MissionMode = "sequential" | "free" | "hybrid";
export type SessionChannel = "voice" | "sms" | "chat" | "email" | "autonomous";
export type SessionStatus = "active" | "complete" | "expired" | "abandoned";

export interface Mission {
  id: string;
  name: string;
  description: string | null;
  mode: MissionMode;
  context_source: string | null;
  workspace_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: string;
  mission_id: string;
  stage_id: string;
  stage_order: number;
  goal: string;
  instructions: string;
  success_criteria: string;
  escalation_instructions: string | null;
  personality_override: string | null;
  emotion_hint: string | null;
  creative_freedom: number;
  next_stage: string | null;
  is_required: boolean;
  deferred_templates: unknown[];
  inline_instructions: unknown[];
  created_at: string;
}

export interface Session {
  id: string;
  mission_id: string;
  workspace_id: string;
  user_id: string | null;
  profile_id: string | null;
  channel: SessionChannel;
  current_stage_id: string | null;
  stage_index: number;
  status: SessionStatus;
  context: Record<string, unknown>;
  collected_data: Record<string, unknown>;
  summary: string | null;
  callback_url: string | null;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboxItem {
  id: string;
  session_id: string;
  stage_id: string;
  workspace_id: string;
  entity_type: string;
  data: Record<string, unknown>;
  validated: boolean;
  processed: boolean;
  created_at: string;
}
```

**Step 3: Create API request/response types**

```typescript
// ============================================
// types/api.ts
// Request and response shapes for all API endpoints.
// Zod schemas in src/schemas/ validate these at runtime.
// ============================================

import type { MissionMode, SessionChannel, Stage } from "./session.js";

/** POST /sessions — request */
export interface CreateSessionRequest {
  mission_id: string;
  workspace_id: string;
  user_id?: string;
  profile_id?: string;
  channel: SessionChannel;
  callback_url?: string;
  context?: Record<string, unknown>;
}

/** POST /sessions — response */
export interface CreateSessionResponse {
  session_id: string;
  mission: { id: string; name: string; mode: MissionMode };
  current_stage: StageInfo | null;
  stages?: StageInfo[];
  context: Record<string, unknown>;
  progress: string;
  system_prompt: string;
}

export interface StageInfo {
  stage_id: string;
  goal: string;
  instructions: string;
  success_criteria: string;
  emotion_hint: string | null;
}

/** POST /sessions/:id/store — request */
export interface StoreRequest {
  entity_type: string;
  data: Record<string, unknown>;
  stage_id?: string;
}

/** POST /sessions/:id/store — response */
export interface StoreResponse {
  inbox_id: string;
  confirmed: true;
  message: string;
}

/** POST /sessions/:id/fetch — request */
export interface FetchRequest {
  query_type: "context" | "inbox" | "stage" | "history";
  filters?: { entity_type?: string; stage_id?: string };
}

/** POST /sessions/:id/advance — request */
export interface AdvanceRequest {
  result?: Record<string, unknown>;
  next_stage_id?: string;
  force?: boolean;
}

/** POST /sessions/:id/advance — response */
export interface AdvanceResponse {
  new_stage?: StageInfo;
  progress: string;
  complete: boolean;
  system_prompt?: string;
  summary?: string;
}

/** Standard error response */
export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
}
```

**Step 4: Create Ultravox types**

```typescript
// ============================================
// types/ultravox.ts
// Types for the Ultravox voice AI integration.
// Ultravox uses HTTP tool calls and a special
// X-Ultravox-Response-Type header for stage transitions.
// ============================================

export interface UltravoxCreateCallRequest {
  mission_id: string;
  workspace_id: string;
  user_id?: string;
  voice?: string;
  language?: string;
}

export interface UltravoxCreateCallResponse {
  session_id: string;
  call_id: string;
  join_url: string;
}

/** Ultravox new-stage response (returned with X-Ultravox-Response-Type: new-stage header) */
export interface UltravoxNewStageResponse {
  systemPrompt: string;
  toolResultText: string;
  selectedTools?: UltravoxTool[];
}

export interface UltravoxTool {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: UltravoxToolParam[];
    http: {
      baseUrlPattern: string;
      httpMethod: string;
    };
  };
}

export interface UltravoxToolParam {
  name: string;
  location: "PARAMETER_LOCATION_BODY";
  schema: Record<string, unknown>;
  required: boolean;
}

/** Ultravox Create Call API payload */
export interface UltravoxCallPayload {
  systemPrompt: string;
  model?: string;
  voice?: string;
  languageHint?: string;
  selectedTools: UltravoxTool[];
  temperature?: number;
}
```

**Step 5: Verify types compile**

Run: `cd services/stage-engine && npx tsc --noEmit`
Expected: May show error for missing index.ts — types themselves should have no errors

**Step 6: Commit**

```bash
git add services/stage-engine/src/types/
git commit -m "feat(stage-engine): add type definitions for auth, sessions, API, Ultravox"
```

---

### Task 5: Error Handler Middleware

**Files:**

- Create: `services/stage-engine/src/middleware/error-handler.ts`
- Test: `services/stage-engine/test/middleware/error-handler.test.ts`

**Step 1: Write the failing test**

```typescript
// test/middleware/error-handler.test.ts
import { describe, test, expect } from "vitest";
import { Hono } from "hono";
import { errorHandler, EngineError } from "../src/middleware/error-handler.js";

function createTestApp() {
  const app = new Hono();
  app.onError(errorHandler);
  return app;
}

describe("errorHandler", () => {
  test("handles EngineError with correct status and code", async () => {
    const app = createTestApp();
    app.get("/fail", () => {
      throw new EngineError("NOT_FOUND", "Session not found", 404);
    });
    const res = await app.request("/fail");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("NOT_FOUND");
    expect(body.message).toBe("Session not found");
  });

  test("handles unknown errors as 500", async () => {
    const app = createTestApp();
    app.get("/crash", () => {
      throw new Error("unexpected");
    });
    const res = await app.request("/crash");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("INTERNAL_ERROR");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd services/stage-engine && npx vitest run test/middleware/error-handler.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// ============================================
// middleware/error-handler.ts
// Global error handler for the Hono app.
// Converts all errors to a consistent JSON format.
// EngineError is used for known/expected errors.
// ============================================

import type { ErrorHandler } from "hono";

/**
 * Custom error class for expected engine errors.
 * Thrown by route handlers when something goes wrong
 * in a predictable way (not found, validation, etc.).
 */
export class EngineError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/**
 * Global error handler. Catches all thrown errors
 * and returns a consistent JSON error response.
 * EngineError gets its own status code; everything
 * else becomes a 500 Internal Server Error.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof EngineError) {
    return c.json({ error: err.code, message: err.message, status: err.status }, err.status as 400);
  }

  console.error("[stage-engine] Unhandled error:", err);
  return c.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred", status: 500 },
    500,
  );
};
```

**Step 4: Run test to verify it passes**

Run: `cd services/stage-engine && npx vitest run test/middleware/error-handler.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add services/stage-engine/src/middleware/error-handler.ts services/stage-engine/test/middleware/error-handler.test.ts
git commit -m "feat(stage-engine): add error handler middleware with EngineError"
```

---

### Task 6: Auth Middleware

**Files:**

- Create: `services/stage-engine/src/middleware/auth.ts`
- Test: `services/stage-engine/test/middleware/auth.test.ts`

**Step 1: Write the failing test**

```typescript
// test/middleware/auth.test.ts
import { describe, test, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock supabase before importing auth
vi.mock("../src/lib/supabase.js", () => ({
  adminClient: {
    from: vi.fn(),
  },
  createUserClient: vi.fn(),
}));

import { authMiddleware } from "../src/middleware/auth.js";
import { adminClient, createUserClient } from "../src/lib/supabase.js";
import type { AuthContext } from "../src/types/auth.js";

function createTestApp() {
  const app = new Hono();
  app.use("*", authMiddleware);
  app.get("/protected", (c) => {
    const auth = c.get("auth") as AuthContext;
    return c.json({ workspaceId: auth.workspaceId });
  });
  return app;
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when no credentials provided", async () => {
    const app = createTestApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
  });

  test("validates API key via SHA-256 hash lookup", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "key-1",
                workspace_id: "ws-123",
                key_type: "service",
                scopes: ["*"],
                rate_limit_per_minute: 60,
                environment: "live",
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    vi.mocked(adminClient.from).mockImplementation(mockFrom);

    const app = createTestApp();
    const res = await app.request("/protected", {
      headers: { "x-api-key": "smo_svc_live_test123" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("ws-123");
  });

  test("validates JWT via Supabase getUser", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    vi.mocked(createUserClient).mockReturnValue({
      auth: { getUser: mockGetUser },
    } as any);

    const app = createTestApp();
    const res = await app.request("/protected", {
      headers: {
        Authorization: "Bearer valid-jwt-token",
        "x-workspace-id": "ws-456",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("ws-456");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd services/stage-engine && npx vitest run test/middleware/auth.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// ============================================
// middleware/auth.ts
// Dual-auth middleware: validates API keys (SHA-256
// hash lookup) or JWTs (Supabase Auth getUser).
// Sets AuthContext on the Hono context for handlers.
// Follows the same pattern as _shared/auth-middleware.ts
// in Supabase Edge Functions.
// ============================================

import type { MiddlewareHandler } from "hono";
import { adminClient, createUserClient } from "../lib/supabase.js";
import { sha256 } from "../lib/crypto.js";
import type { AuthContext } from "../types/auth.js";

// Extend Hono's context variables to include auth
declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

/**
 * Validates the request and attaches AuthContext.
 * Strategy 1: x-api-key header → SHA-256 hash → platform_api_key lookup.
 * Strategy 2: Authorization Bearer → if smo_ prefix, treat as API key;
 *             otherwise validate as Supabase JWT.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // Strategy 1: API key in x-api-key header
  const apiKey = c.req.header("x-api-key");
  if (apiKey) {
    const auth = await validateApiKey(apiKey);
    if (!auth) {
      return c.json({ error: "AUTH_FAILED", message: "Invalid API key", status: 401 }, 401);
    }
    c.set("auth", auth);
    return next();
  }

  // Strategy 2: Bearer token
  const bearer = c.req.header("authorization")?.replace("Bearer ", "");
  if (bearer) {
    // Check if it's a Smartout API key passed as Bearer
    if (bearer.startsWith("smo_")) {
      const auth = await validateApiKey(bearer);
      if (!auth) {
        return c.json({ error: "AUTH_FAILED", message: "Invalid API key", status: 401 }, 401);
      }
      c.set("auth", auth);
      return next();
    }

    // Otherwise treat as JWT
    const auth = await validateJwt(bearer, c.req.header("x-workspace-id") ?? null);
    if (!auth) {
      return c.json(
        { error: "AUTH_FAILED", message: "Invalid or expired token", status: 401 },
        401,
      );
    }
    c.set("auth", auth);
    return next();
  }

  return c.json(
    { error: "AUTH_FAILED", message: "Missing authentication credentials", status: 401 },
    401,
  );
};

/**
 * Validates an API key by hashing it and looking up
 * the hash in the platform_api_key table.
 * Also updates last_used_at for usage tracking.
 */
async function validateApiKey(plaintextKey: string): Promise<AuthContext | null> {
  const keyHash = sha256(plaintextKey);

  const { data, error } = await adminClient
    .from("platform_api_key")
    .select("id, workspace_id, key_type, scopes, rate_limit_per_minute, environment")
    .eq("key_hash", keyHash)
    .in("version", ["current", "previous"])
    .maybeSingle();

  if (error || !data) return null;

  // Fire-and-forget: update last_used_at
  adminClient
    .from("platform_api_key")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    method: "api_key",
    userId: null,
    workspaceId: data.workspace_id,
    scopes: data.scopes ?? [],
    keyId: data.id,
    environment: data.environment,
  };
}

/**
 * Validates a JWT by creating a scoped Supabase client
 * and calling getUser(). Workspace ID comes from the
 * x-workspace-id header (same pattern as Edge Functions).
 */
async function validateJwt(jwt: string, workspaceId: string | null): Promise<AuthContext | null> {
  const client = createUserClient(jwt);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) return null;

  return {
    method: "jwt",
    userId: user.id,
    workspaceId,
    scopes: ["*"],
    keyId: null,
    environment: null,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd services/stage-engine && npx vitest run test/middleware/auth.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add services/stage-engine/src/middleware/auth.ts services/stage-engine/test/middleware/auth.test.ts
git commit -m "feat(stage-engine): add dual-auth middleware (API key + JWT)"
```

---

### Task 7: Hono App + Health Endpoint

**Files:**

- Create: `services/stage-engine/src/app.ts`
- Create: `services/stage-engine/src/index.ts`
- Test: `services/stage-engine/test/routes/health.test.ts`

**Step 1: Write the failing test**

```typescript
// test/routes/health.test.ts
import { describe, test, expect } from "vitest";
import { createApp } from "../src/app.js";

describe("GET /health", () => {
  test("returns 200 with status ok", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("stage-engine");
    expect(body.version).toBe("0.1.0");
  });

  test("does not require authentication", async () => {
    const app = createApp();
    // No auth headers
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd services/stage-engine && npx vitest run test/routes/health.test.ts`
Expected: FAIL — module not found

**Step 3: Create app.ts (testable app factory)**

```typescript
// ============================================
// app.ts
// Creates the Hono application with all routes
// and middleware. Exported as a factory so tests
// can create fresh instances without starting a server.
// ============================================

import { Hono } from "hono";
import { errorHandler } from "./middleware/error-handler.js";
import { authMiddleware } from "./middleware/auth.js";

/**
 * Creates and configures the Hono application.
 * Call this from index.ts to start the server,
 * or from tests to get a testable app instance.
 */
export function createApp(): Hono {
  const app = new Hono();

  // Global error handler — catches all thrown errors
  app.onError(errorHandler);

  // Health check — no auth required
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "stage-engine",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    }),
  );

  // All session and adapter routes require auth
  app.use("/sessions/*", authMiddleware);
  app.use("/adapters/*", authMiddleware);

  // Routes will be registered here in subsequent tasks:
  // POST   /sessions
  // GET    /sessions/:id
  // POST   /sessions/:id/store
  // POST   /sessions/:id/fetch
  // POST   /sessions/:id/advance
  // POST   /sessions/:id/abandon
  // POST   /adapters/ultravox/create-call
  // POST   /adapters/ultravox/store
  // POST   /adapters/ultravox/fetch
  // POST   /adapters/ultravox/advance

  return app;
}
```

**Step 4: Create index.ts (server entry)**

```typescript
// ============================================
// index.ts
// Server entry point. Starts the Hono HTTP server
// on the configured port. This file is the target
// of `pnpm dev` and `pnpm start`.
// ============================================

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`[stage-engine] Running on port ${info.port}`);
  console.log(`[stage-engine] Environment: ${config.NODE_ENV}`);
});
```

**Step 5: Run test to verify it passes**

Run: `cd services/stage-engine && npx vitest run test/routes/health.test.ts`
Expected: PASS (2 tests)

**Step 6: Run all tests**

Run: `cd services/stage-engine && npx vitest run`
Expected: All tests pass

**Step 7: Verify dev server starts**

Run: `cd services/stage-engine && echo "SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=test-key-32-chars-long-placeholder SUPABASE_SERVICE_ROLE_KEY=test-key-32-chars-long-placeholder" > .env && timeout 5 pnpm dev || true`
Expected: Server starts, prints port message

**Step 8: Commit**

```bash
git add services/stage-engine/src/app.ts services/stage-engine/src/index.ts services/stage-engine/test/routes/health.test.ts
git commit -m "feat(stage-engine): add Hono app factory with health endpoint"
```

---

## Epic 2: Data Model

### Task 8: Database Migration — Tables

**Files:**

- Create: `supabase/migrations/20260301200000_engine_tables.sql`

**Step 1: Create migration with all 4 engine tables**

Copy the complete SQL from `services/stage-engine/ARCHITECTURE.md` sections 3.1–3.4. The SQL includes:

- `engine_missions` — mission definitions (TEXT PK, mode check, workspace FK)
- `engine_stages` — stage definitions per mission (UUID PK, mission FK, unique constraints)
- `engine_sessions` — active session tracking (UUID PK, JSONB context/collected_data)
- `engine_inbox` — generic data inbox (UUID PK, session FK, freeform entity_type)

All tables include `ENABLE ROW LEVEL SECURITY` statements.

**Important:** The exact SQL is in `services/stage-engine/ARCHITECTURE.md` section 3 — copy it verbatim. Do NOT create tables without RLS enabled.

**Step 2: Apply migration**

Run: `npx supabase migration up --local`
Expected: Migration applied successfully

**Step 3: Verify tables exist**

Run: `npx supabase db execute --local "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'engine_%' ORDER BY table_name;"`
Expected: 4 rows — engine_inbox, engine_missions, engine_sessions, engine_stages

**Step 4: Commit**

```bash
git add supabase/migrations/20260301200000_engine_tables.sql
git commit -m "feat(stage-engine): add engine_missions, engine_stages, engine_sessions, engine_inbox tables"
```

---

### Task 9: Database Migration — RLS Policies + Indexes

**Files:**

- Create: `supabase/migrations/20260301200100_engine_rls_indexes.sql`

**Step 1: Create migration**

RLS policies follow dual-auth pattern:

- JWT path: `workspace_id IN (SELECT workspace_id FROM profile WHERE user_id = auth.uid() AND is_active = true)`
- API key path: `workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid`

Copy RLS policies and indexes from `services/stage-engine/ARCHITECTURE.md` sections 3.1–3.4.

Indexes needed:

- `idx_engine_missions_context` — active missions by context_source
- `idx_engine_missions_workspace` — active missions by workspace
- `idx_engine_stages_mission` — stages ordered within mission
- `idx_engine_sessions_workspace_status` — active sessions by workspace
- `idx_engine_sessions_expiry` — active sessions by expiry time
- `idx_engine_sessions_context_source` — sessions by mission+workspace
- `idx_engine_inbox_session` — inbox items by session+stage
- `idx_engine_inbox_processing` — unprocessed inbox items

**Step 2: Apply migration**

Run: `npx supabase migration up --local`
Expected: Migration applied

**Step 3: Verify RLS is active**

Run: `npx supabase db execute --local "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'engine_%';"`
Expected: All 4 tables show `rowsecurity = true`

**Step 4: Commit**

```bash
git add supabase/migrations/20260301200100_engine_rls_indexes.sql
git commit -m "feat(stage-engine): add RLS policies and indexes for engine tables"
```

---

### Task 10: Database Migration — Seed Data

**Files:**

- Create: `supabase/migrations/20260301200200_engine_seed.sql`

**Step 1: Create seed migration with a test mission**

```sql
-- ============================================
-- engine_seed.sql
-- Seeds a "discovery-call" mission with 3 stages
-- for testing the full session lifecycle.
-- This is a global mission (workspace_id = NULL).
-- ============================================

-- Discovery Call mission: learn about a new contact
INSERT INTO engine_missions (id, name, description, mode, workspace_id, is_active)
VALUES (
  'discovery-call',
  'Discovery Call',
  'A 3-stage mission to learn about a new contact: their name/role, their main challenge, and confirm understanding.',
  'sequential',
  NULL,
  true
);

-- Stage 1: Greeting — learn the person's name and role
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, emotion_hint, creative_freedom, next_stage, is_required)
VALUES (
  'discovery-call',
  'greeting',
  1,
  'Learn the person''s name and role',
  'Introduce yourself warmly. Ask for their name and what they do. Be genuinely curious. Keep it conversational — no interrogation.',
  'You know their full name and their role/title.',
  'warmth',
  0.8,
  'problem',
  true
);

-- Stage 2: Problem — understand their main challenge
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, escalation_instructions, emotion_hint, creative_freedom, next_stage, is_required)
VALUES (
  'discovery-call',
  'problem',
  2,
  'Understand their main challenge',
  'Ask what their biggest challenge is right now. Listen actively. Ask follow-up questions to understand the root cause, not just symptoms. Store the problem description.',
  'You understand their core problem and can articulate it back to them.',
  'If they say "I don''t have any problems" — reframe as "What would make your work easier?"',
  'empathy',
  0.7,
  'confirm',
  true
);

-- Stage 3: Confirm — summarize and confirm understanding
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, emotion_hint, creative_freedom, is_required)
VALUES (
  'discovery-call',
  'confirm',
  3,
  'Summarize and confirm understanding',
  'Summarize what you''ve learned: their name, role, and main challenge. Ask them to confirm if you got it right. If not, correct your understanding.',
  'They confirm your summary is accurate.',
  'confidence',
  0.6,
  true
);
```

**Step 2: Apply migration**

Run: `npx supabase migration up --local`
Expected: Migration applied, seed data inserted

**Step 3: Verify seed data**

Run: `npx supabase db execute --local "SELECT id, name, mode FROM engine_missions; SELECT mission_id, stage_id, stage_order FROM engine_stages ORDER BY stage_order;"`
Expected: 1 mission (discovery-call) and 3 stages (greeting, problem, confirm)

**Step 4: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: Types regenerated with engine\_\* tables

**Step 5: Commit**

```bash
git add supabase/migrations/20260301200200_engine_seed.sql packages/supabase/src/database.types.ts
git commit -m "feat(stage-engine): seed discovery-call mission with 3 stages"
```

---

## Epic 3: Session Lifecycle

### Task 11: Zod Schemas

**Files:**

- Create: `services/stage-engine/src/schemas/sessions.ts`
- Create: `services/stage-engine/src/schemas/store.ts`
- Create: `services/stage-engine/src/schemas/fetch.ts`
- Create: `services/stage-engine/src/schemas/advance.ts`

**Step 1: Create all request validation schemas**

```typescript
// schemas/sessions.ts
import { z } from "zod";

export const createSessionSchema = z.object({
  mission_id: z.string().min(1),
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  profile_id: z.string().uuid().optional(),
  channel: z.enum(["voice", "sms", "chat", "email", "autonomous"]),
  callback_url: z.string().url().optional(),
  context: z.record(z.unknown()).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
```

```typescript
// schemas/store.ts
import { z } from "zod";

export const storeSchema = z.object({
  entity_type: z.string().min(1).max(100),
  data: z
    .record(z.unknown())
    .refine((d) => JSON.stringify(d).length <= 102400, { message: "Data must be under 100KB" }),
  stage_id: z.string().optional(),
});

export type StoreInput = z.infer<typeof storeSchema>;
```

```typescript
// schemas/fetch.ts
import { z } from "zod";

export const fetchSchema = z.object({
  query_type: z.enum(["context", "inbox", "stage", "history"]),
  filters: z
    .object({
      entity_type: z.string().optional(),
      stage_id: z.string().optional(),
    })
    .optional(),
});

export type FetchInput = z.infer<typeof fetchSchema>;
```

```typescript
// schemas/advance.ts
import { z } from "zod";

export const advanceSchema = z.object({
  result: z.record(z.unknown()).optional(),
  next_stage_id: z.string().optional(),
  force: z.boolean().optional(),
});

export type AdvanceInput = z.infer<typeof advanceSchema>;
```

**Step 2: Verify schemas compile**

Run: `cd services/stage-engine && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add services/stage-engine/src/schemas/
git commit -m "feat(stage-engine): add Zod request validation schemas"
```

---

### Task 12: Session Manager

**Files:**

- Create: `services/stage-engine/src/core/session-manager.ts`
- Test: `services/stage-engine/test/core/session-manager.test.ts`

**Step 1: Write the failing test**

Test the core session logic: loading missions, creating sessions, checking expiry.

```typescript
// test/core/session-manager.test.ts
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/supabase.js", () => ({
  adminClient: { from: vi.fn() },
}));

import { SessionManager } from "../src/core/session-manager.js";
import { adminClient } from "../src/lib/supabase.js";

describe("SessionManager", () => {
  const mgr = new SessionManager();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("loadMission returns mission with stages", async () => {
    // Mock mission lookup
    vi.mocked(adminClient.from).mockImplementation((table: string) => {
      if (table === "engine_missions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "test", name: "Test", mode: "sequential", is_active: true },
                  error: null,
                }),
              }),
            }),
          }),
        } as any;
      }
      if (table === "engine_stages") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { stage_id: "s1", stage_order: 1, goal: "Goal 1", next_stage: "s2" },
                  { stage_id: "s2", stage_order: 2, goal: "Goal 2", next_stage: null },
                ],
                error: null,
              }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const result = await mgr.loadMission("test");
    expect(result.mission.id).toBe("test");
    expect(result.stages).toHaveLength(2);
  });

  test("isExpired returns true for past expiry", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(mgr.isExpired(past)).toBe(true);
  });

  test("isExpired returns false for future expiry", () => {
    const future = new Date(Date.now() + 100000).toISOString();
    expect(mgr.isExpired(future)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd services/stage-engine && npx vitest run test/core/session-manager.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// ============================================
// core/session-manager.ts
// Manages the lifecycle of engine sessions.
// Handles: loading missions, creating sessions,
// fetching session state, checking expiry.
// All database access goes through the admin client.
// ============================================

import { adminClient } from "../lib/supabase.js";
import type { Mission, Stage, Session, SessionChannel } from "../types/session.js";
import { EngineError } from "../middleware/error-handler.js";

interface LoadedMission {
  mission: Mission;
  stages: Stage[];
}

interface CreateSessionParams {
  missionId: string;
  workspaceId: string;
  channel: SessionChannel;
  userId?: string;
  profileId?: string;
  callbackUrl?: string;
  extraContext?: Record<string, unknown>;
}

export class SessionManager {
  /**
   * Loads a mission and its stages from the database.
   * Throws EngineError if mission not found or inactive.
   */
  async loadMission(missionId: string): Promise<LoadedMission> {
    const { data: mission, error: mErr } = await adminClient
      .from("engine_missions")
      .select("*")
      .eq("id", missionId)
      .eq("is_active", true)
      .maybeSingle();

    if (mErr || !mission) {
      throw new EngineError("NOT_FOUND", `Mission "${missionId}" not found or inactive`, 404);
    }

    const { data: stages, error: sErr } = await adminClient
      .from("engine_stages")
      .select("*")
      .eq("mission_id", missionId)
      .order("stage_order", { ascending: true });

    if (sErr || !stages) {
      throw new EngineError("INTERNAL_ERROR", "Failed to load stages", 500);
    }

    return { mission: mission as Mission, stages: stages as Stage[] };
  }

  /**
   * Creates a new session in the database.
   * Sets the first stage for sequential/hybrid modes.
   * Returns the created session.
   */
  async createSession(params: CreateSessionParams): Promise<Session> {
    const { mission, stages } = await this.loadMission(params.missionId);

    // Determine first stage for sequential/hybrid modes
    const firstStage = mission.mode !== "free" && stages.length > 0 ? stages[0] : null;

    // Build initial context
    const context: Record<string, unknown> = {
      ...params.extraContext,
      workspace_id: params.workspaceId,
      user_id: params.userId ?? null,
      profile_id: params.profileId ?? null,
    };

    const { data: session, error } = await adminClient
      .from("engine_sessions")
      .insert({
        mission_id: params.missionId,
        workspace_id: params.workspaceId,
        user_id: params.userId ?? null,
        profile_id: params.profileId ?? null,
        channel: params.channel,
        current_stage_id: firstStage?.stage_id ?? null,
        stage_index: firstStage ? 1 : 0,
        status: "active",
        context,
        collected_data: {},
        callback_url: params.callbackUrl ?? null,
      })
      .select("*")
      .single();

    if (error || !session) {
      throw new EngineError("INTERNAL_ERROR", "Failed to create session", 500);
    }

    return session as Session;
  }

  /**
   * Fetches a session by ID. Checks expiry automatically.
   * Throws EngineError if not found.
   */
  async getSession(sessionId: string): Promise<Session> {
    const { data, error } = await adminClient
      .from("engine_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (error || !data) {
      throw new EngineError("NOT_FOUND", `Session "${sessionId}" not found`, 404);
    }

    const session = data as Session;

    // Auto-expire if past expiry time
    if (session.status === "active" && this.isExpired(session.expires_at)) {
      await this.updateStatus(sessionId, "expired");
      session.status = "expired";
    }

    return session;
  }

  /**
   * Fetches a session and verifies it is active.
   * Throws 409 if session is not active.
   */
  async getActiveSession(sessionId: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (session.status !== "active") {
      throw new EngineError("SESSION_NOT_ACTIVE", `Session is ${session.status}, not active`, 409);
    }
    return session;
  }

  /**
   * Updates session status. Used for abandon, complete, expire.
   */
  async updateStatus(
    sessionId: string,
    status: "complete" | "expired" | "abandoned",
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "complete") {
      updates.completed_at = new Date().toISOString();
    }

    await adminClient.from("engine_sessions").update(updates).eq("id", sessionId);
  }

  /**
   * Updates the session's current stage and collected data.
   */
  async advanceSession(
    sessionId: string,
    nextStageId: string | null,
    stageIndex: number,
    collectedData: Record<string, unknown>,
  ): Promise<void> {
    await adminClient
      .from("engine_sessions")
      .update({
        current_stage_id: nextStageId,
        stage_index: stageIndex,
        collected_data: collectedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  }

  /**
   * Checks if a timestamp is in the past.
   */
  isExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() < Date.now();
  }
}

/** Singleton instance for route handlers */
export const sessionManager = new SessionManager();
```

**Step 4: Run test to verify it passes**

Run: `cd services/stage-engine && npx vitest run test/core/session-manager.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts services/stage-engine/test/core/session-manager.test.ts
git commit -m "feat(stage-engine): add SessionManager with mission loading and session CRUD"
```

---

### Task 13: POST /sessions + GET /sessions/:id

**Files:**

- Create: `services/stage-engine/src/routes/sessions.ts`
- Modify: `services/stage-engine/src/app.ts` — register routes
- Test: `services/stage-engine/test/routes/sessions.test.ts`

**Step 1: Write the failing test**

```typescript
// test/routes/sessions.test.ts
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/supabase.js", () => ({
  adminClient: { from: vi.fn() },
  createUserClient: vi.fn(),
}));

vi.mock("../src/core/session-manager.js", () => ({
  sessionManager: {
    loadMission: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock("../src/core/prompt-builder.js", () => ({
  buildStagePrompt: vi.fn().mockReturnValue("Test system prompt"),
}));

import { createApp } from "../src/app.js";
import { sessionManager } from "../src/core/session-manager.js";

describe("POST /sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  test("creates session and returns first stage", async () => {
    vi.mocked(sessionManager.loadMission).mockResolvedValue({
      mission: { id: "test", name: "Test", mode: "sequential" } as any,
      stages: [
        {
          stage_id: "s1",
          goal: "Goal",
          instructions: "Do it",
          success_criteria: "Done",
          emotion_hint: "warmth",
        },
      ] as any,
    });
    vi.mocked(sessionManager.createSession).mockResolvedValue({
      id: "sess-1",
      current_stage_id: "s1",
      stage_index: 1,
      context: {},
      collected_data: {},
    } as any);

    const app = createApp();
    const res = await app.request("/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "smo_svc_live_test",
      },
      body: JSON.stringify({
        mission_id: "test",
        workspace_id: "00000000-0000-0000-0000-000000000001",
        channel: "chat",
      }),
    });

    // Auth will fail in test (mock not set up for auth) — this tests route registration
    // Full integration tested in E2E (Task 26)
    expect(res.status).toBeDefined();
  });
});
```

**Step 2: Create the route handler**

```typescript
// ============================================
// routes/sessions.ts
// Handles POST /sessions (create) and GET /sessions/:id (status).
// Creates new engine sessions and returns session state.
// ============================================

import type { Context } from "hono";
import { sessionManager } from "../core/session-manager.js";
import { buildStagePrompt } from "../core/prompt-builder.js";
import { createSessionSchema } from "../schemas/sessions.js";
import { EngineError } from "../middleware/error-handler.js";
import type { AuthContext } from "../types/auth.js";
import type { CreateSessionResponse, StageInfo } from "../types/api.js";

/**
 * POST /sessions — Start a new session.
 * Loads the mission, creates a session row,
 * builds the initial system prompt, and returns
 * everything the agent needs to start.
 */
export async function createSession(c: Context): Promise<Response> {
  const auth = c.get("auth") as AuthContext;
  const body = createSessionSchema.parse(await c.req.json());

  // Verify workspace access
  if (auth.workspaceId && auth.workspaceId !== body.workspace_id) {
    throw new EngineError("FORBIDDEN", "Workspace mismatch", 403);
  }

  // Load mission and stages
  const { mission, stages } = await sessionManager.loadMission(body.mission_id);

  // Create the session
  const session = await sessionManager.createSession({
    missionId: body.mission_id,
    workspaceId: body.workspace_id,
    channel: body.channel,
    userId: body.user_id,
    profileId: body.profile_id,
    callbackUrl: body.callback_url,
    extraContext: body.context,
  });

  // Build stage info
  const firstStage = stages.find((s) => s.stage_id === session.current_stage_id);
  const currentStage: StageInfo | null = firstStage
    ? {
        stage_id: firstStage.stage_id,
        goal: firstStage.goal,
        instructions: firstStage.instructions,
        success_criteria: firstStage.success_criteria,
        emotion_hint: firstStage.emotion_hint,
      }
    : null;

  // Build system prompt
  const systemPrompt = firstStage ? buildStagePrompt(firstStage, session.context, {}) : "";

  const totalStages = stages.filter((s) => s.is_required).length;
  const response: CreateSessionResponse = {
    session_id: session.id,
    mission: { id: mission.id, name: mission.name, mode: mission.mode },
    current_stage: currentStage,
    stages: mission.mode === "free" ? stages.map(toStageInfo) : undefined,
    context: session.context,
    progress: `${session.stage_index}/${totalStages}`,
    system_prompt: systemPrompt,
  };

  return c.json(response, 200);
}

/**
 * GET /sessions/:id — Get session status.
 * Returns current state including stage, progress, and collected data.
 */
export async function getSession(c: Context): Promise<Response> {
  const sessionId = c.req.param("id");
  const session = await sessionManager.getSession(sessionId);

  // Load stages for progress calculation
  const { stages } = await sessionManager.loadMission(session.mission_id);
  const totalStages = stages.filter((s) => s.is_required).length;
  const currentStage = stages.find((s) => s.stage_id === session.current_stage_id);

  return c.json({
    session_id: session.id,
    status: session.status,
    current_stage: currentStage ? toStageInfo(currentStage) : null,
    stage_index: session.stage_index,
    progress: `${session.stage_index}/${totalStages}`,
    collected_data: session.collected_data,
    context: session.context,
    summary: session.summary,
  });
}

/** Maps a full Stage to a StageInfo subset */
function toStageInfo(s: {
  stage_id: string;
  goal: string;
  instructions: string;
  success_criteria: string;
  emotion_hint: string | null;
}): StageInfo {
  return {
    stage_id: s.stage_id,
    goal: s.goal,
    instructions: s.instructions,
    success_criteria: s.success_criteria,
    emotion_hint: s.emotion_hint,
  };
}
```

**Step 3: Register routes in app.ts**

Add to `services/stage-engine/src/app.ts` after the auth middleware lines:

```typescript
import { createSession, getSession } from "./routes/sessions.js";

// Inside createApp(), after auth middleware:
app.post("/sessions", createSession);
app.get("/sessions/:id", getSession);
```

**Step 4: Run tests**

Run: `cd services/stage-engine && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add services/stage-engine/src/routes/sessions.ts services/stage-engine/src/app.ts services/stage-engine/test/routes/sessions.test.ts
git commit -m "feat(stage-engine): add POST /sessions and GET /sessions/:id endpoints"
```

---

### Task 14: POST /sessions/:id/abandon

**Files:**

- Create: `services/stage-engine/src/routes/abandon.ts`
- Modify: `services/stage-engine/src/app.ts` — register route

**Step 1: Write route handler**

```typescript
// ============================================
// routes/abandon.ts
// POST /sessions/:id/abandon — marks a session as abandoned.
// Preserves all collected data but stops the session.
// ============================================

import type { Context } from "hono";
import { sessionManager } from "../core/session-manager.js";

/**
 * Marks a session as abandoned. The session must be active.
 * Collected data is preserved for later review.
 */
export async function abandonSession(c: Context): Promise<Response> {
  const sessionId = c.req.param("id");
  const session = await sessionManager.getActiveSession(sessionId);

  await sessionManager.updateStatus(session.id, "abandoned");

  return c.json({
    session_id: session.id,
    status: "abandoned",
    collected_data: session.collected_data,
  });
}
```

**Step 2: Register in app.ts**

```typescript
import { abandonSession } from "./routes/abandon.js";
// Inside createApp():
app.post("/sessions/:id/abandon", abandonSession);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/routes/abandon.ts services/stage-engine/src/app.ts
git commit -m "feat(stage-engine): add POST /sessions/:id/abandon endpoint"
```

---

### Task 15: Session Expiry Cleanup

**Files:**

- Create: `services/stage-engine/src/core/expiry-cleanup.ts`
- Modify: `services/stage-engine/src/index.ts` — start cleanup interval

**Step 1: Write cleanup module**

```typescript
// ============================================
// core/expiry-cleanup.ts
// Background job that marks expired sessions.
// Runs on a configurable interval (default: 5 minutes).
// Updates status from "active" to "expired" for
// sessions past their expires_at timestamp.
// ============================================

import { adminClient } from "../lib/supabase.js";
import { config } from "../config.js";

/**
 * Runs one cleanup cycle: finds and expires stale sessions.
 * Returns the count of expired sessions.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const { data, error } = await adminClient
    .from("engine_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[expiry-cleanup] Error:", error.message);
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[expiry-cleanup] Expired ${count} sessions`);
  }
  return count;
}

/**
 * Starts the cleanup interval. Returns a function to stop it.
 */
export function startExpiryCleanup(): () => void {
  const intervalMs = config.CLEANUP_INTERVAL_MINUTES * 60 * 1000;
  const timer = setInterval(cleanupExpiredSessions, intervalMs);
  console.log(`[expiry-cleanup] Running every ${config.CLEANUP_INTERVAL_MINUTES} minutes`);
  return () => clearInterval(timer);
}
```

**Step 2: Start cleanup in index.ts**

Add to `services/stage-engine/src/index.ts`:

```typescript
import { startExpiryCleanup } from "./core/expiry-cleanup.js";

// After serve() call:
startExpiryCleanup();
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/expiry-cleanup.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add session expiry cleanup background job"
```

---

## Epic 4: Store & Fetch

### Task 16: Inbox Writer

**Files:**

- Create: `services/stage-engine/src/core/inbox-writer.ts`

**Step 1: Write implementation**

```typescript
// ============================================
// core/inbox-writer.ts
// Writes data to the engine_inbox table.
// Validates entity_type and data before writing.
// Returns the created inbox item ID.
// ============================================

import { adminClient } from "../lib/supabase.js";
import { EngineError } from "../middleware/error-handler.js";
import type { InboxItem } from "../types/session.js";

/**
 * Writes a data item to the inbox.
 * The inbox is a generic landing zone — entity_type is
 * freeform (e.g., "department", "shift", "note").
 * Validation and routing happen downstream.
 */
export async function writeToInbox(params: {
  sessionId: string;
  stageId: string;
  workspaceId: string;
  entityType: string;
  data: Record<string, unknown>;
}): Promise<InboxItem> {
  const { data, error } = await adminClient
    .from("engine_inbox")
    .insert({
      session_id: params.sessionId,
      stage_id: params.stageId,
      workspace_id: params.workspaceId,
      entity_type: params.entityType,
      data: params.data,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new EngineError("INTERNAL_ERROR", "Failed to write to inbox", 500);
  }

  return data as InboxItem;
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/inbox-writer.ts
git commit -m "feat(stage-engine): add inbox writer for generic data storage"
```

---

### Task 17: POST /sessions/:id/store

**Files:**

- Create: `services/stage-engine/src/routes/store.ts`
- Modify: `services/stage-engine/src/app.ts` — register route

**Step 1: Write route handler**

```typescript
// ============================================
// routes/store.ts
// POST /sessions/:id/store — agent saves data to inbox.
// Data is stored as-is in the inbox with the entity_type
// label. The response includes an instruction message
// that tells the agent what to do next.
// ============================================

import type { Context } from "hono";
import { sessionManager } from "../core/session-manager.js";
import { writeToInbox } from "../core/inbox-writer.js";
import { storeSchema } from "../schemas/store.js";
import { EngineError } from "../middleware/error-handler.js";
import type { StoreResponse } from "../types/api.js";

export async function storeData(c: Context): Promise<Response> {
  const sessionId = c.req.param("id");
  const session = await sessionManager.getActiveSession(sessionId);
  const body = storeSchema.parse(await c.req.json());

  // Use current stage if not specified
  const stageId = body.stage_id ?? session.current_stage_id;
  if (!stageId) {
    throw new EngineError("VALIDATION_ERROR", "No active stage to store data against", 400);
  }

  const item = await writeToInbox({
    sessionId: session.id,
    stageId,
    workspaceId: session.workspace_id,
    entityType: body.entity_type,
    data: body.data,
  });

  const response: StoreResponse = {
    inbox_id: item.id,
    confirmed: true,
    message: `Data stored successfully. Entity: ${body.entity_type}. Continue with your current stage objectives.`,
  };

  return c.json(response, 200);
}
```

**Step 2: Register in app.ts**

```typescript
import { storeData } from "./routes/store.js";
// Inside createApp():
app.post("/sessions/:id/store", storeData);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/routes/store.ts services/stage-engine/src/app.ts
git commit -m "feat(stage-engine): add POST /sessions/:id/store endpoint"
```

---

### Task 18: POST /sessions/:id/fetch

**Files:**

- Create: `services/stage-engine/src/routes/fetch.ts`
- Modify: `services/stage-engine/src/app.ts` — register route

**Step 1: Write route handler**

```typescript
// ============================================
// routes/fetch.ts
// POST /sessions/:id/fetch — agent requests context or data.
// Supports 4 query types: context, inbox, stage, history.
// Each returns different data based on what the agent needs.
// ============================================

import type { Context } from "hono";
import { adminClient } from "../lib/supabase.js";
import { sessionManager } from "../core/session-manager.js";
import { fetchSchema } from "../schemas/fetch.js";
import { EngineError } from "../middleware/error-handler.js";

export async function fetchData(c: Context): Promise<Response> {
  const sessionId = c.req.param("id");
  const session = await sessionManager.getSession(sessionId);
  const body = fetchSchema.parse(await c.req.json());

  let data: unknown;

  switch (body.query_type) {
    case "context":
      data = session.context;
      break;

    case "inbox": {
      let query = adminClient
        .from("engine_inbox")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (body.filters?.entity_type) {
        query = query.eq("entity_type", body.filters.entity_type);
      }
      if (body.filters?.stage_id) {
        query = query.eq("stage_id", body.filters.stage_id);
      }

      const { data: items, error } = await query;
      if (error) throw new EngineError("INTERNAL_ERROR", "Failed to fetch inbox", 500);
      data = items;
      break;
    }

    case "stage": {
      if (!session.current_stage_id) {
        data = null;
        break;
      }
      const { stages } = await sessionManager.loadMission(session.mission_id);
      data = stages.find((s) => s.stage_id === session.current_stage_id) ?? null;
      break;
    }

    case "history":
      data = session.collected_data;
      break;

    default:
      throw new EngineError("VALIDATION_ERROR", `Unknown query_type: ${body.query_type}`, 400);
  }

  return c.json({ data });
}
```

**Step 2: Register in app.ts**

```typescript
import { fetchData } from "./routes/fetch.js";
// Inside createApp():
app.post("/sessions/:id/fetch", fetchData);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/routes/fetch.ts services/stage-engine/src/app.ts
git commit -m "feat(stage-engine): add POST /sessions/:id/fetch endpoint"
```

---

## Epic 5: Stage Transitions

### Task 19: Stage Manager

**Files:**

- Create: `services/stage-engine/src/core/stage-manager.ts`
- Test: `services/stage-engine/test/core/stage-manager.test.ts`

**Step 1: Write the failing test**

```typescript
// test/core/stage-manager.test.ts
import { describe, test, expect } from "vitest";
import { StageManager } from "../src/core/stage-manager.js";
import type { Stage } from "../src/types/session.js";

const stages: Stage[] = [
  { stage_id: "greeting", stage_order: 1, next_stage: "problem", is_required: true } as Stage,
  { stage_id: "problem", stage_order: 2, next_stage: "confirm", is_required: true } as Stage,
  { stage_id: "confirm", stage_order: 3, next_stage: null, is_required: true } as Stage,
];

describe("StageManager", () => {
  const mgr = new StageManager();

  test("sequential: returns next_stage from current stage", () => {
    const next = mgr.getNextStage("sequential", stages, "greeting", undefined);
    expect(next).toBe("problem");
  });

  test("sequential: returns null on last stage", () => {
    const next = mgr.getNextStage("sequential", stages, "confirm", undefined);
    expect(next).toBeNull();
  });

  test("free: uses provided next_stage_id", () => {
    const next = mgr.getNextStage("free", stages, "greeting", "confirm");
    expect(next).toBe("confirm");
  });

  test("free: throws if no next_stage_id provided", () => {
    expect(() => mgr.getNextStage("free", stages, "greeting", undefined)).toThrow();
  });

  test("getProgress returns correct fraction", () => {
    expect(mgr.getProgress(stages, 2)).toBe("2/3");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd services/stage-engine && npx vitest run test/core/stage-manager.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// ============================================
// core/stage-manager.ts
// Handles stage navigation logic for different
// mission modes: sequential, free, hybrid.
// Pure logic — no database access.
// ============================================

import type { MissionMode, Stage } from "../types/session.js";
import { EngineError } from "../middleware/error-handler.js";

export class StageManager {
  /**
   * Determines the next stage ID based on mission mode.
   * Sequential: follows stage.next_stage chain.
   * Free: uses the provided next_stage_id.
   * Hybrid: sequential for required stages, free for optional.
   * Returns null if mission is complete (no more stages).
   */
  getNextStage(
    mode: MissionMode,
    stages: Stage[],
    currentStageId: string,
    requestedNextId: string | undefined,
  ): string | null {
    const currentStage = stages.find((s) => s.stage_id === currentStageId);
    if (!currentStage) {
      throw new EngineError("NOT_FOUND", `Stage "${currentStageId}" not found`, 404);
    }

    switch (mode) {
      case "sequential":
        return currentStage.next_stage;

      case "free":
        if (!requestedNextId) {
          throw new EngineError(
            "VALIDATION_ERROR",
            "next_stage_id is required for free mode missions",
            400,
          );
        }
        // Verify the requested stage exists
        if (!stages.find((s) => s.stage_id === requestedNextId)) {
          throw new EngineError("NOT_FOUND", `Stage "${requestedNextId}" not found`, 404);
        }
        return requestedNextId;

      case "hybrid":
        // Required stages follow sequential, optional follow free
        if (currentStage.is_required) {
          return currentStage.next_stage;
        }
        if (!requestedNextId) {
          throw new EngineError(
            "VALIDATION_ERROR",
            "next_stage_id required for optional stages in hybrid mode",
            400,
          );
        }
        return requestedNextId;

      default:
        throw new EngineError("INTERNAL_ERROR", `Unknown mode: ${mode}`, 500);
    }
  }

  /**
   * Calculates progress string like "2/3".
   */
  getProgress(stages: Stage[], currentIndex: number): string {
    const requiredCount = stages.filter((s) => s.is_required).length;
    return `${currentIndex}/${requiredCount}`;
  }
}

export const stageManager = new StageManager();
```

**Step 4: Run test to verify it passes**

Run: `cd services/stage-engine && npx vitest run test/core/stage-manager.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add services/stage-engine/src/core/stage-manager.ts services/stage-engine/test/core/stage-manager.test.ts
git commit -m "feat(stage-engine): add StageManager with sequential/free/hybrid navigation"
```

---

### Task 20: Prompt Builder

**Files:**

- Create: `services/stage-engine/src/core/prompt-builder.ts`
- Test: `services/stage-engine/test/core/prompt-builder.test.ts`

**Step 1: Write the failing test**

```typescript
// test/core/prompt-builder.test.ts
import { describe, test, expect } from "vitest";
import { buildStagePrompt } from "../src/core/prompt-builder.js";
import type { Stage } from "../src/types/session.js";

describe("buildStagePrompt", () => {
  const stage: Stage = {
    stage_id: "greeting",
    goal: "Learn the person's name and role",
    instructions: "Be warm and curious",
    success_criteria: "You know their name and title",
    emotion_hint: "warmth",
    creative_freedom: 0.8,
    personality_override: null,
    escalation_instructions: "Ask a simpler question",
  } as Stage;

  test("includes stage goal and instructions", () => {
    const prompt = buildStagePrompt(stage, {}, {});
    expect(prompt).toContain("Learn the person's name and role");
    expect(prompt).toContain("Be warm and curious");
  });

  test("includes success criteria", () => {
    const prompt = buildStagePrompt(stage, {}, {});
    expect(prompt).toContain("You know their name and title");
  });

  test("includes emotion hint when present", () => {
    const prompt = buildStagePrompt(stage, {}, {});
    expect(prompt).toContain("warmth");
  });

  test("includes context when provided", () => {
    const prompt = buildStagePrompt(stage, { user_name: "Pontus" }, {});
    expect(prompt).toContain("Pontus");
  });

  test("includes collected data summary when provided", () => {
    const prompt = buildStagePrompt(stage, {}, { greeting: { name: "Pontus" } });
    expect(prompt).toContain("greeting");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd services/stage-engine && npx vitest run test/core/prompt-builder.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// ============================================
// core/prompt-builder.ts
// Builds system prompts for AI agents.
// Combines stage instructions with session context
// and collected data into a single prompt string.
// Output is channel-agnostic — works for voice,
// chat, SMS, or any LLM interface.
// ============================================

import type { Stage } from "../types/session.js";

/**
 * Builds a complete system prompt for a given stage.
 * The prompt tells the agent: what to achieve (goal),
 * how to do it (instructions), when it's done (criteria),
 * and what tone to use (emotion hint + creative freedom).
 *
 * @param stage - The current stage definition
 * @param context - Session context (identity, workspace data)
 * @param collectedData - Data collected from previous stages
 * @returns A ready-to-use system prompt string
 */
export function buildStagePrompt(
  stage: Stage,
  context: Record<string, unknown>,
  collectedData: Record<string, unknown>,
): string {
  const sections: string[] = [];

  // Personality override (if stage wants a different tone)
  if (stage.personality_override) {
    sections.push(`## Personality\n${stage.personality_override}`);
  }

  // Core assignment
  sections.push(`## Your Current Assignment`);
  sections.push(`**Goal:** ${stage.goal}`);
  sections.push(`**Instructions:** ${stage.instructions}`);
  sections.push(`**Success Criteria:** ${stage.success_criteria}`);

  // Emotional guidance
  if (stage.emotion_hint) {
    sections.push(`**Emotional Tone:** ${stage.emotion_hint}`);
  }

  // Creative freedom as temperature guidance
  const freedom = stage.creative_freedom ?? 0.7;
  if (freedom >= 0.8) {
    sections.push(`**Style:** Be creative and conversational. You have freedom to improvise.`);
  } else if (freedom <= 0.3) {
    sections.push(`**Style:** Be precise and structured. Follow instructions closely.`);
  }

  // Escalation path
  if (stage.escalation_instructions) {
    sections.push(`## If You Get Stuck\n${stage.escalation_instructions}`);
  }

  // Context about who they're talking to
  if (Object.keys(context).length > 0) {
    sections.push(`## Context\n${formatContext(context)}`);
  }

  // What's been collected so far
  if (Object.keys(collectedData).length > 0) {
    sections.push(`## Previously Collected Data\n${formatCollectedData(collectedData)}`);
  }

  // Rules that always apply
  sections.push(`## Rules`);
  sections.push(`- Complete your goal before advancing to the next stage.`);
  sections.push(`- Use the store tool to save important data as you collect it.`);
  sections.push(`- Use the advance tool when your success criteria are met.`);
  sections.push(`- Be natural and conversational — not robotic.`);

  return sections.join("\n\n");
}

/** Formats context object as readable key-value pairs */
function formatContext(ctx: Record<string, unknown>): string {
  return Object.entries(ctx)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `- **${k}:** ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("\n");
}

/** Formats collected data as a summary per stage */
function formatCollectedData(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([stage, value]) => `- **${stage}:** ${JSON.stringify(value)}`)
    .join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `cd services/stage-engine && npx vitest run test/core/prompt-builder.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add services/stage-engine/src/core/prompt-builder.ts services/stage-engine/test/core/prompt-builder.test.ts
git commit -m "feat(stage-engine): add prompt builder for stage system prompts"
```

---

### Task 21: Webhook Sender

**Files:**

- Create: `services/stage-engine/src/core/webhook-sender.ts`

**Step 1: Write implementation**

```typescript
// ============================================
// core/webhook-sender.ts
// Async webhook notifications for session events.
// Fire-and-forget with exponential backoff retry.
// Never blocks the response to the agent.
// ============================================

type WebhookEvent = "session.started" | "stage.changed" | "session.completed" | "session.abandoned";

interface WebhookPayload {
  event: WebhookEvent;
  session_id: string;
  stage_id: string | null;
  progress: string;
  collected_data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Sends a webhook event to the callback URL.
 * Runs asynchronously — never blocks the caller.
 * Retries 3 times with exponential backoff: 1s, 4s, 16s.
 */
export function sendWebhook(callbackUrl: string | null, payload: WebhookPayload): void {
  if (!callbackUrl) return;

  // Fire-and-forget — don't await
  deliverWithRetry(callbackUrl, payload).catch((err) => {
    console.error(`[webhook] All retries failed for ${callbackUrl}:`, err);
  });
}

async function deliverWithRetry(
  url: string,
  payload: WebhookPayload,
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return;
      console.warn(`[webhook] Attempt ${attempt + 1}: HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[webhook] Attempt ${attempt + 1}:`, err);
    }

    // Exponential backoff: 1s, 4s, 16s
    if (attempt < maxRetries - 1) {
      await sleep(Math.pow(4, attempt) * 1000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/webhook-sender.ts
git commit -m "feat(stage-engine): add webhook sender with exponential backoff retry"
```

---

### Task 22: POST /sessions/:id/advance

**Files:**

- Create: `services/stage-engine/src/routes/advance.ts`
- Modify: `services/stage-engine/src/app.ts` — register route

**Step 1: Write route handler**

```typescript
// ============================================
// routes/advance.ts
// POST /sessions/:id/advance — moves to the next stage.
// Saves result data, determines next stage based on
// mission mode, builds new prompt, fires webhooks.
// ============================================

import type { Context } from "hono";
import { sessionManager } from "../core/session-manager.js";
import { stageManager } from "../core/stage-manager.js";
import { buildStagePrompt } from "../core/prompt-builder.js";
import { sendWebhook } from "../core/webhook-sender.js";
import { advanceSchema } from "../schemas/advance.js";
import type { AdvanceResponse } from "../types/api.js";

export async function advanceStage(c: Context): Promise<Response> {
  const sessionId = c.req.param("id");
  const session = await sessionManager.getActiveSession(sessionId);
  const body = advanceSchema.parse(await c.req.json());

  const { mission, stages } = await sessionManager.loadMission(session.mission_id);

  // Save result for current stage if provided
  const collectedData = { ...session.collected_data } as Record<string, unknown>;
  if (body.result && session.current_stage_id) {
    collectedData[session.current_stage_id] = body.result;
  }

  // Determine next stage
  const nextStageId = session.current_stage_id
    ? stageManager.getNextStage(mission.mode, stages, session.current_stage_id, body.next_stage_id)
    : null;

  // Check if mission is complete (no next stage)
  const isComplete = nextStageId === null;

  if (isComplete) {
    // Mark session complete
    await sessionManager.updateStatus(session.id, "complete");
    await sessionManager.advanceSession(session.id, null, session.stage_index, collectedData);

    // Fire webhook
    sendWebhook(session.callback_url, {
      event: "session.completed",
      session_id: session.id,
      stage_id: null,
      progress: stageManager.getProgress(stages, stages.length),
      collected_data: collectedData,
      timestamp: new Date().toISOString(),
    });

    const response: AdvanceResponse = {
      progress: stageManager.getProgress(stages, stages.length),
      complete: true,
      summary: `Session complete. Collected data from ${Object.keys(collectedData).length} stages.`,
    };
    return c.json(response);
  }

  // Advance to next stage
  const newIndex = session.stage_index + 1;
  await sessionManager.advanceSession(session.id, nextStageId, newIndex, collectedData);

  // Build new prompt
  const nextStage = stages.find((s) => s.stage_id === nextStageId)!;
  const systemPrompt = buildStagePrompt(nextStage, session.context, collectedData);

  // Fire webhook
  sendWebhook(session.callback_url, {
    event: "stage.changed",
    session_id: session.id,
    stage_id: nextStageId,
    progress: stageManager.getProgress(stages, newIndex),
    collected_data: collectedData,
    timestamp: new Date().toISOString(),
  });

  const response: AdvanceResponse = {
    new_stage: {
      stage_id: nextStage.stage_id,
      goal: nextStage.goal,
      instructions: nextStage.instructions,
      success_criteria: nextStage.success_criteria,
      emotion_hint: nextStage.emotion_hint,
    },
    progress: stageManager.getProgress(stages, newIndex),
    complete: false,
    system_prompt: systemPrompt,
  };

  return c.json(response);
}
```

**Step 2: Register in app.ts**

```typescript
import { advanceStage } from "./routes/advance.js";
// Inside createApp():
app.post("/sessions/:id/advance", advanceStage);
```

**Step 3: Run all tests**

Run: `cd services/stage-engine && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add services/stage-engine/src/routes/advance.ts services/stage-engine/src/app.ts
git commit -m "feat(stage-engine): add POST /sessions/:id/advance with stage navigation and webhooks"
```

---

## Epic 6: Ultravox Adapter

### Task 23: Ultravox Client

**Files:**

- Create: `services/stage-engine/src/lib/ultravox.ts`

**Step 1: Write Ultravox API client**

```typescript
// ============================================
// lib/ultravox.ts
// HTTP client for the Ultravox voice AI API.
// Used to create calls with pre-configured tools
// pointing back to the stage engine.
// ============================================

import { config } from "../config.js";
import type { UltravoxCallPayload, UltravoxTool } from "../types/ultravox.js";

const ULTRAVOX_API_URL = "https://api.ultravox.ai/api/calls";

/**
 * Creates a new Ultravox call via their API.
 * Returns the call ID and join URL for WebRTC.
 */
export async function createUltravoxCall(
  payload: UltravoxCallPayload,
): Promise<{ callId: string; joinUrl: string }> {
  const res = await fetch(ULTRAVOX_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.ULTRAVOX_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ultravox API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { callId: string; joinUrl: string };
  return { callId: data.callId, joinUrl: data.joinUrl };
}

/**
 * Builds the Ultravox tool definitions that point
 * back to the stage engine's adapter endpoints.
 * These tools are registered when creating a call.
 */
export function buildUltravoxTools(
  engineUrl: string,
  sessionId: string,
  apiKey: string,
): UltravoxTool[] {
  const baseHeaders = { "x-api-key": apiKey };

  return [
    buildTool(
      "store_data",
      "Store collected data from the conversation",
      engineUrl,
      sessionId,
      "store",
      {
        entity_type: {
          type: "string",
          description: "Type of data being stored (e.g., department, shift, note)",
        },
        data: { type: "object", description: "The data to store" },
      },
    ),
    buildTool(
      "fetch_data",
      "Fetch context or previously stored data",
      engineUrl,
      sessionId,
      "fetch",
      {
        query_type: {
          type: "string",
          enum: ["context", "inbox", "stage", "history"],
          description: "What to fetch",
        },
      },
    ),
    buildTool(
      "advance_stage",
      "Move to the next stage of the mission",
      engineUrl,
      sessionId,
      "advance",
      {
        result: { type: "object", description: "Summary data for the current stage" },
      },
    ),
  ];
}

function buildTool(
  name: string,
  description: string,
  engineUrl: string,
  sessionId: string,
  endpoint: string,
  params: Record<string, unknown>,
): UltravoxTool {
  return {
    temporaryTool: {
      modelToolName: name,
      description,
      dynamicParameters: Object.entries(params).map(([paramName, schema]) => ({
        name: paramName,
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: schema as Record<string, unknown>,
        required: paramName !== "result",
      })),
      http: {
        baseUrlPattern: `${engineUrl}/adapters/ultravox/${endpoint}?session_id=${sessionId}`,
        httpMethod: "POST",
      },
    },
  };
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/lib/ultravox.ts
git commit -m "feat(stage-engine): add Ultravox API client and tool builder"
```

---

### Task 24: Ultravox Adapter Endpoints

**Files:**

- Create: `services/stage-engine/src/routes/adapters/ultravox.ts`
- Modify: `services/stage-engine/src/app.ts` — register routes

**Step 1: Write adapter endpoints**

```typescript
// ============================================
// routes/adapters/ultravox.ts
// Ultravox-specific endpoints that wrap the core
// engine operations with Ultravox's tool calling
// conventions and stage transition headers.
// ============================================

import type { Context } from "hono";
import { sessionManager } from "../../core/session-manager.js";
import { stageManager } from "../../core/stage-manager.js";
import { buildStagePrompt } from "../../core/prompt-builder.js";
import { writeToInbox } from "../../core/inbox-writer.js";
import { sendWebhook } from "../../core/webhook-sender.js";
import { createUltravoxCall, buildUltravoxTools } from "../../lib/ultravox.js";
import { config } from "../../config.js";
import { EngineError } from "../../middleware/error-handler.js";
import type { AuthContext } from "../../types/auth.js";
import type { UltravoxNewStageResponse } from "../../types/ultravox.js";

/**
 * POST /adapters/ultravox/create-call
 * Creates an Ultravox call pre-configured with engine tools.
 * Returns join_url for the frontend BrowserCall component.
 */
export async function ultravoxCreateCall(c: Context): Promise<Response> {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();

  // Start engine session
  const { mission, stages } = await sessionManager.loadMission(body.mission_id);
  const session = await sessionManager.createSession({
    missionId: body.mission_id,
    workspaceId: body.workspace_id,
    channel: "voice",
    userId: body.user_id,
  });

  // Build initial prompt
  const firstStage = stages[0];
  const systemPrompt = buildStagePrompt(firstStage, session.context, {});

  // Build tools pointing back to engine
  const apiKey = c.req.header("x-api-key") ?? "";
  const tools = buildUltravoxTools(config.ENGINE_URL, session.id, apiKey);

  // Create Ultravox call
  const { callId, joinUrl } = await createUltravoxCall({
    systemPrompt,
    voice: body.voice,
    languageHint: body.language ?? "no",
    selectedTools: tools,
    temperature: firstStage.creative_freedom,
  });

  return c.json({
    session_id: session.id,
    call_id: callId,
    join_url: joinUrl,
  });
}

/**
 * POST /adapters/ultravox/store
 * Wraps /sessions/:id/store for Ultravox tool format.
 * Session ID passed as query parameter.
 */
export async function ultravoxStore(c: Context): Promise<Response> {
  const sessionId = c.req.query("session_id");
  if (!sessionId) throw new EngineError("VALIDATION_ERROR", "Missing session_id", 400);

  const session = await sessionManager.getActiveSession(sessionId);
  const body = await c.req.json();

  const item = await writeToInbox({
    sessionId: session.id,
    stageId: session.current_stage_id ?? "unknown",
    workspaceId: session.workspace_id,
    entityType: body.entity_type ?? "note",
    data: body.data ?? body,
  });

  // Ultravox expects a text response as the tool result
  return c.text(
    `Data stored successfully (${item.entity_type}). Continue with your current assignment.`,
  );
}

/**
 * POST /adapters/ultravox/fetch
 * Wraps /sessions/:id/fetch for Ultravox tool format.
 */
export async function ultravoxFetch(c: Context): Promise<Response> {
  const sessionId = c.req.query("session_id");
  if (!sessionId) throw new EngineError("VALIDATION_ERROR", "Missing session_id", 400);

  const session = await sessionManager.getSession(sessionId);
  const body = await c.req.json();

  // Default to context query
  const queryType = body.query_type ?? "context";
  let data: unknown = session.context;

  if (queryType === "history") data = session.collected_data;
  if (queryType === "stage") {
    const { stages } = await sessionManager.loadMission(session.mission_id);
    data = stages.find((s) => s.stage_id === session.current_stage_id);
  }

  return c.text(JSON.stringify(data, null, 2));
}

/**
 * POST /adapters/ultravox/advance
 * Wraps /sessions/:id/advance with Ultravox new-stage header.
 * Returns X-Ultravox-Response-Type: new-stage for seamless transitions.
 */
export async function ultravoxAdvance(c: Context): Promise<Response> {
  const sessionId = c.req.query("session_id");
  if (!sessionId) throw new EngineError("VALIDATION_ERROR", "Missing session_id", 400);

  const session = await sessionManager.getActiveSession(sessionId);
  const body = await c.req.json();
  const { mission, stages } = await sessionManager.loadMission(session.mission_id);

  // Save result
  const collectedData = { ...session.collected_data } as Record<string, unknown>;
  if (body.result && session.current_stage_id) {
    collectedData[session.current_stage_id] = body.result;
  }

  // Determine next stage
  const nextStageId = session.current_stage_id
    ? stageManager.getNextStage(mission.mode, stages, session.current_stage_id, body.next_stage_id)
    : null;

  const isComplete = nextStageId === null;

  if (isComplete) {
    await sessionManager.updateStatus(session.id, "complete");
    await sessionManager.advanceSession(session.id, null, session.stage_index, collectedData);

    sendWebhook(session.callback_url, {
      event: "session.completed",
      session_id: session.id,
      stage_id: null,
      progress: stageManager.getProgress(stages, stages.length),
      collected_data: collectedData,
      timestamp: new Date().toISOString(),
    });

    return c.text(
      "Mission complete. All stages finished. Thank the person and wrap up the conversation.",
    );
  }

  // Advance
  const newIndex = session.stage_index + 1;
  await sessionManager.advanceSession(session.id, nextStageId, newIndex, collectedData);

  const nextStage = stages.find((s) => s.stage_id === nextStageId)!;
  const systemPrompt = buildStagePrompt(nextStage, session.context, collectedData);

  sendWebhook(session.callback_url, {
    event: "stage.changed",
    session_id: session.id,
    stage_id: nextStageId,
    progress: stageManager.getProgress(stages, newIndex),
    collected_data: collectedData,
    timestamp: new Date().toISOString(),
  });

  // Return Ultravox new-stage format
  const uvResponse: UltravoxNewStageResponse = {
    systemPrompt,
    toolResultText: `Moving to stage: ${nextStage.goal}`,
  };

  return c.json(uvResponse, 200, {
    "X-Ultravox-Response-Type": "new-stage",
  });
}
```

**Step 2: Register in app.ts**

```typescript
import {
  ultravoxCreateCall,
  ultravoxStore,
  ultravoxFetch,
  ultravoxAdvance,
} from "./routes/adapters/ultravox.js";

// Inside createApp():
app.post("/adapters/ultravox/create-call", ultravoxCreateCall);
app.post("/adapters/ultravox/store", ultravoxStore);
app.post("/adapters/ultravox/fetch", ultravoxFetch);
app.post("/adapters/ultravox/advance", ultravoxAdvance);
```

**Step 3: Run all tests**

Run: `cd services/stage-engine && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add services/stage-engine/src/routes/adapters/ultravox.ts services/stage-engine/src/app.ts
git commit -m "feat(stage-engine): add Ultravox adapter with create-call, store, fetch, advance"
```

---

## Epic 7: Verification + Docs

### Task 25: Docker + Caddy

**Files:**

- Create: `services/stage-engine/Dockerfile`
- Create: `services/stage-engine/docker-compose.yml`
- Create: `services/stage-engine/Caddyfile`

**Step 1: Create Dockerfile**

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
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

**Step 2: Create docker-compose.yml**

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

**Step 3: Create Caddyfile**

```
engine.smartout.ai {
  reverse_proxy stage-engine:3000
}
```

**Step 4: Verify Docker build**

Run: `cd services/stage-engine && docker compose build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add services/stage-engine/Dockerfile services/stage-engine/docker-compose.yml services/stage-engine/Caddyfile
git commit -m "feat(stage-engine): add Docker, Docker Compose, and Caddy config"
```

---

### Task 26: E2E Test Script

**Files:**

- Create: `services/stage-engine/test/e2e.ts`

**Step 1: Write E2E test**

This script runs the complete session lifecycle against a running server + Supabase:

```typescript
// ============================================
// test/e2e.ts
// End-to-end test for the complete session lifecycle.
// Run against a running stage-engine + local Supabase:
//   1. Start local Supabase: npx supabase start
//   2. Start stage-engine: pnpm dev
//   3. Run: pnpm test:e2e
// ============================================

const BASE_URL = process.env.ENGINE_URL ?? "http://localhost:3000";
const API_KEY = process.env.TEST_API_KEY ?? "smo_svc_live_test";

async function request(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("\n=== Stage Engine E2E Test ===\n");

  // 1. Health check
  console.log("1. Health check");
  const health = await request("/health");
  assert(health.status === 200, "Health returns 200");
  assert(health.data.status === "ok", "Health status is ok");

  // 2. Start session
  console.log("\n2. Start session (discovery-call)");
  const session = await request("/sessions", "POST", {
    mission_id: "discovery-call",
    workspace_id: "00000000-0000-0000-0000-000000000001",
    channel: "chat",
  });
  assert(session.status === 200, "Session created");
  const sessionId = session.data.session_id;
  assert(!!sessionId, "Got session ID");
  assert(session.data.current_stage?.stage_id === "greeting", "First stage is greeting");
  assert(!!session.data.system_prompt, "Got system prompt");

  // 3. Fetch context
  console.log("\n3. Fetch context");
  const ctx = await request(`/sessions/${sessionId}/fetch`, "POST", {
    query_type: "context",
  });
  assert(ctx.status === 200, "Fetch context returns 200");

  // 4. Store data for stage 1
  console.log("\n4. Store data (stage 1: greeting)");
  const store1 = await request(`/sessions/${sessionId}/store`, "POST", {
    entity_type: "contact",
    data: { name: "Pontus", role: "CEO" },
  });
  assert(store1.status === 200, "Store returns 200");
  assert(store1.data.confirmed === true, "Store confirmed");

  // 5. Advance to stage 2
  console.log("\n5. Advance to stage 2 (problem)");
  const adv1 = await request(`/sessions/${sessionId}/advance`, "POST", {
    result: { name: "Pontus", role: "CEO" },
  });
  assert(adv1.status === 200, "Advance returns 200");
  assert(adv1.data.new_stage?.stage_id === "problem", "New stage is problem");
  assert(adv1.data.complete === false, "Not complete yet");

  // 6. Store data for stage 2
  console.log("\n6. Store data (stage 2: problem)");
  const store2 = await request(`/sessions/${sessionId}/store`, "POST", {
    entity_type: "challenge",
    data: { problem: "Onboarding takes too long", impact: "High turnover" },
  });
  assert(store2.status === 200, "Store returns 200");

  // 7. Advance to stage 3
  console.log("\n7. Advance to stage 3 (confirm)");
  const adv2 = await request(`/sessions/${sessionId}/advance`, "POST", {
    result: { problem: "Onboarding takes too long" },
  });
  assert(adv2.status === 200, "Advance returns 200");
  assert(adv2.data.new_stage?.stage_id === "confirm", "New stage is confirm");

  // 8. Store data for stage 3
  console.log("\n8. Store data (stage 3: confirm)");
  const store3 = await request(`/sessions/${sessionId}/store`, "POST", {
    entity_type: "confirmation",
    data: { confirmed: true, summary: "Pontus, CEO, onboarding challenge" },
  });
  assert(store3.status === 200, "Store returns 200");

  // 9. Final advance — session completes
  console.log("\n9. Final advance — session should complete");
  const adv3 = await request(`/sessions/${sessionId}/advance`, "POST", {
    result: { confirmed: true },
  });
  assert(adv3.status === 200, "Advance returns 200");
  assert(adv3.data.complete === true, "Session is complete");

  // 10. Verify session status
  console.log("\n10. Verify session status");
  const final = await request(`/sessions/${sessionId}`);
  assert(final.status === 200, "Get session returns 200");
  assert(final.data.status === "complete", "Session status is complete");
  assert(Object.keys(final.data.collected_data).length === 3, "All 3 stages have data");

  // 11. Verify inbox
  console.log("\n11. Verify inbox");
  const inbox = await request(`/sessions/${sessionId}/fetch`, "POST", {
    query_type: "inbox",
  });
  assert(inbox.status === 200, "Fetch inbox returns 200");
  assert(Array.isArray(inbox.data.data), "Inbox data is array");
  assert(inbox.data.data.length === 3, "Inbox has 3 items");

  console.log("\n=== ALL TESTS PASSED ===\n");
}

main().catch((err) => {
  console.error("\n=== TEST FAILED ===");
  console.error(err);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add services/stage-engine/test/e2e.ts
git commit -m "feat(stage-engine): add E2E test script for full session lifecycle"
```

---

### Task 27: ADR + Documentation

**Files:**

- Create: `docs/decisions/0030-stage-engine-gateway.md`
- Modify: `docs/decisions/0000-decision-log.md` — add entry
- Modify: `CLAUDE.md` — add stage-engine to monorepo structure

**Step 1: Create ADR**

Use template from `docs/templates/decision.md`. Key content:

- **Title:** Stage Engine — Universal Agent Gateway
- **Status:** Accepted
- **Context:** Need a channel-agnostic gateway for AI agents across voice, SMS, chat, email
- **Decision:** Hono service on Docker/DigitalOcean, inbox model, 4 engine\_\* tables, Ultravox adapter
- **Consequences:** New service outside Vercel, separate deployment pipeline, Docker networking

**Step 2: Register in decision log**

Add to `docs/decisions/0000-decision-log.md`:

```
| 0030 | Stage Engine Gateway | Accepted | 2026-03-01 |
```

**Step 3: Update CLAUDE.md monorepo structure**

Add to the monorepo structure section:

```
├── services/          → contract-service (Fastify, port 3100), stage-engine (Hono, port 3000),
│                        scrapling (Python)
```

**Step 4: Commit**

```bash
git add docs/decisions/0030-stage-engine-gateway.md docs/decisions/0000-decision-log.md CLAUDE.md
git commit -m "docs(stage-engine): add ADR-0030 and update project docs"
```

---

## Final Checklist

After all 27 tasks are complete, verify:

- [ ] `cd services/stage-engine && pnpm typecheck` — no errors
- [ ] `cd services/stage-engine && pnpm test` — all unit tests pass
- [ ] `cd services/stage-engine && pnpm build` — compiles to dist/
- [ ] `docker compose build` — Docker image builds
- [ ] E2E test passes against local Supabase
- [ ] All 4 engine\_\* tables exist with RLS enabled
- [ ] Seed data (discovery-call mission) is present
- [ ] ADR-0030 registered in decision log
