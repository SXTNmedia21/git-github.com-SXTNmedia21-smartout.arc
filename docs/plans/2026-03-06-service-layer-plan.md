---
title: Platform Admin Service Layer — Implementation Plan
status: draft
updated: 2026-03-06
created: 2026-03-06
module: platform-admin
tags: [services, config, docker, vercel, redis, vault]
---

# Platform Admin Service Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let admins manage all service configuration (API keys, URLs, ports, feature flags) from the Platform Admin UI — no codebase edits needed. Support adding new services dynamically, with config cached in Redis and synced to Vercel/Docker on change.

**Architecture:** A `service_config` table in Supabase stores all service metadata and configuration. Services read config via a `getServiceConfig()` helper that caches in Upstash Redis (production) or in-memory (dev). The Platform Admin UI provides CRUD for services, a setup wizard on first boot, and integrations with the Vercel API (env var sync + redeploy) and Docker Engine API (container restart). Secrets continue to use Vault (`platform_external_secret` + Vault SQL wrappers).

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + Vault), Upstash Redis, Vercel REST API, Docker Engine API, shadcn/ui, Zod, TanStack Query

---

## Existing Infrastructure (what we build on)

| Component                         | Status | Location                                                   |
| --------------------------------- | ------ | ---------------------------------------------------------- |
| Health dashboard (3 tabs)         | Built  | `/platform-admin/health/`                                  |
| Keys & Secrets management         | Built  | `/platform-admin/keys/`                                    |
| Service registry (hardcoded)      | Built  | `keys/_components/service-registry.ts` (20 entries)        |
| Vault SQL wrappers                | Built  | `get_secret()`, `upsert_secret()`, `delete_vault_secret()` |
| `platform_external_secret` table  | Built  | Metadata for Vault secrets                                 |
| `platform_api_key` + usage tables | Built  | API key management                                         |
| Health check API                  | Built  | `/api/platform-admin/health/status/route.ts`               |
| Docker Compose (4 services)       | Built  | `infra/docker-compose.yml`                                 |
| Service secret loading pattern    | Built  | `services/*/src/secrets.ts` (Vault + env fallback)         |

## What This Plan Builds

1. **`service_config` table** — dynamic service registry in Supabase
2. **`getServiceConfig()` helper** — cached config reader (Redis/in-memory)
3. **Config sync API routes** — CRUD + Vercel API + Docker API integration
4. **Services UI** — list page + detail page + setup wizard
5. **Migration of hardcoded services** — move `service-registry.ts` to DB
6. **Service config reader in microservices** — replace env var reads with DB reads

---

## Task 1: Database Migration — `service_config` Table

**Files:**

- Create: `supabase/migrations/20260306100000_service_config.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

**Step 1: Write the migration**

```sql
-- Service type enum
CREATE TYPE service_type AS ENUM ('docker', 'vercel', 'edge-function', 'external');

-- Service status enum
CREATE TYPE service_status AS ENUM ('active', 'stopped', 'error', 'unconfigured');

-- Config change type (runtime = no restart needed, restart = needs restart)
CREATE TYPE config_change_type AS ENUM ('runtime', 'restart');

