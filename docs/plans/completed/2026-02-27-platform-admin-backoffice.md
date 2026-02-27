---
id: plan-platform-admin-backoffice
title: Platform Admin Backoffice Implementation Plan
version: 1.1.0
created: 2026-02-27
last_updated: 2026-02-27
owner: pontus
tags: [platform-admin, module-17, implementation-plan]
---

# Platform Admin Backoffice — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Smartout's internal super-admin backoffice for managing workspaces, billing, landing page content, contracts, platform health, and user administration.

**Architecture:** Next.js 16 App Router with `/platform-admin/*` routes inside `apps/web`, protected by middleware checking `user_identity.is_super_admin`. All queries use a Supabase service-role admin client (bypasses RLS). Every action is audit-logged. The module adds 5 new tables and extends `user_identity` with a super-admin flag.

**Tech Stack:** Next.js 16.1.6 (App Router), TypeScript (strict), Supabase (service role via `@supabase/supabase-js`), Tailwind CSS v4 (CSS-based config, OKLCH colors), shadcn/ui (new-york style), TanStack Table, Recharts, Zod, Lucide React

**Source Spec:** `docs/modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md`

---

## Codebase Facts (verified)

These are verified facts the implementing engineer must know:

| Fact                    | Detail                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User table              | `user_identity` (NOT `user`). PK is `user_id`, references `auth.users(id)`. GDPR vault.                                                                                     |
| Auth trigger            | `handle_new_user()` auto-creates `user_identity` row on `auth.users` INSERT                                                                                                 |
| Subscription data       | Lives on `company` table: `subscription_plan` (text), `subscription_status` (text), `trial_ends_at` (timestamptz). NO separate `stripe_subscription` table                  |
| Existing contract table | `employment_contract` (workspace-scoped HR contracts) with enum `contract_status` (draft/sent/viewed/signed/expired/terminated). Platform contracts are a DIFFERENT concept |
| Existing enums          | 33 enums already exist. `contract_status` is taken — platform contracts need `platform_contract_status`                                                                     |
| RLS pattern             | `get_workspace_ids_for_user(auth.uid())` for SELECT, `is_admin_in_workspace(auth.uid(), wid)` for writes. Platform tables have NO RLS — service role only                   |
| Supabase package        | Exports: `.`, `./client`, `./server`, `./middleware`. No `./admin` yet. Uses `@supabase/ssr@^0.5.0` and `@supabase/supabase-js@^2.45.0`                                     |
| database.types.ts       | Auto-generated (56KB). MUST regenerate after migration via `supabase gen types --local`                                                                                     |
| Seed data               | Test user `admin@smartout.local` / `password123` (user_id: `e0000000-...`). Needs `is_super_admin = true`                                                                   |
| Tailwind v4             | CSS-based config in `globals.css`. Uses `@theme inline`, OKLCH color functions, `@plugin "tailwindcss-animate"`. No `tailwind.config.ts`                                    |
| shadcn/ui               | Style: `new-york`, only `dialog.tsx` installed. Aliases: `@/components/ui`, `@/lib`, `@/hooks`                                                                              |
| Profile status          | Enum `profile_status`: trainee/active/inactive/offboarding. Use `.eq("status", "active")` not `.eq("is_active", true)` for counting active profiles                         |
| Dashboard layout        | Existing dashboard at `/dashboard` is `"use client"` with DashboardContext. Platform admin is SEPARATE — should prefer server components                                    |
| Next.js config          | Clean — only PostHog rewrite rules. No transpilePackages. Dev port 3050                                                                                                     |
| Path alias              | `@/*` maps to `./src/*` in `apps/web`                                                                                                                                       |
| Missing deps            | No `@tanstack/react-table`, no `recharts` in `apps/web/package.json`                                                                                                        |
| Latest migration        | `20260227120000_activate_workspace_multidept.sql` (timestamp format). Sequential: up to `00012`                                                                             |
| Local Supabase          | API: 54331, DB: 54332, Studio: 54333. PostgreSQL 17                                                                                                                         |

---

## Phase 1: Foundation

### Task 1: Database Migration — Platform Admin Tables

**Files:**

- Create: `supabase/migrations/00013_platform_admin_tables.sql`

**Step 1: Write the migration**

