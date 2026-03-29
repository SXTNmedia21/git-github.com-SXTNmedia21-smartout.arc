# Error Logging, Health Checks & 429 Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the production 429 token refresh storm, add a public smoke test endpoint, add a connection check to the join wizard, surface real error messages, and auto-create GitHub issues on critical errors.

**Architecture:** Three layers: (1) Fix the root cause — middleware auth caching to stop the 429 storm. (2) Add observability — `/api/smoke` endpoint + `useConnectionCheck` hook + real error messages in UI. (3) Add automated issue creation — Sentry-to-GitHub integration via a lightweight error reporter that creates GitHub issues on unhandled errors.

**Tech Stack:** Next.js App Router, Supabase Auth (`@supabase/ssr`), Sentry (`@sentry/nextjs`), GitHub REST API (`gh` CLI or `@octokit/rest`), existing health check patterns.

---

## File Structure

| File                                                     | Action | Responsibility                                              |
| -------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `packages/supabase/src/middleware.ts`                    | Modify | Add auth result caching to prevent 429 storm                |
| `apps/web/src/app/api/smoke/route.ts`                    | Create | Public health endpoint — no auth, checks Supabase DB + Auth |
| `apps/web/src/hooks/useConnectionCheck.ts`               | Create | Client hook — calls `/api/smoke` on mount, returns status   |
| `apps/web/src/app/join/_components/ConnectionBanner.tsx` | Create | UI banner when Supabase is unreachable                      |
| `apps/web/src/app/join/_components/SignupWizard.tsx`     | Modify | Mount ConnectionBanner                                      |
| `apps/web/src/app/join/_components/SetupLoading.tsx`     | Modify | Surface real error messages, not generic text               |
| `apps/web/src/app/error.tsx`                             | Modify | Report errors to Sentry + GitHub issue creation             |
| `apps/web/src/app/global-error.tsx`                      | Create | Catch errors outside root layout (currently missing)        |
| `apps/web/src/lib/error-reporter.ts`                     | Create | Creates GitHub issues via API on critical errors            |
| `apps/web/src/env.ts`                                    | Modify | Add `GITHUB_ERROR_REPO` and `GITHUB_ERROR_TOKEN` env vars   |

---

### Task 1: Fix the 429 Token Refresh Storm

**Why:** The middleware calls `supabase.auth.getUser()` on EVERY request. When a token is expired, each call tries to refresh — creating hundreds of refresh requests per minute. The Supabase rate limit (150/5min) gets hit, causing a cascade of 429s. The user can't load because every request fails auth.

**Fix:** Skip `updateSession()` for public routes that don't need auth. This immediately stops the storm for unauthenticated paths.

**Files:**

- Modify: `apps/web/src/middleware.ts:87-288`
- Modify: `packages/supabase/src/middleware.ts:12-56`

- [ ] **Step 1: Add public route skip list to middleware**

In `apps/web/src/middleware.ts`, add a set of paths that should never call `updateSession()`:

```typescript
// Add after the imports, before the middleware function
const PUBLIC_ROUTES = new Set([
  "/join",
  "/login",
  "/api/smoke",
  "/api/health",
  "/api/auth/callback",
]);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  // Also match sub-paths of public routes
  for (const route of PUBLIC_ROUTES) {
    if (pathname.startsWith(route + "/")) return true;
  }
  return false;
}
```

- [ ] **Step 2: Skip updateSession for public routes in portal handler**

In the portal section (around line 141), before calling `updateSession`, check if the route is public:

```typescript
// In the portal block, replace the unconditional updateSession call
// Move step 3 (updateSession) AFTER public route check
if (subdomain.type === "portal") {
  const pathname = request.nextUrl.pathname;

  // Public routes — no auth needed, skip token refresh entirely
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next({ request });
    applyShowcaseMode(request, response);
    return response;
  }
}
```

Move the `updateSession` call (currently at line 136) to AFTER the public route check, so it only runs for authenticated routes.

- [ ] **Step 3: Add error handling to updateSession**

In `packages/supabase/src/middleware.ts`, wrap `getUser()` in a try-catch so a failed refresh doesn't crash the middleware:

```typescript
let user: User | null = null;
try {
  const { data } = await supabase.auth.getUser();
  user = data.user;
} catch (err) {
  console.error("[middleware] auth.getUser failed:", err);
  // Don't crash — continue with user = null (unauthenticated)
}

return { response: supabaseResponse, user };
```

- [ ] **Step 4: Verify the fix locally**

Run: `pnpm --filter web dev`

Open `/join` in browser — verify NO `/token` requests are made in the Network tab.
Open `/dashboard` — verify auth still works normally.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/middleware.ts packages/supabase/src/middleware.ts
git commit -m "fix(auth): skip token refresh on public routes, prevent 429 storm

Public routes (/join, /login, /api/smoke, /api/health) now bypass
updateSession() entirely. Failed getUser() calls no longer crash
the middleware — they fall through as unauthenticated.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add `/api/smoke` Public Health Endpoint

**Why:** We need a public endpoint (no auth) that quickly checks if core services are reachable. Used by the join wizard connection check and by external monitoring.

**Files:**

- Create: `apps/web/src/app/api/smoke/route.ts`

- [ ] **Step 1: Create the smoke endpoint**

```typescript
// apps/web/src/app/api/smoke/route.ts
import { NextResponse } from "next/server";

type ServiceCheck = {
  name: string;
  ok: boolean;
  latency_ms: number;
  error?: string;
};

type SmokeResponse = {
  ok: boolean;
  timestamp: string;
  services: ServiceCheck[];
};

async function checkSupabaseRest(): Promise<ServiceCheck> {
  const start = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { name: "supabase-rest", ok: false, latency_ms: 0, error: "Not configured" };
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
    });
    return {
      name: "supabase-rest",
      ok: res.ok,
      latency_ms: Date.now() - start,
      ...(!res.ok ? { error: `HTTP ${res.status}` } : {}),
    };
  } catch (e) {
    return {
      name: "supabase-rest",
      ok: false,
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

async function checkSupabaseAuth(): Promise<ServiceCheck> {
  const start = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { name: "supabase-auth", ok: false, latency_ms: 0, error: "Not configured" };
  }

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
    });
    return {
      name: "supabase-auth",
      ok: res.ok,
      latency_ms: Date.now() - start,
      ...(!res.ok ? { error: `HTTP ${res.status}` } : {}),
    };
  } catch (e) {
    return {
      name: "supabase-auth",
      ok: false,
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

export async function GET() {
  const services = await Promise.all([checkSupabaseRest(), checkSupabaseAuth()]);

  const allOk = services.every((s) => s.ok);

  const response: SmokeResponse = {
    ok: allOk,
    timestamp: new Date().toISOString(),
    services,
  };

  return NextResponse.json(response, {
    status: allOk ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
```

- [ ] **Step 2: Test locally**

Run: `curl http://localhost:3060/api/smoke | jq .`

Expected: `{ "ok": true, "services": [...] }` with both services passing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/smoke/route.ts
git commit -m "feat(health): add /api/smoke public health endpoint

No auth required. Checks Supabase REST and Auth reachability.
Returns 200 if all OK, 503 if any service is down.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add Connection Check to Join Wizard

**Why:** Users fill out 6 steps then discover on step 7 that Supabase is unreachable. The connection check runs on mount and warns them immediately.

**Files:**

- Create: `apps/web/src/hooks/useConnectionCheck.ts`
- Create: `apps/web/src/app/join/_components/ConnectionBanner.tsx`
- Modify: `apps/web/src/app/join/_components/SignupWizard.tsx:86-131`

- [ ] **Step 1: Create the useConnectionCheck hook**

```typescript
// apps/web/src/hooks/useConnectionCheck.ts
"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = "checking" | "ok" | "error";

type ConnectionCheckResult = {
  status: ConnectionStatus;
  error: string | null;
};

export function useConnectionCheck(): ConnectionCheckResult {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/smoke", {
          signal: AbortSignal.timeout(10000),
        });

        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const failedServices = body?.services
            ?.filter((s: { ok: boolean }) => !s.ok)
            ?.map((s: { name: string; error?: string }) => `${s.name}: ${s.error ?? "down"}`)
            ?.join(", ");
          setError(failedServices ?? `Server svarte med ${res.status}`);
          setStatus("error");
          return;
        }

        setStatus("ok");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Kan ikke nå serveren");
        setStatus("error");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, error };
}
```