-- Main table
CREATE TABLE service_config (
  service_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,                          -- "Stage Engine"
  slug           TEXT NOT NULL UNIQUE,                   -- "stage-engine"
  type           service_type NOT NULL,                  -- docker, vercel, etc.
  status         service_status NOT NULL DEFAULT 'unconfigured',
  description    TEXT,                                   -- What this service does
  host_url       TEXT,                                   -- "http://localhost:5010"
  health_endpoint TEXT DEFAULT '/health',                -- Health check path
  docker_service_name TEXT,                              -- Name in docker-compose
  docker_image   TEXT,                                   -- Docker image reference
  vercel_project_id TEXT,                                -- Vercel project ID (if type=vercel)

  -- Config: non-secret key-value pairs (URLs, ports, feature flags)
  config         JSONB NOT NULL DEFAULT '{}',

  -- Which env vars this service needs (schema definition, not values)
  -- e.g. [{"key": "ULTRAVOX_API_KEY", "required": true, "change_type": "runtime", "description": "..."}]
  env_schema     JSONB NOT NULL DEFAULT '[]',

  -- Vault secret names this service uses (references platform_external_secret)
  vault_secrets  TEXT[] NOT NULL DEFAULT '{}',

  -- Metadata
  version        TEXT,                                   -- Current deployed version
  port           INTEGER,                                -- Primary port
  tags           TEXT[] NOT NULL DEFAULT '{}',            -- ["ai", "voice", "infra"]
  is_critical    BOOLEAN NOT NULL DEFAULT false,         -- Blocks platform if down
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No workspace_id — this is platform-level config
-- RLS: only super admins (is_godmode)

ALTER TABLE service_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access" ON service_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  );

-- Service role bypass for backend reads
CREATE POLICY "service_role_access" ON service_config
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON service_config
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Config change log (audit trail)
CREATE TABLE service_config_log (
  log_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id     UUID NOT NULL REFERENCES service_config(service_id) ON DELETE CASCADE,
  changed_by     UUID NOT NULL REFERENCES auth.users(id),
  change_type    config_change_type NOT NULL,
  field_name     TEXT NOT NULL,                          -- Which field changed
  old_value      TEXT,                                   -- Previous value (masked if secret)
  new_value      TEXT,                                   -- New value (masked if secret)
  applied        BOOLEAN NOT NULL DEFAULT false,         -- Has this change been applied?
  applied_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_config_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_log" ON service_config_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  );

CREATE POLICY "service_role_insert_log" ON service_config_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX idx_service_config_slug ON service_config(slug);
CREATE INDEX idx_service_config_log_service ON service_config_log(service_id, created_at DESC);
```

**Step 2: Run migration locally**

```bash
cd /home/sxtnl/dev/smartout.ai
npx supabase db push --local
```

Expected: Migration applies successfully.

**Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 4: Seed initial services**

Create: `supabase/seed/service-config-seed.sql`

```sql
INSERT INTO service_config (name, slug, type, status, description, host_url, health_endpoint, docker_service_name, port, tags, is_critical, env_schema, vault_secrets) VALUES

-- Docker services
('Stage Engine', 'stage-engine', 'docker', 'active',
 'AI orchestration engine — manages missions, stages, tools, and voice calls via Ultravox',
 'http://localhost:5010', '/health', 'stage-engine', 5010,
 ARRAY['ai', 'voice', 'core'],
 true,
 '[
   {"key": "PORT", "required": true, "change_type": "restart", "description": "Service port"},
   {"key": "ENGINE_URL", "required": true, "change_type": "restart", "description": "Public URL for callbacks"},
   {"key": "SUPABASE_URL", "required": true, "change_type": "restart", "description": "Supabase instance URL"},
   {"key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "change_type": "restart", "description": "Supabase admin key"}
 ]'::jsonb,
 ARRAY['ultravox', 'openrouter']),

('Contract Service', 'contract-service', 'docker', 'active',
 'E-signature orchestration via DocuSeal — manages employment contracts lifecycle',
 'http://localhost:5012', '/health', 'contract-service', 5012,
 ARRAY['contracts', 'core'],
 false,
 '[
   {"key": "PORT", "required": true, "change_type": "restart", "description": "Service port"},
   {"key": "SUPABASE_URL", "required": true, "change_type": "restart", "description": "Supabase instance URL"},
   {"key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "change_type": "restart", "description": "Supabase admin key"}
 ]'::jsonb,
 ARRAY['docuseal', 'docuseal_webhook']),

('Shift MCP', 'shift-mcp', 'docker', 'active',
 'MCP server for schedule management — provides AI tools for shift operations',
 'http://localhost:5011', '/health', 'shift-mcp', 5011,
 ARRAY['scheduling', 'ai'],
 false,
 '[
   {"key": "PORT", "required": true, "change_type": "restart", "description": "Service port"},
   {"key": "SUPABASE_URL", "required": true, "change_type": "restart", "description": "Supabase instance URL"},
   {"key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "change_type": "restart", "description": "Supabase admin key"}
 ]'::jsonb,
 ARRAY[]::text[]),

('Scrapling', 'scrapling', 'docker', 'active',
 'Python web scraping service for data collection',
 'http://localhost:8000', '/health', 'scrapling', 8000,
 ARRAY['data', 'infra'],
 false,
 '[]'::jsonb,
 ARRAY[]::text[]),

-- Vercel services
('Web Dashboard', 'web-dashboard', 'vercel', 'active',
 'Main admin dashboard — Next.js app deployed to Vercel',
 NULL, NULL, NULL, 3060,
 ARRAY['core', 'frontend'],
 true,
 '[
   {"key": "NEXT_PUBLIC_SUPABASE_URL", "required": true, "change_type": "restart", "description": "Supabase URL (public)"},
   {"key": "NEXT_PUBLIC_SUPABASE_ANON_KEY", "required": true, "change_type": "restart", "description": "Supabase anon key (public)"},
   {"key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "change_type": "restart", "description": "Supabase admin key"},
   {"key": "STAGE_ENGINE_URL", "required": true, "change_type": "runtime", "description": "Stage Engine base URL"},
   {"key": "STAGE_ENGINE_API_KEY", "required": true, "change_type": "runtime", "description": "Stage Engine API key"},
   {"key": "ULTRAVOX_API_KEY", "required": false, "change_type": "runtime", "description": "Ultravox voice API (legacy direct)"},
   {"key": "OPENROUTER_API_KEY", "required": false, "change_type": "runtime", "description": "OpenRouter LLM key"}
 ]'::jsonb,
 ARRAY[]::text[]),

('Landing Page', 'landing-page', 'vercel', 'active',
 'Public landing site — Next.js app deployed to Vercel',
 NULL, NULL, NULL, 3055,
 ARRAY['frontend', 'marketing'],
 false,
 '[]'::jsonb,
 ARRAY[]::text[]),

-- Edge Functions (grouped as one service)
('Edge Functions', 'edge-functions', 'edge-function', 'active',
 'Supabase Edge Functions — 28 functions for auth, webhooks, cron jobs, and API gateway',
 NULL, '/health-check', NULL, NULL,
 ARRAY['core', 'auth', 'api'],
 true,
 '[]'::jsonb,
 ARRAY[]::text[]),

-- External services
('Stripe', 'stripe', 'external', 'active',
 'Payment processing and subscription billing',
 'https://api.stripe.com', NULL, NULL, NULL,
 ARRAY['billing'],
 true,
 '[]'::jsonb,
 ARRAY['stripe_secret', 'stripe_webhook']),

('SendGrid', 'sendgrid', 'external', 'active',
 'Transactional and marketing email delivery',
 'https://api.sendgrid.com', NULL, NULL, NULL,
 ARRAY['notifications'],
 false,
 '[]'::jsonb,
 ARRAY['sendgrid']),

('Twilio', 'twilio', 'external', 'active',
 'SMS notifications and voice calls',
 'https://api.twilio.com', NULL, NULL, NULL,
 ARRAY['notifications'],
 false,
 '[]'::jsonb,
 ARRAY['twilio_sid', 'twilio_token']),

('DocuSeal', 'docuseal', 'external', 'active',
 'E-signature service for employment contracts',
 NULL, NULL, NULL, NULL,
 ARRAY['contracts'],
 false,
 '[]'::jsonb,
 ARRAY['docuseal', 'docuseal_webhook']),

('Upstash Redis', 'upstash-redis', 'external', 'active',
 'Serverless Redis for caching and rate limiting',
 NULL, NULL, NULL, NULL,
 ARRAY['infra', 'cache'],
 true,
 '[
   {"key": "UPSTASH_REDIS_REST_URL", "required": true, "change_type": "restart", "description": "Redis REST endpoint"},
   {"key": "UPSTASH_REDIS_REST_TOKEN", "required": true, "change_type": "restart", "description": "Redis auth token"}
 ]'::jsonb,
 ARRAY['upstash_redis_url', 'upstash_redis_token']);
```

**Step 5: Commit**

```bash
git add supabase/migrations/20260306100000_service_config.sql supabase/seed/service-config-seed.sql packages/supabase/src/database.types.ts
git commit -m "feat(platform): add service_config table and seed data"
```

---

## Task 2: Config Cache Helper — `getServiceConfig()`

**Files:**

- Create: `packages/supabase/src/service-config.ts`
- Create: `packages/supabase/src/service-config.test.ts`

**Context:** This is the core utility that all services use to read config. It replaces `process.env.X` for service-specific settings. Uses Upstash Redis in production, in-memory Map in dev. Cache TTL: 60 seconds.

**Step 1: Write the failing test**

```typescript
// packages/supabase/src/service-config.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("getServiceConfig", () => {
  it("should return config for a known service slug", async () => {
    // Will fail until implementation exists
    const { getServiceConfig } = await import("./service-config");
    const config = await getServiceConfig("stage-engine");
    expect(config).toBeDefined();
    expect(config?.slug).toBe("stage-engine");
  });

  it("should return null for unknown service", async () => {
    const { getServiceConfig } = await import("./service-config");
    const config = await getServiceConfig("nonexistent");
    expect(config).toBeNull();
  });

  it("should cache results and not re-fetch within TTL", async () => {
    const { getServiceConfig, _testHelpers } = await import("./service-config");
    // First call
    await getServiceConfig("stage-engine");
    // Second call should use cache
    await getServiceConfig("stage-engine");
    // fetchCount should be 1
    expect(_testHelpers.getFetchCount()).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/sxtnl/dev/smartout.ai
pnpm --filter @smartout/supabase test -- --run service-config
```

Expected: FAIL — module not found.

**Step 3: Write implementation**

```typescript
// packages/supabase/src/service-config.ts
import { createClient } from "@supabase/supabase-js";

type ServiceConfig = {
  service_id: string;
  name: string;
  slug: string;
  type: "docker" | "vercel" | "edge-function" | "external";
  status: "active" | "stopped" | "error" | "unconfigured";
  description: string | null;
  host_url: string | null;
  health_endpoint: string | null;
  docker_service_name: string | null;
  docker_image: string | null;
  vercel_project_id: string | null;
  config: Record<string, unknown>;
  env_schema: Array<{
    key: string;
    required: boolean;
    change_type: "runtime" | "restart";
    description: string;
  }>;
  vault_secrets: string[];
  version: string | null;
  port: number | null;
  tags: string[];
  is_critical: boolean;
};

const CACHE_TTL_MS = 60_000; // 60 seconds

// In-memory cache (works for long-lived processes: Docker services, dev server)
const memoryCache = new Map<string, { data: ServiceConfig | null; expires: number }>();
let fetchCount = 0;

// Redis cache (for serverless — Vercel)
let redis: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: { ex: number }) => Promise<void>;
} | null = null;

async function getRedis() {
  if (redis) return redis;
  // Only load Redis if UPSTASH_REDIS_REST_URL is available
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const { Redis } = await import("@upstash/redis");
    redis = new Redis({ url, token });
    return redis;
  } catch {
    return null;
  }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

async function fetchFromDB(slug: string): Promise<ServiceConfig | null> {
  fetchCount++;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("service_config")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as ServiceConfig;
}

export async function getServiceConfig(slug: string): Promise<ServiceConfig | null> {
  const cacheKey = `svc:${slug}`;
  const now = Date.now();

  // 1. Check memory cache (always available)
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  // 2. Check Redis cache (serverless environments)
  const redisClient = await getRedis();
  if (redisClient) {
    try {
      const redisValue = await redisClient.get(cacheKey);
      if (redisValue) {
        const parsed = JSON.parse(redisValue) as ServiceConfig | null;
        memoryCache.set(cacheKey, { data: parsed, expires: now + CACHE_TTL_MS });
        return parsed;
      }
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  // 3. Fetch from DB
  const config = await fetchFromDB(slug);

  // 4. Store in both caches
  memoryCache.set(cacheKey, { data: config, expires: now + CACHE_TTL_MS });
  if (redisClient) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(config), { ex: 60 });
    } catch {
      // Non-critical — memory cache is enough
    }
  }

  return config;
}

