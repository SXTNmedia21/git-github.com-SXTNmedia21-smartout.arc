# Stage Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Stage Engine — a universal, channel-agnostic gateway (Hono + Docker + Caddy) that orchestrates AI agents through defined missions and stages, with Supabase as the database and Ultravox as the first voice adapter.

**Architecture:** Hono TypeScript server on Node.js behind Caddy reverse proxy. 4 Supabase tables (engine_missions, engine_stages, engine_sessions, engine_inbox). Dual-auth middleware (JWT + API key via SHA-256 hash lookup). Core endpoints for session lifecycle + store/fetch tools + stage transitions. Ultravox adapter for voice calls with X-Ultravox-Response-Type: new-stage header.

**Tech Stack:** Hono, @hono/node-server, @hono/zod-validator, TypeScript 5.x, Node.js 22, Zod 3.x, @supabase/supabase-js 2.49.4, Docker, Caddy 2.x, Supabase (PostgreSQL 17)

**Reference Documents:**

- `services/stage-engine/DECISIONS.md` — 15 locked architectural decisions
- `services/stage-engine/ARCHITECTURE.md` — System design, schema, API, deployment
- `services/stage-engine/BREAKDOWN.md` — 7 epics, 22 stories
- `services/stage-engine/PRD.md` — Full product specification
- `docs/protocols/SECURITY.md` — Auth patterns, key format

---

## Epic 1: Infrastructure

> After this epic: a running Hono server with health endpoint, Docker container, Caddy HTTPS, and auth middleware.

---

### Task 1: Hono Project Scaffold

**Files:**

- Create: `services/stage-engine/package.json`
- Create: `services/stage-engine/tsconfig.json`
- Create: `services/stage-engine/.gitignore`
- Create: `services/stage-engine/src/index.ts`
- Create: `services/stage-engine/src/routes/health.ts`

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
    "test:e2e": "tsx test/e2e.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.14.0",
    "@hono/zod-validator": "^0.5.0",
    "@supabase/supabase-js": "^2.49.4",
    "hono": "^4.7.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.5",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3"
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
.env.local
```

**Step 4: Create src/routes/health.ts**

```typescript
// ============================================
// health.ts
// Health check endpoint for the Stage Engine.
// Returns service status, version, and timestamp.
// Used by Docker healthchecks, Caddy, and monitoring.
// ============================================

import { Hono } from "hono";

const health = new Hono();

/**
 * GET /health
 * Returns service health status.
 * No auth required — public endpoint per Security Protocol §15.5.
 */
health.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "stage-engine",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

export { health };
```

**Step 5: Create src/index.ts**

```typescript
// ============================================
// index.ts
// Entry point for the Stage Engine — Smartout's universal agent gateway.
// Sets up Hono app, registers middleware and routes, starts Node.js server.
// Connected to: src/routes/ (all route handlers)
// Connected to: src/middleware/ (auth, error handling)
// ============================================

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { health } from "./routes/health.js";

const app = new Hono();

// Global middleware
app.use(logger());

// Routes
app.route("/", health);

// Start server
const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stage Engine running on port ${info.port}`);
});

export { app };
```

**Step 6: Install dependencies**

Run: `cd services/stage-engine && pnpm install`

**Step 7: Run dev server to verify**

Run: `cd services/stage-engine && pnpm dev`
Expected: "Stage Engine running on port 3000"

Test: `curl http://localhost:3000/health`
Expected: `{"status":"ok","service":"stage-engine","version":"0.1.0","timestamp":"..."}`

**Step 8: Type check**

Run: `cd services/stage-engine && pnpm typecheck`
Expected: No errors

**Step 9: Commit**

```bash
git add services/stage-engine/package.json services/stage-engine/tsconfig.json services/stage-engine/.gitignore services/stage-engine/src/
git commit -m "feat(stage-engine): scaffold Hono project with health endpoint"
```

---

### Task 2: Environment Config with Zod Validation

**Files:**

- Create: `services/stage-engine/src/config.ts`
- Create: `services/stage-engine/.env.example`

**Step 1: Create src/config.ts**

```typescript
// ============================================
// config.ts
// Validates all environment variables at startup using Zod.
// If any required variable is missing or invalid, the process
// crashes immediately with a clear error message.
// Connected to: .env.example (documents all variables)
// ============================================

import { z } from "zod";

const envSchema = z.object({
  /** Server port — defaults to 3000 */
  PORT: z.coerce.number().default(3000),

  /** Public URL of the engine — used in webhook payloads and Ultravox tool URLs */
  ENGINE_URL: z.string().url(),

  /** Supabase project URL */
  SUPABASE_URL: z.string().url(),

  /** Supabase anonymous key — used for JWT-authenticated requests */
  SUPABASE_ANON_KEY: z.string().min(32),

  /** Supabase service role key — used for admin operations (key validation, context loading) */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),

  /** Ultravox API key for creating voice calls */
  ULTRAVOX_API_KEY: z.string().min(1),

  /** Log level */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** How long sessions last before auto-expiry (hours) */
  SESSION_EXPIRY_HOURS: z.coerce.number().default(24),

  /** How often to run the session cleanup job (minutes) */
  CLEANUP_INTERVAL_MINUTES: z.coerce.number().default(5),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
```

**Step 2: Create .env.example**

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

**Step 3: Update src/index.ts to import config**

Add to top of `src/index.ts`, right after imports:

```typescript
import { config } from "./config.js";
```

Replace the port line:

```typescript
const port = config.PORT;
```

**Step 4: Commit**

```bash
git add services/stage-engine/src/config.ts services/stage-engine/.env.example
git commit -m "feat(stage-engine): add Zod-validated environment config"
```

---

### Task 3: Type Definitions

**Files:**

- Create: `services/stage-engine/src/types/session.ts`
- Create: `services/stage-engine/src/types/api.ts`
- Create: `services/stage-engine/src/types/auth.ts`
- Create: `services/stage-engine/src/types/ultravox.ts`

**Step 1: Create src/types/auth.ts**

```typescript
// ============================================
// auth.ts
// Type definitions for auth context.
// The auth middleware attaches this to every authenticated request.
// Connected to: src/middleware/auth.ts (sets these values)
// ============================================

/**
 * Auth context attached to every authenticated request.
 * Contains the resolved identity and auth method used.
 */
export type AuthContext = {
  /** How the request was authenticated */
  method: "api_key" | "jwt";

  /** Workspace this request is scoped to */
  workspaceId: string;

  /** Supabase auth user ID (available for JWT auth) */
  userId?: string;

  /** API key scopes (available for API key auth) */
  scopes?: string[];
};
```

**Step 2: Create src/types/session.ts**

```typescript
// ============================================
// session.ts
// Type definitions for missions, stages, and sessions.
// These mirror the Supabase database schema exactly.
// Connected to: ARCHITECTURE.md §3 (database schema)
// ============================================

/** Mission mode determines how stages are navigated */
export type MissionMode = "sequential" | "free" | "hybrid";

/** Channel through which the agent communicates */
export type SessionChannel = "voice" | "sms" | "chat" | "email" | "autonomous";

/** Session lifecycle status */
export type SessionStatus = "active" | "complete" | "expired" | "abandoned";

/**
 * A mission defines a multi-stage agent workflow.
 * Missions are reusable templates — sessions are instances.
 */
export type Mission = {
  id: string;
  name: string;
  description: string | null;
  mode: MissionMode;
  context_source: string | null;
  workspace_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * A stage is one step within a mission.
 * Contains instructions for the agent and personality overlay.
 */
export type Stage = {
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
};

/**
 * A session is a single run of a mission.
 * Tracks the user, current stage, and all collected data.
 */
export type Session = {
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
};

/**
 * An inbox entry — data stored by an agent during a session.
 * Freeform, categorized by entity_type.
 */
export type InboxEntry = {
  id: string;
  session_id: string;
  stage_id: string;
  workspace_id: string;
  entity_type: string;
  data: Record<string, unknown>;
  validated: boolean;
  processed: boolean;
  created_at: string;
};
```

**Step 3: Create src/types/api.ts**

```typescript
// ============================================
// api.ts
// Request and response types for all API endpoints.
// Used by route handlers and Zod validation schemas.
// Connected to: ARCHITECTURE.md §4.3 (endpoint specs)
// ============================================

import type { MissionMode, SessionChannel, Stage } from "./session.js";

/** POST /sessions — request body */
export type CreateSessionRequest = {
  mission_id: string;
  workspace_id: string;
  user_id?: string;
  profile_id?: string;
  channel: SessionChannel;
  callback_url?: string;
  context?: Record<string, unknown>;
};

/** POST /sessions — response body */
export type CreateSessionResponse = {
  session_id: string;
  mission: {
    id: string;
    name: string;
    mode: MissionMode;
  };
  current_stage: StageInfo | null;
  stages?: StageInfo[];
  context: Record<string, unknown>;
  progress: string;
  system_prompt: string;
};

/** Stage info returned to clients (subset of full Stage) */
export type StageInfo = {
  stage_id: string;
  goal: string;
  instructions: string;
  success_criteria: string;
  emotion_hint?: string;
};

/** POST /sessions/:id/store — request body */
export type StoreRequest = {
  entity_type: string;
  data: Record<string, unknown>;
  stage_id?: string;
};

/** POST /sessions/:id/store — response body */
export type StoreResponse = {
  inbox_id: string;
  confirmed: true;
  message: string;
};

/** POST /sessions/:id/fetch — request body */
export type FetchRequest = {
  query_type: "context" | "inbox" | "stage" | "history";
  filters?: {
    entity_type?: string;
    stage_id?: string;
  };
};

/** POST /sessions/:id/fetch — response body */
export type FetchResponse = {
  data: Record<string, unknown>;
};

/** POST /sessions/:id/advance — request body */
export type AdvanceRequest = {
  result?: Record<string, unknown>;
  next_stage_id?: string;
  force?: boolean;
};

/** POST /sessions/:id/advance — response body */
export type AdvanceResponse = {
  new_stage?: StageInfo;
  progress: string;
  complete: boolean;
  system_prompt?: string;
  summary?: string;
};

/** Standard error response format */
export type ErrorResponse = {
  error: string;
  message: string;
  status: number;
};
```