```sql
-- ═══════════════════════════════════════════════════════════════
-- Migration 00013: Platform Administration Tables
-- Module 17 — Super Admin Backoffice
-- ═══════════════════════════════════════════════════════════════

-- ─── Super-Admin Flag on user_identity ─────────────────────────
-- user_identity is the GDPR PII vault (00001_identity_tables.sql)
-- is_super_admin is platform-level, NOT a workspace role
ALTER TABLE public.user_identity
  ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;

-- ─── Platform Audit Log ────────────────────────────────────────
-- No RLS — only accessible via service role in platform-admin routes
CREATE TABLE public.platform_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id    uuid NOT NULL REFERENCES public.user_identity(user_id),
  action            text NOT NULL,
  entity_type       text NOT NULL,       -- 'workspace', 'subscription', 'contract', 'user', 'config'
  entity_id         uuid,
  details           jsonb DEFAULT '{}',
  ip_address        inet,
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_platform_audit_admin ON public.platform_audit_log (super_admin_id, created_at DESC);
CREATE INDEX idx_platform_audit_entity ON public.platform_audit_log (entity_type, entity_id);
CREATE INDEX idx_platform_audit_time ON public.platform_audit_log (created_at DESC);

-- ─── Platform Impersonation Log ────────────────────────────────
CREATE TABLE public.platform_impersonation_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id        uuid NOT NULL REFERENCES public.user_identity(user_id),
  target_user_id        uuid NOT NULL REFERENCES public.user_identity(user_id),
  target_workspace_id   uuid NOT NULL REFERENCES public.workspace(workspace_id),
  reason                text NOT NULL,
  started_at            timestamptz DEFAULT now() NOT NULL,
  ended_at              timestamptz,
  actions_taken         jsonb DEFAULT '[]'
);

CREATE INDEX idx_impersonation_admin ON public.platform_impersonation_log (super_admin_id, started_at DESC);

-- ─── Landing Config ────────────────────────────────────────────
CREATE TABLE public.landing_config (
  config_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  name              text NOT NULL,
  locale            text NOT NULL DEFAULT 'no',
  status            text NOT NULL DEFAULT 'draft',    -- 'draft', 'published', 'archived'
  config_json       jsonb NOT NULL,
  published_json    jsonb,
  version           integer NOT NULL DEFAULT 1,
  created_by        uuid REFERENCES public.user_identity(user_id),
  updated_by        uuid REFERENCES public.user_identity(user_id),
  published_at      timestamptz,
  published_by      uuid REFERENCES public.user_identity(user_id),
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_landing_config_updated_at BEFORE UPDATE ON public.landing_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.landing_config_version (
  version_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id         uuid NOT NULL REFERENCES public.landing_config(config_id),
  version           integer NOT NULL,
  config_json       jsonb NOT NULL,
  change_notes      text,
  created_by        uuid REFERENCES public.user_identity(user_id),
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_landing_config_slug ON public.landing_config (slug);
CREATE INDEX idx_landing_config_status ON public.landing_config (status);
CREATE INDEX idx_landing_config_version ON public.landing_config_version (config_id, version DESC);

-- ─── Platform Contract Template ────────────────────────────────
-- NOTE: Uses text for status, NOT the existing contract_status enum
-- (that enum belongs to employment_contract from migration 00012)
CREATE TABLE public.platform_contract_template (
  template_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  description       text,
  docuseal_template_id text,
  template_type     text NOT NULL,        -- 'saas_agreement', 'dpa', 'sla', 'custom'
  locale            text NOT NULL DEFAULT 'no',
  status            text NOT NULL DEFAULT 'active',  -- 'draft', 'active', 'archived'
  variable_fields   jsonb NOT NULL DEFAULT '[]',     -- [{name, label, type, required}]
  created_by        uuid REFERENCES public.user_identity(user_id),
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_platform_contract_template_updated_at BEFORE UPDATE ON public.platform_contract_template FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Platform Contract Instance ────────────────────────────────
-- Company-level contracts (SaaS agreements, DPAs) — NOT employment contracts
CREATE TABLE public.platform_contract_instance (
  contract_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       uuid REFERENCES public.platform_contract_template(template_id),
  company_id        uuid NOT NULL REFERENCES public.company(company_id),
  workspace_id      uuid REFERENCES public.workspace(workspace_id),  -- nullable: can be company-level
  title             text NOT NULL,
  status            text NOT NULL DEFAULT 'draft',  -- 'draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled'
  docuseal_submission_id text,
  field_values      jsonb DEFAULT '{}',
  signatories       jsonb NOT NULL DEFAULT '[]',     -- [{name, email, role, signed_at}]
  sent_at           timestamptz,
  signed_at         timestamptz,
  expires_at        timestamptz,
  document_url      text,
  created_by        uuid REFERENCES public.user_identity(user_id),
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_platform_contract_instance_updated_at BEFORE UPDATE ON public.platform_contract_instance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_platform_contract_company ON public.platform_contract_instance (company_id);
CREATE INDEX idx_platform_contract_workspace ON public.platform_contract_instance (workspace_id);
CREATE INDEX idx_platform_contract_status ON public.platform_contract_instance (status);
CREATE INDEX idx_platform_contract_template ON public.platform_contract_instance (template_id);

-- ─── Platform Metrics (Daily Snapshot) ─────────────────────────
CREATE TABLE public.platform_metrics_daily (
  date                    date PRIMARY KEY,
  total_users             integer NOT NULL DEFAULT 0,
  total_companies         integer NOT NULL DEFAULT 0,
  total_workspaces        integer NOT NULL DEFAULT 0,
  total_profiles          integer NOT NULL DEFAULT 0,
  new_users_today         integer NOT NULL DEFAULT 0,
  new_workspaces_today    integer NOT NULL DEFAULT 0,
  -- Subscription data from company table (subscription_status column)
  subscriptions_trial     integer NOT NULL DEFAULT 0,
  subscriptions_active    integer NOT NULL DEFAULT 0,
  subscriptions_paused    integer NOT NULL DEFAULT 0,
  subscriptions_past_due  integer NOT NULL DEFAULT 0,
  subscriptions_cancelled integer NOT NULL DEFAULT 0,
  mrr_nok                 decimal(12,2) NOT NULL DEFAULT 0,
  active_workspaces_24h   integer NOT NULL DEFAULT 0,
  sessions_created_24h    integer NOT NULL DEFAULT 0,
  tasks_completed_24h     integer NOT NULL DEFAULT 0,
  signups_to_workspace    decimal(5,2),
  workspace_to_invite     decimal(5,2),
  invite_to_session       decimal(5,2),
  computed_at             timestamptz DEFAULT now() NOT NULL
);

-- ─── Metrics Computation Function ──────────────────────────────
-- Reads from company.subscription_status (NOT a separate stripe table)
CREATE OR REPLACE FUNCTION public.compute_platform_metrics()
RETURNS void AS $$
INSERT INTO platform_metrics_daily (
  date,
  total_users,
  total_companies,
  total_workspaces,
  total_profiles,
  new_users_today,
  new_workspaces_today,
  subscriptions_trial,
  subscriptions_active,
  subscriptions_paused,
  subscriptions_past_due,
  subscriptions_cancelled,
  active_workspaces_24h,
  mrr_nok
)
SELECT
  CURRENT_DATE,
  (SELECT count(*) FROM user_identity),
  (SELECT count(*) FROM company),
  (SELECT count(*) FROM workspace),
  (SELECT count(*) FROM profile WHERE status = 'active'),
  (SELECT count(*) FROM user_identity WHERE created_at >= CURRENT_DATE),
  (SELECT count(*) FROM workspace WHERE created_at >= CURRENT_DATE),
  (SELECT count(*) FROM company WHERE subscription_status = 'trial'),
  (SELECT count(*) FROM company WHERE subscription_status = 'active'),
  (SELECT count(*) FROM company WHERE subscription_status = 'paused'),
  (SELECT count(*) FROM company WHERE subscription_status = 'past_due'),
  (SELECT count(*) FROM company WHERE subscription_status = 'cancelled'),
  (SELECT count(DISTINCT workspace_id) FROM profile WHERE updated_at >= now() - interval '24 hours'),
  0 -- MRR placeholder — real values come from Stripe API in production
ON CONFLICT (date) DO UPDATE SET
  total_users = EXCLUDED.total_users,
  total_companies = EXCLUDED.total_companies,
  total_workspaces = EXCLUDED.total_workspaces,
  total_profiles = EXCLUDED.total_profiles,
  new_users_today = EXCLUDED.new_users_today,
  new_workspaces_today = EXCLUDED.new_workspaces_today,
  subscriptions_trial = EXCLUDED.subscriptions_trial,
  subscriptions_active = EXCLUDED.subscriptions_active,
  subscriptions_paused = EXCLUDED.subscriptions_paused,
  subscriptions_past_due = EXCLUDED.subscriptions_past_due,
  subscriptions_cancelled = EXCLUDED.subscriptions_cancelled,
  active_workspaces_24h = EXCLUDED.active_workspaces_24h,
  mrr_nok = EXCLUDED.mrr_nok,
  computed_at = now();
$$ LANGUAGE sql;
```

**Step 2: Update seed data — make test user a super admin**

Append to `supabase/seed.sql`:

```sql
-- 8. Make Admin user a Super Admin for platform-admin development
UPDATE public.user_identity
SET is_super_admin = true
WHERE user_id = 'e0000000-0000-0000-0000-000000000000';
```

**Step 3: Apply migration and verify**

Run: `npx supabase db reset` (from repo root)
Expected: All 13 migrations apply cleanly, seed data loads, test user has `is_super_admin = true`

**Step 4: Regenerate database types**

Run: `npx supabase gen types --local > packages/supabase/src/database.types.ts`
Expected: New file includes `platform_audit_log`, `platform_impersonation_log`, `landing_config`, `landing_config_version`, `platform_contract_template`, `platform_contract_instance`, `platform_metrics_daily` tables, and `user_identity` now has `is_super_admin` column.

**Step 5: Commit**

```bash
git add supabase/migrations/00013_platform_admin_tables.sql supabase/seed.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add platform admin tables and super-admin flag (Module 17)

Tables: platform_audit_log, platform_impersonation_log,
landing_config, landing_config_version, platform_contract_template,
platform_contract_instance, platform_metrics_daily.
Adds is_super_admin to user_identity.
Includes compute_platform_metrics() function."
```

---

### Task 2: Supabase Admin Client (Service Role)

**Files:**

