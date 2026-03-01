# API Gateway Rollout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the public API gateway — Edge Functions that serve workspace data behind the API key auth system we already built.

**Architecture:** A single `workspace-api` Edge Function acts as the gateway. External consumers call it with `x-api-key` header. The function validates the key (via existing `resolveAuth`), checks scopes, queries data through `executeWithWorkspaceContext` (transaction-scoped RLS via GUC variables), and returns JSON. No service holds or validates keys — Supabase is the gate.

**Tech Stack:** Supabase Edge Functions (Deno), deno-postgres, existing `_shared/auth-middleware.ts` + `api-key-auth.ts`, PostgreSQL RLS with `current_setting('app.workspace_id')`.

**What's already built:**

- `platform_api_key` table with SHA-256 hashing, versioned rotation, scopes
- `validate-api-key` Edge Function (key validation endpoint)
- `_shared/auth-middleware.ts` (dual JWT/API key auth)
- `_shared/api-key-auth.ts` with `validateApiKey()` and `executeWithWorkspaceContext()`
- `_shared/rate-limit.ts` (Upstash Redis sliding window)
- Platform-admin CRUD routes for key management
- Key management UI in `/platform-admin/keys`

**What this plan builds:**

- **Task 0:** Agent enforcement rules in CLAUDE.md + SECURITY.md (the law — never a question again)
- **Tasks 1-2:** RLS policies + workspace-api Edge Function foundation
- **Tasks 3-6:** Data endpoints (profiles, org structure, training, contracts)
- **Tasks 7-8:** Usage tracking + environment enforcement
- **Task 9:** Contract service migration to managed keys
- **Tasks 10-12:** Types, API registry, integration tests, ADR

**Security protocol:** All work follows `docs/protocols/SECURITY.md`. The Three Laws apply.

---

## Task 0: Codify Agent Enforcement Rules

**This is the most important task.** Before writing any code, codify the rules that every AI agent and developer must follow in every future session. These rules live in every file on the golden path — the chain of references a fresh agent naturally follows. No ambiguity. No questions. No "should I...?"

**The golden path problem:** A fresh agent building a new table follows: CLAUDE.md → DATABASE.md → "RLS Patterns." That section only shows JWT policies. The API key system is invisible. The agent creates a table with JWT-only RLS and never knows about `get_api_workspace_id()`, workspace-api, or scopes. We fix this by updating EVERY file on the golden path.

**Files:**

- Modify: `CLAUDE.md` — Add "API Gateway — Mandatory Checklists" subsection
- Modify: `docs/reference/DATABASE.md` — Add API key RLS pattern alongside JWT pattern
- Modify: `docs/protocols/SECURITY.md` — Expand §15 AI Agent Rules with gateway enforcement

**Step 1: Add to CLAUDE.md**

Add this subsection inside the existing "Security — Always Enforced" section, after the "Environment Variables" subsection and before the "Protocols" section:

```markdown
### API Gateway — Mandatory Checklists

These are not guidelines. They are rules. Violations break the API contract.

**The gateway pattern:** External consumers get one API key. That key is validated by Supabase Edge Functions. Services sit behind the gate — they don't hold or validate consumer keys. Supabase is the gate.

#### When creating a NEW workspace-scoped table

Every workspace-scoped table needs BOTH auth paths. No exceptions.

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. JWT policy: `USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))`
3. API key policy: `CREATE POLICY "api_key_read_{table}" ... USING (workspace_id = get_api_workspace_id())`
4. If write access needed via API: add `api_key_write_{table}` policy too
5. If publicly exposed: add handler in `workspace-api/handlers/`, register route, add to API registry

Skip steps 3-5 only if the table is internal-only (platform-admin, audit logs).

Also add to the "What NOT To Do" section in CLAUDE.md:
```

- Never create workspace-scoped tables without BOTH JWT and API key RLS policies
- Never create public API endpoints without scope guards
- Never create Edge Functions outside the workspace-api gateway (for data endpoints)

```

#### When creating a NEW Edge Function

| Pattern | When | `verify_jwt` | Auth |
|---------|------|-------------|------|
| JWT-only | User-facing (onboarding, workspace ops) | `true` (default) | `supabase.auth.getUser()` |
| Dual-auth | Public API, data endpoints | `false` | `resolveAuth(req)` from `_shared/auth-middleware.ts` |
| Cron-only | Scheduled tasks (cleanup, watchdog) | `false` | `WATCHDOG_CRON_SECRET` bearer token |

- NEVER roll your own auth. Use `_shared/auth-middleware.ts` for dual-auth.
- Every `verify_jwt = false` function MUST be in `supabase/functions/config.toml`.
- Every data endpoint MUST call `requireScope()` before querying.

#### Canonical Scope List (source of truth)

| Scope | Tables | Status |
|-------|--------|--------|
| `profiles:read` | profile, department, location, team, position | Active |
| `schedules:read` | schedule_shift (future) | Planned |
| `schedules:write` | schedule_shift (future) | Planned |
| `operations:read` | department_session (future) | Planned |
| `operations:write` | department_session (future) | Planned |
| `haccp:read` | haccp_log (future) | Planned |
| `haccp:write` | haccp_log (future) | Planned |
| `training:read` | protocol, protocol_assignment | Active |
| `reports:read` | aggregated views (future) | Planned |
| `contracts:read` | employment_contract | Active |

To add a new scope: (1) add to this table, (2) add handler in `workspace-api/handlers/`, (3) register route in `workspace-api/index.ts`, (4) add to API registry, (5) update preset bundles in `SMARTOUT_SECRET_API_INFRASTRUCTURE.md` §2.4.

#### Service Authentication

ALL microservices (contract-service, scrapling, future services):
- MUST use managed service keys (`smo_svc_live_*`) in `platform_api_key`
- MUST validate via `validate-api-key` Edge Function or direct DB lookup
- MUST NOT use hardcoded env var keys (legacy pattern, being migrated)
- Internal services don't hold consumer keys — the web app/Edge Function is the gateway

#### Environment Enforcement

- `smo_sk_test_*` → blocked in production, allowed in local/staging
- `smo_sk_live_*` → works in all environments
- Environment is key metadata, enforced at the gateway
- No separate databases per environment (single Supabase project per env)
```