/** Get ALL services (for admin UI listing) — not cached as aggressively */
export async function getAllServiceConfigs(): Promise<ServiceConfig[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("service_config").select("*").order("name");

  if (error || !data) return [];
  return data as ServiceConfig[];
}

/** Invalidate cache for a specific service (after config update) */
export async function invalidateServiceConfig(slug: string): Promise<void> {
  const cacheKey = `svc:${slug}`;
  memoryCache.delete(cacheKey);

  const redisClient = await getRedis();
  if (redisClient) {
    try {
      // Delete by setting expired
      await redisClient.set(cacheKey, "null", { ex: 1 });
    } catch {
      // Non-critical
    }
  }
}

/** Get a specific config value for a service (convenience) */
export async function getServiceConfigValue(slug: string, key: string): Promise<string | null> {
  const config = await getServiceConfig(slug);
  if (!config) return null;

  // Check config JSONB first
  const val = config.config[key];
  if (typeof val === "string") return val;
  if (val !== undefined) return String(val);

  return null;
}

// Test helpers — only exported for tests
export const _testHelpers = {
  getFetchCount: () => fetchCount,
  resetCache: () => {
    memoryCache.clear();
    fetchCount = 0;
  },
};
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @smartout/supabase test -- --run service-config
```

Expected: PASS (may need mock for Supabase client in test — add vitest mock if needed).

**Step 5: Export from package**

Modify: `packages/supabase/src/index.ts` — add:

```typescript
export {
  getServiceConfig,
  getAllServiceConfigs,
  invalidateServiceConfig,
  getServiceConfigValue,
} from "./service-config";
```

**Step 6: Commit**

```bash
git add packages/supabase/src/service-config.ts packages/supabase/src/service-config.test.ts packages/supabase/src/index.ts
git commit -m "feat(supabase): add getServiceConfig() with Redis + in-memory cache"
```

---

## Task 3: API Routes — Service Config CRUD

**Files:**

- Create: `apps/web/src/app/api/platform-admin/services/route.ts` (GET all, POST create)
- Create: `apps/web/src/app/api/platform-admin/services/[slug]/route.ts` (GET one, PATCH update, DELETE)
- Create: `apps/web/src/app/api/platform-admin/services/[slug]/restart/route.ts` (POST restart)
- Create: `apps/web/src/app/api/platform-admin/services/[slug]/sync-env/route.ts` (POST sync to Vercel)

**Context:** All routes require super admin (`is_godmode`). Pattern matches existing `/api/platform-admin/keys/` routes. Read `apps/web/src/app/api/platform-admin/keys/route.ts` for the auth guard pattern.

**Step 1: Write GET/POST route for service listing**

```typescript
// apps/web/src/app/api/platform-admin/services/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!identity?.is_godmode) return null;
  return { user, admin };
}