- Create: `packages/supabase/src/admin.ts`
- Modify: `packages/supabase/src/index.ts`
- Modify: `packages/supabase/package.json`

**Context:** The supabase package uses `@supabase/ssr` for browser/server clients with cookie handling. The admin client uses `@supabase/supabase-js` directly (already a dependency via `@supabase/ssr`) because it needs NO cookies/sessions — just the service role key.

**Step 1: Create the admin client**

Create `packages/supabase/src/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

/**
 * Supabase admin client using service role key.
 * Bypasses RLS — ONLY use in platform-admin server code.
 * NEVER import this in client components or expose to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

**Step 2: Add export to barrel**

In `packages/supabase/src/index.ts`, add line:

```typescript
export * as AdminClient from "./admin";
```

**Step 3: Add export path to package.json**

In `packages/supabase/package.json`, add to the `"exports"` object:

```json
"./admin": "./src/admin.ts"
```

Full exports should be:

```json
"exports": {
  ".": "./src/index.ts",
  "./middleware": "./src/middleware.ts",
  "./client": "./src/client.ts",
  "./server": "./src/server.ts",
  "./admin": "./src/admin.ts"
}
```

**Step 4: Commit**

```bash
git add packages/supabase/src/admin.ts packages/supabase/src/index.ts packages/supabase/package.json
git commit -m "feat(supabase): add admin client with service role for platform-admin"
```

---

### Task 3: Platform Types (Zod Schemas)

**Files:**

- Create: `packages/types/src/platform.ts`
- Modify: `packages/types/src/identity.ts` (add `is_super_admin`)
- Modify: `packages/types/src/index.ts` (add export)

**Context:** The types package uses Zod schemas with `z.infer` for TypeScript types. Follow existing patterns in `identity.ts`, `structure.ts`, `governance.ts`.

**Step 1: Add `is_super_admin` to UserSchema**

In `packages/types/src/identity.ts`, inside `UserSchema`, add after the `last_login_at` line:

```typescript
  is_super_admin: z.boolean().default(false),
```

**Step 2: Create platform types**

Create `packages/types/src/platform.ts`:

```typescript
import { z } from "zod";

// ─── Platform Audit Log ────────────────────────────────────────

export const PlatformAuditLogSchema = z.object({
  id: z.string().uuid(),
  super_admin_id: z.string().uuid(),
  action: z.string(),
  entity_type: z.string(), // 'workspace', 'subscription', 'contract', 'user', 'config'
  entity_id: z.string().uuid().nullish(),
  details: z.record(z.unknown()).default({}),
  ip_address: z.string().nullish(),
  created_at: z.string().datetime(),
});
export type PlatformAuditLog = z.infer<typeof PlatformAuditLogSchema>;

// ─── Platform Impersonation Log ────────────────────────────────

export const PlatformImpersonationLogSchema = z.object({
  id: z.string().uuid(),
  super_admin_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
  target_workspace_id: z.string().uuid(),
  reason: z.string().min(1),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullish(),
  actions_taken: z.array(z.unknown()).default([]),
});
export type PlatformImpersonationLog = z.infer<typeof PlatformImpersonationLogSchema>;

// ─── Landing Config ────────────────────────────────────────────

export const LandingConfigSchema = z.object({
  config_id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  locale: z.string().default("no"),
  status: z.string(), // 'draft', 'published', 'archived'
  config_json: z.record(z.unknown()),
  published_json: z.record(z.unknown()).nullish(),
  version: z.number().int().default(1),
  created_by: z.string().uuid().nullish(),
  updated_by: z.string().uuid().nullish(),
  published_at: z.string().datetime().nullish(),
  published_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type LandingConfig = z.infer<typeof LandingConfigSchema>;

export const LandingConfigVersionSchema = z.object({
  version_id: z.string().uuid(),
  config_id: z.string().uuid(),
  version: z.number().int(),
  config_json: z.record(z.unknown()),
  change_notes: z.string().nullish(),
  created_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
});
export type LandingConfigVersion = z.infer<typeof LandingConfigVersionSchema>;

// ─── Platform Contract Template ────────────────────────────────

export const ContractVariableFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "date", "number", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});
export type ContractVariableField = z.infer<typeof ContractVariableFieldSchema>;