- [ ] **Step 2: Create the ConnectionBanner component**

```typescript
// apps/web/src/app/join/_components/ConnectionBanner.tsx
"use client";

import { AlertTriangle } from "lucide-react";
import { useConnectionCheck } from "@/hooks/useConnectionCheck";

export function ConnectionBanner() {
  const { status, error } = useConnectionCheck();

  if (status !== "error") return null;

  return (
    <div className="fixed top-0 right-0 left-0 z-50 border-b border-red-200 bg-red-50 px-4 py-3 text-center dark:border-red-900 dark:bg-red-950/50">
      <div className="flex items-center justify-center gap-2 text-sm text-red-800 dark:text-red-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Kan ikke koble til tjenesten. Registrering er midlertidig utilgjengelig.
        </span>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Mount ConnectionBanner in SignupWizard**

In `apps/web/src/app/join/_components/SignupWizard.tsx`, add the import and mount it inside `WizardContent`:

```typescript
// Add import at top
import { ConnectionBanner } from "./ConnectionBanner";

// Inside WizardContent, add as first child of the outer div (line ~101)
return (
  <div className="relative flex min-h-[100dvh] overflow-hidden">
    <ConnectionBanner />
    {/* ... rest of wizard ... */}
  </div>
);
```

- [ ] **Step 4: Verify locally**

Stop Supabase: `npx supabase stop`
Open `/join` — verify the red banner appears.
Start Supabase: `npx supabase start`
Refresh `/join` — verify the banner disappears.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useConnectionCheck.ts apps/web/src/app/join/_components/ConnectionBanner.tsx apps/web/src/app/join/_components/SignupWizard.tsx
git commit -m "feat(join): add connection check banner to signup wizard

Checks /api/smoke on mount. Shows red banner if Supabase is
unreachable, so users know before filling out 6 steps.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Surface Real Error Messages in SetupLoading

**Why:** The current error UI shows generic "Noe gikk galt" in production. The actual error message from `completeSignup` must be visible to the user and logged.

**Files:**

- Modify: `apps/web/src/app/join/_components/SetupLoading.tsx:76-79`

- [ ] **Step 1: Improve error handling in SetupLoading**

Replace the catch block (lines 76-79) with better error extraction and logging:

```typescript
} catch (err) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Noe gikk galt under oppsettet.";

  console.error("[SetupLoading] Setup failed:", {
    message,
    error: err,
    step1Email: state.step1?.email,
    timestamp: new Date().toISOString(),
  });

  setError(message);
}
```

- [ ] **Step 2: Also improve the error display to show actionable info**

Update the error UI section (lines 85-107) to include a detail toggle:

```typescript
if (error) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/30" />
        <AlertCircle className="absolute inset-0 m-auto h-8 w-8 text-red-500" />
      </div>
      <div className="text-center">
        <h2 className="text-foreground text-xl font-semibold">Noe gikk galt</h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">{error}</p>
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => {
            goToStep(6);
          }}
        >
          Ga tilbake
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            hasStarted.current = false;
          }}
        >
          Prov igjen
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/join/_components/SetupLoading.tsx
git commit -m "fix(join): surface real error messages in SetupLoading

Show the actual error from completeSignup instead of generic text.
Add retry button alongside go-back. Log structured error to console.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Error Reporter — Auto-Create GitHub Issues

**Why:** Critical errors in production should automatically create GitHub issues so nothing gets lost. This connects Sentry error tracking with GitHub issue creation.

**Files:**

- Create: `apps/web/src/lib/error-reporter.ts`
- Modify: `apps/web/src/app/error.tsx`
- Create: `apps/web/src/app/global-error.tsx`
- Modify: `apps/web/src/env.ts` (add new env vars)

- [ ] **Step 1: Add env vars for GitHub integration**

In `apps/web/src/env.ts`, add to the server section:

```typescript
GITHUB_ERROR_TOKEN: z.string().optional(),
GITHUB_ERROR_REPO: z.string().optional(), // format: "owner/repo"
```

- [ ] **Step 2: Create error-reporter.ts**

````typescript
// apps/web/src/lib/error-reporter.ts
import * as Sentry from "@sentry/nextjs";

type ErrorReport = {
  title: string;
  error: Error;
  context?: Record<string, unknown>;
  severity?: "critical" | "error" | "warning";
};