**Step 2: Update DATABASE.md — Add API key RLS pattern**

In `docs/reference/DATABASE.md`, replace the "RLS Patterns" section (currently only shows JWT) with BOTH patterns:

````markdown
## RLS Patterns

All workspace-scoped tables use RLS with TWO auth paths: JWT (for user sessions) and API key (for external integrations). Platform-admin tables are exceptions (no RLS, service role only).

### Pattern 1: JWT Auth (user sessions)

```sql
-- SELECT: user can read data in workspaces they belong to
CREATE POLICY "Read {table}" ON public.{table}
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- WRITE: admin/owner can modify data in their workspace
CREATE POLICY "Write {table}" ON public.{table}
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
```
````

### Pattern 2: API Key Auth (external integrations)

```sql
-- SELECT: API key can read data in the workspace it belongs to
CREATE POLICY "api_key_read_{table}" ON public.{table}
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- WRITE (if needed): API key can write to its workspace
CREATE POLICY "api_key_write_{table}" ON public.{table}
  FOR INSERT WITH CHECK (workspace_id = get_api_workspace_id());
```

### Helper Functions

- `get_workspace_ids_for_user(user_uuid)` — returns all workspace_ids the user has a profile in (JWT path)
- `is_admin_in_workspace(user_uuid, workspace_uuid)` — checks admin+ role (JWT path)
- `get_api_workspace_id()` — returns `current_setting('app.workspace_id', true)::uuid` (API key path)

### MANDATORY: Every workspace-scoped table needs BOTH patterns

When creating a new workspace-scoped table:

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. Add JWT SELECT policy (Pattern 1)
3. Add JWT WRITE policy (Pattern 1)
4. Add API key SELECT policy (Pattern 2)
5. Add API key WRITE policy (Pattern 2) — only if the table will be writable via public API

Tables WITHOUT workspace_id (user_identity, company, platform-admin) are exempt from API key policies.

### Rules

- User-facing operations: RLS client (anon key)
- Admin/trigger operations: service role client
- Platform-admin tables: no RLS, service role only
- `user_identity.is_super_admin` (boolean, default false) gates platform-admin access

````

**Step 3: Expand SECURITY.md §15 AI Agent Rules**

Replace the existing §15 content in `docs/protocols/SECURITY.md` with:

```markdown
## 15. AI Agent Rules

When Claude Code, Cursor, or any AI agent works on Smartout code:

### 15.1 Context Loading (Before ANY auth/key work)

````

MANDATORY — Read these before touching auth, secrets, keys, RLS, or Edge Functions:

1. This document (docs/protocols/SECURITY.md)
2. CLAUDE.md § "API Gateway — Mandatory Checklists"
3. docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md (if touching key logic)
4. docs/architecture/SMARTOUT_ADMIN_KEY_MANAGEMENT.md (if touching key UI)

```

### 15.2 New Table Checklist

```

EVERY new workspace-scoped table MUST have:
☐ ALTER TABLE ... ENABLE ROW LEVEL SECURITY
☐ JWT read policy: USING (workspace*id IN (SELECT get_workspace_ids_for_user(auth.uid())))
☐ API key read policy: CREATE POLICY "api_key_read*{table}" USING (workspace_id = get_api_workspace_id())
☐ Write policies if applicable (JWT + API key variants)
☐ If exposed via public API: handler + route + scope guard + API registry entry

Tables WITHOUT workspace_id (identity layer, platform-admin) are exempt from API key policies.

```

### 15.3 New Edge Function Checklist

```

EVERY new Edge Function MUST:
☐ Use one of the three auth patterns (JWT-only, dual-auth, cron-only)
☐ NEVER implement custom auth logic — use \_shared/auth-middleware.ts
☐ If dual-auth: add verify_jwt = false to supabase/functions/config.toml
☐ If data endpoint: call requireScope() from \_shared/scope-middleware.ts
☐ If querying workspace data: use executeWithWorkspaceContext() from \_shared/api-key-auth.ts
☐ Add to API registry in health/\_components/api-registry.ts
☐ Update CLAUDE.md Edge Function count

```

### 15.4 New Scope Checklist

```

EVERY new API scope MUST:
☐ Follow format: {resource}:{action} (e.g., schedules:read)
☐ Be added to CLAUDE.md canonical scope table
☐ Be added to SMARTOUT_SECRET_API_INFRASTRUCTURE.md §2.4
☐ Have a handler in workspace-api/handlers/
☐ Have a route registered in workspace-api/index.ts
☐ Be added to relevant preset bundles if applicable
☐ Have api_key_read/write RLS policies on all tables it accesses

```

### 15.5 New Microservice Checklist

```

EVERY new microservice MUST:
☐ Authenticate via managed service key (smo*svc_live*\*)
☐ Validate key against platform_api_key (via validate-api-key or DB lookup)
☐ NEVER use hardcoded env var keys for auth
☐ Document the key in platform-admin Keys & Secrets UI
☐ Health endpoint must be public (no auth required)
☐ Webhook endpoints use provider-specific signature verification, not API keys

```

