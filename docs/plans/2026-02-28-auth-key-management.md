---
title: "Auth Key Management System — Implementation Plan"
id: PLAN_AUTH_KEY_MGMT
status: draft
layer: plan
created: 2026-02-28
updated: 2026-02-28
depends_on:
  - ARCH_SECRET_API_INFRA
  - ARCH_ADMIN_KEY_MGMT
---

# Auth Key Management System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralized API key management in the platform admin portal — create, rotate (versioned dual-key with 48h grace period), revoke, and monitor keys for workspace API access, external secret vaulting, and service-to-service auth.

**Architecture:** 3-tier key system based on `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md`. **Tier 1** (workspace API keys) and **Tier 3** (service keys) use SHA-256 hashing — the raw key is shown once at creation, only the hash is stored, and validation is a sub-microsecond hash comparison. **Tier 2** (external secrets like Stripe, Twilio) uses Supabase Vault (pgsodium) because those secrets need plaintext retrieval. Edge Functions accepting API keys use `verify_jwt = false` and a shared auth middleware that normalizes both JWT and API key auth into a unified `AuthContext`. Direct Postgres connections (`deno-postgres`) with `set_config('app.workspace_id', ...)` enable RLS without JWT.

**Tech Stack:** SHA-256 (pgcrypto), Supabase Vault (pgsodium), deno-postgres, Supabase Edge Functions (Deno), Upstash Redis (rate limiting), Next.js API routes, TanStack Table, shadcn/ui

**Source documents:**

- `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md` — Database schema, auth flows, functions
- `docs/architecture/SMARTOUT_ADMIN_KEY_MANAGEMENT.md` — UI routes, access control, UX flows

---

## Architecture Overview

```
                     ┌─────────────────────────────┐
                     │   Platform Admin UI          │
                     │   /platform-admin/keys       │
                     │   /platform-admin/secrets    │
                     └─────────────┬───────────────┘
                                   │ fetch()
                     ┌─────────────▼───────────────┐
                     │   Next.js API Routes         │
                     │   /api/platform-admin/keys/* │
                     │   (getSuperAdminId gate)     │
                     └─────────────┬───────────────┘
                                   │ service role
             ┌─────────────────────▼──────────────────────┐
             │              Supabase Database               │
             │                                              │
             │  ┌──────────────────┐  ┌─────────────────┐  │
             │  │ platform_api_key │  │ vault.secrets    │  │
             │  │ (SHA-256 hashes) │  │ (Tier 2 only)   │  │
             │  └──────────────────┘  └─────────────────┘  │
             │  ┌──────────────────┐  ┌─────────────────┐  │
             │  │ platform_api_key │  │ platform_       │  │
             │  │ _usage (buckets) │  │ external_secret │  │
             │  └──────────────────┘  └─────────────────┘  │
             └─────────────────────────────────────────────┘
                                   ▲
                   ┌───────────────┤ deno-postgres (Pool)
                   │               │ set_config for RLS
     ┌─────────────┴──────────┐    │
     │  Edge Function:         │────┘
     │  _shared/api-key-auth.ts│
     │  (SHA-256 → hash lookup)│
     └─────────────▲──────────┘
                   │ x-api-key header
     ┌─────────────┴───────────────┐
     │   External Systems           │
     │   (POS, payroll, etc.)       │
     └─────────────────────────────┘
```

## 3-Tier Key Architecture

| Tier              | Purpose                                  | Storage                                     | Validation               | Key Format                            |
| ----------------- | ---------------------------------------- | ------------------------------------------- | ------------------------ | ------------------------------------- |
| **1 — Workspace** | External systems calling workspace APIs  | SHA-256 hash in `platform_api_key.key_hash` | Hash comparison (sub-μs) | `smo_sk_live_...` / `smo_sk_test_...` |
| **2 — External**  | Secrets we need to READ (Stripe, Twilio) | Supabase Vault (pgsodium)                   | N/A — retrieved via RPC  | Stripe key, Twilio token, etc.        |
| **3 — Service**   | Internal service-to-service auth         | SHA-256 hash in `platform_api_key.key_hash` | Hash comparison (sub-μs) | `smo_svc_live_...`                    |

