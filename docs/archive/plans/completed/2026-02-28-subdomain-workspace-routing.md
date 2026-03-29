---
title: "Subdomain & Workspace Routing Implementation Plan"
id: PLAN_SUBDOMAIN
version: "1.0"
status: completed
layer: plan
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags:
  - plan
  - subdomain
  - routing
  - workspace
  - middleware
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Subdomain & Workspace Routing Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Execution Mode:** Agent Teams (4 teams, phased execution)

**Goal:** Enable workspace-scoped subdomain routing so every Smartout workspace gets its own URL: `{slug}.smartout.ai`

**Architecture:** Wildcard DNS + Next.js middleware subdomain detection + `x-workspace-slug` header injection. Dashboard layout split into Server Component (workspace query) + Client Component (UI shell). No URL rewriting — existing `/dashboard/...` routes stay unchanged.

**Tech Stack:** Next.js 16 middleware, Supabase Auth (cookie domain config), PostgreSQL (slug constraints + reserved slugs table), React Context (WorkspaceProvider)

**Spec:** `docs/architecture/SMARTOUT_Subdomain_Routing_Architecture.md`

---

## Architecture Decision: Header-Based vs URL Rewriting

The spec describes URL rewriting (`peppes.smartout.ai/dashboard` → internal `/workspace/peppes/dashboard`). After codebase audit, we use **header-based workspace context** instead:

| Approach            | URL Rewriting (spec)             | Header-Based (this plan)       |
| ------------------- | -------------------------------- | ------------------------------ |
| Internal route      | `/workspace/[slug]/dashboard`    | `/dashboard` (unchanged)       |
| Route files         | Must duplicate/move 20+ routes   | Zero file moves                |
| `usePathname()`     | Returns browser path either way  | Returns browser path           |
| NavItem hrefs       | Work (browser URLs don't change) | Work (unchanged)               |
| `ROUTE_MISSION_MAP` | Works                            | Works                          |
| Workspace context   | From URL param `[slug]`          | From `x-workspace-slug` header |
| Complexity          | High (route duplication)         | Low (layout split only)        |

**Why this works:** `NextResponse.rewrite()` doesn't change browser URLs anyway. Since workspace identity comes from the subdomain (not the path), internal route paths don't need the slug. The middleware injects `x-workspace-slug` as a header, and the dashboard server layout reads it.

---

## Current State (verified via codebase audit)

| Aspect                        | Status                    | Details                                                                                |
| ----------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| `workspace.slug` column       | Exists                    | Migration 00001, constraint is `UNIQUE(company_id, slug)` — need global `UNIQUE(slug)` |
| Slug generation               | Exists in RPC             | `activate_workspace_multidept` generates via regex, but no INSERT trigger              |
| `reserved_slug` table         | Missing                   | Need to create                                                                         |
| Slug CHECK constraint         | Missing                   | Need `'^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'`                                             |
| Seed slug `'hq'`              | Too short                 | Fails new CHECK (min 3 chars). Change to `'hq-workspace'`                              |
| Cookie domain config          | Missing                   | All 3 Supabase clients have no domain setting                                          |
| Subdomain middleware          | Missing                   | No Host header detection                                                               |
| WorkspaceProvider             | Missing                   | DashboardContext has hardcoded mock `workspaceData`                                    |
| Dashboard layout              | Client-only               | Needs server wrapper for header reading + DB query                                     |
| `NEXT_PUBLIC_ROOT_DOMAIN` env | Missing                   | Need for dev/prod domain detection                                                     |
| Portal / workspace selector   | Missing                   | No `select-workspace` page                                                             |
| Auth callback (web)           | Duplicate                 | Both `/auth/callback` and `/api/auth/callback` exist with identical code               |
| Auth callback (landing)       | Redirects to `/dashboard` | Default `next` param points to `/dashboard` on landing origin — breaks with subdomains |
| Landing `web-app-url.ts`      | Hardcoded fallback        | Falls back to `https://smartout-web.vercel.app` — needs `https://app.smartout.ai`      |
| Platform-admin redirects      | Point to `/dashboard`     | 12 files redirect to `/dashboard` — breaks on portal subdomain `app.smartout.ai`       |

---

## Impact Analysis: What Does NOT Need Changing

The header-based approach means these files work **unchanged**:

| File / Pattern                                                | Why It Works                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 40+ NavItem `href="/dashboard/..."` in layout                 | Browser-facing paths. Middleware handles subdomain → workspace mapping on every request |
| `ROUTE_MISSION_MAP` keys                                      | `usePathname()` returns browser path (`/dashboard/...`), not internal route             |
| `isActive()` helper                                           | Same — compares against browser pathname                                                |
| `isDashboardPage` check                                       | `pathname === "/dashboard"` still valid                                                 |
| `pathname === "/dashboard/schedule"` conditionals             | Same                                                                                    |
| `apps/web/src/components/dashboard/UserMenu.tsx` links        | `/dashboard/settings` and `/dashboard/my-cv` are browser paths                          |
| `apps/web/src/components/trial-banner.tsx` link               | `/dashboard/settings` is a browser path                                                 |
| `apps/web/src/app/login/page.tsx` `router.push("/dashboard")` | Navigates within current subdomain — middleware resolves workspace                      |
| `apps/web/src/app/invite/[token]/page.tsx` redirect           | Same — stays on current subdomain                                                       |
| `apps/web/src/app/api/auth/callback/route.ts`                 | Uses `${origin}${next}` — `origin` includes subdomain                                   |
| `apps/web/src/app/auth/callback/route.ts`                     | Same (duplicate file — cleanup noted separately)                                        |

---

## Complete File Manifest

### Files to CREATE (7)

| File                                                                | Team | Purpose                                           |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `apps/web/src/lib/subdomain.ts`                                     | 3    | Subdomain extraction utility                      |
| `apps/web/src/lib/workspace-context.tsx`                            | 4    | WorkspaceProvider + useWorkspace hook             |
| `apps/web/src/components/dashboard/DashboardShell.tsx`              | 4    | Client layout extracted from dashboard/layout.tsx |
| `apps/web/src/app/select-workspace/page.tsx`                        | 4    | Portal workspace selector                         |
| `apps/web/src/app/access-denied/page.tsx`                           | 4    | Access denied (no profile in workspace)           |
| `supabase/migrations/20260228200000_workspace_slug_constraints.sql` | 2    | Reserved slugs, global unique, trigger            |
| `docs/decisions/0021-subdomain-workspace-routing.md`                | 2    | ADR                                               |

### Files to MODIFY (10)

| File                                              | Team | Change                                                |
| ------------------------------------------------- | ---- | ----------------------------------------------------- |
| `apps/web/src/env.ts`                             | 1    | Add `NEXT_PUBLIC_ROOT_DOMAIN`                         |
| `packages/supabase/src/client.ts`                 | 1    | Cookie domain for cross-subdomain auth                |
| `packages/supabase/src/server.ts`                 | 1    | Cookie domain for cross-subdomain auth                |
| `packages/supabase/src/middleware.ts`             | 1    | Cookie domain for cross-subdomain auth                |
| `apps/web/src/middleware.ts`                      | 3    | Subdomain detection, header injection, portal routing |
| `apps/web/src/app/dashboard/layout.tsx`           | 4    | Split: server wrapper + client DashboardShell         |
| `apps/landing/src/lib/web-app-url.ts`             | 4    | Update production fallback URL                        |
| `apps/landing/src/app/api/auth/callback/route.ts` | 4    | Fix default redirect for subdomain routing            |
| `supabase/seed.sql`                               | 2    | Fix slug `'hq'` → `'hq-workspace'`                    |
| `docs/decisions/0000-decision-log.md`             | 2    | Add ADR-0021 entry                                    |

### Files to UPDATE AFTER (docs, post-implementation)

| File                                                           | Change                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `CLAUDE.md`                                                    | Add `NEXT_PUBLIC_ROOT_DOMAIN` env var, subdomain conventions, new routes |
| `docs/architecture/SMARTOUT_Subdomain_Routing_Architecture.md` | Update to reflect header-based approach                                  |

### Files NOT changing (verified safe)

| File                                             | Reason                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/login/page.tsx`                | `router.push("/dashboard")` works — stays on current subdomain                                       |
| `apps/web/src/app/invite/[token]/page.tsx`       | Same — `router.push("/dashboard")` stays on subdomain                                                |
| `apps/web/src/app/api/auth/callback/route.ts`    | Uses `${origin}${next}` — origin includes subdomain                                                  |
| `apps/web/src/app/auth/callback/route.ts`        | Same (duplicate — cleanup is separate concern)                                                       |
| `apps/web/src/components/dashboard/UserMenu.tsx` | `/dashboard/settings` is browser-facing path, works with subdomains                                  |
| `apps/web/src/components/trial-banner.tsx`       | `/dashboard/settings` is browser-facing path                                                         |
| 9 platform-admin page guards                     | `redirect("/dashboard")` → middleware catches portal `/dashboard` → redirects to `/select-workspace` |
| `apps/web/src/lib/security.ts`                   | No changes needed                                                                                    |
| `apps/web/src/app/api/telemetry/route.ts`        | `workspace_id` comes from payload, not routing                                                       |
| `apps/web/src/app/api/onboarding-agent/route.ts` | Session-based, no routing dependency                                                                 |

### Known Issues (out of scope, document for future)

| Issue                      | File                                       | Notes                          |
| -------------------------- | ------------------------------------------ | ------------------------------ |
| Duplicate auth callback    | `/auth/callback` + `/api/auth/callback`    | Identical files. Clean up one. |
| Signup page placeholder    | `apps/web/src/app/signup/page.tsx`         | `action="#"` — no real auth    |
| Reset password placeholder | `apps/web/src/app/reset-password/page.tsx` | Mocked logic                   |
| Invite page placeholder    | `apps/web/src/app/invite/[token]/page.tsx` | Mock UI, no token validation   |

---

## Team Structure & Phases

```
Phase 1 (parallel):  Team 1 (Infrastructure) + Team 2 (Database)
Phase 2 (sequential): Team 3 (Middleware) — depends on Team 1 (cookie domain)
Phase 3 (sequential): Team 4 (Workspace UI) — depends on Team 2 + Team 3
Phase 4:              Integration verification
```

---

## Team 1: Infrastructure — Auth & Cookie Domain

**Scope:** Supabase cookie domain configuration, environment variables
**Depends on:** Nothing — can start immediately
**Acceptance criteria:**

- Cookie domain = `.smartout.ai` in production, unset in local dev
- `NEXT_PUBLIC_ROOT_DOMAIN` env var available
- Local dev still works on `localhost:3050`

---

### Task 1.1: Add NEXT_PUBLIC_ROOT_DOMAIN environment variable

**Files:**

- Modify: `apps/web/src/env.ts`

**Step 1: Add env var to client validation**

In the `client` section of `createEnv()`, add:

```typescript
NEXT_PUBLIC_ROOT_DOMAIN: z.string().default("localhost"),
```

In `experimental__runtimeEnv`, add:

```typescript
NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
```

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/env.ts
git commit -m "feat(env): add NEXT_PUBLIC_ROOT_DOMAIN for subdomain routing"
```

---

### Task 1.2: Configure cookie domain on browser client

**Files:**

- Modify: `packages/supabase/src/client.ts`

**Step 1: Add cookie domain option**

Replace `packages/supabase/src/client.ts` entirely:

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

function getCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  return rootDomain && rootDomain !== "localhost" ? `.${rootDomain}` : undefined;
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: getCookieDomain(),
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @smartout/supabase typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/supabase/src/client.ts
git commit -m "feat(supabase): set cookie domain for cross-subdomain auth"
```

---

### Task 1.3: Configure cookie domain on server client

**Files:**

- Modify: `packages/supabase/src/server.ts`

**Step 1: Add cookie domain to setAll**

Replace `packages/supabase/src/server.ts` entirely:

```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

function getServerCookieDomain(): string | undefined {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain || rootDomain === "localhost") return undefined;
  return `.${rootDomain}`;
}

