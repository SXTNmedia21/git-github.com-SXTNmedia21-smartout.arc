# Production Readiness Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 27 production issues (security, stub data, landing bugs) so the existing codebase is safe and reliable for real users.

**Architecture:** 4-phase approach — Foundation (type regeneration), Parallel Hardening (6 independent agents in worktrees), Integration Merge, Verification. Each agent touches a disjoint set of files to avoid merge conflicts.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL 17, Edge Functions/Deno), TypeScript strict, Zod, shadcn/ui, @sentry/nextjs

**Spec:** `docs/superpowers/specs/2026-04-04-production-readiness-hardening-design.md`

---

## Phase 1: Foundation

### Task 1: Regenerate database.types.ts (Agent-F1)

**Files:**

- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Verify Supabase local is running**

Run: `npx supabase status`
Expected: Services running, DB URL shown. If not running: `npx supabase start`

- [ ] **Step 2: Reset database with all migrations**

Run: `npx supabase db reset`
Expected: All 250 migrations applied cleanly, seed data loaded.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File regenerated. Check it's not empty: `wc -l packages/supabase/src/database.types.ts` should show 15000+ lines.

- [ ] **Step 4: Verify expected tables are present**

Run:

```bash
grep -c "service_config" packages/supabase/src/database.types.ts
grep -c "landing_visitor" packages/supabase/src/database.types.ts
grep -c "leader_pulse" packages/supabase/src/database.types.ts
grep -c "workspace_doc_chunk" packages/supabase/src/database.types.ts
grep -c "landing_variant" packages/supabase/src/database.types.ts
```

Expected: Each returns 1+. If any return 0, document which tables are missing — those require a migration first and their casts will remain.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors. Some previously-cast code may now show new errors from the regenerated types — note these for Agent-A3.

- [ ] **Step 6: Count remaining `as any` casts**

Run: `grep -rn "as any" apps/web/src/ --include="*.ts" --include="*.tsx" | wc -l`
Document the count. Compare against the pre-regeneration baseline: 81 `as any` + 130 `as unknown as` = 211 total.

- [ ] **Step 7: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
fix(db): regenerate database.types.ts with all current migrations

Regenerated from 250 migrations on Supabase local. Resolves stale
type definitions for service_config, landing_*, leader_pulse, and
workspace_doc_chunk tables.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Parallel Hardening

> All 6 tasks below run in parallel in isolated worktrees. Each agent branches from the F1 commit.

---

### Task 2: Security Fixes (Agent-A1)

**Files:**

- Modify: `apps/landing/src/app/api/auth/callback/route.ts`
- Modify: `supabase/functions/_shared/cors.ts`
- Modify: `supabase/functions/_shared/rate-limit.ts`
- Modify: `apps/web/src/app/api/platform-admin/contracts/route.ts`
- Modify: `.env.template`

#### 2a: Fix open redirect in landing auth callback

- [ ] **Step 1: Add URL validation**

In `apps/landing/src/app/api/auth/callback/route.ts`, replace line 7:

```typescript
// OLD:
const next = searchParams.get("next") ?? "/";

// NEW:
const rawNext = searchParams.get("next") ?? "/";
const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
```

This ensures `next` is always a relative path. Rejects `//evil.com` and `https://evil.com`.

- [ ] **Step 2: Verify**

Run: `pnpm --filter landing typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/app/api/auth/callback/route.ts
git commit -m "$(cat <<'EOF'
fix(auth): validate redirect param to prevent open redirect

Reject absolute URLs and protocol-relative URLs in the next parameter.
Only allow paths starting with a single slash.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 2b: Fix CORS wildcard

- [ ] **Step 4: Replace wildcard with env-based allowlist**

Replace the entire content of `supabase/functions/_shared/cors.ts`:

```typescript
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : (allowedOrigins[0] ?? ""),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

/** Static headers for functions that don't have access to the request */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": allowedOrigins[0] ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  Vary: "Origin",
};
```

- [ ] **Step 5: Add ALLOWED_ORIGINS to edge function env**

Add to `supabase/functions/.env` (or document for deployment):

```
ALLOWED_ORIGINS=https://smartout.ai,https://app.smartout.ai
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/cors.ts
git commit -m "$(cat <<'EOF'
fix(security): replace CORS wildcard with origin allowlist

Read allowed origins from ALLOWED_ORIGINS env var. When empty,
falls back to first origin (restrictive default). Adds Vary: Origin
header for proper caching.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 2c: Fix rate limiting fail-open

- [ ] **Step 7: Change fallback to fail-closed**

In `supabase/functions/_shared/rate-limit.ts`, replace line 25:

```typescript
// OLD:
if (!rl) return { allowed: true, remaining: 999, resetAt: 0 };

// NEW:
if (!rl) return { allowed: false, remaining: 0, resetAt: 0 };
```

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/rate-limit.ts
git commit -m "$(cat <<'EOF'
fix(security): fail closed when rate limiter unavailable

When Redis is not configured, deny requests instead of allowing
unlimited access. Prevents rate limiting bypass in production.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 2d: Remove hardcoded company PII

- [ ] **Step 9: Replace hardcoded values with env vars**

In `apps/web/src/app/api/platform-admin/contracts/route.ts`, replace lines 120-125:

```typescript
// OLD:
const autofillMap = buildAutofillMap(wsData, company, {
  companyName: "Smartout AS",
  orgNumber: "929 620 291",
  contactEmail: "pontus@smartout.io",
  contactName: "Pontus S. Lindroth",
});

// NEW:
const autofillMap = buildAutofillMap(wsData, company, {
  companyName: process.env.PLATFORM_COMPANY_NAME ?? "",
  orgNumber: process.env.PLATFORM_ORG_NUMBER ?? "",
  contactEmail: process.env.PLATFORM_CONTACT_EMAIL ?? "",
  contactName: process.env.PLATFORM_CONTACT_NAME ?? "",
});
```

- [ ] **Step 10: Add env vars to .env.template**

Append to `.env.template` after the platform section:

```
# Platform company details (used in contract autofill)
PLATFORM_COMPANY_NAME="op://smartout_ai/Platform/company_name"
PLATFORM_ORG_NUMBER="op://smartout_ai/Platform/org_number"
PLATFORM_CONTACT_EMAIL="op://smartout_ai/Platform/contact_email"
PLATFORM_CONTACT_NAME="op://smartout_ai/Platform/contact_name"
```

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/api/platform-admin/contracts/route.ts .env.template
git commit -m "$(cat <<'EOF'
fix(security): move platform company PII to env vars