## Key Design Decisions (from architecture docs)

| Decision         | Choice                                    | Rationale                                                                             |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Tier 1+3 storage | SHA-256 hash                              | 256-bit entropy makes brute-force impossible, sub-μs validation, no decryption needed |
| Tier 2 storage   | Supabase Vault                            | Need plaintext retrieval for API calls to Stripe/Twilio/etc.                          |
| Rotation         | Versioned dual-key + 48h grace            | Zero-downtime, previous key valid 48h, auto-cleanup                                   |
| RLS for API keys | `set_config` + deno-postgres Pool         | PostgREST cannot set GUC variables — direct Postgres required                         |
| Rate limiting    | Upstash Redis                             | Already exists in codebase at `apps/web/src/lib/rate-limit.ts`                        |
| Auth middleware  | Dual-auth (JWT + API key) → `AuthContext` | Single downstream interface regardless of auth method                                 |
| Key format       | `smo_{type}_{env}_{random}`               | Stripe-style prefix for visual ID + GitHub secret scanning                            |
| Usage tracking   | Hourly bucket upsert (not per-request)    | Lower write volume, sufficient for analytics                                          |
| Grace cleanup    | External cron (watchdog pattern)          | Reuse existing `WATCHDOG_CRON_SECRET` pattern                                         |
| Tables           | RLS-enabled (not service-role-only)       | Workspace admins manage their own keys; super-admin sees all                          |

## Scope: V1 (this plan) vs V2

**V1 (this plan) — Super-Admin only:**

- Database migration: 3 tables + Vault wrappers + functions + enums + indexes + RLS
- `_shared/api-key-auth.ts` + `_shared/auth-middleware.ts` for Edge Functions
- `validate-api-key` Edge Function
- Platform admin API routes: keys CRUD + external secrets CRUD
- Platform admin UI: `/platform-admin/keys` + `/platform-admin/secrets`
- Grace period cleanup via cron Edge Function
- ADR-0026

**V2 (deferred) — see `SMARTOUT_ADMIN_KEY_MANAGEMENT.md` Section 2.1:**

- Workspace admin routes: `/settings/integrations/api-keys/*`
- Three-step creation wizard with scope bundles (Norwegian UI)
- External service connection hub: `/settings/integrations/services/*`
- Usage analytics (Recharts charts, hourly/daily toggle)
- Anomaly dashboard: `/platform-admin/keys/anomalies`
- Plan-tier gating (max keys per plan)
- Notification triggers (rotation reminders, anomaly alerts)
- Per-endpoint scope enforcement

---

## Task 1: Database Migration

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_api_key_management.sql`

**Context:** Read `supabase/migrations/00013_platform_admin_tables.sql` for existing platform-admin pattern. Check `packages/supabase/src/database.types.ts` for enum name conflicts.

**Reference:** `SMARTOUT_SECRET_API_INFRASTRUCTURE.md` sections 2.3, 3.2-3.4, 2.8-2.10, 6

### Step 1: Write the migration

```sql
-- =============================================================
-- API Key Management System
-- 3-tier: SHA-256 hashed keys (Tier 1+3), Vault for external secrets (Tier 2)
-- Ref: docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md
-- =============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- Revoke vault access from public roles
REVOKE ALL ON vault.decrypted_secrets FROM anon, authenticated;

-- ── Enums ──

CREATE TYPE public.api_key_version_status AS ENUM ('current', 'previous', 'revoked');
CREATE TYPE public.api_key_type AS ENUM ('workspace', 'service');

-- ── API Key Registry (Tier 1 + Tier 3) ──