export async function createClient() {
  const cookieStore = await cookies();
  const cookieDomain = getServerCookieDomain();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              }),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @smartout/supabase typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/supabase/src/server.ts
git commit -m "feat(supabase): add cookie domain to server client"
```

---

### Task 1.4: Configure cookie domain in middleware client

**Files:**

- Modify: `packages/supabase/src/middleware.ts`

**Step 1: Add cookie domain to middleware setAll**

Replace `packages/supabase/src/middleware.ts` entirely:

```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

function getMiddlewareCookieDomain(): string | undefined {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain || rootDomain === "localhost") return undefined;
  return `.${rootDomain}`;
}

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const cookieDomain = getMiddlewareCookieDomain();

  const supabase = createServerClient<Database>(
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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            }),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @smartout/supabase typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/supabase/src/middleware.ts
git commit -m "feat(supabase): add cookie domain to middleware client"
```

---

## Team 2: Database — Workspace Slug Constraints & Reserved Slugs

**Scope:** Migration for global slug uniqueness, CHECK constraint, reserved_slug table, trigger, seed fix
**Depends on:** Nothing — can start immediately
**Acceptance criteria:**

- `workspace.slug` has global UNIQUE constraint
- Slug format CHECK: `'^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'`
- `reserved_slug` table populated with infrastructure subdomains
- Trigger auto-generates slug from name, validates against reserved slugs
- Seed passes with updated slug
- Types regenerated

---

### Task 2.1: Create the migration

**Files:**

- Create: `supabase/migrations/20260228200000_workspace_slug_constraints.sql`

**Step 1: Write migration file**

```sql
-- Migration: workspace_slug_constraints
-- Purpose: Global slug uniqueness, format validation, reserved slugs table,
--          auto-generation trigger for subdomain routing.
-- Spec: docs/architecture/SMARTOUT_Subdomain_Routing_Architecture.md