**Step 4: Create src/types/ultravox.ts**

```typescript
// ============================================
// ultravox.ts
// Type definitions for Ultravox API integration.
// Covers call creation, tool definitions, and new-stage responses.
// Connected to: Ultravox Call Stages docs
// ============================================

/** POST /adapters/ultravox/create-call — request body */
export type CreateUltravoxCallRequest = {
  mission_id: string;
  workspace_id: string;
  user_id?: string;
  voice?: string;
  language?: string;
};

/** POST /adapters/ultravox/create-call — response body */
export type CreateUltravoxCallResponse = {
  session_id: string;
  call_id: string;
  join_url: string;
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
    http: {
      baseUrlPattern: string;
      httpMethod: "POST";
    };
  };
};

/**
 * Ultravox new-stage response body.
 * Returned with header X-Ultravox-Response-Type: new-stage
 * to trigger a seamless stage transition during a voice call.
 */
export type UltravoxNewStageResponse = {
  systemPrompt: string;
  toolResultText: string;
  selectedTools?: UltravoxHttpTool[];
  temperature?: number;
  voice?: string;
  languageHint?: string;
};

/** Ultravox Create Call API request */
export type UltravoxCreateCallPayload = {
  systemPrompt: string;
  model?: string;
  voice?: string;
  languageHint?: string;
  temperature?: number;
  selectedTools: UltravoxHttpTool[];
  medium?: { serverWebSocket?: { inputSampleRate: number; outputSampleRate: number } };
};

/** Ultravox Create Call API response */
export type UltravoxCreateCallApiResponse = {
  callId: string;
  joinUrl: string;
};
```

**Step 5: Type check**

Run: `cd services/stage-engine && pnpm typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add services/stage-engine/src/types/
git commit -m "feat(stage-engine): add type definitions for session, API, auth, Ultravox"
```

---

### Task 4: Supabase Client Factory

**Files:**

- Create: `services/stage-engine/src/lib/supabase.ts`

**Step 1: Create src/lib/supabase.ts**

```typescript
// ============================================
// supabase.ts
// Supabase client factory for the Stage Engine.
// Creates two clients: one for service-role operations (key validation,
// context loading) and one for user-scoped operations (RLS-enforced).
// Connected to: src/config.ts (provides credentials)
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

/**
 * Service-role client — bypasses RLS.
 * Used for: API key hash lookups in platform_api_key,
 * loading identity context, admin operations.
 * NEVER expose this client to user-facing code.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Creates an anon client with a user's JWT for RLS-enforced queries.
 * Used when the request was authenticated via JWT (not API key).
 *
 * @param accessToken - The user's JWT from the Authorization header
 * @returns A Supabase client with the user's auth context
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
```

**Step 2: Type check**

Run: `cd services/stage-engine && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add services/stage-engine/src/lib/supabase.ts
git commit -m "feat(stage-engine): add Supabase client factory (admin + user)"
```

---

### Task 5: Crypto Helper for API Key Validation

**Files:**

- Create: `services/stage-engine/src/lib/crypto.ts`

**Step 1: Create src/lib/crypto.ts**

```typescript
// ============================================
// crypto.ts
// SHA-256 hashing utility for API key validation.
// API keys are stored as SHA-256 hashes in platform_api_key.
// We hash the incoming key and compare against the stored hash.
// Connected to: src/middleware/auth.ts (uses hashApiKey)
// Connected to: SECURITY.md (key storage pattern)
// ============================================

import { createHash } from "node:crypto";

/**
 * Hashes a raw API key using SHA-256.
 * Used to look up API keys in the platform_api_key table,
 * which stores only hashes — never raw keys.
 *
 * @param key - The raw API key from the x-api-key header
 * @returns The SHA-256 hex digest
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/lib/crypto.ts
git commit -m "feat(stage-engine): add SHA-256 helper for API key validation"
```

---

### Task 6: Auth Middleware (Dual-Auth: API Key + JWT)

**Files:**

- Create: `services/stage-engine/src/middleware/auth.ts`

**Step 1: Create src/middleware/auth.ts**

```typescript
// ============================================
// auth.ts
// Dual-auth middleware for the Stage Engine.
// Supports two auth methods:
//   1. x-api-key header → SHA-256 hash lookup against platform_api_key
//   2. Authorization: Bearer <jwt> → Supabase Auth getUser()
// The resolved auth context is stored in c.set("auth", ...) for route handlers.
// Connected to: src/lib/supabase.ts (admin client for key lookup)
// Connected to: src/lib/crypto.ts (SHA-256 hashing)
// Connected to: DECISIONS.md D14, D15 (auth decisions)
// ============================================

import type { Context, Next } from "hono";
import { supabaseAdmin, createUserClient } from "../lib/supabase.js";
import { hashApiKey } from "../lib/crypto.js";
import type { AuthContext } from "../types/auth.js";

/**
 * Middleware that authenticates requests using API key or JWT.
 * Skips auth for the /health endpoint.
 * On success, sets c.set("auth", authContext) for downstream handlers.
 * On failure, returns 401 with error details.
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  // Health endpoint is public
  if (c.req.path === "/health") {
    return next();
  }

  const apiKey = c.req.header("x-api-key");
  const authHeader = c.req.header("authorization");

  // Try API key first
  if (apiKey) {
    const auth = await validateApiKey(apiKey);
    if (auth) {
      c.set("auth", auth);
      return next();
    }
    return c.json({ error: "AUTH_FAILED", message: "Invalid API key", status: 401 }, 401);
  }

  // Try JWT
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const auth = await validateJwt(token);
    if (auth) {
      c.set("auth", auth);
      return next();
    }
    return c.json({ error: "AUTH_FAILED", message: "Invalid or expired JWT", status: 401 }, 401);
  }

  return c.json(
    { error: "AUTH_FAILED", message: "Missing x-api-key or Authorization header", status: 401 },
    401,
  );
}

/**
 * Validates an API key by hashing it and looking up the hash
 * in the platform_api_key table via service role.
 *
 * @param key - Raw API key from x-api-key header
 * @returns AuthContext if valid, null if invalid
 */
async function validateApiKey(key: string): Promise<AuthContext | null> {
  const hash = hashApiKey(key);

  const { data, error } = await supabaseAdmin
    .from("platform_api_key")
    .select("workspace_id, scopes, is_active, environment")
    .eq("key_hash", hash)
    .eq("version_status", "current")
    .single();

  if (error || !data || !data.is_active) {
    return null;
  }

  return {
    method: "api_key",
    workspaceId: data.workspace_id,
    scopes: data.scopes ?? [],
  };
}

/**
 * Validates a JWT by calling Supabase Auth getUser().
 * Then looks up the user's workspace from their profile.
 *
 * @param token - JWT from Authorization: Bearer header
 * @returns AuthContext if valid, null if invalid
 */
async function validateJwt(token: string): Promise<AuthContext | null> {
  const client = createUserClient(token);

  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    return null;
  }

  // Get user's first active workspace (for workspace context)
  const { data: profile } = await supabaseAdmin
    .from("profile")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!profile) {
    return null;
  }

  return {
    method: "jwt",
    workspaceId: profile.workspace_id,
    userId: user.id,
  };
}
```

**Step 2: Update src/index.ts to use auth middleware**

Add import and middleware registration:

```typescript
import { authMiddleware } from "./middleware/auth.js";

// Add after logger middleware, before routes
app.use("*", authMiddleware);
```

**Step 3: Type check**

Run: `cd services/stage-engine && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add services/stage-engine/src/middleware/auth.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add dual-auth middleware (API key + JWT)"
```

---

### Task 7: Error Handler Middleware

**Files:**

- Create: `services/stage-engine/src/middleware/error-handler.ts`

**Step 1: Create src/middleware/error-handler.ts**

```typescript
// ============================================
// error-handler.ts
// Global error handler for the Stage Engine.
// Catches unhandled errors and returns a consistent JSON error response.
// Connected to: src/types/api.ts (ErrorResponse type)
// ============================================

import type { Context } from "hono";
import type { ErrorResponse } from "../types/api.js";

/**
 * Global error handler.
 * Catches any unhandled error and returns a consistent JSON response.
 * Logs the full error for debugging but only returns safe info to the client.
 */
export function onError(err: Error, c: Context): Response {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);

  const response: ErrorResponse = {
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    status: 500,
  };

  return c.json(response, 500);
}
```

**Step 2: Register in src/index.ts**

Add import and registration:

```typescript
import { onError } from "./middleware/error-handler.js";

// Add after creating the Hono app
app.onError(onError);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/middleware/error-handler.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add global error handler"
```

---

### Task 8: Dockerfile and Docker Compose

**Files:**

- Create: `services/stage-engine/Dockerfile`
- Create: `services/stage-engine/docker-compose.yml`
- Create: `services/stage-engine/Caddyfile`

**Step 1: Create Dockerfile**