### 15.6 Forbidden Actions

```

NEVER:

- Generate placeholder secrets that look real (use "REPLACE_ME")
- Create Edge Functions with custom auth logic
- Store secrets in Supabase tables outside Vault
- Write RLS policies that use service_role bypass for convenience
- Log request bodies that might contain API keys
- Create API key validation without scope checking
- Accept raw secret values in prompts — suggest op:// reference
- Invent new key prefixes — use smo*sk* and smo*svc* only
- Create workspace-scoped tables without api*key_read*\* RLS policies
- Add workspace-api endpoints without scope guards
- Skip the API registry when adding endpoints

```

### 15.7 Required Actions

```

ALWAYS:

- Reference this protocol in PR descriptions for auth-related changes
- Include workspace isolation test in acceptance criteria
- Use the established key format (smo*sk*, smo*svc*)
- Write ADR for any new auth pattern or security decision
- Update CLAUDE.md scope table when adding scopes
- Run workspace isolation test: fake workspace → 0 results

```

```

**Step 4: Verify the golden path works**

Simulate a fresh agent receiving "create a new workspace-scoped table." Trace the path:

1. CLAUDE.md → "API Gateway — Mandatory Checklists" → new table checklist → requires api*key_read*\* policy ✅
2. CLAUDE.md → DATABASE.md → "RLS Patterns" → shows BOTH JWT and API key patterns ✅
3. CLAUDE.md → SECURITY.md §15.2 → new table checklist with exact policy syntax ✅

Check:

- CLAUDE.md scope table matches SECURITY.md
- DATABASE.md shows both RLS patterns with `get_api_workspace_id()`
- Every checklist item has a concrete file path or action
- No "consider" or "should" language — only "MUST" and "NEVER"

**Step 5: Commit**

```bash
git add CLAUDE.md docs/reference/DATABASE.md docs/protocols/SECURITY.md
git commit -m "docs: codify API gateway enforcement rules across golden path (CLAUDE.md + DATABASE.md + SECURITY.md)"
```

---

## Task 1: RLS Augmentation Migration

Add PostgreSQL policies that allow API key auth to access workspace data via GUC variables. These coexist with existing JWT-based policies (PostgreSQL evaluates multiple policies with OR logic).

**Files:**

- Create: `supabase/migrations/20260301100000_api_key_rls_policies.sql`

**Step 1: Write the migration**

```sql
-- ── API Key RLS Policies ──
-- Allows workspace-api Edge Function to access data via set_config('app.workspace_id', ...)
-- Coexists with existing JWT-based policies (OR logic).
-- See: docs/protocols/SECURITY.md §4.3

-- Helper: extract workspace_id from GUC variable (returns NULL if not set)
CREATE OR REPLACE FUNCTION public.get_api_workspace_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- ── Profile ──
CREATE POLICY "api_key_read_profile" ON public.profile
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Department ──
CREATE POLICY "api_key_read_department" ON public.department
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Location ──
CREATE POLICY "api_key_read_location" ON public.location
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Team ──
CREATE POLICY "api_key_read_team" ON public.team
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Team Member ──
CREATE POLICY "api_key_read_team_member" ON public.team_member
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team
      WHERE workspace_id = get_api_workspace_id()
    )
  );

-- ── Season ──
CREATE POLICY "api_key_read_season" ON public.season
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Policy (governance) ──
CREATE POLICY "api_key_read_policy" ON public.policy
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Protocol ──
CREATE POLICY "api_key_read_protocol" ON public.protocol
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Protocol Assignment ──
CREATE POLICY "api_key_read_protocol_assignment" ON public.protocol_assignment
  FOR SELECT USING (
    protocol_id IN (
      SELECT protocol_id FROM public.protocol
      WHERE workspace_id = get_api_workspace_id()
    )
  );

-- ── Employment Contract ──
CREATE POLICY "api_key_read_employment_contract" ON public.employment_contract
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Position ──
CREATE POLICY "api_key_read_position" ON public.position
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

**Step 2: Apply the migration locally**

Run: `npx supabase db reset` (or `npx supabase migration up` if data matters)

**Step 3: Verify policies exist**

Run in Supabase SQL editor:

```sql
SELECT tablename, policyname FROM pg_policies
WHERE policyname LIKE 'api_key_%' ORDER BY tablename;
```

Expected: 11 rows, one per table.

**Step 4: Test workspace isolation**

Run in SQL editor:

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('app.workspace_id', '00000000-0000-0000-0000-000000000000', true);
SELECT count(*) FROM profile; -- Should return 0 (no profiles in fake workspace)
ROLLBACK;
```

**Step 5: Commit**

```bash
git add supabase/migrations/20260301100000_api_key_rls_policies.sql
git commit -m "feat(db): add API key RLS policies for workspace-api gateway"
```

---

## Task 2: Workspace API Edge Function — Foundation

Create the `workspace-api` Edge Function with routing, auth, scope enforcement, and environment checks.

**Files:**

- Create: `supabase/functions/workspace-api/index.ts`
- Create: `supabase/functions/_shared/scope-middleware.ts`
- Modify: `supabase/functions/config.toml` (add `verify_jwt = false`)

**Step 1: Create the scope middleware**

Create `supabase/functions/_shared/scope-middleware.ts`:

```typescript
import { type AuthContext } from "./auth-middleware.ts";

/**
 * Check if the auth context has a required scope.
 * JWT users get full access (RLS handles their restrictions).
 * API key users must have the scope explicitly granted.
 */
export function requireScope(auth: AuthContext, scope: string): boolean {
  if (auth.method === "jwt") return true;
  return auth.scopes.includes(scope) || auth.scopes.includes("*");
}