CREATE TABLE public.platform_api_key (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  company_id            uuid REFERENCES public.company(company_id) ON DELETE CASCADE,
  created_by            uuid NOT NULL REFERENCES public.user_identity(user_id),

  -- Identity
  name                  text NOT NULL,
  description           text,
  key_type              api_key_type NOT NULL DEFAULT 'workspace',
  environment           text NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),

  -- Key material (ONLY hash stored, never plaintext)
  key_hash              varchar(64) NOT NULL,
  key_prefix            varchar(40) NOT NULL,

  -- Version & rotation
  version               api_key_version_status NOT NULL DEFAULT 'current',
  rotation_number       integer NOT NULL DEFAULT 1,
  grace_period_ends_at  timestamptz,

  -- Scopes & limits
  scopes                text[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute integer DEFAULT 60,
  allowed_ips           inet[],

  -- Timestamps
  last_used_at          timestamptz,
  demoted_at            timestamptz,
  revoked_at            timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_key_hash UNIQUE (key_hash),
  CONSTRAINT uq_workspace_version
    UNIQUE (workspace_id, key_type, environment, version)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT chk_workspace_or_service CHECK (
    (key_type = 'workspace' AND workspace_id IS NOT NULL) OR
    (key_type = 'service' AND workspace_id IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_api_key_hash_active
  ON public.platform_api_key (key_hash)
  WHERE version IN ('current', 'previous');

CREATE INDEX idx_api_key_workspace
  ON public.platform_api_key (workspace_id, key_type, environment)
  WHERE version != 'revoked';

CREATE INDEX idx_api_key_grace_expiry
  ON public.platform_api_key (grace_period_ends_at)
  WHERE version = 'previous' AND grace_period_ends_at IS NOT NULL;

-- ── Usage Tracking (hourly buckets, not per-request) ──

CREATE TABLE public.platform_api_key_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      uuid NOT NULL REFERENCES public.platform_api_key(id) ON DELETE CASCADE,
  period_start    timestamptz NOT NULL,
  request_count   integer NOT NULL DEFAULT 0,
  error_count     integer NOT NULL DEFAULT 0,
  last_endpoint   text,
  last_status     smallint,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_key_period UNIQUE (api_key_id, period_start)
);

CREATE INDEX idx_usage_key_period
  ON public.platform_api_key_usage (api_key_id, period_start DESC);

-- ── External Secret Metadata (Tier 2) ──

CREATE TABLE public.platform_external_secret (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid REFERENCES public.workspace(workspace_id),
  provider              text NOT NULL,
  environment           text NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
  vault_secret_name     text NOT NULL UNIQUE,
  description           text,

  -- Rotation tracking
  last_rotated_at       timestamptz,
  last_rotated_by       uuid REFERENCES public.user_identity(user_id),
  rotation_reminder_days integer DEFAULT 90,
  expires_at            timestamptz,

  -- Status
  is_active             boolean NOT NULL DEFAULT true,
  last_verified_at      timestamptz,
  last_error_at         timestamptz,
  last_error_message    text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_secret_workspace ON public.platform_external_secret (workspace_id);
CREATE INDEX idx_external_secret_provider ON public.platform_external_secret (provider);
CREATE INDEX idx_external_secret_rotation_due ON public.platform_external_secret (last_rotated_at)
  WHERE is_active = true;

-- ── Updated_at Triggers ──

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.platform_api_key
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.platform_external_secret
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Vault SECURITY DEFINER Wrappers ──
-- PostgREST cannot call vault.create_secret (PGRST202). These allow supabase.rpc().

CREATE OR REPLACE FUNCTION public.get_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result text;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets WHERE name = secret_name;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_secret(
  p_name text, p_secret text, p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_existing_id uuid; v_new_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = p_name;
  IF v_existing_id IS NOT NULL THEN
    UPDATE vault.secrets SET secret = p_secret WHERE id = v_existing_id;
    RETURN v_existing_id;
  ELSE
    SELECT vault.create_secret(p_secret, p_name, p_description) INTO v_new_id;
    RETURN v_new_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_vault_secret(secret_name text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = secret_name;
  IF v_id IS NULL THEN RETURN false; END IF;
  PERFORM vault.delete_secret(v_id);
  RETURN true;
END;
$$;

-- Lock down Vault wrappers: only service_role
REVOKE EXECUTE ON FUNCTION get_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_secret TO service_role;
REVOKE EXECUTE ON FUNCTION upsert_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_secret TO service_role;
REVOKE EXECUTE ON FUNCTION delete_vault_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_vault_secret TO service_role;

-- ── Key Rotation Function ──

CREATE OR REPLACE FUNCTION public.rotate_api_key(
  p_workspace_id    uuid,
  p_key_type        api_key_type,
  p_environment     text,
  p_new_key_hash    varchar(64),
  p_new_key_prefix  varchar(40),
  p_grace_period    interval DEFAULT '48 hours'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_id uuid;
  v_next_rotation integer;
BEGIN
  SELECT COALESCE(MAX(rotation_number), 0) + 1 INTO v_next_rotation
  FROM platform_api_key
  WHERE workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND key_type = p_key_type AND environment = p_environment;

  -- Revoke existing 'previous'
  UPDATE platform_api_key
  SET version = 'revoked', revoked_at = now(), updated_at = now()
  WHERE workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND key_type = p_key_type AND environment = p_environment
    AND version = 'previous';

  -- Demote 'current' to 'previous'
  UPDATE platform_api_key
  SET version = 'previous', demoted_at = now(),
      grace_period_ends_at = now() + p_grace_period, updated_at = now()
  WHERE workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND key_type = p_key_type AND environment = p_environment
    AND version = 'current';

  -- Insert new 'current' (inherit scopes + rate limit from demoted key)
  INSERT INTO platform_api_key (
    workspace_id, company_id, created_by, name, description,
    key_type, environment, key_hash, key_prefix,
    version, rotation_number, scopes, rate_limit_per_minute
  )
  SELECT
    p_workspace_id, company_id, created_by, name, description,
    p_key_type, p_environment, p_new_key_hash, p_new_key_prefix,
    'current', v_next_rotation, scopes, rate_limit_per_minute
  FROM platform_api_key
  WHERE workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND key_type = p_key_type AND environment = p_environment
    AND version = 'previous'
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ── Usage Logging Function (hourly bucket upsert) ──

CREATE OR REPLACE FUNCTION public.log_api_key_usage(
  p_key_id uuid, p_endpoint text, p_status smallint
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_bucket timestamptz := date_trunc('hour', now());
BEGIN
  INSERT INTO platform_api_key_usage (api_key_id, period_start, request_count, error_count, last_endpoint, last_status)
  VALUES (p_key_id, v_bucket, 1, CASE WHEN p_status >= 400 THEN 1 ELSE 0 END, p_endpoint, p_status)
  ON CONFLICT (api_key_id, period_start)
  DO UPDATE SET
    request_count = platform_api_key_usage.request_count + 1,
    error_count = platform_api_key_usage.error_count + CASE WHEN p_status >= 400 THEN 1 ELSE 0 END,
    last_endpoint = p_endpoint,
    last_status = p_status;
END;
$$;

-- ── Grace Period Cleanup ──

CREATE OR REPLACE FUNCTION public.cleanup_expired_api_keys()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE platform_api_key
  SET version = 'revoked', revoked_at = now(), updated_at = now()
  WHERE version = 'previous'
    AND grace_period_ends_at IS NOT NULL
    AND grace_period_ends_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── RLS Policies ──

ALTER TABLE public.platform_api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_external_secret ENABLE ROW LEVEL SECURITY;

-- Super-admin: full access to everything
CREATE POLICY "super_admin_all" ON public.platform_api_key FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_super_admin = true));

CREATE POLICY "super_admin_all" ON public.platform_api_key_usage FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_super_admin = true));

CREATE POLICY "super_admin_all" ON public.platform_external_secret FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_super_admin = true));

-- Workspace admin/owner: manage their own keys (V2: workspace self-service)
CREATE POLICY "workspace_admin_keys" ON public.platform_api_key FOR ALL
USING (
  workspace_id IN (
    SELECT p.workspace_id FROM profile p
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'owner')
  )
);