export async function GET() {
  const auth = await requireSuperAdmin({} as NextRequest);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.admin.from("service_config").select("*").order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await auth.admin
    .from("service_config")
    .insert({
      name: body.name,
      slug: body.slug,
      type: body.type,
      description: body.description ?? null,
      host_url: body.host_url ?? null,
      health_endpoint: body.health_endpoint ?? "/health",
      docker_service_name: body.docker_service_name ?? null,
      docker_image: body.docker_image ?? null,
      vercel_project_id: body.vercel_project_id ?? null,
      config: body.config ?? {},
      env_schema: body.env_schema ?? [],
      vault_secrets: body.vault_secrets ?? [],
      port: body.port ?? null,
      tags: body.tags ?? [],
      is_critical: body.is_critical ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
```

**Step 2: Write single-service route (GET/PATCH/DELETE)**

```typescript
// apps/web/src/app/api/platform-admin/services/[slug]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { invalidateServiceConfig } from "@smartout/supabase/service-config";

// Same requireSuperAdmin as above — extract to shared util in real implementation
// For the plan, inline it. In implementation, extract to:
// apps/web/src/lib/platform-admin-auth.ts

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // ... auth check ...

  const { data, error } = await admin.from("service_config").select("*").eq("slug", slug).single();

  if (error) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // ... auth check ...

  const body = await request.json();

  // Log the change
  const { data: existing } = await admin
    .from("service_config")
    .select("service_id")
    .eq("slug", slug)
    .single();

  if (!existing) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const { data, error } = await admin
    .from("service_config")
    .update(body)
    .eq("slug", slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Invalidate cache
  await invalidateServiceConfig(slug);

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // ... auth check ...

  const { error } = await admin.from("service_config").delete().eq("slug", slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateServiceConfig(slug);
  return NextResponse.json({ success: true });
}
```

**Step 3: Write Docker restart route**

```typescript
// apps/web/src/app/api/platform-admin/services/[slug]/restart/route.ts

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // ... auth check ...
  const { slug } = await params;

  const { data: service } = await admin
    .from("service_config")
    .select("type, docker_service_name")
    .eq("slug", slug)
    .single();

  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  if (service.type !== "docker" || !service.docker_service_name) {
    return NextResponse.json({ error: "Only Docker services can be restarted" }, { status: 400 });
  }

  // Docker Engine API — requires DOCKER_HOST env var
  // Default: unix socket /var/run/docker.sock (mounted in web container)
  // Or TCP: http://host.docker.internal:2375
  const dockerHost = process.env.DOCKER_HOST ?? "http://localhost:2375";

  try {
    // Find container by label or name
    const listRes = await fetch(
      `${dockerHost}/containers/json?filters=${encodeURIComponent(
        JSON.stringify({ name: [service.docker_service_name] }),
      )}`,
    );
    const containers = await listRes.json();

    if (!containers.length) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    const containerId = containers[0].Id;

    // Restart container
    const restartRes = await fetch(`${dockerHost}/containers/${containerId}/restart`, {
      method: "POST",
    });

    if (!restartRes.ok) {
      return NextResponse.json({ error: "Failed to restart container" }, { status: 502 });
    }

    // Log the restart
    await admin.from("service_config_log").insert({
      service_id: (
        await admin.from("service_config").select("service_id").eq("slug", slug).single()
      ).data?.service_id,
      changed_by: user.id,
      change_type: "restart",
      field_name: "container",
      new_value: "restarted",
      applied: true,
      applied_at: new Date().toISOString(),
    });

    // Invalidate cache
    await invalidateServiceConfig(slug);

    return NextResponse.json({ success: true, containerId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Docker API error: ${msg}` }, { status: 502 });
  }
}
```

**Step 4: Write Vercel env sync route**

```typescript
// apps/web/src/app/api/platform-admin/services/[slug]/sync-env/route.ts

const VERCEL_API = "https://api.vercel.com";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // ... auth check ...
  const { slug } = await params;

  const vercelToken = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!vercelToken) {
    return NextResponse.json({ error: "VERCEL_API_TOKEN not configured" }, { status: 503 });
  }

  const { data: service } = await admin
    .from("service_config")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!service?.vercel_project_id) {
    return NextResponse.json({ error: "No Vercel project linked" }, { status: 400 });
  }

  const body = await request.json();
  // body.env_vars: Record<string, string> — key-value pairs to sync
  // body.target: "production" | "preview" | "development"
  // body.redeploy: boolean — trigger redeploy after sync

  const headers = {
    Authorization: `Bearer ${vercelToken}`,
    "Content-Type": "application/json",
  };

  const projectId = service.vercel_project_id;
  const teamQuery = teamId ? `?teamId=${teamId}` : "";

  // Get existing env vars
  const existingRes = await fetch(`${VERCEL_API}/v10/projects/${projectId}/env${teamQuery}`, {
    headers,
  });
  const existing = await existingRes.json();
  const existingMap = new Map(
    (existing.envs ?? []).map((e: { key: string; id: string }) => [e.key, e.id]),
  );

  const results: Array<{ key: string; action: string; success: boolean }> = [];

  for (const [key, value] of Object.entries(body.env_vars as Record<string, string>)) {
    const envId = existingMap.get(key);

    if (envId) {
      // Update existing
      const res = await fetch(`${VERCEL_API}/v10/projects/${projectId}/env/${envId}${teamQuery}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ value, target: [body.target ?? "production"] }),
      });
      results.push({ key, action: "updated", success: res.ok });
    } else {
      // Create new
      const res = await fetch(`${VERCEL_API}/v10/projects/${projectId}/env${teamQuery}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          key,
          value,
          type: "encrypted",
          target: [body.target ?? "production"],
        }),
      });
      results.push({ key, action: "created", success: res.ok });
    }
  }

  // Optional: trigger redeploy
  if (body.redeploy) {
    await fetch(`${VERCEL_API}/v13/deployments${teamQuery}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: service.name,
        project: projectId,
        target: body.target ?? "production",
      }),
    });
  }

  return NextResponse.json({ results });
}
```

**Step 5: Commit**

```bash
git add apps/web/src/app/api/platform-admin/services/
git commit -m "feat(api): service config CRUD + Docker restart + Vercel env sync"
```

---

## Task 4: Shared Auth Helper — Extract `requireSuperAdmin`

**Files:**

- Create: `apps/web/src/lib/platform-admin-auth.ts`
- Modify: All `/api/platform-admin/` routes to import from shared helper

**Context:** The super admin auth check is duplicated across every platform-admin API route. Extract to a shared helper. Check existing routes in `apps/web/src/app/api/platform-admin/keys/route.ts` for the current pattern.

**Step 1: Create shared helper**

```typescript
// apps/web/src/lib/platform-admin-auth.ts
import { createClient } from "@smartout/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