```dockerfile
# ============================================
# Dockerfile — Stage Engine
# Multi-stage build: compile TypeScript, then run minimal Node.js image.
# Connected to: docker-compose.yml (orchestration)
# ============================================

# Build stage — compile TypeScript to JavaScript
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Runtime stage — minimal image with only compiled output
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

**Step 2: Create docker-compose.yml**

```yaml
# ============================================
# docker-compose.yml — Stage Engine stack
# Runs Caddy (HTTPS reverse proxy) + Stage Engine on a shared Docker network.
# Connected to: Caddyfile (Caddy config)
# Connected to: Dockerfile (engine build)
# ============================================

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
      - ENGINE_URL=${ENGINE_URL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - ULTRAVOX_API_KEY=${ULTRAVOX_API_KEY}
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - SESSION_EXPIRY_HOURS=${SESSION_EXPIRY_HOURS:-24}
      - CLEANUP_INTERVAL_MINUTES=${CLEANUP_INTERVAL_MINUTES:-5}
    networks:
      - smartout-internal
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

**Step 3: Create Caddyfile**

```
# ============================================
# Caddyfile — reverse proxy for Stage Engine
# Caddy auto-provisions HTTPS via Let's Encrypt.
# Connected to: docker-compose.yml (caddy service)
# ============================================

engine.smartout.ai {
  reverse_proxy stage-engine:3000
}
```

**Step 4: Commit**

```bash
git add services/stage-engine/Dockerfile services/stage-engine/docker-compose.yml services/stage-engine/Caddyfile
git commit -m "feat(stage-engine): add Docker + Caddy deployment config"
```

---

## Epic 2: Data Model

> After this epic: all 4 engine tables exist in Supabase with RLS, indexes, and a seed mission.

---

### Task 9: Supabase Migration — Engine Tables

**Files:**

- Create: `supabase/migrations/20260301200000_engine_tables.sql`

**Step 1: Create the migration file**

```sql
-- ============================================
-- 20260301200000_engine_tables.sql
-- Creates the 4 core tables for the Stage Engine:
--   engine_missions — reusable agent workflow definitions
--   engine_stages   — ordered steps within missions
--   engine_sessions — active conversation state
--   engine_inbox    — generic data inbox for agent-stored data
-- Connected to: ARCHITECTURE.md §3 (full schema specification)
-- ============================================

-- ----------------------------------------
-- engine_missions
-- A mission is a reusable template for an agent workflow.
-- Missions have modes: sequential (ordered stages), free (agent chooses),
-- or hybrid (fixed start/end, free middle).
-- ----------------------------------------
CREATE TABLE engine_missions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  mode            TEXT NOT NULL DEFAULT 'sequential'
                    CHECK (mode IN ('sequential', 'free', 'hybrid')),
  context_source  TEXT,
  workspace_id    UUID REFERENCES workspace(workspace_id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_missions ENABLE ROW LEVEL SECURITY;

-- Global missions (workspace_id IS NULL) are readable by everyone.
-- Workspace missions are readable by workspace members (JWT) or API key auth.
CREATE POLICY "read_missions" ON engine_missions
FOR SELECT USING (
  workspace_id IS NULL
  OR workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

-- Only service role can insert/update/delete missions
CREATE POLICY "manage_missions" ON engine_missions
FOR ALL USING (
  auth.role() = 'service_role'
);

CREATE INDEX idx_engine_missions_context ON engine_missions (context_source)
  WHERE is_active = true;
CREATE INDEX idx_engine_missions_workspace ON engine_missions (workspace_id)
  WHERE is_active = true;

-- ----------------------------------------
-- engine_stages
-- A stage is one step within a mission. Contains agent instructions,
-- personality overlay, and navigation rules.
-- ----------------------------------------
CREATE TABLE engine_stages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id              TEXT NOT NULL REFERENCES engine_missions(id) ON DELETE CASCADE,
  stage_id                TEXT NOT NULL,
  stage_order             INTEGER NOT NULL,
  goal                    TEXT NOT NULL,
  instructions            TEXT NOT NULL,
  success_criteria        TEXT NOT NULL,
  escalation_instructions TEXT,
  personality_override    TEXT,
  emotion_hint            TEXT,
  creative_freedom        REAL NOT NULL DEFAULT 0.7
                            CHECK (creative_freedom >= 0 AND creative_freedom <= 1),
  next_stage              TEXT,
  is_required             BOOLEAN NOT NULL DEFAULT true,
  deferred_templates      JSONB DEFAULT '[]',
  inline_instructions     JSONB DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_mission_stage UNIQUE (mission_id, stage_id),
  CONSTRAINT uq_mission_order UNIQUE (mission_id, stage_order)
);

ALTER TABLE engine_stages ENABLE ROW LEVEL SECURITY;

-- Stages inherit mission visibility via subquery on engine_missions
CREATE POLICY "read_stages" ON engine_stages
FOR SELECT USING (
  mission_id IN (SELECT id FROM engine_missions)
);

CREATE POLICY "manage_stages" ON engine_stages
FOR ALL USING (
  auth.role() = 'service_role'
);

CREATE INDEX idx_engine_stages_mission ON engine_stages (mission_id, stage_order);

-- ----------------------------------------
-- engine_sessions
-- A session is one active run of a mission. Tracks user identity,
-- current stage, collected data, and lifecycle status.
-- ----------------------------------------
CREATE TABLE engine_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id      TEXT NOT NULL REFERENCES engine_missions(id),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  user_id         UUID,
  profile_id      UUID,
  channel         TEXT NOT NULL
                    CHECK (channel IN ('voice', 'sms', 'chat', 'email', 'autonomous')),
  current_stage_id TEXT,
  stage_index      INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'complete', 'expired', 'abandoned')),
  context          JSONB NOT NULL DEFAULT '{}',
  collected_data   JSONB NOT NULL DEFAULT '{}',
  summary          TEXT,
  callback_url     TEXT,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_sessions ENABLE ROW LEVEL SECURITY;

-- Workspace isolation: JWT users see their workspace, API key auth uses set_config
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
CREATE INDEX idx_engine_sessions_mission
  ON engine_sessions (mission_id, workspace_id, status);

-- ----------------------------------------
-- engine_inbox
-- Generic data inbox where agents store collected information.
-- Categorized by entity_type, processed asynchronously later.
-- ----------------------------------------
CREATE TABLE engine_inbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES engine_sessions(id) ON DELETE CASCADE,
  stage_id        TEXT NOT NULL,
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  entity_type     TEXT NOT NULL,
  data            JSONB NOT NULL,
  validated       BOOLEAN NOT NULL DEFAULT false,
  processed       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_inbox ENABLE ROW LEVEL SECURITY;

-- Workspace isolation matches sessions policy
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

**Step 2: Apply the migration locally**

Run: `cd smartout_v3 && npx supabase db push` (or `npx supabase migration up` if local)

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Commit**

```bash
git add supabase/migrations/20260301200000_engine_tables.sql packages/supabase/src/database.types.ts
git commit -m "feat(stage-engine): create 4 engine tables with RLS and indexes"
```

---

### Task 10: Seed Test Mission

**Files:**

- Create: `supabase/migrations/20260301200100_engine_seed.sql`

**Step 1: Create the seed migration**

```sql
-- ============================================
-- 20260301200100_engine_seed.sql
-- Seeds a test mission "discovery-call" with 3 stages for E2E testing.
-- This is a global mission (workspace_id = NULL) used for development.
-- Connected to: BREAKDOWN.md Epic 7.1
-- ============================================

-- Discovery call mission — 3-stage sequential flow
INSERT INTO engine_missions (id, name, description, mode, context_source, workspace_id, is_active)
VALUES (
  'discovery-call',
  'Discovery Call',
  'A 3-stage discovery call that learns about the caller, their problem, and confirms understanding.',
  'sequential',
  NULL,
  NULL,
  true
);

-- Stage 1: Greeting — learn who they are
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  escalation_instructions, personality_override, emotion_hint, creative_freedom,
  next_stage, is_required
) VALUES (
  'discovery-call',
  'greeting',
  1,
  'Learn the persons name and role in their organization.',
  'Greet the person warmly. Ask for their name and what they do. Be friendly and natural — this is the first impression. Do not rush. Let them talk.',
  'You know their name and their role/title. Both have been stored.',
  'If they seem reluctant, explain that you just want to understand who you are talking to so you can help them better.',
  'Be extra warm and welcoming. First impressions matter.',
  'warmth',
  0.8,
  'problem',
  true
);

-- Stage 2: Problem — understand their challenge
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  escalation_instructions, personality_override, emotion_hint, creative_freedom,
  next_stage, is_required
) VALUES (
  'discovery-call',
  'problem',
  2,
  'Understand the main challenge or problem they are facing.',
  'Ask what brought them here today. Listen actively. Ask follow-up questions to understand the root cause, not just symptoms. Summarize what you heard to confirm understanding.',
  'You can clearly articulate their main problem in one sentence. The problem description has been stored.',
  'If they are vague, ask for a specific example. "Can you give me an example of when this happened?"',
  'Be empathetic and curious. Show that you genuinely want to understand.',
  'empathy',
  0.7,
  'confirm',
  true
);

-- Stage 3: Confirm — summarize and verify
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  escalation_instructions, personality_override, emotion_hint, creative_freedom,
  next_stage, is_required
) VALUES (
  'discovery-call',
  'confirm',
  3,
  'Summarize what you learned and confirm with the person that you understood correctly.',
  'Summarize: their name, role, and main problem. Ask "Did I get that right?" If they correct you, update your understanding. End by thanking them and explaining what happens next.',
  'The person has confirmed that your summary is accurate. Confirmation has been stored.',
  'If they disagree with your summary, apologize and ask them to explain again. Do not argue.',
  'Be confident but humble. You are confirming, not lecturing.',
  'confidence',
  0.6,
  NULL,
  true
);
```

**Step 2: Apply the migration**

Run: `cd smartout_v3 && npx supabase migration up`

**Step 3: Commit**

```bash
git add supabase/migrations/20260301200100_engine_seed.sql
git commit -m "feat(stage-engine): seed discovery-call test mission with 3 stages"
```

---

## Epic 3: Session Lifecycle

> After this epic: sessions can be started, queried, expired, and abandoned.

---

### Task 11: Session Manager (Core Engine Logic)

**Files:**

- Create: `services/stage-engine/src/core/session-manager.ts`

**Step 1: Create src/core/session-manager.ts**

```typescript
// ============================================
// session-manager.ts
// Core session lifecycle management for the Stage Engine.
// Handles creating, loading, expiring, and abandoning sessions.
// All session state is stored in Supabase engine_sessions table.
// Connected to: src/routes/sessions.ts (route handlers call these functions)
// Connected to: src/types/session.ts (type definitions)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { config } from "../config.js";
import type { Mission, Stage, Session } from "../types/session.js";
import type { CreateSessionRequest, CreateSessionResponse } from "../types/api.js";
import type { AuthContext } from "../types/auth.js";