CREATE POLICY "workspace_admin_usage" ON public.platform_api_key_usage FOR SELECT
USING (
  api_key_id IN (
    SELECT pak.id FROM platform_api_key pak
    JOIN profile p ON p.workspace_id = pak.workspace_id
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'owner')
  )
);

CREATE POLICY "owner_external_secrets" ON public.platform_external_secret FOR ALL
USING (
  workspace_id IN (
    SELECT p.workspace_id FROM profile p
    WHERE p.user_id = auth.uid() AND p.role = 'owner'
  )
);

-- Service role bypasses RLS for Edge Function validation
```

### Step 2: Apply migration

Run: `npx supabase db reset`

### Step 3: Regenerate types

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

### Step 4: Verify

Run: `pnpm typecheck`

### Step 5: Commit

```bash
git add supabase/migrations/ packages/supabase/src/database.types.ts
git commit -m "feat(db): add API key management tables with SHA-256 hashing and Vault wrappers"
```

---

## Task 2: Shared Auth Middleware + validate-api-key Edge Function

**Files:**

- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/api-key-auth.ts`
- Create: `supabase/functions/_shared/auth-middleware.ts`
- Create: `supabase/functions/_shared/rate-limit.ts`
- Create: `supabase/functions/validate-api-key/index.ts`
- Create: `supabase/functions/cleanup-api-keys/index.ts`
- Modify: `supabase/config.toml` — add `verify_jwt = false` entries

