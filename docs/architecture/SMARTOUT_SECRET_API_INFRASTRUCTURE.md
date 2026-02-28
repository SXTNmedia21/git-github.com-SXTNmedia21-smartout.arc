---
title: "Secret & API Key Infrastructure"
id: SECRET_API_INFRA
status: draft
layer: architecture
created: 2026-02-28
updated: 2026-02-28
depends_on:
  - CORE_ARCH_V2
  - MODULE_13
---

# Smartout — Secret & API Key Infrastructure

> **Smartout.io** — Architectural blueprint for migration
> Version 1.0 | February 2026
> **Dependencies:** Core Architecture v2, Module 13 (Multi-Tenant & Scaling), Supabase Vault (pgsodium)

---

## 1. Overview

Smartout manages three categories of secrets with distinct storage strategies, authentication flows, and lifecycle requirements. This document defines the database-level infrastructure: how keys are generated, stored, validated, rotated, and cleaned up.

**Key insight:** Secrets you need back (Stripe API key) are encrypted in Vault. Secrets you only need to verify (API keys you issue) are hashed with SHA-256. Never store a customer-issued key in plaintext.

### Three Categories

```
Category 1: Workspace API Keys (keys Smartout issues to customers)
  → Customer's POS system calls Smartout Edge Functions
  → Storage: SHA-256 hash in `platform_api_key` table
  → Auth: x-api-key header → hash lookup → workspace context → RLS

Category 2: External Service Secrets (keys third parties issue to Smartout)
  → Smartout calls Stripe, Twilio, Resend, DocuSeal
  → Storage: Encrypted in Supabase Vault (pgsodium)
  → Auth: Edge Function reads from Vault → calls external API

Category 3: Service-to-Service Keys (internal communication)
  → n8n calls Supabase Edge Functions, Vercel calls Edge Functions
  → Storage: SHA-256 hash in `platform_api_key` table (same as Cat 1)
  → Auth: Same as Cat 1 but with prefix `smo_svc_` and system-level scopes
```

---

## 2. Category 1: Workspace API Keys

### 2.1 Key Format

Follows the Stripe prefix pattern for instant visual identification and automated secret scanning:

```
Format: smo_{type}_{env}_{random}
  smo_sk_live_k7HjQ9xM2bP4vR8nL5wY...   (workspace secret key, production)
  smo_sk_test_a3BcD4eF5gH6iJ7kL8mN...   (workspace secret key, test/trainee)
  smo_svc_live_p1Qr2St3Uv4Wx5Yz6Ab...   (service-to-service, production)

Prefix breakdown:
  smo_     → Smartout (identifies the platform in leaked key scanners)
  sk_      → secret key (workspace API key)
  svc_     → service key (internal service-to-service)
  live_    → production data
  test_    → trainee/sandbox data only
  {random} → 32 bytes (256 bits) base64url-encoded
```

### 2.2 Key Generation

```typescript
// packages/utils/src/api-key.ts
import { randomBytes, createHash } from "node:crypto";

export interface GeneratedApiKey {
  plaintextKey: string; // Show ONCE to the user, never store
  keyHash: string; // SHA-256 hex, stored in database
  keyPrefix: string; // First 20 chars, shown in dashboard for identification
}

export function generateApiKey(type: "sk" | "svc", env: "live" | "test"): GeneratedApiKey {
  const randomPart = randomBytes(32).toString("base64url");
  const plaintextKey = `smo_${type}_${env}_${randomPart}`;
  const keyHash = createHash("sha256").update(plaintextKey).digest("hex");
  const keyPrefix = plaintextKey.substring(0, 20);

  return { plaintextKey, keyHash, keyPrefix };
}

export function hashApiKey(plaintextKey: string): string {
  return createHash("sha256").update(plaintextKey).digest("hex");
}
```

**Why SHA-256, not bcrypt:** API keys generated with `randomBytes(32)` have 256 bits of entropy. Brute-forcing SHA-256 at that entropy level is computationally impossible (2^256 combinations). bcrypt's deliberate ~100ms delay exists to protect low-entropy passwords — applying it to every API request creates a throughput bottleneck with zero security benefit. SHA-256 is sub-microsecond and produces a fixed 64-char hex string ideal for B-tree indexing.