type AdminAuth = {
  user: User;
  admin: SupabaseClient;
};

export async function requireSuperAdmin(): Promise<AdminAuth | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!identity?.is_godmode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { user, admin };
}

/** Type guard for use in routes */
export function isAuthed(result: AdminAuth | NextResponse): result is AdminAuth {
  return "user" in result;
}
```

**Usage in routes:**

```typescript
import { requireSuperAdmin, isAuthed } from "@/lib/platform-admin-auth";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!isAuthed(auth)) return auth; // Returns the 401/403 NextResponse

  // auth.user and auth.admin are available
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/platform-admin-auth.ts
git commit -m "refactor(api): extract requireSuperAdmin shared helper"
```

---

## Task 5: Services UI — List Page

**Files:**

- Create: `apps/web/src/app/platform-admin/services/page.tsx`
- Create: `apps/web/src/app/platform-admin/services/_components/services-page-client.tsx`
- Create: `apps/web/src/app/platform-admin/services/_components/service-card.tsx`
- Create: `apps/web/src/app/platform-admin/services/_components/add-service-dialog.tsx`

**Context:** Follow the pattern from `/platform-admin/health/page.tsx` — server component for auth guard, client component for UI. Use TanStack Query to fetch services. Cards are clickable and link to `/platform-admin/services/[slug]`.

**Step 1: Write server page with auth guard**

```typescript
// apps/web/src/app/platform-admin/services/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ServicesPageClient } from "./_components/services-page-client";

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) redirect("/dashboard");

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!identity?.is_godmode) redirect("/dashboard");

  // Fetch initial data server-side for fast first paint
  const { data: services } = await admin
    .from("service_config")
    .select("*")
    .order("name");

  return <ServicesPageClient initialServices={services ?? []} />;
}
```

**Step 2: Write services page client**

Build a page with:

- Header: "Services" + "Add Service" button
- Filter chips: All | Docker | Vercel | Edge Functions | External
- Grid of ServiceCard components (2 columns on desktop)
- Each card shows: name, type badge, status indicator, port, tags, health status
- Cards are `<Link href={/platform-admin/services/${slug}}>` wrapped

Use existing patterns from:

- `apps/web/src/app/platform-admin/health/_components/health-page-client.tsx` for layout
- `apps/web/src/components/dashboard/SignalCard.tsx` for card patterns

**Step 3: Write ServiceCard component**

Card displays:

- Service name + description
- Type badge (Docker/Vercel/Edge/External) with color coding
- Status dot (green=active, red=error, gray=stopped, yellow=unconfigured)
- Port number (if applicable)
- Tag pills
- Health status (fetch from `/api/platform-admin/health/status` — reuse existing)
- Missing env vars count (compare env_schema against current config)

**Step 4: Write AddServiceDialog**

Form fields:

- Name (text)
- Slug (auto-generated from name, editable)
- Type (select: docker/vercel/edge-function/external)
- Description (textarea)
- Host URL (text, shown for docker/external)
- Port (number, shown for docker)
- Docker service name (text, shown for docker)
- Health endpoint (text, default "/health")
- Tags (multi-select chips)
- Is critical (checkbox)

**Step 5: Commit**

```bash
git add apps/web/src/app/platform-admin/services/
git commit -m "feat(ui): services list page with cards and add dialog"
```

---

## Task 6: Services UI — Detail Page

**Files:**

- Create: `apps/web/src/app/platform-admin/services/[slug]/page.tsx`
- Create: `apps/web/src/app/platform-admin/services/[slug]/_components/service-detail-client.tsx`
- Create: `apps/web/src/app/platform-admin/services/[slug]/_components/config-editor.tsx`
- Create: `apps/web/src/app/platform-admin/services/[slug]/_components/env-vars-panel.tsx`
- Create: `apps/web/src/app/platform-admin/services/[slug]/_components/service-logs-panel.tsx`
- Create: `apps/web/src/app/platform-admin/services/[slug]/_components/service-actions.tsx`

**Context:** This is the main "service profile" page. Tabbed layout like the health page. Admin can view and edit all service configuration here.

**Step 1: Write server page**

Same auth guard pattern as Task 5. Fetch service by slug from params.

**Step 2: Write service detail client — tabbed layout**

Tabs:

1. **Overview** — service metadata, health status, uptime chart placeholder
2. **Configuration** — edit config JSONB, host URL, port, health endpoint
3. **Environment** — env vars this service needs, with status (configured/missing), edit values
4. **Secrets** — linked Vault secrets (read from `platform_external_secret` by vault_secrets array)
5. **Logs** — change log from `service_config_log` table

**Step 3: Write ConfigEditor component**

- Form with all editable fields from `service_config`
- Each field shows `change_type` badge: "Runtime" (green) or "Restart required" (amber)
- Save button calls PATCH `/api/platform-admin/services/[slug]`
- After save, if any field was `restart` type, show banner: "Changes saved. Restart required to apply." with "Restart now" button

**Step 4: Write EnvVarsPanel component**

- Lists all env vars from `env_schema`
- For each var: name, description, status (configured/missing), change_type
- Click to edit value → calls PATCH to update `config` JSONB
- For Vault secrets: shows masked value, link to Keys & Secrets page
- "Sync to Vercel" button (for vercel-type services) → calls sync-env API

**Step 5: Write ServiceLogsPanel component**

- Fetches from `service_config_log` for this service
- Table: timestamp, changed_by (user name), field, old → new, applied status
- Auto-refreshes every 30s

**Step 6: Write ServiceActions component**

Buttons based on service type:

- Docker: "Restart Service" (calls restart API), "View Container Logs" (calls Docker logs API)
- Vercel: "Sync Env Vars", "Trigger Redeploy"
- All: "Delete Service" (with confirmation dialog)

**Step 7: Commit**

```bash
git add apps/web/src/app/platform-admin/services/[slug]/
git commit -m "feat(ui): service detail page with config, env vars, secrets, and logs"
```

---

## Task 7: Setup Wizard — First-Boot Config Popup

**Files:**

- Create: `apps/web/src/components/platform-admin/setup-wizard.tsx`
- Modify: `apps/web/src/app/platform-admin/layout.tsx` (or create if missing) — render wizard conditionally

**Context:** When a super admin first opens Platform Admin and services are unconfigured (status='unconfigured'), show a modal wizard that guides through essential config. This replaces the need to manually edit `.env.local`.

**Step 1: Write setup wizard component**

Multi-step modal:

1. **Welcome** — "Let's configure your services. You'll need API keys for the services you want to use."
2. **Core Services** — Stage Engine URL + API key, Supabase (already configured, show as confirmed)
3. **AI Services** — Ultravox API key, OpenRouter API key
4. **Billing** — Stripe secret key + webhook secret
5. **Notifications** — SendGrid API key, Twilio SID + token
6. **Contracts** — DocuSeal API key + webhook secret
7. **Review** — Show all configured vs skipped, "Save & Apply" button

Each step:

- Shows which service this is for
- Input fields for required keys
- "Skip" button (mark as unconfigured, can do later)
- Values are saved to Vault (via existing `/api/platform-admin/secrets` endpoint)
- Service status updated to 'active' when all required keys are provided

**Step 2: Add conditional render in layout**

```typescript
// In platform-admin layout or page wrapper
const { data: services } = await admin
  .from("service_config")
  .select("status")
  .eq("status", "unconfigured");