/**
 * Loads a mission and all its stages from the database.
 * Returns null if the mission does not exist or is inactive.
 */
export async function loadMission(
  missionId: string,
): Promise<{ mission: Mission; stages: Stage[] } | null> {
  const { data: mission, error: missionErr } = await supabaseAdmin
    .from("engine_missions")
    .select("*")
    .eq("id", missionId)
    .eq("is_active", true)
    .single();

  if (missionErr || !mission) return null;

  const { data: stages, error: stagesErr } = await supabaseAdmin
    .from("engine_stages")
    .select("*")
    .eq("mission_id", missionId)
    .order("stage_order", { ascending: true });

  if (stagesErr || !stages) return null;

  return { mission: mission as Mission, stages: stages as Stage[] };
}

/**
 * Loads identity context for a session — profile and workspace data.
 * This context is stored in the session and available to the agent.
 */
async function loadIdentityContext(
  workspaceId: string,
  userId?: string,
  profileId?: string,
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};

  // Load workspace info
  const { data: workspace } = await supabaseAdmin
    .from("workspace")
    .select("workspace_id, name, slug")
    .eq("workspace_id", workspaceId)
    .single();

  if (workspace) {
    context.workspace = workspace;
  }

  // Load profile info if profile_id provided
  if (profileId) {
    const { data: profile } = await supabaseAdmin
      .from("profile")
      .select("profile_id, first_name, last_name, role, status")
      .eq("profile_id", profileId)
      .single();

    if (profile) {
      context.profile = profile;
    }
  }

  // Load user identity if user_id provided
  if (userId) {
    const { data: identity } = await supabaseAdmin
      .from("user_identity")
      .select("user_identity_id, email, full_name")
      .eq("user_identity_id", userId)
      .single();

    if (identity) {
      context.identity = identity;
    }
  }

  return context;
}

/**
 * Creates a new session for a mission.
 * Loads mission + stages, identity context, and determines the first stage.
 *
 * @returns CreateSessionResponse or null if mission not found
 */
export async function createSession(
  req: CreateSessionRequest,
  auth: AuthContext,
): Promise<CreateSessionResponse | null> {
  // Load mission and stages
  const result = await loadMission(req.mission_id);
  if (!result) return null;

  const { mission, stages } = result;

  // Determine first stage based on mission mode
  const firstStage = mission.mode === "free" ? null : (stages[0] ?? null);

  // Load identity context
  const identityContext = await loadIdentityContext(req.workspace_id, req.user_id, req.profile_id);

  // Merge additional context from request
  const context = { ...identityContext, ...(req.context ?? {}) };

  // Create session row
  const { data: session, error } = await supabaseAdmin
    .from("engine_sessions")
    .insert({
      mission_id: req.mission_id,
      workspace_id: req.workspace_id,
      user_id: req.user_id ?? null,
      profile_id: req.profile_id ?? null,
      channel: req.channel,
      current_stage_id: firstStage?.stage_id ?? null,
      stage_index: firstStage ? 0 : -1,
      status: "active",
      context,
      collected_data: {},
      callback_url: req.callback_url ?? null,
    })
    .select()
    .single();

  if (error || !session) {
    console.error("[session-manager] Failed to create session:", error?.message);
    return null;
  }

  // Build stage info for response
  const stageInfo = firstStage
    ? {
        stage_id: firstStage.stage_id,
        goal: firstStage.goal,
        instructions: firstStage.instructions,
        success_criteria: firstStage.success_criteria,
        emotion_hint: firstStage.emotion_hint ?? undefined,
      }
    : null;

  // Build progress string
  const total = stages.length;
  const current = firstStage ? 1 : 0;
  const progress = `${current}/${total}`;

  // Import prompt builder dynamically to avoid circular dependency
  const { buildStagePrompt } = await import("./prompt-builder.js");
  const systemPrompt = firstStage
    ? buildStagePrompt(firstStage, context, {})
    : "You are a helpful assistant. The mission is in free mode — choose a stage to start.";

  return {
    session_id: session.id,
    mission: {
      id: mission.id,
      name: mission.name,
      mode: mission.mode as "sequential" | "free" | "hybrid",
    },
    current_stage: stageInfo,
    stages:
      mission.mode === "free"
        ? stages.map((s) => ({
            stage_id: s.stage_id,
            goal: s.goal,
            instructions: s.instructions,
            success_criteria: s.success_criteria,
            emotion_hint: s.emotion_hint ?? undefined,
          }))
        : undefined,
    context,
    progress,
    system_prompt: systemPrompt,
  };
}

/**
 * Loads a session by ID. Returns null if not found.
 * Also checks expiry — if expired, updates status automatically.
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const { data: session, error } = await supabaseAdmin
    .from("engine_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !session) return null;

  // Check if expired
  if (session.status === "active" && new Date(session.expires_at) < new Date()) {
    await supabaseAdmin
      .from("engine_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return { ...session, status: "expired" } as Session;
  }

  return session as Session;
}

/**
 * Marks a session as abandoned. Returns the updated session or null if not found.
 */
export async function abandonSession(sessionId: string): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  if (session.status !== "active") {
    return session;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("engine_sessions")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) return null;
  return updated as Session;
}

/**
 * Runs the session expiry cleanup job.
 * Marks all active sessions past their expires_at as expired.
 * Returns the count of expired sessions.
 */
export async function expireStaleSession(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("engine_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[session-manager] Cleanup error:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}
```

**Step 2: Type check**

Run: `cd services/stage-engine && pnpm typecheck`

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts
git commit -m "feat(stage-engine): add session manager (create, load, expire, abandon)"
```

---

### Task 12: Prompt Builder

**Files:**

- Create: `services/stage-engine/src/core/prompt-builder.ts`

**Step 1: Create src/core/prompt-builder.ts**

```typescript
// ============================================
// prompt-builder.ts
// Builds system prompts for LLMs by combining stage instructions
// with session context and collected data.
// The output is a single string ready for any LLM — channel-agnostic.
// Connected to: DECISIONS.md D9, D10, D11 (agent/stage separation)
// Connected to: src/core/session-manager.ts (calls buildStagePrompt)
// ============================================

import type { Stage } from "../types/session.js";

/**
 * Builds a complete system prompt for a stage.
 * Combines stage instructions, personality overlay, context, and history
 * into a single string that any LLM can use.
 *
 * @param stage - The current stage definition
 * @param context - Session context (identity, workspace, custom data)
 * @param collectedData - Data collected from previous stages
 * @returns A complete system prompt string
 */
export function buildStagePrompt(
  stage: Stage,
  context: Record<string, unknown>,
  collectedData: Record<string, unknown>,
): string {
  const sections: string[] = [];

  // Personality overlay (stage-specific tone adjustment)
  if (stage.personality_override) {
    sections.push(`## Personality\n${stage.personality_override}`);
  }

  // Emotion hint
  if (stage.emotion_hint) {
    sections.push(`## Emotional Tone\nApproach this stage with a sense of: ${stage.emotion_hint}`);
  }

  // Creative freedom guidance
  sections.push(
    `## Creative Freedom\nYour creative freedom level is ${stage.creative_freedom} (0 = strictly follow script, 1 = fully improvise). Stay within the rules but be natural.`,
  );

  // Current stage assignment
  sections.push(`## Your Current Assignment\n**Goal:** ${stage.goal}`);
  sections.push(`## Instructions\n${stage.instructions}`);
  sections.push(
    `## Success Criteria\nYou are done with this stage when: ${stage.success_criteria}`,
  );

  // Escalation instructions
  if (stage.escalation_instructions) {
    sections.push(`## If You Get Stuck\n${stage.escalation_instructions}`);
  }

  // Context about who the agent is talking to
  if (Object.keys(context).length > 0) {
    sections.push(
      `## Context\nHere is what you know about the current situation:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``,
    );
  }

  // History from previous stages
  if (Object.keys(collectedData).length > 0) {
    sections.push(
      `## Previously Collected Data\nData from earlier stages:\n\`\`\`json\n${JSON.stringify(collectedData, null, 2)}\n\`\`\``,
    );
  }

  // Inline instructions (post-action guidance)
  if (
    stage.inline_instructions &&
    Array.isArray(stage.inline_instructions) &&
    stage.inline_instructions.length > 0
  ) {
    const inlineBlock = (stage.inline_instructions as Array<{ after: string; message: string }>)
      .map((i) => `- After "${i.after}": ${i.message}`)
      .join("\n");
    sections.push(`## After-Action Instructions\n${inlineBlock}`);
  }

  return sections.join("\n\n");
}
```

**Step 2: Type check**

Run: `cd services/stage-engine && pnpm typecheck`

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/prompt-builder.ts
git commit -m "feat(stage-engine): add prompt builder for stage system prompts"
```

---

### Task 13: Webhook Sender

**Files:**

- Create: `services/stage-engine/src/core/webhook-sender.ts`

**Step 1: Create src/core/webhook-sender.ts**

```typescript
// ============================================
// webhook-sender.ts
// Async webhook notification system for session events.
// Fires POST requests to callback_url with exponential backoff retry.
// Fire-and-forget — never blocks the response to the agent.
// Connected to: BREAKDOWN.md Epic 5.3
// ============================================

/** Webhook event types sent to callback URLs */
export type WebhookEvent =
  | "session.started"
  | "stage.changed"
  | "stage.progress"
  | "session.completed"
  | "session.abandoned";

/** Payload sent with webhook events */
export type WebhookPayload = {
  event: WebhookEvent;
  session_id: string;
  stage_id?: string;
  progress?: string;
  collected_data?: Record<string, unknown>;
  timestamp: string;
};

/**
 * Sends a webhook notification to the callback URL.
 * Uses exponential backoff: 3 attempts at 1s, 4s, 16s intervals.
 * Fire-and-forget — errors are logged but never thrown.
 *
 * @param callbackUrl - The URL to POST to
 * @param payload - The event payload
 */
export function sendWebhook(callbackUrl: string, payload: WebhookPayload): void {
  // Fire and forget — don't await
  fireWithRetry(callbackUrl, payload).catch((err) => {
    console.error(`[webhook] All retries failed for ${callbackUrl}:`, err.message);
  });
}

/**
 * Internal: attempts to POST the payload with exponential backoff.
 * Retries 3 times: 1s, 4s, 16s delays between attempts.
 */
async function fireWithRetry(url: string, payload: WebhookPayload): Promise<void> {
  const delays = [1000, 4000, 16000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        console.log(`[webhook] Delivered ${payload.event} to ${url}`);
        return;
      }

      console.warn(`[webhook] Attempt ${attempt + 1} failed: HTTP ${res.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.warn(`[webhook] Attempt ${attempt + 1} error: ${message}`);
    }

    // Wait before retry (skip wait after last attempt)
    if (attempt < delays.length) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/webhook-sender.ts