/**
 * Reports an error to both Sentry and GitHub Issues.
 * Sentry captures the full stack trace and breadcrumbs.
 * GitHub issue creation is best-effort — never throws.
 */
export async function reportError({
  title,
  error,
  context,
  severity = "error",
}: ErrorReport): Promise<void> {
  // 1. Always send to Sentry
  Sentry.withScope((scope) => {
    scope.setLevel(severity === "critical" ? "fatal" : severity);
    if (context) {
      scope.setContext("error_context", context);
    }
    scope.setTag("auto_reported", "true");
    Sentry.captureException(error);
  });

  // 2. Create GitHub issue (server-side only, best-effort)
  if (typeof window !== "undefined") return; // Client-side: Sentry only

  try {
    await createGitHubIssue({ title, error, context, severity });
  } catch (ghErr) {
    console.error("[error-reporter] GitHub issue creation failed:", ghErr);
  }
}

async function createGitHubIssue({ title, error, context, severity }: ErrorReport): Promise<void> {
  const token = process.env.GITHUB_ERROR_TOKEN;
  const repo = process.env.GITHUB_ERROR_REPO;

  if (!token || !repo) return;

  // Deduplicate: check if an open issue with same title exists
  const searchRes = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${repo} is:issue is:open in:title "${title}"`)}&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(5000),
    },
  );

  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { total_count: number };
    if (searchData.total_count > 0) {
      // Issue already exists — don't create duplicate
      return;
    }
  }

  const labels = ["bug", "auto-reported"];
  if (severity === "critical") labels.push("critical");

  const body = [
    `## Auto-reported error`,
    "",
    `**Severity:** ${severity}`,
    `**Time:** ${new Date().toISOString()}`,
    `**Environment:** ${process.env.NODE_ENV}`,
    `**Vercel URL:** ${process.env.VERCEL_URL ?? "unknown"}`,
    "",
    "### Error",
    "```",
    error.message,
    "```",
    "",
    "### Stack Trace",
    "```",
    error.stack ?? "No stack trace",
    "```",
    ...(context ? ["", "### Context", "```json", JSON.stringify(context, null, 2), "```"] : []),
    "",
    "---",
    "*This issue was auto-created by the Smartout error reporter.*",
  ].join("\n");

  await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: `[Auto] ${title}`, body, labels }),
    signal: AbortSignal.timeout(5000),
  });
}

/**
 * Client-side error reporter — sends to API route which handles GitHub.
 * Use this from error boundaries and client components.
 */
export async function reportErrorFromClient(
  title: string,
  error: Error,
  context?: Record<string, unknown>,
): Promise<void> {
  // Sentry client-side capture
  Sentry.withScope((scope) => {
    scope.setTag("auto_reported", "true");
    if (context) scope.setContext("error_context", context);
    Sentry.captureException(error);
  });

  // Send to server for GitHub issue creation
  try {
    await fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        message: error.message,
        stack: error.stack,
        context,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best effort — don't crash the app over reporting
  }
}
````

- [ ] **Step 3: Create the API route for client-side error reporting**

```typescript
// apps/web/src/app/api/error-report/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { reportError } from "@/lib/error-reporter";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title: string;
      message: string;
      stack?: string;
      context?: Record<string, unknown>;
    };

    const error = new Error(body.message);
    if (body.stack) error.stack = body.stack;

    await reportError({
      title: body.title,
      error,
      context: {
        ...body.context,
        source: "client",
        userAgent: req.headers.get("user-agent") ?? "unknown",
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/error-reporter.ts apps/web/src/app/api/error-report/route.ts apps/web/src/env.ts
git commit -m "feat(errors): add error reporter with GitHub issue creation

Reports to Sentry (always) and creates GitHub issues (server-side).
Deduplicates by title — won't create duplicate issues.
Client errors go via /api/error-report POST endpoint.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Wire Error Boundaries to Error Reporter

**Why:** The root `error.tsx` only logs to console. The `global-error.tsx` doesn't exist at all — errors outside the root layout are unhandled. Both should report to Sentry + GitHub.

**Files:**

- Modify: `apps/web/src/app/error.tsx`
- Create: `apps/web/src/app/global-error.tsx`

- [ ] **Step 1: Update root error.tsx**

```typescript
// apps/web/src/app/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@smartout/ui";
import { reportErrorFromClient } from "@/lib/error-reporter";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error:", error);
    reportErrorFromClient(
      `Render error: ${error.message.slice(0, 80)}`,
      error,
      { digest: error.digest, page: window.location.pathname },
    );
  }, [error]);

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <p className="text-foreground text-base font-medium">Noe gikk galt</p>
      <p className="text-muted-foreground max-w-md text-center text-sm">{error.message}</p>
      {error.digest && (
        <p className="text-muted-foreground text-xs">Feilkode: {error.digest}</p>
      )}
      <Button variant="outline" onClick={reset}>
        Prov igjen
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create global-error.tsx**