-- ============================================================================
-- 1. Reserved Slugs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reserved_slug (
  slug text PRIMARY KEY,
  reason text NOT NULL DEFAULT 'infrastructure',
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.reserved_slug IS 'Infrastructure subdomains that workspaces cannot claim';

INSERT INTO public.reserved_slug (slug, reason) VALUES
  ('app', 'Portal / workspace selector'),
  ('api', 'API gateway'),
  ('docs', 'Documentation site'),
  ('www', 'Root domain alias'),
  ('admin', 'Reserved for admin'),
  ('status', 'Status page'),
  ('voice', 'Voice AI service'),
  ('staging', 'Staging environment'),
  ('dev', 'Development environment'),
  ('mail', 'Email service'),
  ('smtp', 'Email transport'),
  ('ftp', 'File transfer'),
  ('cdn', 'Content delivery'),
  ('assets', 'Static assets'),
  ('static', 'Static files'),
  ('media', 'Media files'),
  ('blog', 'Blog'),
  ('help', 'Help center'),
  ('support', 'Customer support')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. Workspace Slug Constraints
-- ============================================================================

-- Drop existing per-company unique constraint
ALTER TABLE public.workspace
  DROP CONSTRAINT IF EXISTS workspace_company_id_slug_key;

-- Add global unique constraint
ALTER TABLE public.workspace
  ADD CONSTRAINT workspace_slug_unique UNIQUE (slug);

-- Add format validation (3-50 chars, lowercase alphanumeric + hyphens)
ALTER TABLE public.workspace
  ADD CONSTRAINT workspace_slug_format
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');

-- ============================================================================
-- 3. Slug Generation Trigger Function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_workspace_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter integer := 0;
BEGIN
  -- Only generate if slug is NULL or empty
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    IF EXISTS (SELECT 1 FROM public.reserved_slug WHERE slug = NEW.slug) THEN
      RAISE EXCEPTION 'Slug "%" is reserved and cannot be used', NEW.slug;
    END IF;
    RETURN NEW;
  END IF;

  -- Generate base slug from workspace name
  base_slug := lower(regexp_replace(
    regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  base_slug := left(base_slug, 50);

  IF length(base_slug) < 3 THEN
    base_slug := base_slug || '-ws';
  END IF;

  candidate := base_slug;

  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.reserved_slug WHERE slug = candidate)
       AND NOT EXISTS (SELECT 1 FROM public.workspace WHERE slug = candidate AND workspace_id <> NEW.workspace_id)
    THEN
      NEW.slug := candidate;
      RETURN NEW;
    END IF;

    counter := counter + 1;
    candidate := base_slug || '-' || counter;

    IF counter > 100 THEN
      RAISE EXCEPTION 'Could not generate unique slug for "%"', NEW.name;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- 4. Attach Trigger (INSERT only — existing rows already have slugs)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_workspace_generate_slug ON public.workspace;

CREATE TRIGGER trg_workspace_generate_slug
  BEFORE INSERT ON public.workspace
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_workspace_slug();

-- ============================================================================
-- 5. Index for Fast Slug Lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_slug ON public.workspace (slug);
```

**Step 2: Commit (before running, to avoid losing work if reset needed)**

```bash
git add supabase/migrations/20260228200000_workspace_slug_constraints.sql
git commit -m "feat(db): add workspace slug constraints, reserved_slug table, trigger"
```

---

### Task 2.2: Fix seed data and regenerate types

**Files:**

- Modify: `supabase/seed.sql`

**Step 1: Update seed slug from 'hq' to 'hq-workspace'**

In `supabase/seed.sql` line 15, change:

```sql
-- OLD:
  ('b0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'HQ Workspace', 'hq', 'Headquarters Workspace', 'NOK', 'no', 'NO');

-- NEW:
  ('b0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'HQ Workspace', 'hq-workspace', 'Headquarters Workspace', 'NOK', 'no', 'NO');
```

**Step 2: Reset database to verify**

Run: `npx supabase db reset`
Expected: All migrations apply, seed succeeds

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/seed.sql packages/supabase/src/database.types.ts
git commit -m "fix(seed): update workspace slug to meet 3-char minimum, regenerate types"
```

---

### Task 2.3: Write ADR-0021

**Files:**

- Create: `docs/decisions/0021-subdomain-workspace-routing.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Step 1: Create ADR**

```markdown
---
id: "0021"
title: Subdomain-Based Workspace Routing
status: Accepted
date: 2026-02-28
---

# ADR-0021: Subdomain-Based Workspace Routing

## Context and Problem Statement

Smartout is multi-tenant. Users need clear URL-level workspace isolation and seamless multi-workspace navigation without re-login.

## Decision Drivers

- Professional URLs (peppes.smartout.ai vs generic paths)
- Zero DNS maintenance per customer (wildcard CNAME)
- Cross-subdomain auth sharing via cookie domain
- Industry standard (Slack, Notion, Atlassian)

## Considered Options

1. Path-based routing (`/workspace/{slug}/dashboard`)
2. Subdomain + URL rewriting (rewrite to `/workspace/[slug]/...` internal routes)
3. Subdomain + header injection (set `x-workspace-slug` header, keep existing routes)

## Decision Outcome

Option 3: Subdomain routing with header-based workspace context.

Middleware detects subdomain, sets `x-workspace-slug` header. Dashboard layout (server component) reads header, queries workspace, provides context via WorkspaceProvider. No URL rewriting, no route file changes.

## Rules & Consequences

- Middleware extracts subdomain from Host header
- Reserved subdomains stored in `reserved_slug` table (no code changes to add new ones)
- Cookie domain = `.smartout.ai` for cross-subdomain auth
- Dashboard layout split: Server Component wrapper + Client Component shell
- `useWorkspace()` hook provides workspace context to all dashboard components
- Portal at `app.smartout.ai` with workspace selector
- Local dev uses `{slug}.localhost:3050` with /etc/hosts entries
```

**Step 2: Add to decision log**

Append to `docs/decisions/0000-decision-log.md`:

```
| ADR-0021 | 28-02-2026 | [Subdomain-Based Workspace Routing](./0021-subdomain-workspace-routing.md) | **Accepted** |
```

**Step 3: Commit**

```bash
git add docs/decisions/0021-subdomain-workspace-routing.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): ADR-0021 subdomain-based workspace routing"
```

---

## Team 3: Middleware — Subdomain Detection & Header Injection

**Scope:** Subdomain extraction utility, middleware rewrite with workspace context
**Depends on:** Team 1 (cookie domain must be set)
**Acceptance criteria:**

- `peppes.smartout.ai/dashboard` → sets `x-workspace-slug: peppes` header, renders `/dashboard`
- `app.smartout.ai` → portal mode (no workspace header)
- `app.smartout.ai/dashboard` → redirects to `/select-workspace`
- Reserved subdomains (api, docs, www) pass through
- `peppes.localhost:3050` works in local dev
- `localhost:3050/dashboard` works in dev without subdomain (backwards compat)
- Existing security checks, auth session refresh, contract_status gating all preserved

---

### Task 3.1: Create subdomain extraction utility

**Files:**

- Create: `apps/web/src/lib/subdomain.ts`

**Step 1: Write the utility**

```typescript
/**
 * Subdomain extraction and validation for workspace routing.
 * Spec: docs/architecture/SMARTOUT_Subdomain_Routing_Architecture.md
 */

const RESERVED_SUBDOMAINS = new Set(["app", "api", "docs", "www", "status", "voice"]);

type SubdomainResult =
  | { type: "workspace"; slug: string }
  | { type: "portal" }
  | { type: "reserved"; subdomain: string }
  | { type: "root" };

/**
 * Extract subdomain from the request Host header.
 *
 * Production:
 *   peppes.smartout.ai      → { type: "workspace", slug: "peppes" }
 *   app.smartout.ai         → { type: "portal" }
 *   docs.smartout.ai        → { type: "reserved", subdomain: "docs" }
 *   smartout.ai             → { type: "root" }
 *
 * Development:
 *   peppes.localhost:3050   → { type: "workspace", slug: "peppes" }
 *   app.localhost:3050      → { type: "portal" }
 *   localhost:3050          → { type: "root" }
 */
export function extractSubdomain(host: string): SubdomainResult {
  const hostname = host.split(":")[0]!;

  // Development: *.localhost
  if (hostname.endsWith(".localhost") || hostname === "localhost") {
    const parts = hostname.split(".");
    if (parts.length === 1) return { type: "root" };
    const sub = parts[0]!;
    if (sub === "app") return { type: "portal" };
    if (RESERVED_SUBDOMAINS.has(sub)) return { type: "reserved", subdomain: sub };
    return { type: "workspace", slug: sub };
  }

  // Production: *.smartout.ai (or configured root domain)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "smartout.ai";
  if (!hostname.endsWith(`.${rootDomain}`) && hostname !== rootDomain) {
    // Unknown domain (e.g., Vercel preview URL) — treat as root
    return { type: "root" };
  }

  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return { type: "root" };
  }

  const sub = hostname.slice(0, -(rootDomain.length + 1));

  if (sub === "app") return { type: "portal" };
  if (RESERVED_SUBDOMAINS.has(sub)) return { type: "reserved", subdomain: sub };
  return { type: "workspace", slug: sub };
}

export { RESERVED_SUBDOMAINS };
```

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/lib/subdomain.ts
git commit -m "feat(middleware): add subdomain extraction utility"
```

---

### Task 3.2: Rewrite middleware with subdomain routing

**Files:**

- Modify: `apps/web/src/middleware.ts`

**Step 1: Replace entire middleware**

```typescript
import { updateSession } from "@smartout/supabase/middleware";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { detectSuspiciousRequest } from "@/lib/security";
import { extractSubdomain } from "@/lib/subdomain";

/**
 * Copy auth cookies from the session response onto a redirect response.
 * Required because redirect responses are new objects that don't carry
 * cookies set by updateSession(). See Learning-0002.
 */
function copySessionCookies(source: NextResponse, target: NextResponse): void {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value);
  });
}

export async function middleware(request: NextRequest): Promise<Response> {
  // ── 1. Security — block suspicious requests ──
  const { suspicious, reasons } = detectSuspiciousRequest(request);
  if (suspicious) {
    console.warn(
      JSON.stringify({
        level: "warn",
        action: "suspicious_request_blocked",
        category: "security",
        path: request.nextUrl.pathname,
        reasons,
        ip: request.headers.get("x-forwarded-for") ?? "unknown",
        timestamp: new Date().toISOString(),
      }),
    );
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ── 2. Subdomain detection ──
  const host = request.headers.get("host") ?? "localhost";
  const subdomain = extractSubdomain(host);

  // Root domain (smartout.ai) — should be handled by landing Vercel project.
  // If it hits this app, redirect to landing.
  if (subdomain.type === "root") {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    // In dev without subdomains: fall through to existing behavior
    if (!rootDomain || rootDomain === "localhost") {
      return handleLegacyRouting(request);
    }
    return NextResponse.redirect(new URL("/", `https://${rootDomain}`));
  }

  // Reserved subdomains — pass through (handled by other Vercel projects)
  if (subdomain.type === "reserved") {
    return NextResponse.next();
  }

  // ── 3. Update Supabase auth session ──
  const { response, user: sessionUser } = await updateSession(
    request as unknown as Parameters<typeof updateSession>[0],
  );

  // ── 4. Portal (app.smartout.ai) ──
  if (subdomain.type === "portal") {
    const pathname = request.nextUrl.pathname;

    // Portal root → workspace selector
    if (pathname === "/") {
      const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
      copySessionCookies(response, redir);
      return redir;
    }

    // Portal /dashboard* → redirect to workspace selector
    // (user hit /dashboard on the portal subdomain — no workspace context available)
    if (pathname.startsWith("/dashboard")) {
      const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
      copySessionCookies(response, redir);
      return redir;
    }

    // Platform-admin route protection
    if (pathname.startsWith("/platform-admin")) {
      if (!sessionUser) {
        const redir = NextResponse.redirect(new URL("/login", request.url));
        copySessionCookies(response, redir);
        return redir;
      }

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
        copySessionCookies(response, redir);
        return redir;
      }

      const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
      const { data: identity } = await adminClient
        .from("user_identity")
        .select("is_super_admin")
        .eq("user_id", sessionUser.id)
        .single();

      if (!identity?.is_super_admin) {
        const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
        copySessionCookies(response, redir);
        return redir;
      }
    }

    return response;
  }

  // ── 5. Workspace subdomain ({slug}.smartout.ai) ──
  if (subdomain.type === "workspace") {
    const slug = subdomain.slug;

    // Set workspace slug header for downstream consumption
    response.headers.set("x-workspace-slug", slug);

    // Root of workspace subdomain → redirect to dashboard
    if (request.nextUrl.pathname === "/") {
      const redir = NextResponse.redirect(new URL("/dashboard", request.url));
      copySessionCookies(response, redir);
      redir.headers.set("x-workspace-slug", slug);
      return redir;
    }

    // Contract status gating for dashboard routes
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey && sessionUser) {
        const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

        const { data: profile } = await adminClient
          .from("profile")
          .select("workspace_id, workspace:workspace_id(contract_status, trial_ends_at)")
          .eq("user_id", sessionUser.id)
          .limit(1)
          .single();

        const workspace = profile?.workspace as unknown as {
          contract_status: string | null;
          trial_ends_at: string | null;
        } | null;

        if (workspace?.contract_status) {
          const status = workspace.contract_status;

          if (status === "setup") {
            const redir = NextResponse.redirect(new URL("/onboarding", request.url));
            copySessionCookies(response, redir);
            return redir;
          }

          if (status === "deactivated") {
            const redir = NextResponse.redirect(new URL("/blocked", request.url));
            copySessionCookies(response, redir);
            return redir;
          }

          if (status === "pending_contract" || status === "trial") {
            response.headers.set("x-contract-status", status);
            if (workspace.trial_ends_at) {
              response.headers.set("x-trial-ends-at", workspace.trial_ends_at);
            }
          }

          if (status === "suspended") {
            response.headers.set("x-contract-status", "suspended");
          }
        }
      }
    }

    return response;
  }

  return response;
}