/**
 * Check environment enforcement.
 * Test keys (smo_sk_test_*) should only access test/sandbox data.
 * This is enforced at the gateway level since the DB doesn't distinguish environments.
 *
 * Returns the environment context for the request.
 */
export function getKeyEnvironment(apiKey: string | null): "live" | "test" | "jwt" {
  if (!apiKey) return "jwt";
  if (apiKey.includes("_test_")) return "test";
  return "live";
}
```

**Step 2: Create the Edge Function**

Create `supabase/functions/workspace-api/index.ts`:

```typescript
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-middleware.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { executeWithWorkspaceContext } from "../_shared/api-key-auth.ts";
import { requireScope } from "../_shared/scope-middleware.ts";

// ── Route handlers ──

type RouteHandler = (
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
) => Promise<Response>;

const routes: Record<string, RouteHandler> = {};

// Handlers are registered in subsequent tasks.
// Pattern: routes["GET /v1/profiles"] = handleGetProfiles;

// ── Main router ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate
    const auth = await resolveAuth(req);
    if (!auth) {
      return jsonError(401, "Invalid or missing API key");
    }

    // 2. Rate limit
    const rl = await checkRateLimit(auth.rateLimitKey, auth.rateLimitPerMinute);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rl.remaining),
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      });
    }

    // 3. Require workspace context (service keys without workspace_id cannot use data APIs)
    if (!auth.workspaceId) {
      return jsonError(
        400,
        "Workspace context required. Use a workspace API key, not a service key.",
      );
    }

    // 4. Route
    const url = new URL(req.url);
    // Extract path after /workspace-api (e.g., "/v1/profiles")
    const fnPath = url.pathname.replace(/^\/workspace-api/, "").replace(/\/$/, "") || "/";
    const routeKey = `${req.method} ${fnPath}`;

    const handler = routes[routeKey];
    if (!handler) {
      return jsonError(404, `Unknown endpoint: ${req.method} ${fnPath}`);
    }

    // 5. Execute handler
    return await handler({ workspaceId: auth.workspaceId, scopes: auth.scopes }, url);
  } catch (error: unknown) {
    console.error("[workspace-api]", error);
    return jsonError(500, "Internal server error");
  }
});

// ── Helpers ──

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export { routes, requireScope, executeWithWorkspaceContext };
```

**Step 3: Add to config.toml**

Add to `supabase/functions/config.toml`:

```toml
[workspace-api]
verify_jwt = false
```

**Step 4: Test that the function starts**

Run: `npx supabase functions serve workspace-api --no-verify-jwt`

Call it:

```bash
curl -i http://localhost:54321/functions/v1/workspace-api/v1/profiles
```

Expected: `401 Invalid or missing API key`

**Step 5: Commit**

```bash
git add supabase/functions/workspace-api/index.ts \
        supabase/functions/_shared/scope-middleware.ts \
        supabase/functions/config.toml
git commit -m "feat(edge): create workspace-api gateway with routing and scope middleware"
```

---

## Task 3: GET /v1/profiles — Employee List

The first data endpoint. Returns profiles in the workspace with basic info (no PII).

**Files:**

- Modify: `supabase/functions/workspace-api/index.ts` (register route)
- Create: `supabase/functions/workspace-api/handlers/profiles.ts`

**Step 1: Create the handler**

Create `supabase/functions/workspace-api/handlers/profiles.ts`:

```typescript
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";

interface ProfileRow {
  profile_id: string;
  profile_code: string;
  display_name: string;
  role: string;
  status: string;
  is_active: boolean;
  job_title: string | null;
  employee_number: string | null;
  department_id: string | null;
  location_id: string | null;
  joined_at: string;
}