### 2.3 Data Model

```sql
-- Migration: 030_api_key_management.sql

-- Enum for key version lifecycle
CREATE TYPE api_key_version_status AS ENUM ('current', 'previous', 'revoked');

-- Enum for key type
CREATE TYPE api_key_type AS ENUM ('workspace', 'service');

-- Master API key registry
CREATE TABLE platform_api_key (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  company_id            UUID REFERENCES company(company_id) ON DELETE CASCADE,
  created_by_profile_id UUID REFERENCES profile(profile_id),

  -- Identity
  name                  TEXT NOT NULL,                          -- "POS Integration", "Booking System"
  description           TEXT,
  key_type              api_key_type NOT NULL DEFAULT 'workspace',
  environment           TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),

  -- Key material (only hash stored, never plaintext)
  key_hash              VARCHAR(64) NOT NULL,                  -- SHA-256 hex
  key_prefix            VARCHAR(40) NOT NULL,                  -- First 20 chars for display

  -- Version & rotation
  version               api_key_version_status NOT NULL DEFAULT 'current',
  rotation_number       INTEGER NOT NULL DEFAULT 1,            -- Increments on each rotation
  grace_period_ends_at  TIMESTAMPTZ,                           -- When 'previous' version expires

  -- Scopes & limits
  scopes                TEXT[] NOT NULL DEFAULT '{}',           -- e.g., {'profiles:read', 'schedules:read'}
  rate_limit_per_minute INTEGER DEFAULT 60,
  allowed_ips           INET[],                                -- NULL = any IP allowed

  -- Timestamps
  last_used_at          TIMESTAMPTZ,
  demoted_at            TIMESTAMPTZ,                           -- When moved from current → previous
  revoked_at            TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,                           -- Optional hard expiry
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_key_hash UNIQUE (key_hash),
  CONSTRAINT uq_workspace_version
    UNIQUE (workspace_id, key_type, environment, version)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT chk_workspace_or_service
    CHECK (
      (key_type = 'workspace' AND workspace_id IS NOT NULL) OR
      (key_type = 'service' AND workspace_id IS NULL)
    )
);

-- Indexes for fast lookup
CREATE INDEX idx_api_key_hash_active
  ON platform_api_key (key_hash)
  WHERE version IN ('current', 'previous');

CREATE INDEX idx_api_key_workspace
  ON platform_api_key (workspace_id, key_type, environment)
  WHERE version != 'revoked';

CREATE INDEX idx_api_key_grace_expiry
  ON platform_api_key (grace_period_ends_at)
  WHERE version = 'previous' AND grace_period_ends_at IS NOT NULL;

-- Lightweight usage aggregation (NOT per-request logging)
CREATE TABLE platform_api_key_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      UUID NOT NULL REFERENCES platform_api_key(id) ON DELETE CASCADE,
  period_start    TIMESTAMPTZ NOT NULL,                         -- Hourly bucket
  request_count   INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  last_endpoint   TEXT,
  last_status     SMALLINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_key_period UNIQUE (api_key_id, period_start)
);

CREATE INDEX idx_usage_key_period
  ON platform_api_key_usage (api_key_id, period_start DESC);
```

### 2.4 Scope Taxonomy

Scopes follow `{resource}:{action}` format. Available scopes are gated by workspace plan tier.

```
-- Read scopes
profiles:read          — Employee list, readiness scores, basic info
schedules:read         — Published shifts, availability calendar
operations:read        — Session data, task completion rates
haccp:read             — Temperature logs, control list results
training:read          — Competence matrix, progress tracking
reports:read           — Aggregated KPIs, dashboard data
contracts:read         — Contract metadata (not document content)

-- Write scopes (require explicit opt-in)
schedules:write        — Create/modify shifts, manage availability
operations:write       — Update task status, log deviations
haccp:write            — Submit temperature readings, control checks

-- Preset bundles for non-technical users
"Read Only"            → profiles:read, schedules:read, operations:read, reports:read
"POS Integration"      → schedules:read, operations:read, operations:write
"HACCP System"         → haccp:read, haccp:write
"Full Access"          → All read + all write scopes
```