/**
 * Legacy routing for local development without subdomains.
 * When running on plain localhost:3050, behave like the old middleware.
 */
async function handleLegacyRouting(request: NextRequest): Promise<Response> {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const { response, user: sessionUser } = await updateSession(
    request as unknown as Parameters<typeof updateSession>[0],
  );

  // Dashboard contract_status gating (same as workspace subdomain)
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey && sessionUser) {
      const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

      const { data: profile } = await adminClient
        .from("profile")
        .select("workspace_id, workspace:workspace_id(contract_status, trial_ends_at)")
        .eq("user_id", sessionUser.id)
        .limit(1)
        .single();

      const workspace = profile?.workspace as unknown as {
        contract_status: string | null;
        trial_ends_at: string | null;
      } | null;

      if (workspace?.contract_status) {
        const status = workspace.contract_status;

        if (status === "setup") {
          const redir = NextResponse.redirect(new URL("/onboarding", request.url));
          copySessionCookies(response, redir);
          return redir;
        }

        if (status === "deactivated") {
          const redir = NextResponse.redirect(new URL("/blocked", request.url));
          copySessionCookies(response, redir);
          return redir;
        }

        if (status === "pending_contract" || status === "trial") {
          response.headers.set("x-contract-status", status);
          if (workspace.trial_ends_at) {
            response.headers.set("x-trial-ends-at", workspace.trial_ends_at);
          }
        }

        if (status === "suspended") {
          response.headers.set("x-contract-status", "suspended");
        }
      }
    }
  }

  // Platform-admin protection
  if (request.nextUrl.pathname.startsWith("/platform-admin")) {
    if (!sessionUser) {
      const redir = NextResponse.redirect(new URL("/login", request.url));
      copySessionCookies(response, redir);
      return redir;
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      const redir = NextResponse.redirect(new URL("/dashboard", request.url));
      copySessionCookies(response, redir);
      return redir;
    }

    const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
    const { data: identity } = await adminClient
      .from("user_identity")
      .select("is_super_admin")
      .eq("user_id", sessionUser.id)
      .single();

    if (!identity?.is_super_admin) {
      const redir = NextResponse.redirect(new URL("/dashboard", request.url));
      copySessionCookies(response, redir);
      return redir;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**Key design decisions in this middleware:**

1. **`copySessionCookies` helper** — DRY helper replaces 12 duplicated cookie-copy blocks from original middleware (Learning-0002)
2. **`handleLegacyRouting`** — Preserves backwards-compatible behavior for `localhost:3050` dev without subdomains
3. **Portal `/dashboard` redirect** — When someone hits `/dashboard` on `app.smartout.ai`, they're redirected to `/select-workspace`. This catches all 12 platform-admin page guards that `redirect("/dashboard")` — they end up at the workspace selector
4. **No URL rewriting** — workspace subdomain sets `x-workspace-slug` header, keeps existing route paths
5. **Contract status gating preserved** — identical logic, applied on workspace subdomain

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(middleware): subdomain detection, workspace header injection, portal routing"
```

---

## Team 4: Workspace UI — Context, Layout Split, Portal

**Scope:** WorkspaceProvider, dashboard layout split, workspace selector, access denied, landing app fixes
**Depends on:** Team 2 (slug in DB) + Team 3 (middleware sets headers)
**Acceptance criteria:**

- `useWorkspace()` returns workspace data in any dashboard component
- Dashboard layout reads `x-workspace-slug` header, queries workspace, verifies profile
- Workspace selector lists user's workspaces with subdomain links
- Access denied page for invalid workspaces
- Landing app URLs point to correct subdomain
- Dev fallback works (no subdomain → uses first workspace)

---

### Task 4.1: Create WorkspaceProvider context

**Files:**

- Create: `apps/web/src/lib/workspace-context.tsx`

**Step 1: Write the context**

```typescript
"use client";

import { createContext, useContext, type ReactNode } from "react";

export type WorkspaceData = {
  workspace_id: string;
  company_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  currency: string;
  language: string;
  country: string;
  timezone: string;
  contract_status: string | null;
};

type WorkspaceContextValue = {
  workspace: WorkspaceData;
  slug: string;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: WorkspaceData;
  children: ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={{ workspace, slug: workspace.slug }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/** Throws if used outside WorkspaceProvider */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

/** Returns null if no WorkspaceProvider — safe for shared components */
export function useWorkspaceOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/workspace-context.tsx
git commit -m "feat(ui): add WorkspaceProvider with useWorkspace and useWorkspaceOptional hooks"
```

---

### Task 4.2: Extract DashboardShell client component

**Files:**

- Create: `apps/web/src/components/dashboard/DashboardShell.tsx`

**Step 1: Copy the entire current `apps/web/src/app/dashboard/layout.tsx` to `apps/web/src/components/dashboard/DashboardShell.tsx`**

Make these changes to the copy:

1. Rename the default export from `DashboardLayout` to `DashboardShell`
2. Remove the hardcoded `workspaceData` mock (lines 116-123). Instead, get it from context:

```typescript
import { useWorkspaceOptional } from "@/lib/workspace-context";

// Inside DashboardShell component, replace the mock:
const workspaceCtx = useWorkspaceOptional();
const workspaceData = useMemo(
  () =>
    workspaceCtx
      ? {
          workspace_id: workspaceCtx.workspace.workspace_id,
          company_id: workspaceCtx.workspace.company_id,
          name: workspaceCtx.workspace.name,
        }
      : null,
  [workspaceCtx],
);
```

3. Replace hardcoded workspace name "Bårdshaug Vegkro" in the header (line 173):

```typescript
<span className="text-sm font-bold text-white">
  {workspaceData?.name ?? "Workspace"}
</span>
```

4. Keep everything else identical — all NavItem hrefs, ROUTE_MISSION_MAP, etc.

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(ui): extract DashboardShell client component from dashboard layout"
```

---

### Task 4.3: Convert dashboard layout to server component

**Files:**

- Modify: `apps/web/src/app/dashboard/layout.tsx`

**Step 1: Replace the entire dashboard layout**

The layout becomes a thin server component that reads the workspace slug header, queries the database, and wraps the client shell:

```typescript
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { WorkspaceProvider, type WorkspaceData } from "@/lib/workspace-context";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const slug = headersList.get("x-workspace-slug");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let workspace: WorkspaceData | null = null;

  if (slug) {
    // Workspace subdomain: query workspace by slug
    const { data } = await supabase
      .from("workspace")
      .select("workspace_id, company_id, name, slug, logo_url, currency, language, country, timezone, contract_status")
      .eq("slug", slug)
      .single();

    if (!data) {
      redirect("/access-denied?reason=workspace-not-found");
    }

    // Verify user has profile in this workspace
    const { data: profile } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", user.id)
      .eq("workspace_id", data.workspace_id)
      .single();

    if (!profile) {
      redirect("/access-denied?reason=no-profile");
    }

    workspace = data;
  } else {
    // No subdomain (local dev or legacy) — use first workspace
    const { data: profile } = await supabase
      .from("profile")
      .select("workspace_id, workspace:workspace_id(workspace_id, company_id, name, slug, logo_url, currency, language, country, timezone, contract_status)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (profile?.workspace) {
      workspace = profile.workspace as unknown as WorkspaceData;
    }
  }

  if (workspace) {
    return (
      <WorkspaceProvider workspace={workspace}>
        <DashboardShell>{children}</DashboardShell>
      </WorkspaceProvider>
    );
  }

  // Fallback: no workspace found at all
  return <DashboardShell>{children}</DashboardShell>;
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

**Step 3: Verify build**

Run: `pnpm --filter web build`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(ui): convert dashboard layout to server component with workspace resolution"
```

---

### Task 4.4: Create access denied page

**Files:**

- Create: `apps/web/src/app/access-denied/page.tsx`

**Step 1: Write the page**

```typescript
import Link from "next/link";

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  const messages: Record<string, { title: string; description: string }> = {
    "workspace-not-found": {
      title: "Workspace ikke funnet",
      description: "Denne workspace-adressen finnes ikke. Sjekk URL-en og prøv igjen.",
    },
    "no-profile": {
      title: "Ingen tilgang",
      description: "Du har ikke en profil i denne workspace-en. Kontakt en administrator for å få tilgang.",
    },
  };

  const msg = messages[reason ?? ""] ?? {
    title: "Tilgang nektet",
    description: "Du har ikke tilgang til denne siden.",
  };

  const portalUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    && process.env.NEXT_PUBLIC_ROOT_DOMAIN !== "localhost"
    ? `https://app.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/select-workspace`
    : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-2xl font-black text-white">{msg.title}</h1>
        <p className="mb-8 text-zinc-400">{msg.description}</p>
        <Link
          href={portalUrl}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          Gå til mine workspaces
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/access-denied/page.tsx
git commit -m "feat(ui): add access denied page for workspace routing"
```

---

### Task 4.5: Create workspace selector page

**Files:**

- Create: `apps/web/src/app/select-workspace/page.tsx`

**Step 1: Write the workspace selector**

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@smartout/supabase/server";

export default async function SelectWorkspacePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profiles } = await supabase
    .from("profile")
    .select("profile_id, role, display_name, workspace:workspace_id(workspace_id, name, slug, logo_url)")
    .eq("user_id", user.id);

  const workspaces = (profiles ?? [])
    .map((p) => {
      const ws = p.workspace as unknown as {
        workspace_id: string;
        name: string;
        slug: string;
        logo_url: string | null;
      } | null;
      return ws ? { ...ws, role: p.role, displayName: p.display_name } : null;
    })
    .filter(Boolean) as {
      workspace_id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      role: string;
      displayName: string | null;
    }[];

  // Single workspace: redirect directly
  if (workspaces.length === 1) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    const ws = workspaces[0]!;
    if (rootDomain && rootDomain !== "localhost") {
      redirect(`https://${ws.slug}.${rootDomain}/dashboard`);
    }
    redirect("/dashboard");
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const isProduction = rootDomain !== "localhost";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-xl">
        <h1 className="mb-2 text-3xl font-black text-white">Mine workspaces</h1>
        <p className="mb-8 text-zinc-400">Velg en workspace for å komme i gang.</p>

        <div className="grid gap-4">
          {workspaces.map((ws) => {
            const href = isProduction
              ? `https://${ws.slug}.${rootDomain}/dashboard`
              : "/dashboard";

            return (
              <Link
                key={ws.workspace_id}
                href={href}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-black text-white">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{ws.name}</p>
                  <p className="text-sm text-zinc-500">
                    {ws.slug}.{rootDomain} &middot; {ws.role}
                  </p>
                </div>
                <span className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400">
                  &rarr;
                </span>
              </Link>
            );
          })}
        </div>

        {workspaces.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-zinc-400">Du har ingen workspaces ennå.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/select-workspace/page.tsx
git commit -m "feat(ui): add workspace selector page for portal"
```

---

### Task 4.6: Update landing app web-app-url.ts

**Files:**

- Modify: `apps/landing/src/lib/web-app-url.ts`

**Step 1: Update production fallback URL**

Change line 7 from:

```typescript
const PRODUCTION_WEB_APP_URL = "https://smartout-web.vercel.app";
```

To:

```typescript
const PRODUCTION_WEB_APP_URL = "https://app.smartout.ai";
```

**Step 2: Commit**

```bash
git add apps/landing/src/lib/web-app-url.ts
git commit -m "fix(landing): update web app URL to portal subdomain"
```

---

### Task 4.7: Fix landing app auth callback

**Files:**

- Modify: `apps/landing/src/app/api/auth/callback/route.ts`

**Step 1: Update default redirect**

The landing auth callback redirects to `${origin}/dashboard` by default, but `origin` is the landing app (`smartout.ai`), which has no `/dashboard` route. Change default to `/`:

```typescript
import { createClient } from "@smartout/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Invalid_link`);
}
```

**Step 2: Commit**

```bash
git add apps/landing/src/app/api/auth/callback/route.ts
git commit -m "fix(landing): update auth callback default redirect for subdomain routing"
```

---

## Phase 4: Integration Verification

### Verification Checklist

1. **Database reset:**

   ```bash
   npx supabase db reset
   ```

   Expected: All migrations + seed apply cleanly

2. **Types:**

   ```bash
   npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
   ```

   Expected: `reserved_slug` table appears in types

3. **Full checks:**

   ```bash
   pnpm typecheck && pnpm lint && pnpm build
   ```

   Expected: All pass

4. **Local dev test (without subdomains):**
   - Start: `npx supabase start && pnpm --filter web dev`
   - Visit `http://localhost:3050/dashboard`
   - Expected: Dashboard loads with workspace from DB (first profile's workspace)

5. **Local dev test (with subdomains):**
   - Add to `/etc/hosts`:
     ```
     127.0.0.1  hq-workspace.localhost
     127.0.0.1  app.localhost
     ```
   - Visit `http://hq-workspace.localhost:3050/dashboard`
   - Expected: Dashboard loads with HQ workspace data
   - Visit `http://app.localhost:3050/`
   - Expected: Redirects to `/select-workspace`
   - Visit `http://app.localhost:3050/dashboard`
   - Expected: Redirects to `/select-workspace`

### Post-Implementation Documentation

Update `CLAUDE.md`:

1. Add `NEXT_PUBLIC_ROOT_DOMAIN` to env vars table
2. Add new routes: `/select-workspace`, `/access-denied`
3. Add subdomain routing conventions
4. Add ADR-0021 to ADR table
5. Update dashboard layout description (server + client split)

---

## ADR Checklist

| ADR                                         | Status              |
| ------------------------------------------- | ------------------- |
| ADR-0021: Subdomain-Based Workspace Routing | Created in Task 2.3 |

---

## Team Execution Summary

| Phase        | Team              | Tasks        | Files Created | Files Modified |
| ------------ | ----------------- | ------------ | ------------- | -------------- |
| 1 (parallel) | 1: Infrastructure | 1.1–1.4      | 0             | 4              |
| 1 (parallel) | 2: Database       | 2.1–2.3      | 2             | 2              |
| 2            | 3: Middleware     | 3.1–3.2      | 1             | 1              |
| 3            | 4: Workspace UI   | 4.1–4.7      | 4             | 3              |
| 4            | Integration       | Checklist    | 0             | 1 (docs)       |
| **Total**    |                   | **16 tasks** | **7 files**   | **10 files**   |