const needsSetup = (services?.length ?? 0) > 3; // More than 3 unconfigured = first boot
```

If `needsSetup`, render `<SetupWizard />` as a modal overlay.

**Step 3: Commit**

```bash
git add apps/web/src/components/platform-admin/setup-wizard.tsx
git commit -m "feat(ui): first-boot setup wizard for service configuration"
```

---

## Task 8: Migrate Hardcoded Service Registry to DB

**Files:**

- Modify: `apps/web/src/app/platform-admin/keys/_components/service-registry.ts`
- Modify: `apps/web/src/app/api/platform-admin/health/status/route.ts`
- Modify: `apps/web/src/app/platform-admin/health/_components/health-page-client.tsx`

**Context:** Currently services are hardcoded in `service-registry.ts` (20 entries) and `health/status/route.ts` (5 services + 8 external). Migrate these to read from `service_config` table instead.

**Step 1: Update health status API**

Replace hardcoded service URLs with dynamic lookup:

```typescript
// Instead of:
const services = [
  { name: "Supabase DB", url: "http://127.0.0.1:54321/rest/v1/" },
  { name: "Contract Service", url: "http://localhost:5012/health" },
  // ...
];

// Use:
const { data: services } = await admin
  .from("service_config")
  .select("name, slug, host_url, health_endpoint, type, status, is_critical")
  .in("type", ["docker", "edge-function"])
  .eq("status", "active");