### 2.5 Authentication Flow

When an Edge Function receives a request with `x-api-key`, it must validate the key and establish workspace context for RLS. This requires a **direct Postgres connection** because PostgREST does not support custom GUC variables.

```typescript
// supabase/functions/_shared/api-key-auth.ts
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const pool = new Pool(Deno.env.get("DATABASE_URL")!, 3, true);

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string;
  keyType: "workspace" | "service";
  scopes: string[];
  rateLimitPerMinute: number;
}

export async function validateApiKey(plaintextKey: string): Promise<ApiKeyContext | null> {
  const keyHash = await sha256(plaintextKey);
  const conn = await pool.connect();

  try {
    const result = await conn.queryObject<ApiKeyContext>(
      `
      UPDATE platform_api_key
      SET last_used_at = now()
      WHERE key_hash = $1
        AND version IN ('current', 'previous')
        AND (expires_at IS NULL OR expires_at > now())
      RETURNING
        id AS "keyId",
        workspace_id AS "workspaceId",
        key_type AS "keyType",
        scopes,
        rate_limit_per_minute AS "rateLimitPerMinute"
    `,
      [keyHash],
    );

    return result.rows[0] || null;
  } finally {
    conn.release();
  }
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

### 2.6 RLS Integration via `set_config`

For API key-authenticated requests, workspace isolation uses PostgreSQL GUC variables instead of JWT claims:

```sql
-- RLS policy that works with BOTH JWT auth and API key auth
CREATE POLICY "workspace_isolation_dual_auth" ON session_task
FOR ALL
USING (
  workspace_id IN (
    -- Path 1: JWT auth (normal Supabase Auth)
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR
  -- Path 2: API key auth (GUC variable set by Edge Function)
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
```

Edge Function sets the context within a transaction:

```typescript
// Inside an API key-authenticated Edge Function
async function executeWithWorkspaceContext(workspaceId: string, query: string, params: unknown[]) {
  const conn = await pool.connect();
  try {
    await conn.queryArray("BEGIN");
    await conn.queryArray("SET LOCAL ROLE authenticated");
    await conn.queryArray("SELECT set_config('app.workspace_id', $1, true)", [workspaceId]);

    const result = await conn.queryObject(query, params);

    await conn.queryArray("COMMIT");
    return result.rows;
  } catch (err) {
    await conn.queryArray("ROLLBACK");
    throw err;
  } finally {
    conn.release();
  }
}
```

**Critical rules:**

- Always use `set_config(..., true)` — the `true` makes it transaction-local. Supabase uses Supavisor (transaction-mode pooling), so session-scoped variables leak to the next client.
- Always wrap in `BEGIN`/`COMMIT` — `SET LOCAL` only works inside a transaction.
- Always `SET LOCAL ROLE authenticated` — direct connections use the `postgres` superuser, which bypasses RLS entirely.

### 2.7 Dual-Auth Middleware

Edge Functions that accept both JWT (logged-in users) and API keys (external integrations) use a unified middleware:

```typescript
// supabase/functions/_shared/auth-middleware.ts
import { createClient } from "@supabase/supabase-js";
import { validateApiKey, type ApiKeyContext } from "./api-key-auth.ts";

export type AuthMethod = "jwt" | "api_key";

export interface AuthContext {
  method: AuthMethod;
  userId: string | null; // Set for JWT, null for API key
  workspaceId: string;
  scopes: string[]; // All scopes for JWT, key scopes for API key
  keyId: string | null; // Set for API key, null for JWT
  rateLimitKey: string; // Identifier for rate limiting
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
    };
  }

  // Strategy 2: JWT Bearer token
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (bearer) {
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

    // Resolve workspace from request header or user's active profile
    const workspaceId = req.headers.get("x-workspace-id");
    if (!workspaceId) return null;

    return {
      method: "jwt",
      userId: user.id,
      workspaceId,
      scopes: ["*"], // JWT users have full scope (RLS handles access)
      keyId: null,
      rateLimitKey: `user:${user.id}`,
    };
  }

  return null;
}

