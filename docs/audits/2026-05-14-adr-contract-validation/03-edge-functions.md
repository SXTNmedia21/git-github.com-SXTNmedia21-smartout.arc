---
title: Audit slice 03 — edge-functions
slice: edge-functions
mode: smoke
created: 2026-05-14
findings_critical: 0
findings_high: 1
findings_medium: 1
findings_low: 3
---

# Findings

## HIGH

### F-EF-05 — `analyze-workspace` has no auth gate (unauthenticated write to `onboarding_session`)

**File:** `supabase/functions/analyze-workspace/index.ts:9-175`
**ADR:** ADR-0029 (all standalone EFs must authenticate callers)

**Evidence:**
```ts
// Line 15-21: anon client is created with forwarded Authorization header
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
);
// auth.getUser() is NEVER called — no 401 guard anywhere in the handler
// Line 148-157: writes to onboarding_session using this unauthenticated client
const { error: updateError } = await supabaseClient
  .from("onboarding_session")
  .update({ ai_analysis: mockAiResponse, ... })
  .eq("id", sessionId);
```

`config.toml` has `verify_jwt = false` for this function. RLS on `onboarding_session` is the only guard — if that policy has a gap or allows anon, any unauthenticated caller can trigger DB writes. The function never calls `auth.getUser()` and has no 401 path.

**Why violates:** ADR-0029 requires that data-writing standalone EFs authenticate callers (JWT or API key). `verify_jwt = false` is permitted only when the EF performs its own auth check (token-as-auth per ADR-0123, HMAC webhook signature, or service-role bearer). `analyze-workspace` does none of these. There is also no Zod validation on the request body — `sessionId`, `companyName`, `scrapedData`, `webSearchData` are destructured directly from `req.json()` with `as` cast.

**Remediation:** Either (a) add `auth.getUser()` gate at the top of the handler and return 401 when user is null (the EF is called from the onboarding wizard where a session must exist), or (b) migrate to a Next.js route handler per ADR-0179 (preferred — this is a user-facing mutation from the browser). Note: the function contains a stub/mock Claude AI call; assess whether it is still live before migrating.

---

## MEDIUM

### F-EF-06 — `activate-workspace` leaks raw `error.message` (may expose PG error text)

**File:** `supabase/functions/activate-workspace/index.ts:67`
**ADR:** ADR-0029 (data returned to callers must not expose internal error details — F-WH-01 pattern)

**Evidence:**
```ts
} catch (error) {   // catch-all, no type guard
  return new Response(JSON.stringify({ error: error.message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 400,
  });
}
```

The catch block is untyped (`error` without `: unknown`), and `error.message` is returned directly. If the Supabase RPC call fails with a PG error (e.g. constraint violation, RLS rejection), the raw PostgreSQL message (which may include table/column names and partial row data) is forwarded to the caller.

**Why violates:** The F-WH-01 pattern established during the webhook hardening sortie (merged `23538c2ec`) requires that internal error strings are NOT forwarded to callers. Acceptable patterns: log error server-side (`console.error`), return a generic `"Internal server error"` message. Typed catch (`error: unknown`) with `instanceof Error` guard is also required.

**Remediation:**
```ts
} catch (error: unknown) {
  console.error("[activate-workspace] error:", error);
  return new Response(
    JSON.stringify({ error: "Internal server error" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
```

---

## LOW

### F-EF-07 — `heartbeat-dispatcher` leaks Supabase RPC error string (cron-only, low blast radius)

**File:** `supabase/functions/heartbeat-dispatcher/index.ts:56`
**ADR:** ADR-0029 / F-WH-01 pattern

**Evidence:**
```ts
if (error) {
  return new Response(JSON.stringify({ error: error.message }), {
    status: 500,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
```

`error` here is the Supabase PostgREST error object from `supabase.rpc("heartbeat_pickup")`. Its `.message` field can contain PG internal details.

**Why violates:** Same class as F-EF-06. Blast radius is lower (cron bearer only, not browser-facing) but the pattern is inconsistent and should be unified.

**Remediation:** Log the error detail, return `{ error: "heartbeat_pickup failed" }` generic message.

---

### F-EF-08 — `google-places-intelligence` returns `error.message` in a **200** success envelope (misleading + leaks internals)

**File:** `supabase/functions/google-places-intelligence/index.ts:143-153`
**ADR:** ADR-0029 / F-WH-01 pattern

**Evidence:**
```ts
} catch (error: unknown) {
  return new Response(
    JSON.stringify({
      success: true,    // ← claims success on exception path
      data: null,
      reason: "exception",
      error: error instanceof Error ? error.message : String(error),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
}
```

The exception path returns HTTP 200 with `success: true` and the raw `error.message`. Callers (notably `identify-company` which invokes this EF-to-EF) silently swallow the error and treat it as a soft miss, but the error text is forwarded in the response payload.