git commit -m "feat(stage-engine): add webhook sender with exponential backoff"
```

---

### Task 14: Session Routes (Start, Status, Abandon)

**Files:**

- Create: `services/stage-engine/src/routes/sessions.ts`
- Modify: `services/stage-engine/src/index.ts` (register route)

**Step 1: Create src/routes/sessions.ts**

```typescript
// ============================================
// sessions.ts
// Route handlers for session lifecycle endpoints:
//   POST /sessions       — start a new session
//   GET  /sessions/:id   — get session status
//   POST /sessions/:id/abandon — abandon a session
// Connected to: src/core/session-manager.ts (business logic)
// Connected to: src/types/api.ts (request/response types)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createSession, getSession, abandonSession } from "../core/session-manager.js";
import { sendWebhook } from "../core/webhook-sender.js";
import type { AuthContext } from "../types/auth.js";

const sessions = new Hono();

// -- Schemas --

const createSessionSchema = z.object({
  mission_id: z.string().min(1),
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  profile_id: z.string().uuid().optional(),
  channel: z.enum(["voice", "sms", "chat", "email", "autonomous"]),
  callback_url: z.string().url().optional(),
  context: z.record(z.unknown()).optional(),
});

// -- POST /sessions --

sessions.post("/sessions", zValidator("json", createSessionSchema), async (c) => {
  const body = c.req.valid("json");
  const auth = c.get("auth") as AuthContext;

  const result = await createSession(body, auth);
  if (!result) {
    return c.json(
      {
        error: "NOT_FOUND",
        message: `Mission "${body.mission_id}" not found or inactive`,
        status: 404,
      },
      404,
    );
  }

  // Fire webhook if callback_url set
  if (body.callback_url) {
    sendWebhook(body.callback_url, {
      event: "session.started",
      session_id: result.session_id,
      stage_id: result.current_stage?.stage_id,
      progress: result.progress,
      timestamp: new Date().toISOString(),
    });
  }

  return c.json(result, 200);
});

// -- GET /sessions/:id --

sessions.get("/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  const session = await getSession(sessionId);

  if (!session) {
    return c.json(
      { error: "NOT_FOUND", message: `Session "${sessionId}" not found`, status: 404 },
      404,
    );
  }

  return c.json({
    session_id: session.id,
    status: session.status,
    current_stage_id: session.current_stage_id,
    stage_index: session.stage_index,
    progress: `${session.stage_index + 1}/?`,
    collected_data: session.collected_data,
    context: session.context,
    summary: session.summary,
    channel: session.channel,
    expires_at: session.expires_at,
    created_at: session.created_at,
  });
});

// -- POST /sessions/:id/abandon --

sessions.post("/sessions/:id/abandon", async (c) => {
  const sessionId = c.req.param("id");
  const session = await getSession(sessionId);

  if (!session) {
    return c.json(
      { error: "NOT_FOUND", message: `Session "${sessionId}" not found`, status: 404 },
      404,
    );
  }

  if (session.status !== "active") {
    return c.json(
      {
        error: "SESSION_NOT_ACTIVE",
        message: `Session is already "${session.status}"`,
        status: 409,
      },
      409,
    );
  }

  const updated = await abandonSession(sessionId);

  // Fire webhook
  if (session.callback_url) {
    sendWebhook(session.callback_url, {
      event: "session.abandoned",
      session_id: sessionId,
      collected_data: session.collected_data as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });
  }

  return c.json({ session_id: sessionId, status: "abandoned" });
});

export { sessions };
```

**Step 2: Update src/index.ts — register sessions route**

Add import and route registration:

```typescript
import { sessions } from "./routes/sessions.js";

// Add after health route
app.route("/", sessions);
```

**Step 3: Type check**

Run: `cd services/stage-engine && pnpm typecheck`

**Step 4: Commit**

```bash
git add services/stage-engine/src/routes/sessions.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add session routes (start, status, abandon)"
```

---

### Task 15: Session Expiry Cleanup Job

**Files:**

- Modify: `services/stage-engine/src/index.ts`

**Step 1: Add cleanup interval to src/index.ts**

After the `serve()` call, add:

```typescript
import { expireStaleSession } from "./core/session-manager.js";

// Session expiry cleanup — runs on a configurable interval
const cleanupMs = config.CLEANUP_INTERVAL_MINUTES * 60 * 1000;
setInterval(async () => {
  const count = await expireStaleSession();
  if (count > 0) {
    console.log(`[cleanup] Expired ${count} stale session(s)`);
  }
}, cleanupMs);

console.log(`[cleanup] Session cleanup running every ${config.CLEANUP_INTERVAL_MINUTES} minutes`);
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add session expiry cleanup job"
```

---

## Epic 4: Store & Fetch Tools

> After this epic: agents can save data to the inbox and retrieve context/data.

---

### Task 16: Inbox Writer (Store Core Logic)

**Files:**

- Create: `services/stage-engine/src/core/inbox-writer.ts`

**Step 1: Create src/core/inbox-writer.ts**

```typescript
// ============================================
// inbox-writer.ts
// Validates and writes agent data to the engine_inbox table.
// All agent-stored data goes through here — never directly to entity tables.
// Connected to: DECISIONS.md D2 (inbox model)
// Connected to: src/routes/store.ts (route handler)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { InboxEntry } from "../types/session.js";

/** Maximum size for the data payload in bytes (100KB) */
const MAX_DATA_SIZE = 100 * 1024;

/**
 * Validates store request data before writing to inbox.
 * Returns an error message string if invalid, null if valid.
 */
export function validateStoreData(
  entityType: string,
  data: Record<string, unknown>,
): string | null {
  if (!entityType || entityType.trim().length === 0) {
    return "entity_type must be a non-empty string";
  }

  if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
    return "data must be a non-empty object";
  }

  // Check data size
  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_DATA_SIZE) {
    return `data exceeds maximum size of ${MAX_DATA_SIZE / 1024}KB`;
  }

  return null;
}

/**
 * Writes a data entry to the engine_inbox table.
 *
 * @returns The created inbox entry, or null on failure
 */