export const PlatformContractTemplateSchema = z.object({
  template_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  docuseal_template_id: z.string().nullish(),
  template_type: z.string(), // 'saas_agreement', 'dpa', 'sla', 'custom'
  locale: z.string().default("no"),
  status: z.string(), // 'draft', 'active', 'archived'
  variable_fields: z.array(ContractVariableFieldSchema).default([]),
  created_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type PlatformContractTemplate = z.infer<typeof PlatformContractTemplateSchema>;

// ─── Platform Contract Instance ────────────────────────────────

export const ContractSignatorySchema = z.object({
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  signed_at: z.string().datetime().nullish(),
});
export type ContractSignatory = z.infer<typeof ContractSignatorySchema>;

export const PlatformContractInstanceSchema = z.object({
  contract_id: z.string().uuid(),
  template_id: z.string().uuid().nullish(),
  company_id: z.string().uuid(),
  workspace_id: z.string().uuid().nullish(),
  title: z.string().min(1),
  status: z.string(), // 'draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled'
  docuseal_submission_id: z.string().nullish(),
  field_values: z.record(z.unknown()).default({}),
  signatories: z.array(ContractSignatorySchema).default([]),
  sent_at: z.string().datetime().nullish(),
  signed_at: z.string().datetime().nullish(),
  expires_at: z.string().datetime().nullish(),
  document_url: z.string().nullish(),
  created_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type PlatformContractInstance = z.infer<typeof PlatformContractInstanceSchema>;

// ─── Platform Metrics Daily ────────────────────────────────────

export const PlatformMetricsDailySchema = z.object({
  date: z.string(),
  total_users: z.number().int(),
  total_companies: z.number().int(),
  total_workspaces: z.number().int(),
  total_profiles: z.number().int(),
  new_users_today: z.number().int(),
  new_workspaces_today: z.number().int(),
  subscriptions_trial: z.number().int(),
  subscriptions_active: z.number().int(),
  subscriptions_paused: z.number().int(),
  subscriptions_past_due: z.number().int(),
  subscriptions_cancelled: z.number().int(),
  mrr_nok: z.number(),
  active_workspaces_24h: z.number().int(),
  sessions_created_24h: z.number().int(),
  tasks_completed_24h: z.number().int(),
  signups_to_workspace: z.number().nullish(),
  workspace_to_invite: z.number().nullish(),
  invite_to_session: z.number().nullish(),
  computed_at: z.string().datetime(),
});
export type PlatformMetricsDaily = z.infer<typeof PlatformMetricsDailySchema>;
```

**Step 3: Add to barrel export**

In `packages/types/src/index.ts`, add:

```typescript
export * from "./platform";
```

**Step 4: Commit**

```bash
git add packages/types/src/platform.ts packages/types/src/identity.ts packages/types/src/index.ts
git commit -m "feat(types): add platform admin Zod schemas (Module 17)"
```

---

### Task 4: Platform Admin Auth Helper + Middleware Guard

**Files:**

- Create: `apps/web/src/lib/platform-admin.ts`
- Modify: `apps/web/src/middleware.ts`

**Context:** Middleware uses `@supabase/ssr` `createServerClient` with cookies for auth. The admin client from `packages/supabase/src/admin.ts` can't be used in Edge Runtime middleware (it uses Node.js `createClient`). Instead, inline the service role check in middleware. The helper file is for use in server components and route handlers.

**Step 1: Create the platform-admin auth helper**

Create `apps/web/src/lib/platform-admin.ts`:

```typescript
import { createAdminClient } from "@smartout/supabase/admin";
import { createClient } from "@smartout/supabase/server";

/**
 * Check if the current user is a super admin.
 * Use in server components and route handlers (NOT middleware).
 * Returns the user_id if super admin, null otherwise.
 */
export async function getSuperAdminId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_identity")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .single();

  return data?.is_super_admin ? user.id : null;
}

/**
 * Log a platform admin action to the audit log.
 */
export async function logPlatformAction(
  superAdminId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  await admin.from("platform_audit_log").insert({
    super_admin_id: superAdminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}
```

**Step 2: Update middleware**

Replace `apps/web/src/middleware.ts` with:

```typescript
import { updateSession } from "@smartout/supabase/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Update the session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await updateSession(request as any);

  // Example redirect: If accessing root, go to dashboard
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Platform-admin route protection
  if (request.nextUrl.pathname.startsWith("/platform-admin")) {
    // Get current user from session cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(
            cookiesToSet: {
              name: string;
              value: string;
              options: CookieOptions;
            }[],
          ) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Check super-admin flag via service role (bypasses RLS)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: identity } = await adminClient
      .from("user_identity")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .single();

    if (!identity?.is_super_admin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/platform-admin.ts apps/web/src/middleware.ts
git commit -m "feat: add super-admin middleware guard and audit helper"
```

---

### Task 5: Install Missing Dependencies

**Step 1: Install TanStack Table and Recharts**

Run from repo root:

```bash
pnpm --filter web add @tanstack/react-table recharts
```

**Step 2: Install shadcn/ui components**

Run from `apps/web` directory:

```bash
npx shadcn@latest add table badge card tabs sheet separator dropdown-menu input select button tooltip
```

Note: `dialog.tsx` already exists — skip if prompted.

**Step 3: Verify components installed**

Run: `ls apps/web/src/components/ui/`
Expected: `table.tsx`, `badge.tsx`, `card.tsx`, `tabs.tsx`, `sheet.tsx`, `separator.tsx`, `dropdown-menu.tsx`, `input.tsx`, `select.tsx`, `button.tsx`, `tooltip.tsx`, `dialog.tsx`

**Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/components/ui/ pnpm-lock.yaml
git commit -m "feat: install TanStack Table, Recharts, and shadcn/ui components"
```

---

### Task 6: Platform Admin Layout Shell

**Files:**

- Create: `apps/web/src/app/platform-admin/layout.tsx`
- Create: `apps/web/src/app/platform-admin/page.tsx`
- Create: `apps/web/src/components/platform-admin/sidebar-nav.tsx`

**Context:** The existing dashboard layout is `"use client"` with state management. Platform admin should be simpler — prefer server components. The layout uses the dark theme CSS variables from `globals.css` (`.dark` class).

**Step 1: Create sidebar navigation**

Create `apps/web/src/components/platform-admin/sidebar-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  FileText,
  FileSignature,
  Activity,
  Users,
  ScrollText,
} from "lucide-react";

const navItems = [
  { href: "/platform-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform-admin/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/platform-admin/billing", label: "Billing", icon: CreditCard },
  { href: "/platform-admin/content", label: "Content", icon: FileText },
  { href: "/platform-admin/contracts", label: "Contracts", icon: FileSignature },
  { href: "/platform-admin/health", label: "Health", icon: Activity },
  { href: "/platform-admin/users", label: "Users", icon: Users },
  { href: "/platform-admin/audit", label: "Audit Log", icon: ScrollText },
];

export function PlatformAdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      <div className="mb-4 px-3 py-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Platform Admin
        </h2>
      </div>
      {navItems.map((item) => {
        const isActive =
          item.href === "/platform-admin/dashboard"
            ? pathname === "/platform-admin/dashboard" || pathname === "/platform-admin"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 2: Create layout** (uses CSS variables, not hardcoded zinc colors)

Create `apps/web/src/app/platform-admin/layout.tsx`:

```tsx
import { PlatformAdminSidebarNav } from "@/components/platform-admin/sidebar-nav";

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-background text-foreground flex h-screen">
      <aside className="border-border bg-background w-56 shrink-0 border-r">
        <PlatformAdminSidebarNav />
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

**Step 3: Create root redirect**

Create `apps/web/src/app/platform-admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function PlatformAdminPage() {
  redirect("/platform-admin/dashboard");
}
```

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/ apps/web/src/components/platform-admin/
git commit -m "feat: add platform-admin layout shell with sidebar navigation"
```

---

### Task 7: Placeholder Pages + Reusable DataTable

**Files:**

- Create: `apps/web/src/app/platform-admin/dashboard/page.tsx`
- Create: `apps/web/src/app/platform-admin/workspaces/page.tsx`
- Create: `apps/web/src/app/platform-admin/billing/page.tsx`
- Create: `apps/web/src/app/platform-admin/content/page.tsx`
- Create: `apps/web/src/app/platform-admin/contracts/page.tsx`
- Create: `apps/web/src/app/platform-admin/health/page.tsx`
- Create: `apps/web/src/app/platform-admin/users/page.tsx`
- Create: `apps/web/src/app/platform-admin/audit/page.tsx`
- Create: `apps/web/src/components/platform-admin/data-table.tsx`

**Step 1: Create the reusable DataTable**

Create `apps/web/src/components/platform-admin/data-table.tsx`:

```tsx
"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="border-border rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-xs font-medium tracking-wider uppercase">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={onRowClick ? "cursor-pointer" : ""}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 2: Create all 8 placeholder pages**

Each page is a simple server component:

```tsx
// Pattern for each page — change title/description per route
export default function XxxPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">[Title]</h1>
      <p className="text-muted-foreground mt-2">[Description] coming soon.</p>
    </div>
  );
}
```

Pages to create with their titles:

- `dashboard/page.tsx` → "Dashboard" / "Platform overview"
- `workspaces/page.tsx` → "Workspaces" / "All workspaces across the platform"
- `billing/page.tsx` → "Billing" / "Subscription and revenue overview"
- `content/page.tsx` → "Content" / "Landing page configurations"
- `contracts/page.tsx` → "Contracts" / "Platform contract management"
- `health/page.tsx` → "Health" / "Platform metrics and system health"
- `users/page.tsx` → "Users" / "All platform users"
- `audit/page.tsx` → "Audit Log" / "Super-admin action history"

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/ apps/web/src/components/platform-admin/data-table.tsx
git commit -m "feat: add placeholder pages and reusable DataTable component"
```

---

## Phase 2: Workspace Overview

### Task 8: Workspace List — Server Component with DataTable

**Files:**

- Modify: `apps/web/src/app/platform-admin/workspaces/page.tsx`
- Create: `apps/web/src/components/platform-admin/workspace-columns.tsx`

**Context:** Subscription data is on `company` table (`subscription_plan`, `subscription_status`). There is NO `stripe_subscription` table. Join workspace → company via `company_id`.

**Step 1: Create workspace column definitions**

Create `apps/web/src/components/platform-admin/workspace-columns.tsx`:

```tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export type WorkspaceRow = {
  workspace_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  company: {
    company_id: string;
    name: string;
    org_number: string;
    subscription_plan: string | null;
    subscription_status: string | null;
  } | null;
};

const statusVariant: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  trial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  past_due: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  paused: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export const workspaceColumns: ColumnDef<WorkspaceRow>[] = [
  {
    accessorKey: "name",
    header: "Workspace",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorFn: (row) => row.company?.name,
    id: "company",
    header: "Company",
  },
  {
    accessorFn: (row) => row.company?.org_number,
    id: "org_number",
    header: "Org.nr",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground font-mono text-xs">{getValue() as string}</span>
    ),
  },
  {
    accessorFn: (row) => row.company?.subscription_plan || "—",
    id: "plan",
    header: "Plan",
    cell: ({ getValue }) => {
      const plan = getValue() as string;
      return plan !== "—" ? (
        <Badge variant="outline" className="text-xs capitalize">
          {plan}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorFn: (row) => row.company?.subscription_status || "unknown",
    id: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string;
      return (
        <Badge
          variant="outline"
          className={`text-xs capitalize ${statusVariant[status] || statusVariant.paused}`}
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("no-NO"),
  },
];
```

**Step 2: Update workspaces page as server component**

Replace `apps/web/src/app/platform-admin/workspaces/page.tsx`:

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { WorkspaceListClient } from "@/components/platform-admin/workspace-list-client";

export default async function WorkspacesPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: workspaces } = await admin
    .from("workspace")
    .select(
      `workspace_id, name, slug, is_active, created_at,
       company:company_id (company_id, name, org_number, subscription_plan, subscription_status)`,
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <p className="text-muted-foreground mt-1 text-sm">All workspaces across the platform</p>
      <div className="mt-6">
        <WorkspaceListClient data={workspaces || []} />
      </div>
    </div>
  );
}
```

**Step 3: Create the client wrapper** (DataTable needs `"use client"`)

Create `apps/web/src/components/platform-admin/workspace-list-client.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "./data-table";
import { workspaceColumns, type WorkspaceRow } from "./workspace-columns";

export function WorkspaceListClient({ data }: { data: WorkspaceRow[] }) {
  const router = useRouter();

  return (
    <DataTable
      columns={workspaceColumns}
      data={data}
      onRowClick={(row) => router.push(`/platform-admin/workspaces/${row.workspace_id}`)}
    />
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/workspaces/ apps/web/src/components/platform-admin/
git commit -m "feat: add workspace list page with server-fetched DataTable"
```

---

### Task 9: Workspace Detail Page

**Files:**

- Create: `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx`

**Context:** Profile count uses `status` enum (not `is_active`). Company data comes from the join. `department` table has `workspace_id`.

**Step 1: Create workspace detail page** (server component)

Create `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx`:

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const { id } = await params;
  const admin = createAdminClient();

  const { data: workspace } = await admin
    .from("workspace")
    .select("*, company:company_id (*)")
    .eq("workspace_id", id)
    .single();

  if (!workspace) redirect("/platform-admin/workspaces");

  // Parallel count queries using profile.status enum
  const [
    { count: totalProfiles },
    { count: activeProfiles },
    { count: traineeProfiles },
    { count: departmentCount },
  ] = await Promise.all([
    admin.from("profile").select("*", { count: "exact", head: true }).eq("workspace_id", id),
    admin
      .from("profile")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", id)
      .eq("status", "active"),
    admin
      .from("profile")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", id)
      .eq("status", "trainee"),
    admin.from("department").select("*", { count: "exact", head: true }).eq("workspace_id", id),
  ]);

  const company = workspace.company as Record<string, unknown> | null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <Badge variant="outline" className="capitalize">
          {(company?.subscription_status as string) || "unknown"}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Profiles</p>
          <p className="text-2xl font-semibold">{totalProfiles || 0}</p>
          <p className="text-muted-foreground text-xs">
            {activeProfiles || 0} active, {traineeProfiles || 0} trainee
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Departments</p>
          <p className="text-2xl font-semibold">{departmentCount || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Plan</p>
          <p className="text-2xl font-semibold capitalize">
            {(company?.subscription_plan as string) || "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Created</p>
          <p className="text-lg font-semibold">
            {new Date(workspace.created_at).toLocaleDateString("no-NO")}
          </p>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-medium">Company Info</h2>
        <div className="border-border rounded-md border p-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{(company?.name as string) || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Org Number</dt>
              <dd className="font-mono">{(company?.org_number as string) || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">City</dt>
              <dd>{(company?.city as string) || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Industry</dt>
              <dd className="capitalize">{(company?.industry as string) || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{(company?.email as string) || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{(company?.phone as string) || "—"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/workspaces/
git commit -m "feat: add workspace detail page with stats and company info"
```

---

## Phase 3: Dashboard

### Task 10: Dashboard with KPI Cards

**Files:**

- Modify: `apps/web/src/app/platform-admin/dashboard/page.tsx`

**Context:** KPIs query `company.subscription_status` (text column, NOT an enum). Recent workspaces join to `company` for status.

**Step 1: Replace dashboard page** (server component with parallel queries)

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Building2, Users, CreditCard, AlertTriangle, PlayCircle } from "lucide-react";

export default async function DashboardPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const [
    { count: totalWorkspaces },
    { count: totalUsers },
    { count: trialCount },
    { count: activeCount },
    { count: pastDueCount },
    { data: recentWorkspaces },
  ] = await Promise.all([
    admin.from("workspace").select("*", { count: "exact", head: true }),
    admin.from("user_identity").select("*", { count: "exact", head: true }),
    admin
      .from("company")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "trial"),
    admin
      .from("company")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "active"),
    admin
      .from("company")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "past_due"),
    admin
      .from("workspace")
      .select("workspace_id, name, created_at, company:company_id (name, subscription_status)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const kpis = [
    { label: "Workspaces", value: totalWorkspaces || 0, icon: Building2 },
    { label: "Users", value: totalUsers || 0, icon: Users },
    { label: "Active Subs", value: activeCount || 0, icon: CreditCard },
    { label: "Trials", value: trialCount || 0, icon: PlayCircle },
    {
      label: "At Risk",
      value: pastDueCount || 0,
      icon: AlertTriangle,
      danger: (pastDueCount || 0) > 0,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground mt-1 text-sm">Platform overview</p>

      <div className="mt-6 grid grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className={`p-4 ${kpi.danger ? "border-destructive/30" : ""}`}>
              <div className="flex items-center gap-2">
                <Icon className="text-muted-foreground h-4 w-4" />
                <p className="text-muted-foreground text-xs tracking-wider uppercase">
                  {kpi.label}
                </p>
              </div>
              <p className={`mt-2 text-3xl font-semibold ${kpi.danger ? "text-destructive" : ""}`}>
                {kpi.value}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-medium">Recent Workspaces</h2>
        <div className="border-border rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                <th className="px-4 py-3">Workspace</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentWorkspaces?.map((ws) => (
                <tr key={ws.workspace_id} className="border-border border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{ws.name}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {(ws.company as { name: string } | null)?.name || "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 capitalize">
                    {(ws.company as { subscription_status: string } | null)?.subscription_status ||
                      "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Date(ws.created_at).toLocaleDateString("no-NO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/dashboard/
git commit -m "feat: add platform dashboard with KPI cards and recent workspaces"
```

---

## Phase 4: Audit Log

### Task 11: Audit Log Page

**Files:**

- Modify: `apps/web/src/app/platform-admin/audit/page.tsx`
- Create: `apps/web/src/components/platform-admin/audit-columns.tsx`
- Create: `apps/web/src/components/platform-admin/audit-list-client.tsx`

**Step 1: Create audit column definitions**

Create `apps/web/src/components/platform-admin/audit-columns.tsx`:

```tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  admin: {
    first_name: string;
    last_name: string;
  } | null;
};

const entityColors: Record<string, string> = {
  workspace: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  subscription: "bg-green-500/10 text-green-400 border-green-500/20",
  contract: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  user: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  config: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export const auditColumns: ColumnDef<AuditRow>[] = [
  {
    accessorKey: "created_at",
    header: "Timestamp",
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleString("no-NO", {
        dateStyle: "short",
        timeStyle: "medium",
      }),
  },
  {
    accessorFn: (row) => (row.admin ? `${row.admin.first_name} ${row.admin.last_name}` : "System"),
    id: "admin",
    header: "Admin",
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
  },
  {
    accessorKey: "entity_type",
    header: "Entity",
    cell: ({ getValue }) => {
      const type = getValue() as string;
      return (
        <Badge variant="outline" className={`text-xs capitalize ${entityColors[type] || ""}`}>
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "entity_id",
    header: "Entity ID",
    cell: ({ getValue }) => {
      const id = getValue() as string | null;
      return id ? (
        <span className="text-muted-foreground font-mono text-xs">{id.slice(0, 8)}...</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
];
```

**Step 2: Create client wrapper**

Create `apps/web/src/components/platform-admin/audit-list-client.tsx`:

```tsx
"use client";

import { DataTable } from "./data-table";
import { auditColumns, type AuditRow } from "./audit-columns";

export function AuditListClient({ data }: { data: AuditRow[] }) {
  return <DataTable columns={auditColumns} data={data} />;
}
```

**Step 3: Update audit page** (server component)

Replace `apps/web/src/app/platform-admin/audit/page.tsx`:

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { AuditListClient } from "@/components/platform-admin/audit-list-client";
import type { AuditRow } from "@/components/platform-admin/audit-columns";

export default async function AuditPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: auditLogs } = await admin
    .from("platform_audit_log")
    .select(
      `id, action, entity_type, entity_id, details, created_at,
       admin:super_admin_id (first_name, last_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="text-muted-foreground mt-1 text-sm">All super-admin actions</p>
      <div className="mt-6">
        <AuditListClient data={(auditLogs as unknown as AuditRow[]) || []} />
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/audit/ apps/web/src/components/platform-admin/audit-*
git commit -m "feat: add audit log page with filterable DataTable"
```

---

## Phase 5: Users + Billing + Health (Read-Only)

### Task 12: Users Page

**Files:**

- Modify: `apps/web/src/app/platform-admin/users/page.tsx`

**Context:** Users are in `user_identity` table. `is_super_admin` column added by migration 00013.

**Step 1: Replace users page** (server component)

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default async function UsersPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: users } = await admin
    .from("user_identity")
    .select(
      "user_id, email, first_name, last_name, is_super_admin, is_active, last_login_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-muted-foreground mt-1 text-sm">All platform users</p>

      <div className="border-border mt-6 rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.user_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">
                  {user.first_name} {user.last_name}
                </td>
                <td className="text-muted-foreground px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  {user.is_super_admin && (
                    <Badge
                      variant="outline"
                      className="border-purple-500/20 bg-purple-500/10 text-xs text-purple-400"
                    >
                      Super Admin
                    </Badge>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleDateString("no-NO")
                    : "Never"}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {new Date(user.created_at).toLocaleDateString("no-NO")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/users/
git commit -m "feat: add users management page for platform admin"
```

---

### Task 13: Billing Page (Read-Only)

**Files:**

- Modify: `apps/web/src/app/platform-admin/billing/page.tsx`

**Context:** All subscription data is on `company` table: `subscription_plan` (text, nullable), `subscription_status` (text, default 'trial'), `trial_ends_at` (timestamptz, nullable).

**Step 1: Replace billing page**

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function BillingPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: companies } = await admin
    .from("company")
    .select(
      "company_id, name, org_number, subscription_plan, subscription_status, trial_ends_at, created_at",
    )
    .order("created_at", { ascending: false });

  const statusColor: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    trial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    past_due: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    paused: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  const active = companies?.filter((c) => c.subscription_status === "active").length || 0;
  const trial = companies?.filter((c) => c.subscription_status === "trial").length || 0;
  const pastDue = companies?.filter((c) => c.subscription_status === "past_due").length || 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="text-muted-foreground mt-1 text-sm">Subscription and revenue overview</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Active</p>
          <p className="text-3xl font-semibold text-green-400">{active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Trial</p>
          <p className="text-3xl font-semibold text-blue-400">{trial}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Past Due</p>
          <p className={`text-3xl font-semibold ${pastDue > 0 ? "text-destructive" : ""}`}>
            {pastDue}
          </p>
        </Card>
      </div>

      <div className="border-border mt-8 rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Org.nr</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial Ends</th>
            </tr>
          </thead>
          <tbody>
            {companies?.map((c) => (
              <tr key={c.company_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                  {c.org_number}
                </td>
                <td className="px-4 py-3 capitalize">{c.subscription_plan || "—"}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${statusColor[c.subscription_status || ""] || ""}`}
                  >
                    {c.subscription_status || "unknown"}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {c.trial_ends_at ? new Date(c.trial_ends_at).toLocaleDateString("no-NO") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/
git commit -m "feat: add read-only billing overview using company subscription data"
```

---

### Task 14: Health Page

**Files:**

- Modify: `apps/web/src/app/platform-admin/health/page.tsx`

**Step 1: Replace health page** (reads from `platform_metrics_daily` if populated, otherwise live counts)

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

export default async function HealthPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: metrics } = await admin
    .from("platform_metrics_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Platform Health</h1>
      <p className="text-muted-foreground mt-1 text-sm">Metrics and system health overview</p>

      {metrics ? (
        <>
          <div className="mt-6 grid grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Total Users</p>
              <p className="text-2xl font-semibold">{metrics.total_users}</p>
              <p className="text-muted-foreground text-xs">+{metrics.new_users_today} today</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Workspaces</p>
              <p className="text-2xl font-semibold">{metrics.total_workspaces}</p>
              <p className="text-muted-foreground text-xs">+{metrics.new_workspaces_today} today</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Active 24h</p>
              <p className="text-2xl font-semibold">{metrics.active_workspaces_24h}</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">MRR (NOK)</p>
              <p className="text-2xl font-semibold">
                {Number(metrics.mrr_nok).toLocaleString("no-NO")}
              </p>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-5 gap-4">
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Trial</p>
              <p className="text-xl font-semibold text-blue-400">{metrics.subscriptions_trial}</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Active</p>
              <p className="text-xl font-semibold text-green-400">{metrics.subscriptions_active}</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Paused</p>
              <p className="text-xl font-semibold">{metrics.subscriptions_paused}</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Past Due</p>
              <p className="text-xl font-semibold text-orange-400">
                {metrics.subscriptions_past_due}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Cancelled</p>
              <p className="text-destructive text-xl font-semibold">
                {metrics.subscriptions_cancelled}
              </p>
            </Card>
          </div>

          <p className="text-muted-foreground mt-4 text-xs">
            Last computed: {new Date(metrics.computed_at).toLocaleString("no-NO")}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground mt-6">
          No metrics data. Run <code className="text-xs">SELECT compute_platform_metrics()</code> in
          Supabase SQL editor to populate.
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/health/
git commit -m "feat: add platform health page with daily metrics display"
```

---

## Phase 6: Content + Contracts (API Routes)

### Task 15: Create ADR for New Dependencies

**Files:**

- Create: `docs/decisions/0017-tanstack-table-recharts-platform-admin.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Context:** ADR enforcement in CLAUDE.md requires an ADR when adding new packages. This plan adds `@tanstack/react-table` and `recharts`.

**Step 1: Create ADR using `docs/decisions/template.md`**

Title: "TanStack Table and Recharts for Platform Admin"

Key points:

- **Context:** Platform admin needs sortable data tables and metric visualizations
- **Decision:** Use `@tanstack/react-table` for headless tables (composable with shadcn/ui `<Table>`) and `recharts` for charts (React-native, SSR-safe)
- **Alternatives considered:** Raw HTML tables (insufficient for sorting/filtering), AG Grid (overkill, heavy), Nivo (heavier than Recharts, less React-idiomatic)
- **Consequences:** Two new runtime deps scoped to `apps/web`. Both are tree-shakeable. Recharts components should be lazy-loaded via `next/dynamic` per performance rules.

**Step 2: Add entry to decision log**

Add to `docs/decisions/0000-decision-log.md`:

```markdown
| ADR-0017 | 27-02-2026 | [TanStack Table and Recharts for Platform Admin](./0017-tanstack-table-recharts-platform-admin.md) | **Accepted** |
```

**Step 3: Commit**

```bash
git add docs/decisions/0017-tanstack-table-recharts-platform-admin.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): ADR-0017 TanStack Table and Recharts for platform admin"
```

---

### Task 16: Landing Config API Routes

**Files:**

- Create: `apps/web/src/app/api/platform-admin/content/configs/route.ts`
- Create: `apps/web/src/app/api/platform-admin/content/configs/[slug]/route.ts`
- Create: `apps/web/src/app/api/platform-admin/content/configs/[slug]/publish/route.ts`
- Create: `apps/web/src/app/api/content/[slug]/route.ts` (public, no auth)

**Step 1: Create list + create route**

Create `apps/web/src/app/api/platform-admin/content/configs/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const CreateConfigSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  locale: z.string().default("no"),
  config_json: z.record(z.unknown()),
});

export async function GET() {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("landing_config")
    .select("config_id, slug, name, locale, status, version, published_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = CreateConfigSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("landing_config")
    .insert({
      ...body.data,
      created_by: adminId,
      updated_by: adminId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(adminId, "create_config", "config", data.config_id, {
    slug: body.data.slug,
  });

  return NextResponse.json({ data }, { status: 201 });
}
```

**Step 2: Create single config + update route**

Create `apps/web/src/app/api/platform-admin/content/configs/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const UpdateConfigSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config_json: z.record(z.unknown()).optional(),
  locale: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin.from("landing_config").select("*").eq("slug", slug).single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const body = UpdateConfigSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("landing_config")
    .update({ ...body.data, updated_by: adminId })
    .eq("slug", slug)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logPlatformAction(adminId, "update_config", "config", data.config_id, {
    slug,
    fields: Object.keys(body.data),
  });

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("landing_config")
    .update({ status: "archived", updated_by: adminId })
    .eq("slug", slug)
    .select("config_id")
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logPlatformAction(adminId, "archive_config", "config", data.config_id, { slug });

  return NextResponse.json({ success: true });
}
```

**Step 3: Create publish route**

Create `apps/web/src/app/api/platform-admin/content/configs/[slug]/publish/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const admin = createAdminClient();

  // Get current config
  const { data: config, error: fetchError } = await admin
    .from("landing_config")
    .select("config_id, config_json, version")
    .eq("slug", slug)
    .single();

  if (fetchError || !config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newVersion = config.version + 1;

  // Save version snapshot and publish in parallel
  const [versionResult, publishResult] = await Promise.all([
    admin.from("landing_config_version").insert({
      config_id: config.config_id,
      version: newVersion,
      config_json: config.config_json,
      created_by: adminId,
    }),
    admin
      .from("landing_config")
      .update({
        published_json: config.config_json,
        status: "published",
        version: newVersion,
        published_at: new Date().toISOString(),
        published_by: adminId,
        updated_by: adminId,
      })
      .eq("slug", slug),
  ]);

  if (versionResult.error || publishResult.error) {
    return NextResponse.json(
      { error: versionResult.error?.message || publishResult.error?.message },
      { status: 500 },
    );
  }

  await logPlatformAction(adminId, "publish_config", "config", config.config_id, {
    slug,
    version: newVersion,
  });

  return NextResponse.json({ success: true, version: newVersion });
}
```

**Step 4: Create public endpoint** (no auth — used by landing app)

Create `apps/web/src/app/api/content/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("landing_config")
    .select("slug, name, locale, published_json, published_at, version")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !data || !data.published_json) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: data.slug,
    name: data.name,
    locale: data.locale,
    content: data.published_json,
    version: data.version,
    published_at: data.published_at,
  });
}
```

**Step 5: Commit**

```bash
git add apps/web/src/app/api/platform-admin/content/ apps/web/src/app/api/content/
git commit -m "feat: add landing config CRUD, publish, and public API routes"
```

---

### Task 17: Content List Page + Contracts List Page

**Files:**

- Modify: `apps/web/src/app/platform-admin/content/page.tsx`
- Modify: `apps/web/src/app/platform-admin/contracts/page.tsx`

**Context:** Table names are `landing_config` and `platform_contract_instance` (NOT `contract_instance`) — to avoid confusion with the existing `employment_contract` table.

**Step 1: Replace content page** (server component)

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default async function ContentPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: configs } = await admin
    .from("landing_config")
    .select("config_id, slug, name, locale, status, version, published_at, updated_at")
    .order("updated_at", { ascending: false });

  const statusColor: Record<string, string> = {
    draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    published: "bg-green-500/10 text-green-400 border-green-500/20",
    archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Content</h1>
      <p className="text-muted-foreground mt-1 text-sm">Landing page configurations</p>

      <div className="border-border mt-6 rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Locale</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Published</th>
            </tr>
          </thead>
          <tbody>
            {configs?.map((config) => (
              <tr key={config.config_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">{config.name}</td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">{config.slug}</td>
                <td className="text-muted-foreground px-4 py-3 uppercase">{config.locale}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${statusColor[config.status] || ""}`}
                  >
                    {config.status}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-4 py-3">v{config.version}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {config.published_at
                    ? new Date(config.published_at).toLocaleDateString("no-NO")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Replace contracts page** (server component)

```tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default async function ContractsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: contracts } = await admin
    .from("platform_contract_instance")
    .select(
      `contract_id, title, status, sent_at, signed_at, expires_at, created_at,
       company:company_id (name),
       template:template_id (name, template_type)`,
    )
    .order("created_at", { ascending: false });

  const statusColor: Record<string, string> = {
    draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    viewed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    signed: "bg-green-500/10 text-green-400 border-green-500/20",
    expired: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Contracts</h1>
      <p className="text-muted-foreground mt-1 text-sm">Platform contract management</p>

      <div className="border-border mt-6 rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Signed</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody>
            {contracts?.map((contract) => (
              <tr key={contract.contract_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">{contract.title}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {(contract.company as { name: string } | null)?.name || "—"}
                </td>
                <td className="text-muted-foreground px-4 py-3 capitalize">
                  {(
                    (contract.template as { template_type: string } | null)?.template_type || "—"
                  ).replace("_", " ")}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${statusColor[contract.status] || ""}`}
                  >
                    {contract.status}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {contract.signed_at
                    ? new Date(contract.signed_at).toLocaleDateString("no-NO")
                    : "—"}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {contract.expires_at
                    ? new Date(contract.expires_at).toLocaleDateString("no-NO")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/content/ apps/web/src/app/platform-admin/contracts/
git commit -m "feat: add content list and contracts list pages"
```

---

### Task 18: DocuSeal Webhook Handler

**Files:**

- Create: `apps/web/src/app/api/webhooks/docuseal/route.ts`

**Context:** Handles DocuSeal signature events, updates `platform_contract_instance.status`, logs to audit. Uses `platform_contract_instance` table name.

**Step 1: Create webhook handler**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";

const DocuSealEventSchema = z.object({
  event_type: z.string(),
  timestamp: z.string(),
  data: z.object({
    id: z.number(),
    submission_id: z.number(),
    status: z.string(),
    documents: z
      .array(
        z.object({
          name: z.string(),
          url: z.string().url(),
        }),
      )
      .optional(),
    submitters: z
      .array(
        z.object({
          name: z.string().optional(),
          email: z.string().email(),
          role: z.string().optional(),
          completed_at: z.string().nullable().optional(),
        }),
      )
      .optional(),
  }),
});

const eventToStatus: Record<string, string> = {
  "form.viewed": "viewed",
  "form.started": "viewed",
  "form.completed": "signed",
  "submission.completed": "signed",
  "submission.expired": "expired",
};

export async function POST(request: NextRequest) {
  // Validate webhook signature if configured
  const webhookSecret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("x-docuseal-signature");
    if (signature !== webhookSecret) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const parsed = DocuSealEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { event_type, data } = parsed.data;
  const newStatus = eventToStatus[event_type];

  if (!newStatus) {
    // Event type not relevant — acknowledge silently
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();

  // Find contract by DocuSeal submission ID
  const { data: contract, error: findError } = await admin
    .from("platform_contract_instance")
    .select("contract_id, status")
    .eq("docuseal_submission_id", String(data.submission_id))
    .single();

  if (findError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Build update payload
  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "signed") {
    updates.signed_at = new Date().toISOString();

    // Store document URL if provided
    if (data.documents?.length) {
      updates.document_url = data.documents[0].url;
    }

    // Update signatories with completion timestamps
    if (data.submitters?.length) {
      updates.signatories = data.submitters.map((s) => ({
        name: s.name || "",
        email: s.email,
        role: s.role || "signer",
        signed_at: s.completed_at || null,
      }));
    }
  }

  const { error: updateError } = await admin
    .from("platform_contract_instance")
    .update(updates)
    .eq("contract_id", contract.contract_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Audit log (system action — no super_admin_id, use a sentinel)
  await admin.from("platform_audit_log").insert({
    super_admin_id: "00000000-0000-0000-0000-000000000000",
    action: `docuseal_${event_type}`,
    entity_type: "contract",
    entity_id: contract.contract_id,
    details: { event_type, submission_id: data.submission_id, new_status: newStatus },
  });

  return NextResponse.json({ received: true, status: newStatus });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/api/webhooks/
git commit -m "feat: add DocuSeal webhook handler for contract signature events"
```

---

## Summary

| Task | Phase                | Description                                        | Key Codebase Fact                                                                       |
| ---- | -------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1    | Foundation           | Migration (5 new tables + flag + metrics function) | Table is `user_identity`, enum `contract_status` taken, use `platform_contract_*` names |
| 2    | Foundation           | Admin client (`@smartout/supabase/admin`)          | Add export to `package.json`, uses `@supabase/supabase-js` directly                     |
| 3    | Foundation           | Platform Zod types                                 | Follow `identity.ts` pattern, add `is_super_admin` to `UserSchema`                      |
| 4    | Foundation           | Middleware + auth helper                           | Use `@supabase/ssr` in middleware, `@supabase/supabase-js` for admin check              |
| 5    | Foundation           | Install deps (TanStack Table, Recharts, shadcn)    | Only `dialog.tsx` exists, Tailwind v4 CSS-based                                         |
| 6    | Foundation           | Layout shell + sidebar                             | Use CSS variables (`text-muted-foreground`, `bg-background`), not hardcoded zinc        |
| 7    | Foundation           | Placeholders + DataTable                           | Reusable `DataTable<TData>` for all list pages                                          |
| 8    | Workspaces           | Workspace list                                     | Join `workspace` → `company` for subscription data (no `stripe_subscription` table)     |
| 9    | Workspaces           | Workspace detail                                   | `profile.status = 'active'` (enum), not `is_active` for counting                        |
| 10   | Dashboard            | KPI cards                                          | Query `company.subscription_status` (text column)                                       |
| 11   | Audit                | Audit log                                          | Join `platform_audit_log` → `user_identity` via `super_admin_id`                        |
| 12   | Users/Billing/Health | Users page                                         | `user_identity` table, `is_super_admin` boolean                                         |
| 13   | Users/Billing/Health | Billing (read-only)                                | `company` table has `subscription_plan/status/trial_ends_at`                            |
| 14   | Users/Billing/Health | Health page                                        | `platform_metrics_daily` + `compute_platform_metrics()` function                        |
| 15   | ADR                  | ADR-0017 for TanStack Table + Recharts             | MANDATORY per ADR enforcement rules — new deps require ADR                              |
| 16   | Content/Contracts    | Landing config APIs (full CRUD + publish + public) | `landing_config` table, publish copies `config_json` → `published_json`                 |
| 17   | Content/Contracts    | Content + Contracts list pages                     | Use `platform_contract_instance`, NOT `contract_instance`                               |
| 18   | Content/Contracts    | DocuSeal webhook                                   | Updates `platform_contract_instance.status`                                             |

---

## Not Covered (Future Plans)

- Stripe API billing actions (change plan, extend trial, add credit, pause, cancel)
- Full CMS section editor with drag-and-drop, live preview, theme editor
- Contract send flow (DocuSeal API integration)
- Impersonation (session-level with banner)
- Real-time activity feed (Supabase Realtime)
- Alerts panel (past-due, expiring trials)
- Recharts visualizations (MRR trends, funnels, heatmaps)
- CSV export

---

## Design Notes

### Hardcoded semantic colors in status badges

This plan uses hardcoded Tailwind color values (`text-green-400`, `bg-blue-500/10`, etc.) for status badge styling. CLAUDE.md prohibits hardcoded colors like `zinc-800` in favor of CSS variable classes (`bg-background`, `text-foreground`). However, semantic status colors (green=active, red=danger, blue=trial) don't have CSS variable equivalents in the theme. These are intentional deviations for status indicators only — all layout/theme colors use CSS variables correctly.

---

## Changelog

| Date       | Version | Change                                                                                                                                                                                                           | Author |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-02-27 | 1.0.0   | Initial plan                                                                                                                                                                                                     | Claude |
| 2026-02-27 | 1.1.0   | Added YAML frontmatter, changelog, ADR task (Task 15), fixed enum count (30→33), replaced `as any` with proper types, completed Tasks 15-18 with full implementation code, added design notes on semantic colors | Claude |