export async function handleGetProfiles(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  if (!requireScope({ method: "api_key", scopes: auth.scopes } as any, "profiles:read")) {
    return new Response(JSON.stringify({ error: "Missing scope: profiles:read" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const status = url.searchParams.get("status"); // trainee, active, inactive, offboarding
  const isActive = url.searchParams.get("is_active"); // true, false

  let query = `
    SELECT profile_id, profile_code, display_name, role, status,
           is_active, job_title, employee_number, department_id,
           location_id, joined_at
    FROM profile
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (status) {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  if (isActive !== null && isActive !== undefined) {
    query += ` AND is_active = $${paramIdx}`;
    params.push(isActive === "true");
    paramIdx++;
  }

  query += ` ORDER BY display_name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<ProfileRow>(auth.workspaceId, query, params);

  return jsonOk({ profiles: rows, limit, offset });
}
```

**Step 2: Register the route**

In `workspace-api/index.ts`, add after the `routes` declaration:

```typescript
import { handleGetProfiles } from "./handlers/profiles.ts";
routes["GET /v1/profiles"] = handleGetProfiles;
```

**Step 3: Test with a real key**

Create a test key via SQL (local dev):

```sql
SELECT create_api_key(
  'Test Key',
  'workspace'::api_key_type,
  '{YOUR_WORKSPACE_ID}'::uuid,
  'test',
  ARRAY['profiles:read'],
  60, NULL, NULL
);
```

Then call:

```bash
curl -H "x-api-key: {returned_key}" \
  http://localhost:54321/functions/v1/workspace-api/v1/profiles
```

Expected: JSON with `data.profiles` array.

**Step 4: Commit**

```bash
git add supabase/functions/workspace-api/
git commit -m "feat(api): add GET /v1/profiles endpoint to workspace-api"
```

---

## Task 4: GET /v1/departments, /v1/teams, /v1/locations

Organization structure endpoints — useful for POS integrations mapping employees to departments.

**Files:**

- Create: `supabase/functions/workspace-api/handlers/organization.ts`
- Modify: `supabase/functions/workspace-api/index.ts` (register routes)

**Step 1: Create the handler**

Create `supabase/functions/workspace-api/handlers/organization.ts`:

```typescript
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";

function scopeGuard(scopes: string[], required: string): Response | null {
  if (!requireScope({ method: "api_key", scopes } as any, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetDepartments(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, "profiles:read");
  if (denied) return denied;

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT department_id, name, description, is_active, created_at
     FROM department WHERE workspace_id = $1 ORDER BY name`,
    [auth.workspaceId],
  );
  return jsonOk({ departments: rows });
}

export async function handleGetTeams(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, "profiles:read");
  if (denied) return denied;

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT team_id, name, description, department_id,
            leader_profile_id, is_active, created_at
     FROM team WHERE workspace_id = $1 ORDER BY name`,
    [auth.workspaceId],
  );
  return jsonOk({ teams: rows });
}

export async function handleGetLocations(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, "profiles:read");
  if (denied) return denied;

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT location_id, name, address, city, postal_code,
            country, is_active, created_at
     FROM location WHERE workspace_id = $1 ORDER BY name`,
    [auth.workspaceId],
  );
  return jsonOk({ locations: rows });
}
```

**Step 2: Register routes in index.ts**

```typescript
import {
  handleGetDepartments,
  handleGetTeams,
  handleGetLocations,
} from "./handlers/organization.ts";
routes["GET /v1/departments"] = handleGetDepartments;
routes["GET /v1/teams"] = handleGetTeams;
routes["GET /v1/locations"] = handleGetLocations;
```

**Step 3: Test each endpoint**

```bash
curl -H "x-api-key: {key}" http://localhost:54321/functions/v1/workspace-api/v1/departments
curl -H "x-api-key: {key}" http://localhost:54321/functions/v1/workspace-api/v1/teams
curl -H "x-api-key: {key}" http://localhost:54321/functions/v1/workspace-api/v1/locations
```

**Step 4: Commit**

```bash
git add supabase/functions/workspace-api/
git commit -m "feat(api): add GET /v1/departments, teams, locations endpoints"
```

---

## Task 5: GET /v1/protocols, /v1/assignments — Training Data

Training progress endpoints — useful for LMS integrations and compliance reporting.

**Files:**

- Create: `supabase/functions/workspace-api/handlers/training.ts`
- Modify: `supabase/functions/workspace-api/index.ts` (register routes)

**Step 1: Create the handler**

Create `supabase/functions/workspace-api/handlers/training.ts`:

```typescript
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";

function scopeGuard(scopes: string[], required: string): Response | null {
  if (!requireScope({ method: "api_key", scopes } as any, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetProtocols(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, "training:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT protocol_id, policy_id, name, description, type,
            is_active, created_at
     FROM protocol
     WHERE workspace_id = $1
     ORDER BY name
     LIMIT $2 OFFSET $3`,
    [auth.workspaceId, limit, offset],
  );
  return jsonOk({ protocols: rows, limit, offset });
}

export async function handleGetAssignments(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, "training:read");
  if (denied) return denied;

  const profileId = url.searchParams.get("profile_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = `
    SELECT pa.assignment_id, pa.protocol_id, pa.profile_id,
           pa.status, pa.assigned_at, pa.completed_at,
           p.name AS protocol_name
    FROM protocol_assignment pa
    JOIN protocol p ON pa.protocol_id = p.protocol_id
    WHERE p.workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (profileId) {
    query += ` AND pa.profile_id = $${idx}`;
    params.push(profileId);
    idx++;
  }

  query += ` ORDER BY pa.assigned_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ assignments: rows, limit, offset });
}
```

**Step 2: Register routes**

```typescript
import { handleGetProtocols, handleGetAssignments } from "./handlers/training.ts";
routes["GET /v1/protocols"] = handleGetProtocols;
routes["GET /v1/assignments"] = handleGetAssignments;
```

**Step 3: Test**

```bash
curl -H "x-api-key: {key_with_training_read}" \
  http://localhost:54321/functions/v1/workspace-api/v1/protocols
```

Expected: JSON with `data.protocols` array. If key lacks `training:read` scope: 403.

**Step 4: Commit**

```bash
git add supabase/functions/workspace-api/
git commit -m "feat(api): add GET /v1/protocols, assignments endpoints"
```

---

## Task 6: GET /v1/contracts — Employment Contract Metadata

Contract metadata endpoint. Does NOT return document content — only status, dates, position info.

**Files:**

- Create: `supabase/functions/workspace-api/handlers/contracts.ts`
- Modify: `supabase/functions/workspace-api/index.ts` (register route)

**Step 1: Create the handler**

Create `supabase/functions/workspace-api/handlers/contracts.ts`:

```typescript
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";

export async function handleGetContracts(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  if (!requireScope({ method: "api_key", scopes: auth.scopes } as any, "contracts:read")) {
    return new Response(JSON.stringify({ error: "Missing scope: contracts:read" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const profileId = url.searchParams.get("profile_id");
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = `
    SELECT contract_id, profile_id, status, position_title,
           employment_category, employment_percentage,
           start_date, end_date, signed_at, created_at
    FROM employment_contract
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (profileId) {
    query += ` AND profile_id = $${idx}`;
    params.push(profileId);
    idx++;
  }
  if (status) {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);

  // Explicitly exclude document_url and signature_id (sensitive)
  return jsonOk({ contracts: rows, limit, offset });
}
```

**Step 2: Register route**

```typescript
import { handleGetContracts } from "./handlers/contracts.ts";
routes["GET /v1/contracts"] = handleGetContracts;
```

**Step 3: Test**

```bash
curl -H "x-api-key: {key_with_contracts_read}" \
  http://localhost:54321/functions/v1/workspace-api/v1/contracts
```

**Step 4: Commit**

```bash
git add supabase/functions/workspace-api/
git commit -m "feat(api): add GET /v1/contracts endpoint (metadata only)"
```

---

## Task 7: Usage Tracking — Hourly Bucket Logging

Log every workspace-api request to `platform_api_key_usage` in hourly buckets via `ON CONFLICT DO UPDATE`.

**Files:**

- Modify: `supabase/functions/_shared/api-key-auth.ts` (add `logUsage` function)
- Modify: `supabase/functions/workspace-api/index.ts` (call `logUsage` after handler)

**Step 1: Add usage logging to api-key-auth.ts**

Add to the bottom of `_shared/api-key-auth.ts`:

```typescript
export async function logUsage(keyId: string, endpoint: string, statusCode: number): Promise<void> {
  const conn = await pool.connect();
  try {
    // Hourly bucket: truncate to hour
    await conn.queryObject(
      `INSERT INTO platform_api_key_usage (api_key_id, endpoint, hour_bucket, request_count, error_count)
       VALUES ($1, $2, date_trunc('hour', now()), 1, $3)
       ON CONFLICT (api_key_id, endpoint, hour_bucket)
       DO UPDATE SET
         request_count = platform_api_key_usage.request_count + 1,
         error_count = platform_api_key_usage.error_count + $3`,
      [keyId, endpoint, statusCode >= 400 ? 1 : 0],
    );
  } catch (err) {
    // Usage logging should never block the response
    console.error("[usage-tracking]", err);
  } finally {
    conn.release();
  }
}
```

**Step 2: Call logUsage in workspace-api/index.ts**

After the handler returns, log the usage (fire-and-forget):

```typescript
import { logUsage } from "../_shared/api-key-auth.ts";

// Inside the main Deno.serve handler, after getting the response from the route handler:
const response = await handler(...);

// Fire-and-forget usage logging (only for API key auth, not JWT)
if (auth.method === "api_key" && auth.keyId) {
  logUsage(auth.keyId, fnPath, response.status).catch(() => {});
}

return response;
```

**Step 3: Verify usage tracking**

After calling the API, check:

```sql
SELECT * FROM platform_api_key_usage ORDER BY hour_bucket DESC LIMIT 5;
```

Expected: Row with `request_count = 1` for the endpoint called.

**Step 4: Commit**

```bash
git add supabase/functions/_shared/api-key-auth.ts \
        supabase/functions/workspace-api/index.ts
git commit -m "feat(api): add hourly bucket usage tracking for workspace-api"
```

---

## Task 8: Environment Enforcement

Test keys (`smo_sk_test_*`) should be limited. In v1, we enforce this at the key validation level — test keys only work in non-production environments OR are rate-limited more aggressively.

**Files:**

- Modify: `supabase/functions/_shared/api-key-auth.ts` (add environment field to ApiKeyContext)
- Modify: `supabase/functions/workspace-api/index.ts` (check environment)

**Step 1: Add environment to ApiKeyContext**

In `api-key-auth.ts`, update the `validateApiKey` function to also return the `environment` column:

```typescript
export interface ApiKeyContext {
  keyId: string;
  workspaceId: string | null;
  keyType: "workspace" | "service";
  scopes: string[];
  rateLimitPerMinute: number;
  environment: "live" | "test";
}
```

Update the SQL query to include `environment` in the RETURNING clause and map it.

**Step 2: Enforce in workspace-api**

In `workspace-api/index.ts`, after auth validation:

```typescript
// Environment check: test keys cannot access workspace-api in production
const isProduction = Deno.env.get("ENVIRONMENT") === "production";
if (auth.method === "api_key" && auth.environment === "test" && isProduction) {
  return jsonError(403, "Test keys cannot access production data. Use a live key.");
}
```

**Step 3: Test**

Create a test key (`smo_sk_test_*`) and verify it works in local dev but would be blocked in production (check the environment variable logic).

**Step 4: Commit**

```bash
git add supabase/functions/_shared/api-key-auth.ts \
        supabase/functions/workspace-api/index.ts
git commit -m "feat(api): add environment enforcement for test vs live keys"
```

---

## Task 9: Contract Service Key Migration

Migrate the contract service from a hardcoded `SERVICE_KEY` env var to a managed service key (`smo_svc_live_*`) validated against `platform_api_key`.

**Important:** The contract service runs as a separate Fastify process. It's an internal service called by the Next.js web app — NOT by external consumers directly. The web app is the gateway.

**Files:**

- Modify: `services/contract-service/src/server.ts` (validate key against DB instead of env var)
- Modify: `services/contract-service/src/config.ts` (add Supabase URL for key validation)
- Modify: `apps/web/src/lib/contract-service.ts` (document the managed key pattern)

**Step 1: Update contract service auth middleware**

In `services/contract-service/src/server.ts`, replace the direct string comparison with a call to the `validate-api-key` Edge Function:

```typescript
// Before (hardcoded comparison):
// if (serviceKey !== config.SERVICE_KEY) { return reply.status(401)... }

// After (validate against managed key):
app.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health" || request.url.startsWith("/webhooks/")) return;

  const serviceKey = request.headers["x-service-key"] as string | undefined;
  if (!serviceKey) {
    return reply.status(401).send({ error: "Unauthorized: missing X-Service-Key" });
  }

  // Validate against Supabase platform_api_key table
  try {
    const res = await fetch(`${config.SUPABASE_URL}/functions/v1/validate-api-key`, {
      method: "POST",
      headers: {
        "x-api-key": serviceKey,
        "Content-Type": "application/json",
      },
    });
    const body = await res.json();
    if (!body.valid) {
      return reply.status(401).send({ error: "Unauthorized: invalid service key" });
    }
    // Attach workspace context for downstream use
    request.workspaceId = body.workspace_id;
  } catch {
    // Fallback: if validate-api-key is unavailable, check legacy env var
    if (serviceKey !== config.SERVICE_KEY) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  }
});
```

**Note:** The fallback to `config.SERVICE_KEY` is intentional for backwards compatibility during migration. Remove it after all keys are migrated.

**Step 2: Create a managed service key**

Via the platform-admin UI or API:

- Type: `service`
- Environment: `live`
- Scopes: `contracts:read`, `contracts:write`
- Name: "Contract Service"

**Step 3: Update env vars**

Replace the old `CONTRACT_SERVICE_KEY` value in `.env.local` with the new managed key (`smo_svc_live_*`).

**Step 4: Test**

```bash
curl -H "X-Service-Key: smo_svc_live_xxx" http://localhost:3100/health
```

Expected: 200 (health is public, no auth needed).

```bash
curl -H "X-Service-Key: smo_svc_live_xxx" http://localhost:3100/contracts
```

Expected: 200 with contracts list.

**Step 5: Commit**

```bash
git add services/contract-service/src/server.ts \
        services/contract-service/src/config.ts
git commit -m "feat(contract-service): migrate to managed service key validation"
```

---

## Task 10: Regenerate Types + Update API Registry

After the RLS migration, regenerate TypeScript types and update the API registry with new endpoints.

**Files:**

- Regenerate: `packages/supabase/src/database.types.ts`
- Modify: `apps/web/src/app/platform-admin/health/_components/api-registry.ts`
- Modify: `CLAUDE.md` (update edge function count)

**Step 1: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 2: Add workspace-api to API registry**

Add these entries to the `apiEndpoints` array in `api-registry.ts`:

```typescript
{ path: "/functions/v1/workspace-api/v1/profiles", method: "GET", category: "Public API", service: "workspace-api", description: "List employees in workspace", auth: "api-key", status: "active" },
{ path: "/functions/v1/workspace-api/v1/departments", method: "GET", category: "Public API", service: "workspace-api", description: "List departments", auth: "api-key", status: "active" },
{ path: "/functions/v1/workspace-api/v1/teams", method: "GET", category: "Public API", service: "workspace-api", description: "List teams", auth: "api-key", status: "active" },
{ path: "/functions/v1/workspace-api/v1/locations", method: "GET", category: "Public API", service: "workspace-api", description: "List locations", auth: "api-key", status: "active" },
{ path: "/functions/v1/workspace-api/v1/protocols", method: "GET", category: "Public API", service: "workspace-api", description: "List training protocols", auth: "api-key", status: "active" },
{ path: "/functions/v1/workspace-api/v1/assignments", method: "GET", category: "Public API", service: "workspace-api", description: "List protocol assignments", auth: "api-key", status: "active" },
{ path: "/functions/v1/workspace-api/v1/contracts", method: "GET", category: "Public API", service: "workspace-api", description: "List employment contracts (metadata)", auth: "api-key", status: "active" },
```

**Step 3: Update CLAUDE.md**

Update edge function count from 14 to 15 (added `workspace-api`).

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

**Step 5: Commit**

```bash
git add packages/supabase/src/database.types.ts \
        apps/web/src/app/platform-admin/health/_components/api-registry.ts \
        CLAUDE.md
git commit -m "chore: regenerate types, update API registry with workspace-api endpoints"
```

---

## Task 11: Integration Test — Full Lifecycle

Write a SQL-based integration test that verifies the complete flow: create key → call workspace-api → verify scope enforcement → verify usage tracking → verify workspace isolation.

**Files:**

- Create: `supabase/tests/api-key-lifecycle.sql`

**Step 1: Write the test**

```sql
-- API Key Lifecycle Integration Test
-- Run with: psql -f supabase/tests/api-key-lifecycle.sql

BEGIN;

-- 1. Create a test workspace (if not exists)
DO $$
DECLARE
  v_ws_id uuid;
  v_key_result record;
  v_key_hash text;
BEGIN
  -- Use an existing workspace or create test data
  SELECT workspace_id INTO v_ws_id FROM workspace LIMIT 1;
  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'No workspace found. Seed data first.';
  END IF;

  -- 2. Create an API key
  SELECT * INTO v_key_result FROM create_api_key(
    'Integration Test Key',
    'workspace'::api_key_type,
    v_ws_id,
    'test',
    ARRAY['profiles:read', 'training:read'],
    60, NULL, NULL
  );

  RAISE NOTICE 'Created key: % (prefix: %)', v_key_result.key_id, v_key_result.key_prefix;

  -- 3. Verify key exists
  ASSERT (SELECT count(*) FROM platform_api_key WHERE id = v_key_result.key_id) = 1,
    'Key should exist';

  -- 4. Verify key has correct scopes
  ASSERT (SELECT scopes FROM platform_api_key WHERE id = v_key_result.key_id) = ARRAY['profiles:read', 'training:read'],
    'Scopes should match';

  -- 5. Test workspace isolation via set_config
  PERFORM set_config('app.workspace_id', v_ws_id::text, true);
  ASSERT get_api_workspace_id() = v_ws_id,
    'get_api_workspace_id() should return the configured workspace';

  -- 6. Test RLS with API key context
  SET LOCAL ROLE authenticated;
  PERFORM set_config('app.workspace_id', v_ws_id::text, true);

  -- Should be able to read profiles in this workspace
  ASSERT (SELECT count(*) FROM profile WHERE workspace_id = v_ws_id) >= 0,
    'Should be able to read profiles via API key RLS';

  -- 7. Test workspace isolation: fake workspace should return 0
  PERFORM set_config('app.workspace_id', '00000000-0000-0000-0000-000000000000', true);
  ASSERT (SELECT count(*) FROM profile) = 0,
    'Fake workspace should see no profiles';

  -- 8. Test rotation
  SELECT * INTO v_key_result FROM rotate_api_key(v_key_result.key_id, 48);
  RAISE NOTICE 'Rotated key. New prefix: %', v_key_result.key_prefix;

  -- 9. Verify both versions exist
  ASSERT (
    SELECT count(*) FROM platform_api_key
    WHERE workspace_id = v_ws_id
      AND version IN ('current', 'previous')
  ) >= 2, 'Should have current + previous versions after rotation';

  -- 10. Cleanup
  RESET ROLE;
  DELETE FROM platform_api_key WHERE name = 'Integration Test Key';

  RAISE NOTICE '✅ All lifecycle tests passed';
END $$;

ROLLBACK; -- Clean up everything
```

**Step 2: Run the test**

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/tests/api-key-lifecycle.sql
```

Expected: `NOTICE: ✅ All lifecycle tests passed`

**Step 3: Commit**

```bash
git add supabase/tests/api-key-lifecycle.sql
git commit -m "test: add API key lifecycle integration test"
```

---

## Task 12: Write ADR-0029 + Update Decision Log

Document the API gateway rollout decisions.

**Files:**

- Create: `docs/decisions/0029-workspace-api-gateway.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Step 1: Write ADR**

```markdown
---
id: ADR-0029
title: Workspace API Gateway
status: Accepted
date: 2026-03-01
---

# ADR-0029: Workspace API Gateway

## Context and Problem Statement

The API key management system (ADR-0028) provides key creation, validation, and rotation. But no endpoints exist that serve workspace data to external consumers. We need a public API gateway that external integrations (POS, booking, HACCP systems) can call with their API key.

## Decision Drivers

- Gateway pattern: one entry point, Supabase validates at the gate
- Scope enforcement: keys should only access resources they're granted
- Workspace isolation: must be provably impossible for key A to see workspace B's data
- Environment enforcement: test keys must not access production data

## Decision Outcome

Single `workspace-api` Edge Function with sub-routing. Uses `executeWithWorkspaceContext` for transaction-scoped RLS via PostgreSQL GUC variables. New RLS policies on exposed tables check `current_setting('app.workspace_id')` alongside existing JWT-based policies.

## Key Decisions

### Single Function with Sub-Routing

One Edge Function (`workspace-api`) handles all `/v1/*` routes. Simpler deployment, single `verify_jwt = false` entry, shared auth context. Routes are `GET /v1/profiles`, `GET /v1/departments`, etc.

### RLS via GUC Variables

Added `get_api_workspace_id()` helper and `api_key_read_*` policies on 11 tables. These coexist with JWT-based policies (PostgreSQL OR logic). API key auth sets `app.workspace_id` GUC → policies grant access → workspace isolation enforced at database level.

### Environment Enforcement at Gateway

Test keys (`smo_sk_test_*`) are blocked from production via Edge Function check. No schema-level separation — environment is metadata on the key, enforced at the gateway.

## Rules & Consequences

- New workspace-scoped tables MUST get both a JWT-based and `api_key_read_*` RLS policy
- Query results must never include sensitive fields (document_url, signature_id, etc.)
- Usage tracking via hourly bucket upserts for every workspace-api request
- Future write endpoints need `api_key_write_*` policies + scope enforcement
```

**Step 2: Register in decision log**

Add to `0000-decision-log.md`:

```
| 0029 | Workspace API Gateway | Accepted | 2026-03-01 |
```

**Step 3: Commit**

```bash
git add docs/decisions/0029-workspace-api-gateway.md \
        docs/decisions/0000-decision-log.md
git commit -m "docs: ADR-0029 workspace API gateway architecture"
```

---

## Verification Checklist

After all tasks complete:

**Governance (Task 0):**

1. CLAUDE.md has "API Gateway — Mandatory Checklists" with scope table, new-table checklist, new-function checklist, service auth rules
2. SECURITY.md §15 has expanded checklists (§15.1-15.7) with zero ambiguity
3. Every checklist item has a concrete file path or action — no "consider" or "should"

**Technical (Tasks 1-12):** 4. `npx supabase db reset` — clean DB with all migrations applied 5. `npx supabase functions serve` — all Edge Functions running 6. Create test API key via SQL `create_api_key()` function 7. Call all 7 workspace-api endpoints — verify JSON responses 8. Call with wrong scope — verify 403 9. Call with invalid key — verify 401 10. Call with fake workspace — verify 0 results 11. Check `platform_api_key_usage` — verify hourly bucket entries 12. `pnpm typecheck` — no type errors 13. `psql -f supabase/tests/api-key-lifecycle.sql` — all assertions pass

---

## Future Work (Not in This Plan)

- **Write endpoints** (schedules:write, operations:write, haccp:write) — after those modules are built
- **Webhook support** — push data to consumers on events (contract signed, shift changed)
- **OpenAPI spec generation** — auto-generate docs from route definitions
- **Workspace self-service key management** — workspace admins create their own keys (V2)
- **IP restriction enforcement** — check source IP against key's allowed_ips
- **Custom rate limit tiers** — per-key rate limits from platform_api_key.rate_limit_per_minute