export async function writeToInbox(params: {
  sessionId: string;
  stageId: string;
  workspaceId: string;
  entityType: string;
  data: Record<string, unknown>;
}): Promise<InboxEntry | null> {
  const { data: entry, error } = await supabaseAdmin
    .from("engine_inbox")
    .insert({
      session_id: params.sessionId,
      stage_id: params.stageId,
      workspace_id: params.workspaceId,
      entity_type: params.entityType,
      data: params.data,
    })
    .select()
    .single();

  if (error) {
    console.error("[inbox-writer] Failed to write:", error.message);
    return null;
  }

  return entry as InboxEntry;
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/inbox-writer.ts
git commit -m "feat(stage-engine): add inbox writer with validation"
```

---

### Task 17: Store Route

**Files:**

- Create: `services/stage-engine/src/routes/store.ts`
- Modify: `services/stage-engine/src/index.ts`

**Step 1: Create src/routes/store.ts**

```typescript
// ============================================
// store.ts
// POST /sessions/:id/store — agent stores data to the engine inbox.
// Validates the data, writes to inbox, and returns a tool response
// message that instructs the agent what to do next.
// Connected to: src/core/inbox-writer.ts (write logic)
// Connected to: src/core/session-manager.ts (session lookup)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getSession } from "../core/session-manager.js";
import { validateStoreData, writeToInbox } from "../core/inbox-writer.js";

const store = new Hono();

const storeSchema = z.object({
  entity_type: z.string().min(1),
  data: z.record(z.unknown()),
  stage_id: z.string().optional(),
});

/**
 * POST /sessions/:id/store
 * Agent sends data to the inbox. Returns a tool response message.
 */
store.post("/sessions/:id/store", zValidator("json", storeSchema), async (c) => {
  const sessionId = c.req.param("id");
  const body = c.req.valid("json");

  // Load session
  const session = await getSession(sessionId);
  if (!session || session.status !== "active") {
    return c.json(
      {
        error: "SESSION_NOT_ACTIVE",
        message: session ? `Session is "${session.status}"` : "Session not found",
        status: session ? 409 : 404,
      },
      session ? 409 : 404,
    );
  }

  // Validate data
  const validationError = validateStoreData(body.entity_type, body.data as Record<string, unknown>);
  if (validationError) {
    return c.json({ error: "VALIDATION_ERROR", message: validationError, status: 400 }, 400);
  }

  // Determine stage_id — use provided or current session stage
  const stageId = body.stage_id ?? session.current_stage_id ?? "unknown";

  // Write to inbox
  const entry = await writeToInbox({
    sessionId,
    stageId,
    workspaceId: session.workspace_id,
    entityType: body.entity_type,
    data: body.data as Record<string, unknown>,
  });

  if (!entry) {
    return c.json({ error: "INTERNAL_ERROR", message: "Failed to store data", status: 500 }, 500);
  }

  return c.json({
    inbox_id: entry.id,
    confirmed: true,
    message: `Data stored successfully. Type: ${body.entity_type}. Continue with the conversation.`,
  });
});

export { store };
```

**Step 2: Register in src/index.ts**

```typescript
import { store } from "./routes/store.js";

app.route("/", store);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/routes/store.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add store endpoint for agent data"
```

---

### Task 18: Fetch Route

**Files:**

- Create: `services/stage-engine/src/routes/fetch.ts`
- Modify: `services/stage-engine/src/index.ts`

**Step 1: Create src/routes/fetch.ts**

```typescript
// ============================================
// fetch.ts
// POST /sessions/:id/fetch — agent requests context or data.
// Supports four query types: context, inbox, stage, history.
// Connected to: src/core/session-manager.ts (session + stage lookup)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getSession, loadMission } from "../core/session-manager.js";
import { supabaseAdmin } from "../lib/supabase.js";

const fetchRoute = new Hono();

const fetchSchema = z.object({
  query_type: z.enum(["context", "inbox", "stage", "history"]),
  filters: z
    .object({
      entity_type: z.string().optional(),
      stage_id: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /sessions/:id/fetch
 * Agent requests data. query_type determines what's returned:
 *   - context: identity + workspace info
 *   - inbox: stored data for this session
 *   - stage: current stage details
 *   - history: all collected_data across stages
 */
fetchRoute.post("/sessions/:id/fetch", zValidator("json", fetchSchema), async (c) => {
  const sessionId = c.req.param("id");
  const body = c.req.valid("json");

  // Load session
  const session = await getSession(sessionId);
  if (!session) {
    return c.json(
      { error: "NOT_FOUND", message: `Session "${sessionId}" not found`, status: 404 },
      404,
    );
  }

  let data: Record<string, unknown> = {};

  switch (body.query_type) {
    case "context":
      data = session.context as Record<string, unknown>;
      break;

    case "inbox": {
      let query = supabaseAdmin
        .from("engine_inbox")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (body.filters?.entity_type) {
        query = query.eq("entity_type", body.filters.entity_type);
      }
      if (body.filters?.stage_id) {
        query = query.eq("stage_id", body.filters.stage_id);
      }

      const { data: entries } = await query;
      data = { entries: entries ?? [] };
      break;
    }

    case "stage": {
      if (!session.current_stage_id) {
        data = { stage: null, message: "No current stage (free mode)" };
        break;
      }

      const result = await loadMission(session.mission_id);
      if (result) {
        const currentStage = result.stages.find((s) => s.stage_id === session.current_stage_id);
        data = currentStage
          ? {
              stage_id: currentStage.stage_id,
              goal: currentStage.goal,
              instructions: currentStage.instructions,
              success_criteria: currentStage.success_criteria,
              emotion_hint: currentStage.emotion_hint,
            }
          : { stage: null };
      }
      break;
    }

    case "history":
      data = session.collected_data as Record<string, unknown>;
      break;
  }

  return c.json({ data });
});

export { fetchRoute };
```

**Step 2: Register in src/index.ts**

```typescript
import { fetchRoute } from "./routes/fetch.js";

app.route("/", fetchRoute);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/routes/fetch.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add fetch endpoint for context/data retrieval"
```

---

## Epic 5: Stage Transitions

> After this epic: sessions can advance through stages with prompt rebuilding and webhooks.

---

### Task 19: Stage Manager (Navigation Logic)

**Files:**

- Create: `services/stage-engine/src/core/stage-manager.ts`

**Step 1: Create src/core/stage-manager.ts**

```typescript
// ============================================
// stage-manager.ts
// Stage navigation logic for sequential, free, and hybrid mission modes.
// Determines the next stage and updates session state.
// Connected to: DECISIONS.md D7 (mission modes)
// Connected to: src/routes/advance.ts (route handler)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { loadMission } from "./session-manager.js";
import { buildStagePrompt } from "./prompt-builder.js";
import { sendWebhook, type WebhookPayload } from "./webhook-sender.js";
import type { Session, Stage, Mission } from "../types/session.js";
import type { AdvanceRequest, AdvanceResponse, StageInfo } from "../types/api.js";

/**
 * Advances a session to the next stage.
 * Handles sequential, free, and hybrid modes.
 *
 * @param session - The current session
 * @param req - The advance request body
 * @returns AdvanceResponse with new stage info, or null on error
 */
export async function advanceStage(
  session: Session,
  req: AdvanceRequest,
): Promise<AdvanceResponse | null> {
  // Load mission and stages
  const result = await loadMission(session.mission_id);
  if (!result) return null;

  const { mission, stages } = result;

  // Find current stage
  const currentStage = stages.find((s) => s.stage_id === session.current_stage_id);

  // Save result data for current stage
  if (req.result && currentStage) {
    const updatedData = {
      ...(session.collected_data as Record<string, unknown>),
      [currentStage.stage_id]: req.result,
    };

    await supabaseAdmin
      .from("engine_sessions")
      .update({ collected_data: updatedData, updated_at: new Date().toISOString() })
      .eq("id", session.id);

    // Update local copy for prompt builder
    session.collected_data = updatedData;
  }

  // Determine next stage based on mode
  const nextStage = resolveNextStage(mission, stages, currentStage, req);

  // No next stage → mission complete
  if (!nextStage) {
    await supabaseAdmin
      .from("engine_sessions")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    // Fire completion webhook
    if (session.callback_url) {
      sendWebhook(session.callback_url, {
        event: "session.completed",
        session_id: session.id,
        collected_data: session.collected_data as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      complete: true,
      progress: `${stages.length}/${stages.length}`,
      summary: `Mission complete. Collected data for ${Object.keys(session.collected_data as Record<string, unknown>).length} stages.`,
    };
  }

  // Advance to next stage
  const nextIndex = stages.findIndex((s) => s.stage_id === nextStage.stage_id);

  await supabaseAdmin
    .from("engine_sessions")
    .update({
      current_stage_id: nextStage.stage_id,
      stage_index: nextIndex,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  // Build new system prompt
  const systemPrompt = buildStagePrompt(
    nextStage,
    session.context as Record<string, unknown>,
    session.collected_data as Record<string, unknown>,
  );

  // Fire stage change webhook
  if (session.callback_url) {
    sendWebhook(session.callback_url, {
      event: "stage.changed",
      session_id: session.id,
      stage_id: nextStage.stage_id,
      progress: `${nextIndex + 1}/${stages.length}`,
      timestamp: new Date().toISOString(),
    });
  }

  const stageInfo: StageInfo = {
    stage_id: nextStage.stage_id,
    goal: nextStage.goal,
    instructions: nextStage.instructions,
    success_criteria: nextStage.success_criteria,
    emotion_hint: nextStage.emotion_hint ?? undefined,
  };

  return {
    new_stage: stageInfo,
    progress: `${nextIndex + 1}/${stages.length}`,
    complete: false,
    system_prompt: systemPrompt,
  };
}

/**
 * Resolves the next stage based on mission mode.
 * - Sequential: follows stage.next_stage chain
 * - Free: uses next_stage_id from request
 * - Hybrid: sequential for required stages, free for optional
 */
function resolveNextStage(
  mission: Mission,
  stages: Stage[],
  currentStage: Stage | undefined,
  req: AdvanceRequest,
): Stage | null {
  switch (mission.mode) {
    case "sequential": {
      if (!currentStage?.next_stage) return null;
      return stages.find((s) => s.stage_id === currentStage.next_stage) ?? null;
    }

    case "free": {
      if (!req.next_stage_id) return null;
      return stages.find((s) => s.stage_id === req.next_stage_id) ?? null;
    }

    case "hybrid": {
      // If a specific next_stage_id is provided, use it (for optional stages)
      if (req.next_stage_id) {
        return stages.find((s) => s.stage_id === req.next_stage_id) ?? null;
      }
      // Otherwise follow sequential chain for required stages
      if (!currentStage?.next_stage) return null;
      return stages.find((s) => s.stage_id === currentStage.next_stage) ?? null;
    }

    default:
      return null;
  }
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/stage-manager.ts
git commit -m "feat(stage-engine): add stage manager with sequential/free/hybrid navigation"
```

---

### Task 20: Advance Route

**Files:**

- Create: `services/stage-engine/src/routes/advance.ts`
- Modify: `services/stage-engine/src/index.ts`

**Step 1: Create src/routes/advance.ts**

```typescript
// ============================================
// advance.ts
// POST /sessions/:id/advance — moves the session to the next stage.
// Saves current stage result, determines next stage, rebuilds prompt.
// Connected to: src/core/stage-manager.ts (navigation logic)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getSession } from "../core/session-manager.js";
import { advanceStage } from "../core/stage-manager.js";

const advance = new Hono();

const advanceSchema = z.object({
  result: z.record(z.unknown()).optional(),
  next_stage_id: z.string().optional(),
  force: z.boolean().optional(),
});

/**
 * POST /sessions/:id/advance
 * Advances the session to the next stage.
 * Returns new stage info, updated progress, and a new system prompt.
 */
advance.post("/sessions/:id/advance", zValidator("json", advanceSchema), async (c) => {
  const sessionId = c.req.param("id");
  const body = c.req.valid("json");

  // Load session
  const session = await getSession(sessionId);
  if (!session) {
    return c.json(
      { error: "NOT_FOUND", message: `Session "${sessionId}" not found`, status: 404 },
      404,
    );
  }

  if (session.status !== "active") {
    return c.json(
      { error: "SESSION_NOT_ACTIVE", message: `Session is "${session.status}"`, status: 409 },
      409,
    );
  }

  // Advance
  const result = await advanceStage(session, body);
  if (!result) {
    return c.json(
      { error: "INTERNAL_ERROR", message: "Failed to advance stage", status: 500 },
      500,
    );
  }

  return c.json(result);
});

export { advance };
```

**Step 2: Register in src/index.ts**

```typescript
import { advance } from "./routes/advance.js";

app.route("/", advance);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/routes/advance.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add advance endpoint for stage transitions"
```

---

## Epic 6: Channel Adapter — Ultravox

> After this epic: voice calls can run missions through the Stage Engine via Ultravox.

---

### Task 21: Ultravox Client Library

**Files:**

- Create: `services/stage-engine/src/lib/ultravox.ts`

**Step 1: Create src/lib/ultravox.ts**

```typescript
// ============================================
// ultravox.ts
// Ultravox API client for creating voice calls.
// Calls the Ultravox Create Call API and returns the call ID + join URL.
// Connected to: src/routes/adapters/ultravox.ts (adapter endpoints)
// Connected to: Ultravox API docs
// ============================================

import { config } from "../config.js";
import type {
  UltravoxCreateCallPayload,
  UltravoxCreateCallApiResponse,
  UltravoxHttpTool,
} from "../types/ultravox.js";

/**
 * Creates an Ultravox voice call via the Ultravox API.
 *
 * @param payload - The call configuration
 * @returns Call ID and join URL, or null on failure
 */
export async function createUltravoxCall(
  payload: UltravoxCreateCallPayload,
): Promise<UltravoxCreateCallApiResponse | null> {
  try {
    const res = await fetch("https://api.ultravox.ai/api/calls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.ULTRAVOX_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[ultravox] Create call failed: ${res.status} ${text}`);
      return null;
    }

    const data = (await res.json()) as UltravoxCreateCallApiResponse;
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[ultravox] Create call error: ${message}`);
    return null;
  }
}

/**
 * Builds the Ultravox HTTP tool definitions for store, fetch, and advance.
 * These tools point back to the engine's adapter endpoints.
 *
 * @param engineUrl - The public URL of the engine (e.g. https://engine.smartout.ai)
 * @param sessionId - The session ID to include in tool URLs
 * @param apiKey - The API key to include in tool headers
 * @returns Array of Ultravox tool definitions
 */
export function buildUltravoxTools(
  engineUrl: string,
  sessionId: string,
  apiKey: string,
): UltravoxHttpTool[] {
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
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/store?session_id=${sessionId}&api_key=${apiKey}`,
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
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/fetch?session_id=${sessionId}&api_key=${apiKey}`,
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
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/advance?session_id=${sessionId}&api_key=${apiKey}`,
          httpMethod: "POST",
        },
      },
    },
  ];
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/lib/ultravox.ts
git commit -m "feat(stage-engine): add Ultravox client and tool builder"
```

---

### Task 22: Ultravox Adapter Routes

**Files:**

- Create: `services/stage-engine/src/routes/adapters/ultravox.ts`
- Modify: `services/stage-engine/src/index.ts`

**Step 1: Create src/routes/adapters/ultravox.ts**

```typescript
// ============================================
// ultravox.ts
// Adapter endpoints for Ultravox voice calls.
// Wraps core store/fetch/advance endpoints in Ultravox tool format.
// Advance returns X-Ultravox-Response-Type: new-stage header
// for seamless stage transitions during a voice call.
// Connected to: src/lib/ultravox.ts (API client + tool builder)
// Connected to: Ultravox Call Stages docs
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createSession, getSession } from "../../core/session-manager.js";
import { advanceStage } from "../../core/stage-manager.js";
import { validateStoreData, writeToInbox } from "../../core/inbox-writer.js";
import { loadMission } from "../../core/session-manager.js";
import { buildStagePrompt } from "../../core/prompt-builder.js";
import { createUltravoxCall, buildUltravoxTools } from "../../lib/ultravox.js";
import { config } from "../../config.js";
import type { AuthContext } from "../../types/auth.js";
import type { UltravoxNewStageResponse } from "../../types/ultravox.js";

const ultravox = new Hono();

// -- Create Call --

const createCallSchema = z.object({
  mission_id: z.string().min(1),
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  voice: z.string().optional(),
  language: z.string().optional(),
});

/**
 * POST /adapters/ultravox/create-call
 * Creates an Ultravox voice call with Stage Engine tools pre-configured.
 * Returns session_id, call_id, and join_url for the frontend.
 */
ultravox.post("/adapters/ultravox/create-call", zValidator("json", createCallSchema), async (c) => {
  const body = c.req.valid("json");
  const auth = c.get("auth") as AuthContext;

  // Start engine session
  const session = await createSession(
    {
      mission_id: body.mission_id,
      workspace_id: body.workspace_id,
      user_id: body.user_id,
      channel: "voice",
    },
    auth,
  );

  if (!session) {
    return c.json(
      { error: "NOT_FOUND", message: `Mission "${body.mission_id}" not found`, status: 404 },
      404,
    );
  }

  // Build Ultravox tools pointing back to this engine
  const apiKey = c.req.header("x-api-key") ?? "";
  const tools = buildUltravoxTools(config.ENGINE_URL, session.session_id, apiKey);

  // Create Ultravox call
  const call = await createUltravoxCall({
    systemPrompt: session.system_prompt,
    voice: body.voice,
    languageHint: body.language ?? "no",
    selectedTools: tools,
  });

  if (!call) {
    return c.json(
      { error: "INTERNAL_ERROR", message: "Failed to create Ultravox call", status: 500 },
      500,
    );
  }

  return c.json({
    session_id: session.session_id,
    call_id: call.callId,
    join_url: call.joinUrl,
  });
});

// -- Store (Ultravox tool format) --

const uvStoreSchema = z.object({
  entity_type: z.string().min(1),
  data: z.record(z.unknown()),
});

/**
 * POST /adapters/ultravox/store
 * Ultravox tool wrapper for store. Session ID from query param.
 */
ultravox.post("/adapters/ultravox/store", zValidator("json", uvStoreSchema), async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.json(
      { error: "VALIDATION_ERROR", message: "session_id query param required", status: 400 },
      400,
    );
  }

  const body = c.req.valid("json");
  const session = await getSession(sessionId);

  if (!session || session.status !== "active") {
    return c.json(
      { error: "SESSION_NOT_ACTIVE", message: "Session not found or not active", status: 409 },
      409,
    );
  }

  const validationError = validateStoreData(body.entity_type, body.data as Record<string, unknown>);
  if (validationError) {
    return c.json({ error: "VALIDATION_ERROR", message: validationError, status: 400 }, 400);
  }

  const entry = await writeToInbox({
    sessionId,
    stageId: session.current_stage_id ?? "unknown",
    workspaceId: session.workspace_id,
    entityType: body.entity_type,
    data: body.data as Record<string, unknown>,
  });

  if (!entry) {
    return c.json({ error: "INTERNAL_ERROR", message: "Failed to store data", status: 500 }, 500);
  }

  // Return plain text — Ultravox tool result
  return c.text(`Stored ${body.entity_type} successfully. Continue the conversation.`);
});

// -- Fetch (Ultravox tool format) --

const uvFetchSchema = z.object({
  query_type: z.enum(["context", "inbox", "stage", "history"]),
});

/**
 * POST /adapters/ultravox/fetch
 * Ultravox tool wrapper for fetch. Returns data as text for the agent.
 */
ultravox.post("/adapters/ultravox/fetch", zValidator("json", uvFetchSchema), async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.json(
      { error: "VALIDATION_ERROR", message: "session_id query param required", status: 400 },
      400,
    );
  }

  const body = c.req.valid("json");
  const session = await getSession(sessionId);

  if (!session) {
    return c.json({ error: "NOT_FOUND", message: "Session not found", status: 404 }, 404);
  }

  // Simplified fetch — returns JSON as text for the agent to parse
  let data: unknown;

  switch (body.query_type) {
    case "context":
      data = session.context;
      break;
    case "history":
      data = session.collected_data;
      break;
    case "inbox": {
      const { data: entries } = await (await import("../../lib/supabase.js")).supabaseAdmin
        .from("engine_inbox")
        .select("entity_type, data, stage_id, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      data = entries ?? [];
      break;
    }
    case "stage": {
      if (session.current_stage_id) {
        const result = await loadMission(session.mission_id);
        const stage = result?.stages.find((s) => s.stage_id === session.current_stage_id);
        data = stage
          ? { stage_id: stage.stage_id, goal: stage.goal, instructions: stage.instructions }
          : null;
      } else {
        data = null;
      }
      break;
    }
  }

  return c.text(JSON.stringify(data, null, 2));
});

// -- Advance (Ultravox new-stage format) --

const uvAdvanceSchema = z.object({
  result: z.record(z.unknown()).optional(),
  next_stage_id: z.string().optional(),
});

/**
 * POST /adapters/ultravox/advance
 * Advances to the next stage and returns Ultravox new-stage response.
 * Sets X-Ultravox-Response-Type: new-stage header for seamless transition.
 */
ultravox.post("/adapters/ultravox/advance", zValidator("json", uvAdvanceSchema), async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.json(
      { error: "VALIDATION_ERROR", message: "session_id query param required", status: 400 },
      400,
    );
  }

  const body = c.req.valid("json");
  const session = await getSession(sessionId);

  if (!session || session.status !== "active") {
    return c.json(
      { error: "SESSION_NOT_ACTIVE", message: "Session not found or not active", status: 409 },
      409,
    );
  }

  const result = await advanceStage(session, body);
  if (!result) {
    return c.json({ error: "INTERNAL_ERROR", message: "Failed to advance", status: 500 }, 500);
  }

  // If mission complete, return text result (no new stage)
  if (result.complete) {
    return c.text(
      `Mission complete! Summary: ${result.summary ?? "All stages finished."}. Thank the person and say goodbye.`,
    );
  }

  // Return Ultravox new-stage response
  const newStageResponse: UltravoxNewStageResponse = {
    systemPrompt: result.system_prompt!,
    toolResultText: `Stage transition: now in "${result.new_stage!.stage_id}". Goal: ${result.new_stage!.goal}`,
  };

  c.header("X-Ultravox-Response-Type", "new-stage");
  return c.json(newStageResponse);
});

export { ultravox };
```

**Step 2: Register in src/index.ts**

```typescript
import { ultravox } from "./routes/adapters/ultravox.js";

app.route("/", ultravox);
```

**Step 3: Type check**

Run: `cd services/stage-engine && pnpm typecheck`

**Step 4: Commit**

```bash
git add services/stage-engine/src/routes/adapters/ultravox.ts services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): add Ultravox adapter (create-call, store, fetch, advance)"
```

---

## Epic 7: End-to-End Verification

> After this epic: a verified working system with a complete lifecycle test.

---

### Task 23: Final index.ts Assembly

**Files:**

- Modify: `services/stage-engine/src/index.ts`

**Step 1: Verify final src/index.ts looks like this**

```typescript
// ============================================
// index.ts
// Entry point for the Stage Engine — Smartout's universal agent gateway.
// Sets up Hono app, registers middleware and routes, starts Node.js server.
// Connected to: src/routes/ (all route handlers)
// Connected to: src/middleware/ (auth, error handling)
// ============================================

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { config } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import { onError } from "./middleware/error-handler.js";
import { health } from "./routes/health.js";
import { sessions } from "./routes/sessions.js";
import { store } from "./routes/store.js";
import { fetchRoute } from "./routes/fetch.js";
import { advance } from "./routes/advance.js";
import { ultravox } from "./routes/adapters/ultravox.js";
import { expireStaleSession } from "./core/session-manager.js";

const app = new Hono();

// Global middleware
app.use(logger());
app.use("*", authMiddleware);

// Error handler
app.onError(onError);

// Routes
app.route("/", health);
app.route("/", sessions);
app.route("/", store);
app.route("/", fetchRoute);
app.route("/", advance);
app.route("/", ultravox);

// Start server
const port = config.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stage Engine running on port ${info.port}`);
});

// Session expiry cleanup — runs on a configurable interval
const cleanupMs = config.CLEANUP_INTERVAL_MINUTES * 60 * 1000;
setInterval(async () => {
  const count = await expireStaleSession();
  if (count > 0) {
    console.log(`[cleanup] Expired ${count} stale session(s)`);
  }
}, cleanupMs);

console.log(`[cleanup] Session cleanup running every ${config.CLEANUP_INTERVAL_MINUTES} minutes`);

export { app };
```

**Step 2: Type check the entire project**

Run: `cd services/stage-engine && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): finalize index.ts with all routes and middleware"
```

---

### Task 24: End-to-End Test Script

**Files:**

- Create: `services/stage-engine/test/e2e.ts`

**Step 1: Create test/e2e.ts**

```typescript
// ============================================
// e2e.ts
// End-to-end test for the Stage Engine lifecycle.
// Runs the complete flow: start → fetch → store → advance (x3) → complete.
// Uses the "discovery-call" seed mission.
// Run with: pnpm test:e2e (requires engine running + seed data)
// ============================================

const BASE_URL = process.env.ENGINE_URL || "http://localhost:3000";
const API_KEY = process.env.TEST_API_KEY || "";

/** Helper: make authenticated requests to the engine */
async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
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

/** Simple assertion helper */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function runE2E(): Promise<void> {
  console.log("=== Stage Engine E2E Test ===\n");

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = (await healthRes.json()) as { status: string };
  assert(healthRes.status === 200, "Health endpoint returns 200");
  assert(healthData.status === "ok", "Health status is ok");

  // 2. Start session
  const startRes = await request("POST", "/sessions", {
    mission_id: "discovery-call",
    workspace_id: "00000000-0000-0000-0000-000000000001", // Replace with valid workspace
    channel: "chat",
  });
  assert(startRes.status === 200, "Session created successfully");

  const session = startRes.data as {
    session_id: string;
    mission: { id: string; mode: string };
    current_stage: { stage_id: string; goal: string };
    progress: string;
    system_prompt: string;
  };
  assert(session.mission.id === "discovery-call", "Mission is discovery-call");
  assert(session.current_stage.stage_id === "greeting", "First stage is greeting");
  assert(session.progress === "1/3", "Progress is 1/3");
  assert(session.system_prompt.length > 0, "System prompt is non-empty");

  const sessionId = session.session_id;

  // 3. Fetch context
  const fetchRes = await request("POST", `/sessions/${sessionId}/fetch`, {
    query_type: "context",
  });
  assert(fetchRes.status === 200, "Fetch context returns 200");

  // 4. Store data for stage 1 (greeting)
  const storeRes = await request("POST", `/sessions/${sessionId}/store`, {
    entity_type: "person",
    data: { name: "Pontus", role: "CEO" },
  });
  assert(storeRes.status === 200, "Store returns 200");
  const storeData = storeRes.data as { confirmed: boolean; inbox_id: string };
  assert(storeData.confirmed === true, "Store confirmed");

  // 5. Advance to stage 2 (problem)
  const adv1 = await request("POST", `/sessions/${sessionId}/advance`, {
    result: { name: "Pontus", role: "CEO" },
  });
  assert(adv1.status === 200, "Advance to stage 2 returns 200");
  const adv1Data = adv1.data as {
    new_stage: { stage_id: string };
    complete: boolean;
    progress: string;
  };
  assert(adv1Data.new_stage.stage_id === "problem", "Now on problem stage");
  assert(adv1Data.complete === false, "Not complete yet");
  assert(adv1Data.progress === "2/3", "Progress is 2/3");

  // 6. Store data for stage 2 (problem)
  await request("POST", `/sessions/${sessionId}/store`, {
    entity_type: "problem",
    data: { description: "Employee onboarding takes too long" },
  });

  // 7. Advance to stage 3 (confirm)
  const adv2 = await request("POST", `/sessions/${sessionId}/advance`, {
    result: { problem: "Employee onboarding takes too long" },
  });
  assert(adv2.status === 200, "Advance to stage 3 returns 200");
  const adv2Data = adv2.data as { new_stage: { stage_id: string }; progress: string };
  assert(adv2Data.new_stage.stage_id === "confirm", "Now on confirm stage");
  assert(adv2Data.progress === "3/3", "Progress is 3/3");

  // 8. Store data for stage 3 (confirm)
  await request("POST", `/sessions/${sessionId}/store`, {
    entity_type: "confirmation",
    data: { confirmed: true, summary: "Pontus, CEO, needs faster onboarding" },
  });

  // 9. Advance — should complete
  const adv3 = await request("POST", `/sessions/${sessionId}/advance`, {
    result: { confirmed: true },
  });
  assert(adv3.status === 200, "Final advance returns 200");
  const adv3Data = adv3.data as { complete: boolean; progress: string; summary: string };
  assert(adv3Data.complete === true, "Session is complete");

  // 10. Verify session status
  const statusRes = await request("GET", `/sessions/${sessionId}`);
  assert(statusRes.status === 200, "Get session status returns 200");
  const statusData = statusRes.data as { status: string; collected_data: Record<string, unknown> };
  assert(statusData.status === "complete", "Session status is complete");
  assert(Object.keys(statusData.collected_data).length === 3, "Collected data has 3 stages");

  // 11. Verify inbox entries
  const inboxRes = await request("POST", `/sessions/${sessionId}/fetch`, {
    query_type: "inbox",
  });
  assert(inboxRes.status === 200, "Fetch inbox returns 200");
  const inboxData = inboxRes.data as { data: { entries: unknown[] } };
  assert(inboxData.data.entries.length === 3, "Inbox has 3 entries");

  console.log("\n=== All tests passed! ===");
}

runE2E().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add services/stage-engine/test/e2e.ts
git commit -m "feat(stage-engine): add E2E lifecycle test"
```

---

### Task 25: README

**Files:**

- Create: `services/stage-engine/README.md`

**Step 1: Create README.md**

````markdown
# Stage Engine

Universal, channel-agnostic AI agent gateway for Smartout.

## Quick Start

```bash
# Install
pnpm install

# Dev (requires .env with Supabase + Ultravox credentials)
pnpm dev

# Type check
pnpm typecheck

# Build
pnpm build

# Production
pnpm start
```
````

## Architecture

See `ARCHITECTURE.md` for full system design.

## Endpoints

| Method | Path                           | Purpose                 |
| ------ | ------------------------------ | ----------------------- |
| GET    | /health                        | Health check            |
| POST   | /sessions                      | Start session           |
| GET    | /sessions/:id                  | Get status              |
| POST   | /sessions/:id/store            | Store data              |
| POST   | /sessions/:id/fetch            | Fetch context           |
| POST   | /sessions/:id/advance          | Next stage              |
| POST   | /sessions/:id/abandon          | Abandon                 |
| POST   | /adapters/ultravox/create-call | Create voice call       |
| POST   | /adapters/ultravox/store       | Store (Ultravox format) |
| POST   | /adapters/ultravox/fetch       | Fetch (Ultravox format) |
| POST   | /adapters/ultravox/advance     | Advance (new-stage)     |

````

**Step 2: Commit**

```bash
git add services/stage-engine/README.md
git commit -m "docs(stage-engine): add README"
````

---

## Summary

| Epic                 | Tasks        | Files Created | Endpoints                                       |
| -------------------- | ------------ | ------------- | ----------------------------------------------- |
| 1. Infrastructure    | 1-8          | 14 files      | /health                                         |
| 2. Data Model        | 9-10         | 2 migrations  | —                                               |
| 3. Session Lifecycle | 11-15        | 5 files       | /sessions, /sessions/:id, /sessions/:id/abandon |
| 4. Store & Fetch     | 16-18        | 3 files       | /sessions/:id/store, /sessions/:id/fetch        |
| 5. Stage Transitions | 19-20        | 2 files       | /sessions/:id/advance                           |
| 6. Ultravox Adapter  | 21-22        | 2 files       | 4 adapter endpoints                             |
| 7. Verification      | 23-25        | 2 files       | —                                               |
| **Total**            | **25 tasks** | **~30 files** | **11 endpoints**                                |

### Parallelization Notes for Agent Teams

- **Tasks 1-8** (Epic 1): Mostly sequential, but Tasks 3 (types) and 4 (supabase client) can run in parallel
- **Tasks 9-10** (Epic 2): Sequential (seed depends on tables)
- **Tasks 11-13** (Epic 3 core): Can run in parallel (session-manager, prompt-builder, webhook-sender)
- **Task 14** (routes): Depends on 11-13
- **Tasks 16-18** (Epic 4): Task 16 (inbox-writer) first, then 17-18 in parallel
- **Tasks 19-20** (Epic 5): Sequential
- **Tasks 21-22** (Epic 6): Sequential (ultravox client before routes)
- **Tasks 23-25** (Epic 7): Can run in parallel
