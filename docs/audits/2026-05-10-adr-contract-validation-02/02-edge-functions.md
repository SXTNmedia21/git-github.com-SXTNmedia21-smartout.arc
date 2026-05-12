---
title: Slice 02 — edge-functions Audit
status: done
created: 2026-05-10
updated: 2026-05-10
module: audit
tags: [audit, edge-functions, adr, smoke]
mode: smoke
baseline: 2026-05-10-adr-contract-validation
---

# Slice 02 — Edge Functions Audit

## Summary

1. **F-EF-01 OPEN (HIGH)** — `analyze-setup-documents`: `verify_jwt=false` + header-presence-only auth (`if (!authHeader)` only) + `SUPABASE_SERVICE_ROLE_KEY` client constructed unconditionally + browser-callable from `DocumentDropStep.tsx:321` via client-side `invokeEdgeFunction`. ADR-0179 violation.
2. **F-EF-02a OPEN (HIGH)** — `ingest-workspace-knowledge`: browser-invoked from `wizard-definition.ts:295` (`"use client"`) via `invokeEdgeFunction`. `verify_jwt=false`, wildcard CORS (`"Access-Control-Allow-Origin": "*"` hardcoded inline). Although the body has a JWT validation path, it's reachable from browser. ADR-0179 violation.
3. **F-EF-02b OPEN (HIGH)** — `send-login-code`: invoked from `people-actions.ts:766` via `supabase.functions.invoke()`. File is `"use server"` (Server Action), so it is server-to-EF — NOT a browser-direct violation. **Reclassified from baseline**: F-EF-02b is NOT an ADR-0179 violation. Server Actions are Next.js server-side.
4. **F-EF-03 NEW (MEDIUM)** — `ingest-workspace-knowledge` hardcodes inline wildcard CORS (`"*"`). Other functions migrated to `getCorsHeaders(req)` (tenant-aware echo). The deprecated `corsHeaders` apex-only export (`https://smartout.ai` only) is also still in use across 20 functions — not browser-critical for internal-only callers but is a pending migration per the shared/cors.ts deprecation notice.
5. **F-EF-04 CONFIRMED (LOW)** — `push-dispatch` uses deprecated `corsHeaders` (apex-only); it is DB-trigger-called (not browser), so no CORS runtime impact. Deprecation cleanup deferred.

---

## Findings Table

| ID | Severity | File:Line | ADR | Evidence |
|---|---|---|---|---|
| F-EF-01 | HIGH | `supabase/functions/analyze-setup-documents/index.ts:197-201` | ADR-0179 | `verify_jwt=false`; auth gate = `if (!authHeader) → 401` only (header presence, not validation); service_role client at line 222 unconditional; browser caller at `apps/web/src/components/dashboard/wizard-steps/DocumentDropStep.tsx:321` (`"use client"`) |
| F-EF-02a | HIGH | `supabase/functions/ingest-workspace-knowledge/index.ts:14-16, 295` | ADR-0179 | Browser caller at `apps/web/src/app/dashboard/setup/wizard-definition.ts:295` (`"use client"`); function has `verify_jwt=false`; inline wildcard CORS `"Access-Control-Allow-Origin": "*"` |
| F-EF-02b | LOW | `apps/web/src/app/dashboard/people/_actions/people-actions.ts:766` | ADR-0179 | `send-login-code` invoked via `supabase.functions.invoke()` — but caller file is `"use server"` (Next.js Server Action). Server→EF path does not violate ADR-0179. **Reclassification** from baseline HIGH to LOW (documentation drift). |
| F-EF-03 | MEDIUM | `supabase/functions/ingest-workspace-knowledge/index.ts:14-16` | ADR-0171 (implied) | Hardcoded wildcard CORS `"Access-Control-Allow-Origin": "*"` inline. All other migrated functions use `getCorsHeaders(req)` or the apex-fallback `corsHeaders`. Wildcard + browser-callable = CORS over-exposure. |
| F-EF-04 | LOW | `supabase/functions/push-dispatch/index.ts:16` | — | Deprecated `corsHeaders` import (apex-only `https://smartout.ai`). DB-trigger-only caller, no runtime CORS impact. Pending migration. |

---

## Per-ADR Rollup

### ADR-0029 — Workspace API Gateway

`workspace-api` EF: `verify_jwt=false`, auth via `validate-api-key` sub-call + `api_key_read_*` RLS policies (GUC variables). Correct per ADR-0029 design. No violation.

`workspace-api` handlers use both deprecated `corsHeaders` import and the standard pattern. Since `workspace-api` is called by external integrations (API key, not browser JWT), CORS is irrelevant for external callers. No finding raised.

### ADR-0039 — Infrastructure Consolidation

`gather-workspace-intelligence` correctly uses `SCRAPLING_SERVICE_URL` env var as the base URL (not hardcoded path). ADR-0039 scraping URL pattern compliant. No violation.

### ADR-0077 — Contract Intake PII Handling

No EF found that processes `personal_number` or `bank_account` directly. `contract-lifecycle` uses `CRON_SECRET` auth (not browser-callable). Admin-fill PII route is BFF (`/api/contracts/admin-fill-pii`), not an EF. No ADR-0077 violation in EF layer.