```typescript
// apps/web/src/app/global-error.tsx
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
    Sentry.captureException(error, {
      tags: { boundary: "global-error" },
    });
  }, [error]);

  return (
    <html lang="nb">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Noe gikk galt</h1>
        <p style={{ color: "#666", maxWidth: "400px", margin: "1rem auto" }}>
          {error.message}
        </p>
        {error.digest && (
          <p style={{ color: "#999", fontSize: "0.75rem" }}>Feilkode: {error.digest}</p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            border: "1px solid #ccc",
            borderRadius: "6px",
            cursor: "pointer",
            background: "white",
          }}
        >
          Prov igjen
        </button>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/error.tsx apps/web/src/app/global-error.tsx
git commit -m "feat(errors): wire error boundaries to Sentry + GitHub reporter

Root error.tsx now reports to Sentry and creates GitHub issues.
Added global-error.tsx to catch errors outside root layout.
Both show the actual error message, not just generic text.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add Environment Variables

**Why:** The GitHub error reporter needs a token and repo name. Must be added to `.env.template` and Vercel.

**Files:**

- Modify: `.env.template`

- [ ] **Step 1: Add env vars to .env.template**

Add after the Sentry section:

```bash
# ── GitHub Error Reporter ────────────────────────
GITHUB_ERROR_TOKEN="op://smartout_ai/GitHub/error_reporter_token"
GITHUB_ERROR_REPO="SXTNmedia21/smartout.ai"
```

- [ ] **Step 2: Add to env.ts**

Already done in Task 5 Step 1.

- [ ] **Step 3: Create the GitHub token**

The user needs to create a fine-grained GitHub personal access token with:

- Repository access: `SXTNmedia21/smartout.ai`
- Permissions: Issues (read + write)
- Save it in 1Password vault `smartout_ai` under `GitHub` item, field `error_reporter_token`

**Tell the user:** "You need to create a GitHub fine-grained token with Issues write access for the smartout.ai repo, and save it in 1Password."

- [ ] **Step 4: Commit**

```bash
git add .env.template
git commit -m "chore(env): add GitHub error reporter token and repo vars

GITHUB_ERROR_TOKEN and GITHUB_ERROR_REPO for auto-creating
GitHub issues on critical production errors.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Typecheck and Final Verification

- [ ] **Step 1: Run typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors (warnings OK).

- [ ] **Step 3: Test smoke endpoint locally**

```bash
curl -s http://localhost:3060/api/smoke | jq .
```

Expected: `{ "ok": true, "services": [...] }`

- [ ] **Step 4: Test error boundary**

Create a temporary error in a dashboard page, load it, verify:

1. Error message shows (not generic "Noe gikk galt" without details)
2. Sentry receives the event (check Sentry dashboard)
3. Console shows structured error log

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: address typecheck and lint issues from error logging implementation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | What                                                      | Fixes                            |
| ---- | --------------------------------------------------------- | -------------------------------- |
| 1    | Skip auth on public routes + error handling in middleware | 429 storm                        |
| 2    | `/api/smoke` public endpoint                              | No health visibility             |
| 3    | Connection check banner in join wizard                    | Users discover failures too late |
| 4    | Real error messages in SetupLoading                       | Generic "Noe gikk galt"          |
| 5    | Error reporter (Sentry + GitHub issues)                   | Errors lost in void              |
| 6    | Wire error boundaries to reporter                         | No automated issue tracking      |
| 7    | Add env vars                                              | Config for GitHub integration    |
| 8    | Typecheck + verification                                  | Quality gate                     |