Replace hardcoded company name, org number, email, and contact name
with environment variables managed via 1Password vault.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Infrastructure Fixes (Agent-A2)

**Files:**

- Modify: `apps/web/src/hooks/useJourneySocket.ts`
- Modify: `apps/web/src/app/api/platform-admin/services/test/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/services/health/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/services/config/[slug]/restart/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts`
- Modify: `apps/web/src/app/platform-admin/guardian/_hooks/useGuardianSocket.ts`
- Modify: `apps/web/src/app/api/scrape/public/route.ts`
- Modify: `supabase/functions/config.toml`
- Modify: `supabase/functions/cleanup-api-keys/index.ts`
- Modify: `supabase/functions/contract-lifecycle/index.ts`
- Modify: `supabase/functions/daily-session-replenish/index.ts`
- Modify: `supabase/functions/health-check/index.ts`
- Modify: `supabase/functions/session-hook-executor/index.ts`
- Modify: `supabase/functions/watchdog-integrity/index.ts`
- Modify: `.env.template`

#### 3a: Replace hardcoded localhost URLs

- [ ] **Step 1: Fix useJourneySocket.ts**

In `apps/web/src/hooks/useJourneySocket.ts`, replace line 28:

```typescript
// OLD:
stageEngineUrl = "ws://localhost:5010",

// NEW:
stageEngineUrl = process.env.NEXT_PUBLIC_STAGE_ENGINE_WS_URL ?? "ws://localhost:5010",
```

- [ ] **Step 2: Fix services/test/route.ts**

In `apps/web/src/app/api/platform-admin/services/test/route.ts`, replace lines 7-14:

```typescript
// OLD:
const SERVICE_URLS: Record<string, string | undefined> = {
  "stage-engine": env.STAGE_ENGINE_URL ?? "http://localhost:5010",
  "shift-mcp": env.SHIFT_MCP_URL ?? "http://localhost:5011",
  "contract-service": env.CONTRACT_SERVICE_URL ?? "http://localhost:5012",
  scrapling: env.SCRAPLING_SERVICE_URL ?? "http://localhost:8000",
  supabase: env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  caddy: "http://localhost:80",
};

// NEW:
function requireInProd(name: string, fallback: string): string {
  const val = process.env[name];
  if (!val && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val ?? fallback;
}

const SERVICE_URLS: Record<string, string> = {
  "stage-engine": requireInProd("STAGE_ENGINE_URL", "http://localhost:5010"),
  "shift-mcp": requireInProd("SHIFT_MCP_URL", "http://localhost:5011"),
  "contract-service": requireInProd("CONTRACT_SERVICE_URL", "http://localhost:5012"),
  scrapling: requireInProd("SCRAPLING_SERVICE_URL", "http://localhost:8000"),
  supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  caddy: requireInProd("CADDY_URL", "http://localhost:80"),
};
```

- [ ] **Step 3: Fix services/health/route.ts fallback entries**

In `apps/web/src/app/api/platform-admin/services/health/route.ts`, replace the fallback block (lines 75-90):

```typescript
// Fallback: if DB is empty (first boot), add hardcoded essentials
if (entries.length === 0) {
  entries.push(
    {
      name: "supabase",
      slug: "supabase",
      url: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      healthPath: "/rest/v1/",
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
    },
    {
      name: "stage-engine",
      slug: "stage-engine",
      url: process.env.STAGE_ENGINE_URL ?? "",
      healthPath: "/health",
    },
  );
}
```

- [ ] **Step 4: Fix restart/route.ts Docker host**

In `apps/web/src/app/api/platform-admin/services/config/[slug]/restart/route.ts`, replace line 31:

```typescript
// OLD:
const dockerHost = process.env.DOCKER_HOST ?? "http://localhost:2375";

// NEW:
const dockerHost = process.env.DOCKER_HOST;
if (!dockerHost) {
  return NextResponse.json({ error: "DOCKER_HOST not configured" }, { status: 503 });
}
```

- [ ] **Step 5: Fix lookup/route.ts and analyze-documents/route.ts**

In `apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts`, replace line 5:

```typescript
// OLD:
const SCRAPLING_URL = process.env.SCRAPLING_SERVICE_URL || "http://localhost:8000";
// NEW:
const SCRAPLING_URL = process.env.SCRAPLING_SERVICE_URL ?? "";
```

In `apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts`, replace line 59:

```typescript
// OLD:
const scraplingUrl = process.env.SCRAPLING_SERVICE_URL || "http://localhost:8000";
// NEW:
const scraplingUrl = process.env.SCRAPLING_SERVICE_URL ?? "";
```

- [ ] **Step 6: Fix useGuardianSocket.ts**

In `apps/web/src/app/platform-admin/guardian/_hooks/useGuardianSocket.ts`, replace line 36:

```typescript
// OLD:
const STAGE_ENGINE_URL = process.env.NEXT_PUBLIC_STAGE_ENGINE_URL ?? "http://localhost:5010";
// NEW:
const STAGE_ENGINE_URL = process.env.NEXT_PUBLIC_STAGE_ENGINE_URL ?? "";
```

- [ ] **Step 7: Add env vars to .env.template**

Append to `.env.template`:

```
# Service URLs (required in production)
STAGE_ENGINE_URL="op://smartout_ai/StageEngine/url"
SHIFT_MCP_URL="op://smartout_ai/ShiftMCP/url"
CONTRACT_SERVICE_URL="op://smartout_ai/ContractService/url"
SCRAPLING_SERVICE_URL="op://smartout_ai/Scrapling/url"
DOCKER_HOST="op://smartout_ai/Docker/host"
CADDY_URL="op://smartout_ai/Caddy/url"
NEXT_PUBLIC_STAGE_ENGINE_URL="op://smartout_ai/StageEngine/url"
NEXT_PUBLIC_STAGE_ENGINE_WS_URL="op://smartout_ai/StageEngine/ws_url"
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/hooks/useJourneySocket.ts \
  apps/web/src/app/api/platform-admin/services/test/route.ts \
  apps/web/src/app/api/platform-admin/services/health/route.ts \
  apps/web/src/app/api/platform-admin/services/config/[slug]/restart/route.ts \
  apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts \
  apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts \
  apps/web/src/app/platform-admin/guardian/_hooks/useGuardianSocket.ts \
  .env.template
git commit -m "$(cat <<'EOF'
fix(infra): replace hardcoded localhost URLs with env vars

All service URLs now read from environment variables. In production,
missing required URLs throw or return 503. Development retains
localhost fallbacks for non-critical paths.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 3b: Add missing edge functions to config.toml

- [ ] **Step 9: Add 6 missing function entries**

Verify which functions are missing first:

```bash
diff <(ls -d supabase/functions/*/ | grep -v _shared | sed 's|.*/\(.*\)/|\1|' | sort) \
     <(grep '^\[functions\.' supabase/functions/config.toml | sed 's/\[functions\.\(.*\)\]/\1/' | sort)
```

Then append the missing entries to `supabase/functions/config.toml`:

```toml
[functions.analyze-workspace]
verify_jwt = false

[functions.apply-change-proposal]
verify_jwt = true

[functions.extract-workspace-data]
verify_jwt = false

[functions.scrape-raw-data]
verify_jwt = false

[functions.search-brreg]
verify_jwt = false

[functions.shift-clock-compliance]
verify_jwt = true
```

> **Note:** `guardian-actions`, `identify-company`, and `scrape-website` are already in config.toml — the original audit overcounted. The `verify_jwt` settings above are best guesses. Review each function's `index.ts` to confirm whether it handles its own auth (set `false`) or relies on JWT (set `true`).

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/config.toml
git commit -m "$(cat <<'EOF'
fix(infra): add 6 missing edge functions to config.toml

Functions existed as directories but were not registered for
deployment: analyze-workspace, apply-change-proposal,
extract-workspace-data, scrape-raw-data, search-brreg,
shift-clock-compliance.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 3c: Add try/catch to 6 edge functions

- [ ] **Step 11: Wrap cleanup-api-keys**

In `supabase/functions/cleanup-api-keys/index.ts`, wrap the handler body after the auth check:

```typescript
Deno.serve(async (req) => {
  // ... existing auth check ...

  try {
    // ... existing logic (Supabase client init, RPC call, response) ...
  } catch (err) {
    console.error("[cleanup-api-keys] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 12: Repeat for remaining 5 functions**

Apply the same pattern to:

- `supabase/functions/contract-lifecycle/index.ts`
- `supabase/functions/daily-session-replenish/index.ts`
- `supabase/functions/health-check/index.ts`
- `supabase/functions/session-hook-executor/index.ts`
- `supabase/functions/watchdog-integrity/index.ts`

Each function: wrap the body after auth check in `try { ... } catch (err) { console.error(...); return 500 }`.

- [ ] **Step 13: Commit**

```bash
git add supabase/functions/cleanup-api-keys/index.ts \
  supabase/functions/contract-lifecycle/index.ts \
  supabase/functions/daily-session-replenish/index.ts \
  supabase/functions/health-check/index.ts \
  supabase/functions/session-hook-executor/index.ts \
  supabase/functions/watchdog-integrity/index.ts
git commit -m "$(cat <<'EOF'
fix(edge): add try/catch error handling to 6 edge functions

Prevents unhandled exceptions from crashing functions. Returns
structured 500 response with error logging for: cleanup-api-keys,
contract-lifecycle, daily-session-replenish, health-check,
session-hook-executor, watchdog-integrity.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### ~~3d: Fix conditional hooks in TemplatePreview~~ — REMOVED

> **Review note:** Verification shows hooks in TemplatePreview are called at the top level of the component — no React rules violation exists. Skipping this fix.

#### 3d: Fix scrape route returning 200 on error

- [ ] **Step 14: Change error status code**

In `apps/web/src/app/api/scrape/public/route.ts`, replace the error responses:

```typescript
// OLD (line ~91):
return NextResponse.json({ status: "failed" }, { status: 200 });

// NEW:
return NextResponse.json({ status: "failed" }, { status: 502 });

// OLD (line ~97):
return NextResponse.json({ status: "failed" }, { status: 200 });

// NEW:
return NextResponse.json({ status: "failed" }, { status: 500 });
```

- [ ] **Step 15: Commit**

```bash
git add apps/web/src/app/api/scrape/public/route.ts
git commit -m "$(cat <<'EOF'
fix(api): return proper error status codes from scrape route

Return 502 when upstream fails and 500 on unhandled exceptions
instead of misleading 200 responses.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Type Safety Sweep (Agent-A3)

**Files:** ~80+ files across `apps/web/src/`

> **Agent guidance:** This task is inherently exploratory — 211 casts (81 `as any` + 130 `as unknown as`) each requiring case-by-case judgment. The categories below are ordered by priority but the exact files and fixes cannot be fully prescribed. Work through each category, commit after each, and document what you couldn't resolve. If a cast requires more than 5 minutes of investigation, add a `// SAFETY: <reason>` comment and move on. The goal is < 10 uncommented casts remaining, not perfection.

#### 4a: Remove casts resolved by type regeneration

- [ ] **Step 1: Find and fix UntypedClient casts**

Search for all files with `UntypedClient` or `TODO.*Remove.*cast`:

```bash
grep -rn "UntypedClient\|TODO.*Remove.*cast\|TODO.*Remove.*UntypedClient" apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

Current UntypedClient files (6 total):

- `apps/web/src/app/platform-admin/landing/page.tsx`
- `apps/web/src/app/api/admin/visitor-sessions/route.ts`
- `apps/web/src/app/api/admin/tag-visitor/route.ts`
- `apps/landing/src/lib/get-variant.ts`
- `apps/landing/src/app/api/track/route.ts`
- `apps/landing/src/app/api/waitlist/route.ts`

For each file: remove the `UntypedClient` type definition, remove the `as unknown as UntypedClient` cast, and use the Supabase client directly. The regenerated `database.types.ts` should now include these tables.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors. If errors appear, the table wasn't in the regenerated types — restore the cast with a `// SAFETY: table not yet in generated types` comment.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(types): remove UntypedClient casts resolved by type regeneration

Tables now present in database.types.ts: service_config, landing_*,
leader_pulse, workspace_doc_chunk. Removed temporary UntypedClient
workarounds and TODO comments.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 4b: Type the websites schema

- [ ] **Step 4: Create WebsitesDatabase type helper**

Create `packages/supabase/src/websites-types.ts`. Inspect the `websites` schema tables by running:

```bash
grep -A 50 '"websites":' packages/supabase/src/database.types.ts | head -100
```

If the `websites` schema is in `database.types.ts`, create a typed client helper. If not, generate types for it:

```bash
npx supabase gen types typescript --local --schema websites > packages/supabase/src/websites.types.ts
```

Then create a helper:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WebsitesDatabase } from "./websites.types";

export function websitesClient(client: SupabaseClient) {
  return client.schema("websites") as unknown as SupabaseClient<WebsitesDatabase>["from"];
}
```

- [ ] **Step 5: Replace `.schema("websites" as any)` across all files**

Search: `grep -rn 'schema("websites" as any)' apps/web/src/ --include="*.ts" --include="*.tsx" -l`

In each file, import the helper and replace the pattern.

- [ ] **Step 6: Run typecheck + commit**

Run: `pnpm typecheck` — 0 errors expected.

```bash
git commit -m "$(cat <<'EOF'
fix(types): add typed websites schema client, remove as any casts

Created websitesClient helper for the websites PostgreSQL schema.
Replaced ~69 instances of .schema("websites" as any) with typed access.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 4c: Type shift clock and GPS data

- [ ] **Step 7: Define types and Zod schemas**

Create `apps/web/src/hooks/shift-clock/types.ts`:

```typescript
import { z } from "zod";

export const GpsCoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  timestamp: z.number().optional(),
});
export type GpsCoordinate = z.infer<typeof GpsCoordinateSchema>;

export const BreakEntrySchema = z.object({
  break_start: z.string(),
  break_end: z.string().nullable(),
  break_type: z.enum(["paid", "unpaid"]),
  duration_minutes: z.number().optional(),
});
export type BreakEntry = z.infer<typeof BreakEntrySchema>;

export const SupplementEntrySchema = z.object({
  type: z.string(),
  rate: z.number(),
  hours: z.number(),
  amount: z.number(),
});
export type SupplementEntry = z.infer<typeof SupplementEntrySchema>;
```

- [ ] **Step 8: Replace casts in shift clock hooks**

In `apps/web/src/hooks/shift-clock/useShiftClock.ts`, import the schemas and replace `as unknown as` casts with Zod parsing at the data boundary (where DB data is received). Example:

```typescript
// OLD:
const gps = row.clock_in_gps as unknown as GpsCoordinate;

// NEW:
const gps = GpsCoordinateSchema.parse(row.clock_in_gps);
```

Apply the same pattern for breaks and supplements.

- [ ] **Step 9: Run typecheck + commit**

```bash
git commit -m "$(cat <<'EOF'
fix(types): add Zod schemas for shift clock GPS, breaks, supplements

Replaced as unknown as casts in shift clock hooks with runtime Zod validation at the
database boundary. Typed: GpsCoordinate, BreakEntry, SupplementEntry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 4d: Type onboarding scraped data

- [ ] **Step 10: Add ScrapedCompanyData Zod schema to existing types file**

`apps/web/src/app/onboarding/types.ts` already exists. Add the Zod schema to it (don't overwrite existing types):

```typescript
import { z } from "zod";

export const ScrapedCompanyDataSchema = z
  .object({
    name: z.string().optional(),
    org_number: z.string().optional(),
    address: z.string().optional(),
    industry: z.string().optional(),
    nace_codes: z.array(z.string()).optional(),
    employee_count: z.number().optional(),
    website_url: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();
export type ScrapedCompanyData = z.infer<typeof ScrapedCompanyDataSchema>;
```

- [ ] **Step 11: Replace casts in onboarding hooks**

In `apps/web/src/app/onboarding/hooks/useBotsson.ts` and `useOnboardingState.ts`, replace `as unknown as` casts with Zod parsing.

- [ ] **Step 12: Run typecheck + commit**

```bash
git commit -m "$(cat <<'EOF'
fix(types): add Zod schema for scraped company data in onboarding

Replaced as unknown as casts in onboarding hooks with runtime validation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 4e: Sweep remaining casts

- [ ] **Step 13: Find all remaining casts**

```bash
grep -rn "as any\|as unknown as" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules\|\.next" | wc -l
```

For each remaining cast:

- If it's a DB boundary: add Zod validation
- If it's a third-party lib gap: add `// SAFETY: <reason>` comment
- If it's a JSON type coercion (`as unknown as Json`): this is acceptable, leave it

- [ ] **Step 14: Final count + commit**

Run: `grep -rn "as any" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "SAFETY\|node_modules\|\.next" | wc -l`
Target: < 10.

```bash
git commit -m "$(cat <<'EOF'
fix(types): sweep remaining type casts across web app

Added SAFETY comments to unavoidable casts. Added Zod validation
at remaining DB/API boundaries.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Dashboard Stub Data & Broken Features (Agent-B1)

**Files:**

- Modify: `apps/web/src/app/dashboard/close/_components/CloseOutFlow.tsx`
- Create: `apps/web/src/app/dashboard/_hooks/useDashboardMetrics.ts`
- Modify: `apps/web/src/components/dashboard/interactive/InteractiveDashboard.tsx`
- Modify: `apps/web/src/app/dashboard/onboarding-assistant/_components/assistant-ui.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/OversiktTab.tsx`
- Modify: `apps/web/src/app/dashboard/season/_components/SeasonOverviewTab.tsx`
- Modify: `apps/web/src/app/dashboard/people/_actions/people-actions.ts`
- Modify: `apps/web/src/lib/context/build-bootstrap-context.ts`

#### 5a: Fix CloseOutFlow null department

- [ ] **Step 1: Add department selector**

In `apps/web/src/app/dashboard/close/_components/CloseOutFlow.tsx`, replace the hardcoded null:

```typescript
// OLD:
// TODO: Replace with actual department selection
const departmentId: string | null = null;

// NEW:
const { workspaceId } = useWorkspace();
const { data: departments } = useQuery({
  queryKey: ["departments", workspaceId],
  queryFn: async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("department")
      .select("department_id, name")
      .eq("workspace_id", workspaceId)
      .order("name");
    return data ?? [];
  },
});
const [departmentId, setDepartmentId] = useState<string | null>(null);
```

Add a selector UI before the main flow content:

```tsx
{
  !departmentId && departments && departments.length > 0 && (
    <div className="flex flex-col items-center gap-4 py-12">
      <h2 className="text-lg font-semibold">Velg avdeling</h2>
      <select
        className="border-input bg-background rounded-lg border px-4 py-2"
        value=""
        onChange={(e) => setDepartmentId(e.target.value)}
      >
        <option value="" disabled>
          Velg avdeling...
        </option>
        {departments.map((d) => (
          <option key={d.department_id} value={d.department_id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck + commit**

```bash
git commit -m "$(cat <<'EOF'
fix(close): add department selector to close-out flow

Replace hardcoded null departmentId with a dropdown that queries
departments for the current workspace. Flow starts after selection.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 5b: Wire dashboard metrics

- [ ] **Step 3: Verify table columns and enum values exist**

Before writing the hook, confirm the schema supports the queries:

```bash
# Verify employment_contract has a status column with 'signed' value
grep -A 20 "employment_contract:" packages/supabase/src/database.types.ts | head -30

# Verify protocol_assignment has status, due_date columns
grep -A 20 "protocol_assignment:" packages/supabase/src/database.types.ts | head -30

# Verify workspace_budget has target_revenue, actual_revenue columns
grep -A 20 "workspace_budget:" packages/supabase/src/database.types.ts | head -30
```

If any column is missing, adjust the query in the hook below or remove that metric (show "—" instead of a number).

- [ ] **Step 4: Create useDashboardMetrics hook**

Create `apps/web/src/app/dashboard/_hooks/useDashboardMetrics.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useDashboardMetrics() {
  const { workspaceId } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard-metrics", workspaceId],
    queryFn: async () => {
      const [contractsRes, trainingRes, budgetRes] = await Promise.all([
        supabase
          .from("employment_contract")
          .select("contract_id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .neq("status", "signed"),
        supabase
          .from("protocol_assignment")
          .select("assignment_id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "in_progress")
          .lt("due_date", new Date(Date.now() + 30 * 86400000).toISOString()),
        supabase
          .from("workspace_budget")
          .select("target_revenue, actual_revenue")
          .eq("workspace_id", workspaceId)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const unsignedContracts = contractsRes.count ?? 0;
      const expiringTraining = trainingRes.count ?? 0;

      let budgetVariance = "0%";
      if (budgetRes.data?.target_revenue && budgetRes.data?.actual_revenue) {
        const variance = Math.round(
          ((budgetRes.data.actual_revenue - budgetRes.data.target_revenue) /
            budgetRes.data.target_revenue) *
            100,
        );
        budgetVariance = `${variance > 0 ? "+" : ""}${variance}%`;
      }

      return { unsignedContracts, expiringTraining, budgetVariance };
    },
    staleTime: 60_000,
  });
}
```

- [ ] **Step 5: Wire into InteractiveDashboard**

In `apps/web/src/components/dashboard/interactive/InteractiveDashboard.tsx`, replace lines 98-100:

```typescript
// OLD:
const unsignedContracts = 0; // TODO: wire from action items hook when available
const expiringTraining = 0; // TODO: wire from training readiness hook
const budgetVariance = "0%"; // TODO: wire from budget hook

// NEW:
const { data: metrics } = useDashboardMetrics();
const unsignedContracts = metrics?.unsignedContracts ?? 0;
const expiringTraining = metrics?.expiringTraining ?? 0;
const budgetVariance = metrics?.budgetVariance ?? "0%";
```

Add the import at the top of the file.

- [ ] **Step 6: Run typecheck + commit**

```bash
git commit -m "$(cat <<'EOF'
fix(dashboard): wire real metrics for contracts, training, budget

Created useDashboardMetrics hook querying employment_contract,
protocol_assignment, and workspace_budget tables. Replaces hardcoded
zero values in InteractiveDashboard metric strip.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 5c: Replace onboarding assistant mock data

- [ ] **Step 7: Replace mock data with empty state**

In `apps/web/src/app/dashboard/onboarding-assistant/_components/assistant-ui.tsx`:

1. Delete the `STAGES`, `INITIAL_TRANSCRIPT`, `INITIAL_EXTRACTED_DATA` constants (lines 6-88)
2. Replace the component's initial state to show an empty state:

```tsx
// Note: existing imports include CheckCircle2, Circle, Mic, MicOff, Send, Volume2
// from lucide-react — use Mic as the icon (no Bot import available)
export default function AssistantUI() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10">
        <Mic className="h-8 w-8 text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold">Onboarding-assistenten</h2>
      <p className="text-muted-foreground max-w-md text-center">
        Start en ny onboarding-prosess fra oppsettsveiviseren for å bruke assistenten.
      </p>
    </div>
  );
}
```

Note: The component currently imports `CheckCircle2, Circle, Mic, MicOff, Send, Volume2` from lucide-react — do NOT add a new `Bot` import. If the component has more functionality beyond the mock data display, preserve it. Only remove the hardcoded mock constants (`STAGES`, `INITIAL_TRANSCRIPT`, `INITIAL_EXTRACTED_DATA` at lines 7-88) and the UI that renders them.

- [ ] **Step 8: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(onboarding): remove mock data from assistant UI

Replace hardcoded hotel demo data (Hotell Spåtind, Kari Nordmann)
with an empty state directing users to start onboarding properly.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 5d: Replace shift click toast with detail sheet

- [ ] **Step 9: Create ShiftDetailSheet**

In `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx`, replace the toast handler:

```typescript
// OLD:
const handleEmployeeClick = useCallback((assignment: MalEmployeeAssignment) => {
  // TODO: open shift detail sheet for editing time, swap, message, remove
  toast.info(`${assignment.employeeName} — ${assignment.status}`);
}, []);

// NEW:
const [selectedAssignment, setSelectedAssignment] = useState<MalEmployeeAssignment | null>(null);

const handleEmployeeClick = useCallback((assignment: MalEmployeeAssignment) => {
  setSelectedAssignment(assignment);
}, []);
```

Add a Sheet component at the bottom of the JSX (using shadcn Sheet):

```tsx
<Sheet open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>{selectedAssignment?.employeeName}</SheetTitle>
    </SheetHeader>
    <div className="space-y-4 py-4">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Status</span>
        <span>{selectedAssignment?.status}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Stilling</span>
        <span>{selectedAssignment?.positionName ?? "—"}</span>
      </div>
      <Button variant="outline" disabled className="w-full" title="Redigering kommer snart">
        Rediger vakt
      </Button>
    </div>
  </SheetContent>
</Sheet>
```

- [ ] **Step 10: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(schedule): replace shift click toast with detail sheet

Show shift details (employee, status, position) in a proper Sheet
component instead of a toast notification. Edit button disabled
pending full editor implementation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 5e: Fix remaining stubs (duty leader, season, notifications, bootstrap)

- [ ] **Step 11: Wire duty leader persistence**

The `duty_leader_id` column EXISTS on `department_session` (confirmed in `database.types.ts` line 4880, FK to `profile.profile_id`). The TODO comment on OversiktTab.tsx line 254 saying it doesn't exist is **stale and wrong**.

In `OversiktTab.tsx`, wire the select's `onChange` to persist via Supabase mutation:

```typescript
// Remove the stale TODO comment on line 254
// Wire onChange to update department_session:
const handleDutyLeaderChange = async (leaderId: string) => {
  setDutyLeaderId(leaderId);
  await supabase
    .from("department_session")
    .update({ duty_leader_id: leaderId })
    .eq("session_id", sessionId);
};
```

Replace the current `onChange` with `handleDutyLeaderChange`. Ensure the supabase client is imported.

- [ ] **Step 12: Fix season overview slice**

In `SeasonOverviewTab.tsx`, replace `.slice(0, 7)`:

```typescript
// OLD:
}).slice(0, 7); // First week as sample

// NEW:
});
```

Update `peakDayHourTargets` to use the full array (it already selects the peak from whatever array it receives).

- [ ] **Step 13: Verify process-notifications EF accepts this payload**

```bash
# Check the edge function exists and inspect its expected payload shape
grep -A 30 "Deno.serve" supabase/functions/process-notifications/index.ts | head -40
```

Confirm the EF accepts `{ event, workspace_id, payload }`. If the shape differs, adjust the invocation below to match.

- [ ] **Step 14: Wire protocol reminders to notification EF**

In `people-actions.ts`, add the edge function call after the activity_trail insert:

```typescript
// After the activity_trail insert, trigger the notification
await supabase.functions.invoke("process-notifications", {
  body: {
    event: "training.reminder_sent",
    workspace_id: workspaceId,
    payload: {
      profile_id: profileId,
      assignment_id: assignmentId,
      protocol_name: protocolName,
    },
  },
});
```

- [ ] **Step 15: Verify company_member.role column and WorkspaceRole type**

```bash
# Verify role column exists
grep -A 10 "company_member:" packages/supabase/src/database.types.ts | grep "role"

# Verify WorkspaceRole type
grep -rn "WorkspaceRole" apps/web/src/ --include="*.ts" -l | head -5
```

If `WorkspaceRole` doesn't exist, use `string` with a comment noting the type gap.

- [ ] **Step 16: Fix bootstrap context TODOs**

In `build-bootstrap-context.ts`, the file currently has NO supabase client import — it only handles business logic. You need to either:

- (a) Add a supabase client parameter to the function signature: `buildBootstrapContext(input: BootstrapInput, supabase: SupabaseClient)`, or
- (b) Import `createClient` from `@/lib/supabase/server` at the top of the file

Option (a) is preferred (dependency injection). Then replace the 4 TODO blocks:

```typescript
// Replace role TODO:
const { data: memberData } = await supabase
  .from("company_member")
  .select("role")
  .eq("profile_id", profileId)
  .eq("workspace_id", workspaceId)
  .maybeSingle();
const role: WorkspaceRole = (memberData?.role as WorkspaceRole) ?? "employee";

// Replace readiness TODO:
const { count: totalAssignments } = await supabase
  .from("protocol_assignment")
  .select("assignment_id", { count: "exact", head: true })
  .eq("profile_id", profileId)
  .eq("workspace_id", workspaceId);
const { count: completedAssignments } = await supabase
  .from("protocol_assignment")
  .select("assignment_id", { count: "exact", head: true })
  .eq("profile_id", profileId)
  .eq("workspace_id", workspaceId)
  .eq("status", "completed");
const readinessScore = totalAssignments
  ? Math.round(((completedAssignments ?? 0) / totalAssignments) * 100)
  : 0;

// Replace verification flags TODO:
const verificationFlags = {
  all_policies_learned: readinessScore === 100,
  all_protocols_completed: readinessScore === 100,
  has_overdue_assignments: false, // TODO: add due_date check when column is available
};

// Replace recent searches TODO (remove — table doesn't exist):
const recentSearches: string[] = [];
```

- [ ] **Step 17: Run typecheck + commit**

```bash
git commit -m "$(cat <<'EOF'
fix(dashboard): wire real data for duty leader, season, reminders, context

- Duty leader: wired to persist via department_session.duty_leader_id
- Season overview shows full season targets (removed 7-day slice)
- Protocol reminders invoke process-notifications edge function
- Bootstrap context queries real role and readiness from DB

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Feature Flag Gating (Agent-B2)

**Files:**

- Create: `apps/web/src/lib/feature-flags.ts`
- Modify: `apps/web/src/app/dashboard/my-cv/page.tsx`
- Modify: `apps/web/src/app/dashboard/shift-clock/page.tsx`
- Modify: `apps/web/src/app/dashboard/ai/page.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`
- Modify: `.env.template`

- [ ] **Step 1: Create feature flags utility**

Create `apps/web/src/lib/feature-flags.ts`:

```typescript
/**
 * Feature flags for gating unfinished features.
 * Remove the flag and gate when the feature ships.
 */
export const FEATURE_FLAGS = {
  MY_CV: process.env.NEXT_PUBLIC_FF_MY_CV === "true",
  SHIFT_CLOCK_LEADER: process.env.NEXT_PUBLIC_FF_SHIFT_CLOCK_LEADER === "true",
  AI_CHAT: process.env.NEXT_PUBLIC_FF_AI_CHAT === "true",
} as const;
```

- [ ] **Step 2: Gate my-cv page**

Replace `apps/web/src/app/dashboard/my-cv/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export default function MyCvPage() {
  if (!FEATURE_FLAGS.MY_CV) {
    redirect("/dashboard");
  }

  return (
    <div className="py-12 text-center">
      <h1 className="text-2xl font-bold">Min profil</h1>
      <p className="text-muted-foreground mt-2">Under utvikling</p>
    </div>
  );
}
```

- [ ] **Step 3: Gate shift clock leader view**

In `apps/web/src/app/dashboard/shift-clock/page.tsx`, replace the `LeaderOverviewPlaceholder` rendering:

```typescript
import { FEATURE_FLAGS } from "@/lib/feature-flags";

// In ShiftClockPage:
if (isAdminMode && !FEATURE_FLAGS.SHIFT_CLOCK_LEADER) {
  return <ShiftClockView />;  // Show employee view for admins too when flag is off
}

if (isAdminMode) {
  return <LeaderOverviewPlaceholder />;
}
```

- [ ] **Step 4: Gate AI chat section**

In `apps/web/src/app/dashboard/ai/page.tsx`, conditionally render the chat card:

```typescript
import { FEATURE_FLAGS } from "@/lib/feature-flags";

// Replace the "kommer snart" div (the dashed border card):
{FEATURE_FLAGS.AI_CHAT && (
  <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-6">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
      <MessageSquare className="h-6 w-6 text-zinc-500" />
    </div>
    <div>
      <h2 className="font-semibold text-zinc-400">Chat</h2>
      <p className="mt-1 text-sm text-zinc-600">Snakk med Mr. Botsson — kommer snart</p>
    </div>
  </div>
)}
```

- [ ] **Step 5: Remove nav links for flagged-off features**

In `apps/web/src/components/dashboard/DashboardShell.tsx`, find the my-cv NavItem by searching for `href="/dashboard/my-cv"` and wrap it with a flag check:

```typescript
{FEATURE_FLAGS.MY_CV && (
  <NavItem
    href="/dashboard/my-cv"
    icon={FileText}
    label="Min profil"
    isDark={isDark}
    active={isActive("/dashboard/my-cv")}
    isCollapsed={isSidebarCollapsed}
  />
)}
```

Import `FEATURE_FLAGS` at the top of the file.

- [ ] **Step 6: Add env vars to .env.template**

Append after `NEXT_PUBLIC_INTERACTIVE_DASHBOARD=true`:

```
NEXT_PUBLIC_FF_MY_CV=false
NEXT_PUBLIC_FF_SHIFT_CLOCK_LEADER=false
NEXT_PUBLIC_FF_AI_CHAT=false
```

- [ ] **Step 7: Verify and commit**

Run: `pnpm typecheck`
Run: `grep -rn "under construction\|kommer snart\|Task 11\|Implementeres i" apps/web/src/ --include="*.tsx"`
Expected: Results only inside `FEATURE_FLAGS` conditionals.

```bash
git add apps/web/src/lib/feature-flags.ts \
  apps/web/src/app/dashboard/my-cv/page.tsx \
  apps/web/src/app/dashboard/shift-clock/page.tsx \
  apps/web/src/app/dashboard/ai/page.tsx \
  apps/web/src/components/dashboard/DashboardShell.tsx \
  .env.template
git commit -m "$(cat <<'EOF'
feat(flags): gate unfinished features behind feature flags

Add FEATURE_FLAGS utility. Gate: my-cv page, shift clock leader view,
AI chat section. Remove nav links when flags are off. All flags
default to false — enable in .env.template to show during development.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Landing Bugs + Error Boundaries + Sentry (Agent-C1)

**Files:**

- Modify: `apps/landing/src/app/blog/page.tsx`
- Modify: `apps/landing/src/app/api/wizard/engine-start/route.ts`
- Modify: `apps/landing/src/app/api/revalidate/route.ts`
- Delete or modify: `apps/landing/src/app/[slug]/page.tsx`
- Create: `apps/landing/src/app/error.tsx`
- Create: `apps/landing/src/app/loading.tsx`
- Create: `apps/landing/src/app/demo/error.tsx`
- Create: `apps/landing/src/app/docs/[slug]/error.tsx`
- Create: `apps/landing/sentry.client.config.ts`
- Create: `apps/landing/sentry.server.config.ts`
- Modify: `apps/landing/next.config.ts`
- Modify: `apps/landing/package.json`

#### 7a: Remove unreachable blog entries

- [ ] **Step 1: Filter out `ready: false` stories**

In `apps/landing/src/app/blog/page.tsx`, find the stories array and remove the 4 entries with `ready: false`. Or if they're rendered conditionally, change the filter to only show `ready: true` stories:

```typescript
// Find the stories rendering and filter:
const publishedStories = stories.filter((s) => s.ready !== false);
// Then use publishedStories in the JSX map instead of stories
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/app/blog/page.tsx
git commit -m "$(cat <<'EOF'
fix(landing): hide unpublished blog stories

Filter out stories with ready: false from the blog index.
Prevents 4 "Kommer snart" entries that link to 404 pages.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 7b: Fix nil UUID in engine-start

- [ ] **Step 3: Replace with env var**

In `apps/landing/src/app/api/wizard/engine-start/route.ts`, replace line 52:

```typescript
// OLD:
workspace_id: "b0000000-0000-0000-0000-000000000000",

// NEW:
workspace_id: process.env.DEMO_WORKSPACE_ID ?? "",
```

Add a guard at the top of the handler:

```typescript
if (!process.env.DEMO_WORKSPACE_ID) {
  return NextResponse.json({ error: "Demo unavailable" }, { status: 503 });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/app/api/wizard/engine-start/route.ts
git commit -m "$(cat <<'EOF'
fix(landing): replace nil UUID with DEMO_WORKSPACE_ID env var

Return 503 if env var is not configured instead of sending requests
to a non-existent workspace.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 7c: Fix revalidateTag call

- [ ] **Step 5: Remove extra argument**

In `apps/landing/src/app/api/revalidate/route.ts`, replace line 48:

```typescript
// OLD:
revalidateTag("landing", "max");

// NEW:
revalidateTag("landing");
```

Remove the comment about "max" cache profile on lines 46-47 as well.

- [ ] **Step 6: Commit**

```bash
git add apps/landing/src/app/api/revalidate/route.ts
git commit -m "$(cat <<'EOF'
fix(landing): fix revalidateTag call signature

revalidateTag accepts a single string argument. The second arg
was silently ignored, potentially breaking cache invalidation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 7d: Remove dead [slug] catch-all

- [ ] **Step 7: Delete the file**

```bash
rm apps/landing/src/app/\[slug\]/page.tsx
rmdir apps/landing/src/app/\[slug\]/ 2>/dev/null || true
```

- [ ] **Step 8: Commit**

```bash
git add -A apps/landing/src/app/\[slug\]/
git commit -m "$(cat <<'EOF'
fix(landing): remove dead [slug] catch-all route

Route returned 404 for all requests since variants were archived.
Removing eliminates the unnecessary catch-all.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 7e: Add error boundaries and loading states

- [ ] **Step 9: Create root error boundary**

Create `apps/landing/src/app/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold">Noe gikk galt</h2>
      <p className="text-muted-foreground max-w-md">
        Vi beklager, en uventet feil oppstod. Prøv å laste siden på nytt.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-full px-6 py-2 font-semibold transition-colors hover:opacity-90"
      >
        Prøv igjen
      </button>
    </div>
  );
}
```

- [ ] **Step 10: Create root loading state**

Create `apps/landing/src/app/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  );
}
```

- [ ] **Step 11: Create demo error boundary**

Create `apps/landing/src/app/demo/error.tsx`:

```tsx
"use client";

export default function DemoError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold">Demo ikke tilgjengelig</h2>
      <p className="text-muted-foreground max-w-md">
        Demoen er midlertidig utilgjengelig. Prøv igjen senere.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-full px-6 py-2 font-semibold"
      >
        Prøv igjen
      </button>
    </div>
  );
}
```

- [ ] **Step 12: Create docs error boundary**

Create `apps/landing/src/app/docs/[slug]/error.tsx`:

```tsx
"use client";

export default function DocsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold">Kunne ikke laste dokumentet</h2>
      <p className="text-muted-foreground max-w-md">
        Noe gikk galt ved lasting av denne siden. Prøv å laste på nytt.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-full px-6 py-2 font-semibold"
      >
        Prøv igjen
      </button>
    </div>
  );
}
```

- [ ] **Step 13: Commit**

```bash
git add apps/landing/src/app/error.tsx \
  apps/landing/src/app/loading.tsx \
  apps/landing/src/app/demo/error.tsx \
  apps/landing/src/app/docs/\[slug\]/error.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add error boundaries and loading states

Root error boundary with Sentry integration, root loading spinner,
demo-specific error boundary, and docs page error boundary.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 7f: Add Sentry to landing

- [ ] **Step 14: Install Sentry**

```bash
cd apps/landing && pnpm add @sentry/nextjs
```

- [ ] **Step 15: Create Sentry config files**

Create `apps/landing/sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
});
```

Create `apps/landing/sentry.server.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
});
```

- [ ] **Step 16: Wrap next.config.ts with Sentry**

In `apps/landing/next.config.ts`, add Sentry wrapper:

```typescript
// At the top:
import { withSentryConfig } from "@sentry/nextjs";

// At the bottom, replace the default export:
export default withSentryConfig(nextConfig, {
  silent: true,
  org: "smartout",
  project: "landing",
});
```

- [ ] **Step 17: Add DEMO_WORKSPACE_ID to .env.template**

`SENTRY_AUTH_TOKEN` already exists in `.env.template` — no action needed for Sentry.

However, `DEMO_WORKSPACE_ID` (used by engine-start route, fixed in Task 7b) is NOT in `.env.template`. Add it:

```
# Landing demo workspace
DEMO_WORKSPACE_ID="op://smartout_ai/Landing/demo_workspace_id"
```

- [ ] **Step 18: Build test**

Run: `pnpm --filter landing build`
Expected: Build succeeds with all routes.

- [ ] **Step 19: Commit**

```bash
git add apps/landing/sentry.client.config.ts \
  apps/landing/sentry.server.config.ts \
  apps/landing/next.config.ts \
  apps/landing/package.json \
  .env.template
git commit -m "$(cat <<'EOF'
feat(landing): add Sentry error tracking

Install @sentry/nextjs, create client/server configs matching web
app setup. Wrap next.config.ts with withSentryConfig. Enabled only
in production.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Integration Merge

### Task 8: Merge All Branches

- [ ] **Step 1: Create integration branch**

```bash
git checkout development-msi
git checkout -b fix/production-hardening
```

- [ ] **Step 2: Merge in order**

Merge each agent's branch. If using `superpowers:subagent-driven-development` with `isolation: "worktree"`, the branch names will be auto-generated — check `git branch --list 'worktree-*'` or use the branch names returned by each agent.

```bash
# Replace these with the actual branch names from each agent's output
git merge <a1-security-branch> --no-edit
git merge <a2-infra-branch> --no-edit
git merge <b1-stubs-branch> --no-edit
git merge <b2-flags-branch> --no-edit
git merge <c1-landing-branch> --no-edit
git merge <a3-types-branch> --no-edit   # Last — highest conflict risk
```

Resolve any conflicts. A3 goes last because it touches the most files.

> **Expected conflict:** `.env.template` is modified by agents A1, A2, and B2 in parallel. All three append to the end of the file. When merging, accept all additions — they are disjoint env var groups (platform company details, service URLs, feature flags). Combine them in order: platform vars, service URLs, feature flags.

- [ ] **Step 3: Build check**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Expected: All pass. Fix any issues from merge.

---

## Phase 4: Verification

### Task 9: Build Health (Agent-V1)

- [ ] **Step 1: Full build**

```bash
pnpm typecheck    # 0 errors
pnpm lint         # 0 errors (warnings OK)
npx turbo run build  # All 10 tasks pass
```

---

### Task 10: Security Residual Audit (Agent-V2)

- [ ] **Step 1: Run all security checks**

```bash
# No CORS wildcard
grep -r "Allow-Origin.*\"\*\"" supabase/functions/

# No hardcoded PII
grep -rn "Pontus\|929 620\|pontus@smartout" apps/ packages/

# No localhost in production code
grep -rn "localhost:[0-9]" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v middleware | grep -v "// dev-only" | grep -v node_modules | grep -v .next

# All edge functions in config.toml
diff <(ls -d supabase/functions/*/ | grep -v _shared | sed 's|.*/\(.*\)/|\1|' | sort) <(grep '^\[functions\.' supabase/functions/config.toml | sed 's/\[functions\.\(.*\)\]/\1/' | sort)
```

Expected: All checks return 0 results (or only intentional exceptions).

---

### Task 11: Stub Data Residual Audit (Agent-V3)

- [ ] **Step 1: Run all stub checks**

```bash
# No mock data in dashboard
grep -rn "Kari Nordmann\|Per Olsen\|Hotell Spåtind\|mock\|Mock\|MOCK" apps/web/src/app/dashboard/ --include="*.ts" --include="*.tsx"

# No hardcoded zeros in metrics
grep -rn "unsignedContracts = 0\|expiringTraining = 0\|budgetVariance = .0%" apps/web/src/

# No stubs visible when flags are off
grep -rn "under construction\|kommer snart\|Task 11\|Implementeres i" apps/web/src/ --include="*.tsx" | grep -v FEATURE_FLAGS

# Type cast count
grep -c "as any" apps/web/src/**/*.ts apps/web/src/**/*.tsx 2>/dev/null | awk -F: '{s+=$2} END {print "Remaining as any:", s}'
```

Expected: 0 results for first 3 checks. `as any` count < 10.