**Why violates:** F-WH-01 pattern: internal error text must not reach callers. The HTTP 200 also makes this undetectable by standard error monitoring on status codes.

**Remediation:** Return HTTP 503 (service unavailable) with a generic message on exception. Callers already handle `!res.ok` as a soft miss (`if (!res.ok) return null`).

---

### F-EF-09 — ~20 standalone EFs inline CORS headers instead of importing `_shared/cors.ts`

**Files:** `analyze-workspace`, `heartbeat-dispatcher`, `scrape-raw-data`, `engine-dispatch`, `session-lifecycle`, `guardian-sweep`, and ~14 others (full list below)
**ADR:** No specific ADR, but the shared helpers audit criterion ("shared helpers reused, not duplicated")

**Evidence:** `_shared/cors.ts` exists and is used by most EFs. The following EFs define their own inline CORS constant instead:

`analyze-workspace`, `heartbeat-dispatcher`, `scrape-raw-data`, `engine-dispatch`, `session-lifecycle`, `guardian-sweep`, `fire-delayed-triggers`, `call-command`, `ingest-workspace-knowledge`, `session-hook-executor`, `process-settlement-image`, `extract-workspace-data`, `session-watchdog-demoter`, `generate-monthly-invoices`, `ops-day-brief`, `ops-triage`, `ops-monitor`, `payroll-period-locked-handler`, `tariff-amendment-sweep`, `obligation-due-soon-cron`

Most inline copies are identical to `_shared/cors.ts`. Divergence risk: if CORS policy needs to change (e.g. restrict origins for production), only `_shared/cors.ts` would be updated while inline copies drift.

**Why violates:** The shared helper exists precisely to prevent divergence. Many of the EFs with inline CORS are internal/cron-only and don't need CORS at all (they are never called from browsers). For cron EFs, the CORS block is dead code.

**Remediation (priority order):**
1. Internal/cron EFs (heartbeat-dispatcher, ops-*, guardian-sweep, session-watchdog-demoter, fire-delayed-triggers, tariff-amendment-sweep, obligation-*): remove CORS block entirely — no browser caller.
2. User-facing EFs: replace inline object with `import { corsHeaders } from "../_shared/cors.ts";`.

---

## Verified (no findings)

- **ADR-0029 auth pattern** — `workspace-api` uses `resolveAuth()` (JWT + API key dual-auth) + `checkRateLimit()` correctly. Rate limiting is enforced for all `workspace-api` routes via `_shared/rate-limit.ts` (Upstash Redis, sliding window 60 req/60s, fail-open in dev / fail-closed in prod).
- **ADR-0029 webhook pattern** — `sendgrid-webhook`, `livekit-webhook`, `stripe-webhook` all use HMAC/signature verification as the auth surface (correct for `verify_jwt=false` webhooks). Idempotency confirmed: `sendgrid-webhook` uses `sg_message_id` upsert-and-count dedup; `livekit-webhook` uses UNIQUE on `call_log.call_session_id` with `upsert` ON CONFLICT DO NOTHING (F-WH-04 pattern clean); `stripe-webhook` uses `upsertPaymentAttempt` with PG-23505 duplicate detection.
- **ADR-0029 pre-workspace exception** — `accept-invitation` is the only permitted pre-workspace EF per ADR-0123 (2026-04-22 amendment). It uses invitation token as auth surface + optional JWT re-validation for the mobile OTP path. Clean.
- **ADR-0039 infra (scrapling URL pattern)** — `scrape-raw-data` and `scrape-website` both use `SCRAPLING_SERVICE_URL` env-var as base URL with path appended separately. ADR-0039 compliant.
- **ADR-0078 channel pinning (L1 gate)** — `engine-dispatch` does NOT inline the ADR-0078 L1 check in Deno code. However, the gate is implemented in the DB-level `gate_action` RPC (migration `20260516130000_gate_action_unseeded_warning.sql` lines 112-125): fetches `engine_process.allowed_channels` and rejects if session channel is not in the array. This is an architectural choice (DB gate vs EF gate) that satisfies the ADR's L1 requirement. The `engine_process` column `allowed_channels` exists and is seeded correctly for `shift_lifecycle` (`['system']`) and notification processes (`['push','in_app']`).
- **ADR-0077 (PII handling, no-echo)** — not directly testable at EF level without capability tool inspection; deferred to capability-tools slice.
- **`_shared/internal-auth.ts`** — correctly implements fail-closed bearer-token check for internal EFs (cron/service-role callers). Used by `google-places-intelligence`, `health-check`, and others. Pattern is sound.
- **Env-var fail-fast** — `_shared/api-key-auth.ts` (pool init) throws explicitly on missing `DATABASE_URL`/`SUPABASE_DB_URL`. `_shared/rate-limit.ts` fails-closed in prod on missing Upstash vars (with local-dev detection). Both follow F-WH-02 pattern.