### ADR-0078 — Engine Process Channel Restriction

`engine-dispatch`: `verify_jwt=false`, uses `verifyInternalAuth()` (service role or cron secret). The L1 channel restriction enforcement lives in `engine-dispatch`'s dispatch logic. Baseline finding F-EF-04 (channel-allowed gap in engine-dispatch) is out-of-scope for this slice (code review required for dispatch body — not re-examined here).

### ADR-0179 — Browser Mutations via Next.js Route Handlers

**Two open violations confirmed:**
- F-EF-01: `analyze-setup-documents` — browser client directly invokes EF.
- F-EF-02a: `ingest-workspace-knowledge` — browser client (`wizard-definition.ts`) directly invokes EF.

**One baseline finding reclassified:**
- F-EF-02b: `send-login-code` — `"use server"` Server Action. Server-to-EF invocation is NOT an ADR-0179 violation. The ADR explicitly permits server-internal scheduled/delegated EF calls. Baseline HIGH was a false positive based on `supabase.functions.invoke()` presence without checking the `"use server"` directive.

**Webhook EFs (compliant):** `stripe-webhook` (STRIPE_WEBHOOK_SECRET + `constructEventAsync`), `sendgrid-webhook` (ECDSA P-256 signature verification), `livekit-webhook` (LiveKit SDK verify). All correct: `verify_jwt=false` + signature verification. Per ADR-0179 mutation surface table, this is the canonical pattern.

**Internal/cron EFs (compliant):** `engine-dispatch`, `process-settlement-image`, `bootstrap-cascade`, `guardian-sweep`, `guardian-notify`, `fire-delayed-triggers`, `obligation-overdue-cron`, `obligation-due-soon-cron`, `heartbeat-dispatcher`, `ops-day-brief`, `ops-triage`, `push-dispatch` — all use either `verifyInternalAuth()` (service role + cron secret), WATCHDOG_CRON_SECRET bearer, CRON_SECRET bearer, or PUSH_DISPATCH_SECRET. Fail-closed on missing secret.

**JWT-verified EFs (correct):** `livekit-token` (`verify_jwt=true`), `apply-change-proposal` (`verify_jwt=true`), `guardian-actions` (`verify_jwt=true`), `shift-clock-compliance` (`verify_jwt=true`). Pattern correct.

---

## Delta vs Baseline

| Finding | Baseline Status | Current Status | Change |
|---|---|---|---|
| F-EF-01 (`analyze-setup-documents` header-only auth + service_role + browser) | OPEN HIGH | OPEN HIGH | Unchanged. No code changes in Phase F0 touching this function. |
| F-EF-02 (`ingest-workspace-knowledge` browser invoke) | OPEN HIGH | OPEN HIGH | Unchanged. Caller still at `wizard-definition.ts:295` (`"use client"`). |
| F-EF-02 (`send-login-code` invoke) | OPEN HIGH (bundled in F-EF-02) | **RECLASSIFIED LOW** | `people-actions.ts:1` = `"use server"`. Server Action → EF is ADR-0179 compliant. Baseline was a false positive. |
| F-EF-03 (wildcard CORS in `ingest-workspace-knowledge`) | Not raised explicitly | NEW MEDIUM | Inline `"Access-Control-Allow-Origin": "*"` not flagged separately in baseline; surfaced this slice. |

**Net:** 2 HIGH open (unchanged), 1 HIGH reclassified to LOW (false positive resolved), 1 MEDIUM new.

---

## ADR-0282 Contract Verification

**F-AC-02 check: No ultravox references in `supabase/functions/`.**

```
grep -rn "ultravox" supabase/functions/ → (no output)
```

Zero matches. No `ultravox` string, no `/adapters/ultravox/` path, no `create-call` route reference found anywhere under `supabase/functions/`. The ADR-0282 contract (remove ultravox EF caller) is **SATISFIED** for the EF layer.

---

## Verified Intentional

- `gather-workspace-intelligence` (`verify_jwt=false`): Auth is optional by design (line 136: "Auth is optional — unauthenticated callers get intelligence data without workspace provisioning"). Pre-workspace onboarding flow. Acceptable per ADR-0029 pre-workspace exception table (ADR-0123).
- `finalize-workspace` and `activate-workspace` (`verify_jwt=false`): Use `createClient` with caller's JWT forwarded; auth validated by Supabase Auth on the anon-key client. Workspace bootstrap lifecycle — pre-workspace context, no service_role escalation without prior auth.
- `ingest-workspace-knowledge` service_role usage (line 271): Service role is used **after** JWT validation or service_role identity check (lines 236-268). Escalation is gated. The violation is the browser-callable surface (ADR-0179), not the service_role use pattern internally.
- `send-login-code` raw `fetch` to SendGrid: This is an EF (not a Next.js route handler). Since `send-login-code` is correctly gated via a Server Action (`"use server"`), the ADR-0045 violation concerns are server-internal and pre-date the ADR-0045 + ADR-0179 combined enforcement target. Existing open issue, not a regression.
- Deprecated `corsHeaders` (apex-only) used across ~20 internal-only functions: None of these are browser-callable mutations. Migration to `getCorsHeaders(req)` is cosmetic for non-browser surfaces.