**Context:** Read `supabase/functions/health-check/index.ts` for import patterns. No `_shared/` exists yet. Reference `SMARTOUT_SECRET_API_INFRASTRUCTURE.md` sections 2.5-2.7, 5.

### Step 1: Create `_shared/cors.ts`

```typescript
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
```

### Step 2: Create `_shared/api-key-auth.ts`

SHA-256 key validation via direct Postgres connection with pooling.

```typescript
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const pool = new Pool(Deno.env.get("DATABASE_URL")!, 3, true);

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string | null;
  keyType: "workspace" | "service";
  scopes: string[];
  rateLimitPerMinute: number;
}

export async function validateApiKey(plaintextKey: string): Promise<ApiKeyContext | null> {
  const keyHash = await sha256(plaintextKey);
  const conn = await pool.connect();

  try {
    const result = await conn.queryObject<{
      id: string;
      workspace_id: string | null;
      key_type: string;
      scopes: string[];
      rate_limit_per_minute: number;
    }>(
      `
      UPDATE platform_api_key
      SET last_used_at = now()
      WHERE key_hash = $1
        AND version IN ('current', 'previous')
        AND (expires_at IS NULL OR expires_at > now())
        AND (grace_period_ends_at IS NULL OR grace_period_ends_at > now())
      RETURNING id, workspace_id, key_type, scopes, rate_limit_per_minute
    `,
      [keyHash],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      keyId: row.id,
      workspaceId: row.workspace_id,
      keyType: row.key_type as "workspace" | "service",
      scopes: row.scopes ?? [],
      rateLimitPerMinute: row.rate_limit_per_minute ?? 60,
    };
  } finally {
    conn.release();
  }
}

export async function executeWithWorkspaceContext<T>(
  workspaceId: string,
  query: string,
  params: unknown[],
): Promise<T[]> {
  const conn = await pool.connect();
  try {
    await conn.queryArray("BEGIN");
    await conn.queryArray("SET LOCAL ROLE authenticated");
    await conn.queryArray("SELECT set_config('app.workspace_id', $1, true)", [workspaceId]);

    const result = await conn.queryObject<T>(query, params);

    await conn.queryArray("COMMIT");
    return result.rows;
  } catch (err) {
    await conn.queryArray("ROLLBACK");
    throw err;
  } finally {
    conn.release();
  }
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

### Step 3: Create `_shared/auth-middleware.ts`

Dual-auth: normalizes JWT and API key into unified `AuthContext`.

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateApiKey, type ApiKeyContext } from "./api-key-auth.ts";

export type AuthMethod = "jwt" | "api_key";

export interface AuthContext {
  method: AuthMethod;
  userId: string | null;
  workspaceId: string | null;
  scopes: string[];
  keyId: string | null;
  rateLimitKey: string;
  rateLimitPerMinute: number;
}

export async function resolveAuth(req: Request): Promise<AuthContext | null> {
  // Strategy 1: API key header
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const keyCtx = await validateApiKey(apiKey);
    if (!keyCtx) return null;
    return {
      method: "api_key",
      userId: null,
      workspaceId: keyCtx.workspaceId,
      scopes: keyCtx.scopes,
      keyId: keyCtx.keyId,
      rateLimitKey: `key:${keyCtx.keyId}`,
      rateLimitPerMinute: keyCtx.rateLimitPerMinute,
    };
  }

  // Strategy 2: Bearer token (could be API key or JWT)
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (bearer) {
    // If it looks like a Smartout API key, validate as such
    if (bearer.startsWith("smo_")) {
      const keyCtx = await validateApiKey(bearer);
      if (!keyCtx) return null;
      return {
        method: "api_key",
        userId: null,
        workspaceId: keyCtx.workspaceId,
        scopes: keyCtx.scopes,
        keyId: keyCtx.keyId,
        rateLimitKey: `key:${keyCtx.keyId}`,
        rateLimitPerMinute: keyCtx.rateLimitPerMinute,
      };
    }

    // Otherwise treat as JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${bearer}` } } },
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const workspaceId = req.headers.get("x-workspace-id");
    return {
      method: "jwt",
      userId: user.id,
      workspaceId: workspaceId ?? null,
      scopes: ["*"],
      keyId: null,
      rateLimitKey: `user:${user.id}`,
      rateLimitPerMinute: 120,
    };
  }

  return null;
}