// Build health checks dynamically
const checks = services.map((svc) => ({
  name: svc.name,
  slug: svc.slug,
  url: svc.host_url && svc.health_endpoint ? `${svc.host_url}${svc.health_endpoint}` : null,
  critical: svc.is_critical,
}));
```

**Step 2: Update service registry**

The `service-registry.ts` file in keys can either:

- A) Stay as a fallback/static registry for the Keys page specifically
- B) Be replaced by a hook that reads from `service_config`

Recommended: **B** — replace with a `useServiceRegistry()` hook that fetches from the API.

**Step 3: Commit**

```bash
git add apps/web/src/app/api/platform-admin/health/ apps/web/src/app/platform-admin/keys/ apps/web/src/app/platform-admin/health/
git commit -m "refactor(platform): migrate hardcoded services to service_config table"
```

---

## Task 9: Service Config Reader in Microservices

**Files:**

- Modify: `services/stage-engine/src/config.ts`
- Modify: `services/stage-engine/src/secrets.ts`
- Modify: `services/contract-service/src/config.ts`
- Modify: `services/contract-service/src/secrets.ts`

**Context:** Microservices currently read all config from env vars at startup. Add a secondary path: try `service_config` table first, fall back to env vars. This lets the admin UI drive config without editing `.env` files.

**Step 1: Add config loader to Stage Engine**

```typescript
// services/stage-engine/src/db-config.ts
import { createClient } from "@supabase/supabase-js";

let cachedConfig: Record<string, unknown> | null = null;
let cacheExpires = 0;

export async function loadServiceConfig(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (cachedConfig && cacheExpires > now) return cachedConfig;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {};

  try {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("service_config")
      .select("config, host_url, port")
      .eq("slug", "stage-engine")
      .single();

    cachedConfig = (data?.config as Record<string, unknown>) ?? {};
    cacheExpires = now + 60_000;
    return cachedConfig;
  } catch {
    return {};
  }
}