// Scope checking for API key requests
export function hasScope(auth: AuthContext, required: string): boolean {
  if (auth.method === "jwt") return true; // JWT access controlled by RLS, not scopes
  return auth.scopes.includes(required) || auth.scopes.includes("*");
}
```

**Edge Function config** — disable automatic JWT verification for dual-auth functions:

```toml
# supabase/functions/config.toml
[functions.public-api]
verify_jwt = false
```

### 2.8 Key Rotation

Rotation creates a new `current` version, demotes the old `current` to `previous` with a grace period, and revokes any existing `previous`:

```sql
-- Function: rotate an API key (called from Edge Function or admin action)
CREATE OR REPLACE FUNCTION rotate_api_key(
  p_workspace_id    UUID,
  p_key_type        api_key_type,
  p_environment     TEXT,
  p_new_key_hash    VARCHAR(64),
  p_new_key_prefix  VARCHAR(40),
  p_grace_period    INTERVAL DEFAULT '48 hours'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id UUID;
  v_next_rotation INTEGER;
BEGIN
  -- Get next rotation number
  SELECT COALESCE(MAX(rotation_number), 0) + 1 INTO v_next_rotation
  FROM platform_api_key
  WHERE workspace_id = p_workspace_id
    AND key_type = p_key_type
    AND environment = p_environment;

  -- Step 1: Revoke any existing 'previous' version
  UPDATE platform_api_key
  SET version = 'revoked', revoked_at = now(), updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND key_type = p_key_type
    AND environment = p_environment
    AND version = 'previous';

  -- Step 2: Demote 'current' to 'previous' with grace period
  UPDATE platform_api_key
  SET version = 'previous',
      demoted_at = now(),
      grace_period_ends_at = now() + p_grace_period,
      updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND key_type = p_key_type
    AND environment = p_environment
    AND version = 'current';

  -- Step 3: Insert new 'current' key
  INSERT INTO platform_api_key (
    workspace_id, key_type, environment,
    key_hash, key_prefix, version, rotation_number,
    scopes, rate_limit_per_minute
  )
  SELECT
    p_workspace_id, p_key_type, p_environment,
    p_new_key_hash, p_new_key_prefix, 'current', v_next_rotation,
    scopes, rate_limit_per_minute
  FROM platform_api_key
  WHERE workspace_id = p_workspace_id
    AND key_type = p_key_type
    AND environment = p_environment
    AND version = 'previous'    -- Just demoted, inherits its config
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
```

### 2.9 Automatic Cleanup via pg_cron

```sql
-- Revoke expired 'previous' keys every hour
SELECT cron.schedule(
  'revoke-expired-api-keys',
  '0 * * * *',
  $$
    UPDATE platform_api_key
    SET version = 'revoked', revoked_at = now(), updated_at = now()
    WHERE version = 'previous'
      AND grace_period_ends_at IS NOT NULL
      AND grace_period_ends_at <= now();
  $$
);

-- Aggregate usage stats and clean raw data older than 90 days
SELECT cron.schedule(
  'cleanup-api-key-usage',
  '0 3 * * *',
  $$
    DELETE FROM platform_api_key_usage
    WHERE period_start < now() - INTERVAL '90 days';
  $$
);
```

### 2.10 Usage Tracking

Usage is tracked per hourly bucket, not per request. Edge Functions increment counters via upsert:

```sql
-- Function called by Edge Functions after processing a request
CREATE OR REPLACE FUNCTION log_api_key_usage(
  p_key_id    UUID,
  p_endpoint  TEXT,
  p_status    SMALLINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bucket TIMESTAMPTZ := date_trunc('hour', now());
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
```

---

## 3. Category 2: External Service Secrets (Vault)

### 3.1 What Goes in Vault

| Service  | Secret           | Vault Name Pattern              |
| -------- | ---------------- | ------------------------------- |
| Stripe   | Secret key       | `stripe_{env}_{workspace_slug}` |
| Twilio   | Auth token       | `twilio_auth_token`             |
| Twilio   | Account SID      | `twilio_account_sid`            |
| Resend   | API key          | `resend_api_key`                |
| DocuSeal | API key          | `docuseal_api_key`              |
| Ultravox | API key          | `ultravox_api_key`              |
| Upstash  | Redis REST token | `upstash_redis_token`           |

Platform-level secrets (Twilio, Resend, etc.) are global. Workspace-specific secrets (e.g., per-workspace Stripe Connect accounts) include the workspace identifier in the name.

### 3.2 Vault Storage & Retrieval

Supabase Vault uses pgsodium's Transparent Column Encryption. Secrets are encrypted at rest with AES-256-GCM, keys derived from a root key managed by Supabase infrastructure (never stored in the database).

```sql
-- Store a secret
SELECT vault.create_secret(
  'sk_live_abc123xyz',                               -- plaintext
  'stripe_live_hotel_fjord',                          -- unique name
  'provider:stripe env:live workspace:hotel-fjord'    -- metadata tags
);

-- Retrieve decrypted
SELECT decrypted_secret
FROM vault.decrypted_secrets
WHERE name = 'stripe_live_hotel_fjord';

-- Update a secret (rotate)
UPDATE vault.secrets
SET secret = 'sk_live_new_key_456'
WHERE name = 'stripe_live_hotel_fjord';

-- Delete
SELECT vault.delete_secret(
  (SELECT id FROM vault.secrets WHERE name = 'stripe_live_hotel_fjord')
);
```

### 3.3 Edge Function Access via RPC Wrappers

PostgREST cannot call `vault.create_secret` directly (dot notation causes PGRST202 errors). Use `SECURITY DEFINER` wrapper functions restricted to `service_role`:

```sql
-- Read a secret by name
CREATE OR REPLACE FUNCTION get_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result TEXT;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets
  WHERE name = secret_name;
  RETURN result;
END;
$$;

-- Store or update a secret
CREATE OR REPLACE FUNCTION upsert_secret(
  p_name TEXT,
  p_secret TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
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

-- Delete a secret
CREATE OR REPLACE FUNCTION delete_secret(secret_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = secret_name;
  IF v_id IS NULL THEN RETURN FALSE; END IF;
  PERFORM vault.delete_secret(v_id);
  RETURN TRUE;
END;
$$;

-- Lock down: only service_role can call these
REVOKE EXECUTE ON FUNCTION get_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_secret TO service_role;
REVOKE EXECUTE ON FUNCTION upsert_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_secret TO service_role;
REVOKE EXECUTE ON FUNCTION delete_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_secret TO service_role;
```

```typescript
// Edge Function usage
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Read
const { data: stripeKey } = await supabase.rpc("get_secret", {
  secret_name: "stripe_live_hotel_fjord",
});

// Write (rotation)
await supabase.rpc("upsert_secret", {
  p_name: "stripe_live_hotel_fjord",
  p_secret: "sk_live_new_rotated_key",
  p_description: "provider:stripe env:live workspace:hotel-fjord rotated:2026-02-28",
});
```

### 3.4 External Secret Metadata Tracking

Vault stores the encrypted value, but we need metadata (last rotated, who rotated, expiry reminders) in a queryable table:

```sql
CREATE TABLE platform_external_secret (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID REFERENCES workspace(workspace_id),  -- NULL = platform-level
  provider            TEXT NOT NULL,                             -- stripe, twilio, resend, docuseal
  environment         TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
  vault_secret_name   TEXT NOT NULL UNIQUE,                     -- FK to vault.secrets.name
  description         TEXT,

  -- Rotation tracking
  last_rotated_at     TIMESTAMPTZ,
  last_rotated_by     UUID REFERENCES profile(profile_id),
  rotation_reminder_days INTEGER DEFAULT 90,                    -- Alert X days after last rotation
  expires_at          TIMESTAMPTZ,                              -- Hard expiry if the provider enforces it

  -- Status
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_verified_at    TIMESTAMPTZ,                              -- Last successful API call
  last_error_at       TIMESTAMPTZ,
  last_error_message  TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_secret_workspace ON platform_external_secret (workspace_id);
CREATE INDEX idx_external_secret_provider ON platform_external_secret (provider);
CREATE INDEX idx_external_secret_rotation_due ON platform_external_secret (last_rotated_at)
  WHERE is_active = true;
```

---

## 4. Category 3: Service-to-Service Keys

Service-to-service keys use the same `platform_api_key` table as workspace keys, distinguished by `key_type = 'service'` and prefix `smo_svc_`. They have no `workspace_id` (they operate across workspaces or at platform level).

```
Typical service keys:
  n8n → Edge Functions       (scopes: workflows:execute, sessions:write)
  Vercel API routes → EF     (scopes: profiles:read, contracts:write)
  Cron jobs → EF             (scopes: cleanup:execute, notifications:send)
```

Service keys are created by the Super-Admin only. They follow the same rotation and cleanup lifecycle as workspace keys.

---

## 5. Rate Limiting

### 5.1 Strategy

Supabase Edge Functions are stateless — no shared in-memory state between invocations. Rate limiting uses **Upstash Redis** (HTTP-based, works in Deno runtime, ~1-5ms latency overhead).

```typescript
// supabase/functions/_shared/rate-limit.ts
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";

const redis = new Redis({
  url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"), // Default: 60 req/min
  prefix: "rl:smartout",
});

export async function checkRateLimit(
  identifier: string,
  customLimit?: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const { success, remaining, reset } = await ratelimit.limit(identifier);
  return {
    allowed: success,
    remaining,
    resetAt: reset,
  };
}
```

### 5.2 Rate Limit Tiers

| Plan         | Workspace API Key | Service Key  |
| ------------ | ----------------- | ------------ |
| Trial        | 30 req/min        | N/A          |
| Starter      | 60 req/min        | N/A          |
| Professional | 300 req/min       | 1000 req/min |
| Enterprise   | Custom            | Custom       |

---

## 6. RLS Policies for Key Management Tables

```sql
-- platform_api_key: workspace admins manage their own keys
CREATE POLICY "owner_admin_manage_keys" ON platform_api_key
FOR ALL
USING (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
    AND is_active = true
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
    AND is_active = true
  )
);

-- platform_external_secret: only owner can see/manage external secrets
CREATE POLICY "owner_manage_external_secrets" ON platform_external_secret
FOR ALL
USING (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid()
    AND role = 'owner'
    AND is_active = true
  )
);

-- Super-admin: can see everything (platform_api_key)
CREATE POLICY "super_admin_all_keys" ON platform_api_key
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_identity
    WHERE user_id = auth.uid()
    AND is_super_admin = true
  )
);
```

---

## 7. Migration Sequence

| Order | Migration                    | Description                                                                     |
| ----- | ---------------------------- | ------------------------------------------------------------------------------- |
| 1     | `030_api_key_enums.sql`      | Create `api_key_version_status`, `api_key_type` enums                           |
| 2     | `031_api_key_tables.sql`     | Create `platform_api_key`, `platform_api_key_usage`, `platform_external_secret` |
| 3     | `032_api_key_indexes.sql`    | All indexes (hash lookup, workspace, grace expiry)                              |
| 4     | `033_api_key_functions.sql`  | `rotate_api_key()`, `log_api_key_usage()`                                       |
| 5     | `034_vault_rpc_wrappers.sql` | `get_secret()`, `upsert_secret()`, `delete_secret()`                            |
| 6     | `035_api_key_rls.sql`        | RLS policies for all key management tables                                      |
| 7     | `036_api_key_cron.sql`       | pg_cron jobs for expired key cleanup and usage data retention                   |

---

## 8. Integration Points

| Module                       | Integration                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ |
| **Module 13 (Multi-Tenant)** | API keys scoped to workspace. RLS enforces isolation via `set_config` pattern. |
| **Module 4 (Operations)**    | External POS systems read/write session data via workspace API keys.           |
| **Module 5 (HACCP)**         | External temperature monitoring systems submit readings via API key.           |
| **Module 3 (Scheduling)**    | Booking systems read published schedules via API key.                          |
| **All Edge Functions**       | Dual-auth middleware handles both JWT and API key auth.                        |
| **n8n**                      | Uses service-to-service keys to call Edge Functions.                           |

---

_Secrets in Smartout follow one rule: if you need the plaintext back, encrypt it in Vault. If you only need to verify it, hash it with SHA-256. There is no third option._