export function hasScope(auth: AuthContext, required: string): boolean {
  if (auth.method === "jwt") return true;
  return auth.scopes.includes(required) || auth.scopes.includes("*");
}
```

### Step 4: Create `_shared/rate-limit.ts`

```typescript
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";

let ratelimit: Ratelimit | null = null;

function getRateLimiter(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    prefix: "rl:smartout:ef",
  });
  return ratelimit;
}

export async function checkRateLimit(
  identifier: string,
  _customLimit?: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const rl = getRateLimiter();
  if (!rl) return { allowed: true, remaining: 999, resetAt: 0 };

  const { success, remaining, reset } = await rl.limit(identifier);
  return { allowed: success, remaining, resetAt: reset };
}
```

### Step 5: Create `validate-api-key` Edge Function

```typescript
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth, type AuthContext } from "../_shared/auth-middleware.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await resolveAuth(req);

    if (!auth) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid or missing credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limit check
    const rl = await checkRateLimit(auth.rateLimitKey, auth.rateLimitPerMinute);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ valid: false, error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rl.remaining),
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      });
    }

    return new Response(
      JSON.stringify({
        valid: true,
        method: auth.method,
        key_id: auth.keyId,
        workspace_id: auth.workspaceId,
        scopes: auth.scopes,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

### Step 6: Create `cleanup-api-keys` Edge Function

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("cleanup_expired_api_keys");

  return new Response(
    JSON.stringify({
      status: error ? "error" : "ok",
      revoked_count: data ?? 0,
      timestamp: new Date().toISOString(),
      error: error?.message,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
```

### Step 7: Update `config.toml`

Add:

```toml
[functions.validate-api-key]
verify_jwt = false

[functions.cleanup-api-keys]
verify_jwt = false
```

### Step 8: Commit

```bash
git add supabase/functions/_shared/ supabase/functions/validate-api-key/ supabase/functions/cleanup-api-keys/ supabase/config.toml
git commit -m "feat(edge): add dual-auth middleware, validate-api-key, and cleanup-api-keys Edge Functions"
```

---

## Task 3: API Routes — Key Management CRUD

**Files:**

- Create: `apps/web/src/app/api/platform-admin/keys/route.ts` (GET list, POST create)
- Create: `apps/web/src/app/api/platform-admin/keys/[id]/route.ts` (GET detail)
- Create: `apps/web/src/app/api/platform-admin/keys/[id]/rotate/route.ts` (POST rotate)
- Create: `apps/web/src/app/api/platform-admin/keys/[id]/revoke/route.ts` (POST revoke)
- Create: `apps/web/src/app/api/platform-admin/keys/[id]/usage/route.ts` (GET usage)
- Create: `apps/web/src/app/api/platform-admin/secrets/route.ts` (GET list, POST create)

**Context:** Read `apps/web/src/app/api/platform-admin/contracts/route.ts` for the CRUD pattern. All routes use `getSuperAdminId()` gate, `logPlatformAction()` audit, Zod validation.

**Key generation happens server-side** (Node.js `crypto.getRandomValues` + `crypto.subtle.digest` for SHA-256). The plaintext key is returned ONCE in the POST response, never stored.

### Step 1: Create `keys/route.ts` — list + create

**GET:** Returns all keys with metadata (no hashes, no secrets). Joins workspace name.
**POST:** Validates with Zod schema. Generates `smo_{type}_{env}_{random}`, SHA-256 hashes it, stores hash + prefix, returns plaintext once.

Schema:

```typescript
const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  key_type: z.enum(["workspace", "service"]),
  workspace_id: z.string().uuid().optional(),
  environment: z.enum(["live", "test"]).default("live"),
  description: z.string().max(500).optional(),
  rate_limit_per_minute: z.number().int().min(1).max(10000).default(60),
  scopes: z.array(z.string()).default([]),
  expires_at: z.string().datetime().optional(),
});
```

### Step 2: Create `keys/[id]/rotate/route.ts`

Calls `admin.rpc("rotate_api_key", {...})` with new hash + prefix. Returns new plaintext key once.

### Step 3: Create `keys/[id]/revoke/route.ts`

Updates all versions of the key (by workspace + type + env) to `revoked`. Immediate.

### Step 4: Create `keys/[id]/usage/route.ts`

Returns hourly usage buckets from `platform_api_key_usage`. Accepts `limit` query param.

### Step 5: Create `keys/[id]/route.ts`

Returns key detail with all rotation versions and total usage count. Uses `Promise.all()` for parallel queries.

### Step 6: Create `secrets/route.ts`

**GET:** Lists external secrets (metadata only — no decrypted values).
**POST:** Stores secret in Vault via `admin.rpc("upsert_secret", {...})`, creates metadata row in `platform_external_secret`.

### Step 7: Verify + commit

```bash
pnpm typecheck
git add apps/web/src/app/api/platform-admin/keys/ apps/web/src/app/api/platform-admin/secrets/
git commit -m "feat(api): add key management and external secrets CRUD routes"
```

---

## Task 4: Platform Admin UI — Key Management Page

**Files:**

- Create: `apps/web/src/app/platform-admin/keys/page.tsx`
- Create: `apps/web/src/app/platform-admin/keys/_components/keys-page-client.tsx`
- Create: `apps/web/src/app/platform-admin/keys/_components/create-key-dialog.tsx`
- Create: `apps/web/src/app/platform-admin/keys/_components/key-secret-display.tsx`
- Modify: `apps/web/src/components/platform-admin/status-badge.tsx`

**Context:** Follow `users-client.tsx` TanStack Table pattern. Follow `health-page-client.tsx` fetch + skeleton pattern.

**Reference:** `SMARTOUT_ADMIN_KEY_MANAGEMENT.md` section 5 (super-admin dashboard)

### Step 1: Status badge entries

```typescript
workspace: "bg-violet-500/15 text-violet-500 border-violet-500/20",
service: "bg-purple-500/15 text-purple-500 border-purple-500/20",
current: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
previous: "bg-orange-500/15 text-orange-500 border-orange-500/20",
revoked: "bg-red-500/15 text-red-500 border-red-500/20",
```

### Step 2: Server page (`keys/page.tsx`)

Super-admin gate → render `KeysPageClient`.

### Step 3: `key-secret-display.tsx`

Show-once component with copy button + "Copy this key now — it will not be shown again" warning. CSS variable classes, not hardcoded zinc.

### Step 4: `create-key-dialog.tsx`

Dialog with form: name, type (workspace/service), environment (live/test), workspace (shown for workspace type), description, rate limit, expiry. On success → show `KeySecretDisplay`.

### Step 5: `keys-page-client.tsx`

Two tabs: "API Keys" and "External Secrets".

**API Keys tab:** TanStack Table with columns: Workspace, Key Prefix, Type (badge), Env (badge), Version (badge), Rate Limit, Last Used, Created, Actions. Search, filter by type. Row actions: Rotate (shows new key), Revoke (confirmation).

**External Secrets tab:** Simpler table: Name, Provider, Env, Last Rotated, Verified, Actions.

### Step 6: Verify + commit

```bash
pnpm typecheck
git add apps/web/src/app/platform-admin/keys/ apps/web/src/components/platform-admin/status-badge.tsx
git commit -m "feat(ui): add platform admin key management page"
```

---

## Task 5: Navigation, API Registry, ADR, CLAUDE.md

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx` — add "Keys" nav
- Modify: `apps/web/src/app/platform-admin/health/_components/api-registry.ts` — add endpoints
- Modify: `CLAUDE.md` — update tables, routes, edge functions, enums
- Create: `docs/decisions/0026-api-key-management-system.md`
- Modify: `docs/decisions/0000-decision-log.md`

### Step 1: Nav item

Add `KeyRound` icon → `/platform-admin/keys`, after "Health" before "Audit".

### Step 2: API Registry

Add 9 entries: 5 key routes, 2 secret routes, validate-api-key EF, cleanup-api-keys EF.

### Step 3: ADR-0026

Document key decisions:

- SHA-256 for issued keys vs Vault for all (rationale: sub-μs validation, no need for plaintext retrieval)
- Vault only for external secrets (rationale: need to call Stripe API with actual key)
- deno-postgres for `set_config` (rationale: PostgREST limitation)
- Versioned rotation + 48h grace (rationale: zero-downtime for integrators)
- Hourly usage buckets (rationale: lower write volume than per-request)

### Step 4: CLAUDE.md updates

Add tables, routes, edge functions, enums, architecture doc references.

### Step 5: Commit

```bash
git add CLAUDE.md docs/decisions/ apps/web/src/components/dashboard/DashboardShell.tsx \
  apps/web/src/app/platform-admin/health/_components/api-registry.ts
git commit -m "feat: add nav, API registry, ADR-0026, CLAUDE.md updates for key management"
```

---

## Task 6: Integration Test — Full Lifecycle

### Step 1: Start environment

```bash
npx supabase start && npx supabase db reset
pnpm --filter web dev
```

### Step 2: Verify migration

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
AND tablename IN ('platform_api_key', 'platform_api_key_usage', 'platform_external_secret');

SELECT typname FROM pg_type WHERE typname LIKE 'api_key%';

SELECT proname FROM pg_proc WHERE proname IN (
  'get_secret', 'upsert_secret', 'delete_vault_secret',
  'rotate_api_key', 'log_api_key_usage', 'cleanup_expired_api_keys'
);
```

### Step 3: Test key lifecycle via UI

1. **Create** — `/platform-admin/keys` → Create Key → verify `smo_sk_live_...` shown once
2. **List** — Verify key appears with correct badges
3. **Validate** — `SELECT encode(digest('smo_sk_live_...', 'sha256'), 'hex')` → match `key_hash`
4. **Rotate** — Actions → Rotate → verify new key shown, old key has grace period
5. **Grace** — Old key still valid (check hash in `platform_api_key WHERE version = 'previous'`)
6. **Rotate again** — v1 key now revoked
7. **Revoke** — Actions → Revoke → all versions revoked
8. **Vault** — Test `SELECT upsert_secret(...)` and `SELECT get_secret(...)` for external secrets

### Step 4: Test Edge Function

```bash
npx supabase functions serve validate-api-key
curl http://localhost:54321/functions/v1/validate-api-key -H "x-api-key: smo_sk_live_..."
```

### Step 5: Type check + final commit

```bash
pnpm typecheck
git add -A
git commit -m "fix: integration test fixes for key management system"
```