/** Get a config value: DB config > env var > default */
export async function getConfig(key: string, fallback?: string): Promise<string | undefined> {
  const dbConfig = await loadServiceConfig();
  return (dbConfig[key] as string) ?? process.env[key] ?? fallback;
}
```

**Step 2: Update existing config.ts to use getConfig as fallback**

Don't break existing env var pattern — add DB as primary source, env as fallback. Services that can't reach Supabase (network issues) still work via env vars.

**Step 3: Commit**

```bash
git add services/stage-engine/src/db-config.ts services/contract-service/src/db-config.ts
git commit -m "feat(services): add DB-first config loading with env var fallback"
```

---

## Task 10: Navigation + Platform Admin Layout Update

**Files:**

- Modify: `apps/web/src/app/platform-admin/` layout or nav component
- Check: `apps/web/src/app/platform-admin/health/_components/health-page-client.tsx` for existing nav

**Context:** Add "Services" to the Platform Admin navigation. Currently there's Health and Keys. Services should sit between them.

**Step 1: Find and update the navigation**

Look for the nav/sidebar in the platform-admin layout. Add:

```typescript
{ label: "Services", href: "/platform-admin/services", icon: Server }
```

Between Health and Keys in the navigation order.

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/
git commit -m "feat(nav): add Services to platform-admin navigation"
```

---

## Task 11: Vercel + Docker API Keys Setup

**Files:**

- Modify: `apps/web/.env.local` (dev)
- Document: Required production env vars

**Context:** For the Vercel API and Docker API to work, we need credentials.

**Required env vars (add to .env.local for dev):**

```bash
# Vercel API — create at https://vercel.com/account/tokens
VERCEL_API_TOKEN=<personal access token>
VERCEL_TEAM_ID=<team id from Vercel dashboard>

# Docker Engine API — for local dev, expose Docker socket
# Option A: TCP (requires dockerd config)
DOCKER_HOST=http://localhost:2375
# Option B: Unix socket (mount in container or use from host)
# DOCKER_HOST=unix:///var/run/docker.sock
```

**For production:** These should be the first secrets added via the setup wizard (Task 7) and stored in Vault.

**Step 1: Add to .env.example and .env.template**

**Step 2: Commit**

```bash
git add .env.example .env.template
git commit -m "docs(env): add VERCEL_API_TOKEN and DOCKER_HOST env vars"
```

---

## Task 12: Typecheck + Final Verification

**Step 1: Run typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai
pnpm turbo typecheck
```

Expected: 0 errors.

**Step 2: Run any existing tests**

```bash
pnpm test
```

**Step 3: Manual smoke test**

1. Start local Supabase: `npx supabase start`
2. Run seed: `npx supabase db reset --local` (or apply seed manually)
3. Start web: `pnpm --filter web dev`
4. Login as super admin
5. Navigate to `/platform-admin/services`
6. Verify: service cards visible, clickable
7. Click a service → detail page loads
8. Edit a config value → saves successfully
9. Check setup wizard appears if services are unconfigured

**Step 4: Commit everything and create PR**

```bash
git add -A
git commit -m "feat(platform): service layer — UI-driven config management

- service_config table with RLS and audit log
- getServiceConfig() with Redis + in-memory cache
- CRUD API routes for services
- Docker restart + Vercel env sync APIs
- Services list page + detail page with tabs
- First-boot setup wizard
- Migrated hardcoded service registry to DB
- DB-first config loading in microservices"
```

---

## Dependency Graph

```
Task 1 (migration) ─────┬──→ Task 2 (cache helper)
                         │
                         ├──→ Task 3 (API routes) ──→ Task 4 (auth helper)
                         │
                         ├──→ Task 8 (migrate registry)
                         │
                         └──→ Task 9 (microservice config)

Task 3 + Task 4 ────────┬──→ Task 5 (list UI)
                         │
                         └──→ Task 6 (detail UI) ──→ Task 7 (setup wizard)

Task 5 + Task 6 ───────────→ Task 10 (navigation)

All ────────────────────────→ Task 11 (API keys) ──→ Task 12 (verify)
```

## Estimated Scope

| Task                   | Lines (approx)     | Complexity |
| ---------------------- | ------------------ | ---------- |
| 1. Migration           | ~100 SQL           | Low        |
| 2. Cache helper        | ~120 TS            | Medium     |
| 3. API routes          | ~300 TS            | Medium     |
| 4. Auth helper         | ~50 TS             | Low        |
| 5. List UI             | ~350 TSX           | Medium     |
| 6. Detail UI           | ~500 TSX           | High       |
| 7. Setup wizard        | ~250 TSX           | Medium     |
| 8. Migrate registry    | ~100 TS            | Low        |
| 9. Microservice config | ~80 TS per service | Low        |
| 10. Navigation         | ~20 TSX            | Low        |
| 11. API keys docs      | ~10                | Low        |
| 12. Verification       | 0                  | Low        |
| **Total**              | **~2000**          |            |

## APIs Required (External)

| API            | Endpoint                               | Auth                 | Purpose                   |
| -------------- | -------------------------------------- | -------------------- | ------------------------- |
| Vercel         | `api.vercel.com/v10/projects/{id}/env` | Bearer token         | Read/write env vars       |
| Vercel         | `api.vercel.com/v13/deployments`       | Bearer token         | Trigger redeploy          |
| Docker Engine  | `/containers/json`                     | None (socket) or TLS | List containers           |
| Docker Engine  | `/containers/{id}/restart`             | None (socket) or TLS | Restart container         |
| Docker Engine  | `/containers/{id}/logs`                | None (socket) or TLS | Stream logs               |
| Supabase Vault | `get_secret()` / `upsert_secret()`     | Service role         | Secret storage (existing) |
| Upstash Redis  | REST API                               | Token                | Config cache              |
