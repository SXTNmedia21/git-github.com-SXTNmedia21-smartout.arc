---
title: "Slice 03 — Edge Functions ADR Audit"
status: complete
updated: 2026-05-15
created: 2026-05-15
module: edge-functions
tags: [audit, edge-functions, adr]
---

# Slice 03 — Edge Functions

**Scope:** `supabase/functions/**` (65 EFs + `_shared/`)
**ADRs:** ADR-0029 (workspace-api gateway), ADR-0039 (infra consolidation), ADR-0077 (PII handling), ADR-0078 (channel restriction), ADR-0179 (browser mutations via route handlers)
**Date:** 2026-05-15
**Baseline:** 2026-05-13

---

## Summary

F-EF-03 (CRITICAL, 5 unauthenticated intelligence EFs) is **CLOSED** — `verifyInternalAuth()` confirmed in all 5. F-EF-04 (ADR-0123 legacy `/onboarding` violations) is **PARTIALLY CLOSED** — legacy onboarding EF calls eliminated, but the violation persists through the `/onboarding` wizard itself. F-EF-02a (ADR-0179 browser→EF) remains **OPEN** and extends beyond the originally flagged line.

New findings: 1 HIGH (identify-company unauthenticated), 1 MEDIUM (CRON_SECRET not in env template for 3 EFs).

---

## Findings Table

| ID | File | ADR | Severity | Status | Description |
|----|------|-----|----------|--------|-------------|
| F-EF-02a | `apps/web/src/app/onboarding/wizard-definition.ts:14,292` | ADR-0179 | HIGH | OPEN | Client component invokes `finalize-workspace` / `activate-workspace` EFs directly via `supabase.functions.invoke()`. These are workspace-scoped mutations. ADR-0179 forbids this pattern. |
| F-EF-03 | intelligence EFs × 5 | ADR-0029 | CRITICAL | CLOSED | `verifyInternalAuth()` confirmed in `gather-workspace-intelligence`, `google-places-intelligence`, `web-search-intelligence`, `scrape-website`, `analyze-workspace`. |
| F-EF-04 | `/onboarding` legacy | ADR-0123 | HIGH | CLOSED | F-OB-10-01 deletion of 27 files confirmed; no legacy onboarding EF invocations remain outside wizard-definition.ts. |
| F-EF-05 | `supabase/functions/identify-company/index.ts` | ADR-0029 | HIGH | NEW | `verify_jwt = false` + **no auth check** at all. Any unauthenticated caller can invoke. No `verifyInternalAuth`, no JWT validation, no cron secret. CORS headers present → browser-callable. Caller origin unclear (only referenced from `_shared/brreg.ts` comment). |
| F-EF-06 | `tariff-amendment-sweep`, `obligation-overdue-cron`, `obligation-due-soon-cron` | ADR-0039 | MEDIUM | NEW | These 3 EFs use `CRON_SECRET` env var, which is **absent from `.env.template`**. All other cron EFs standardize on `WATCHDOG_CRON_SECRET`. Auth is fail-closed (missing env → 401) but CRON_SECRET will be undefined in any env built from the template, causing all scheduled invocations to fail silently. |
| F-EF-07 | `analyze-setup-documents/index.ts` | ADR-0029 | LOW | OPEN | Uses JWT auth (validates user via anon-key client) but not `verifyInternalAuth`. Appropriate for browser-invocable use case (Storage file upload review), but caller path and CORS surface not documented in config.toml comment. |

---

## Per-ADR Rollup

### ADR-0029 — Workspace API Gateway

**workspace-api:** Correctly implements `resolveAuth` + `requireScope` + `executeWithWorkspaceContext`. Compliant.

**identify-company (F-EF-05):** `verify_jwt = false` with zero auth. Exposes a Brreg lookup endpoint publicly. While Brreg data is public itself, the unauthenticated surface is an unintended widening of attack surface inconsistent with ADR-0029's fail-closed stance.

**scrape-raw-data:** `verify_jwt = false`, uses `auth.getUser()` via anon-key client passthrough. JWT is required but not enforced at Supabase level — relies on manual validation. Lower risk but inconsistent with `verifyInternalAuth` pattern for internal EFs.

**analyze-setup-documents:** Uses JWT validation + workspace-membership check (profile table lookup). This is a valid browser-JWT pattern for a Storage-adjacent operation. Not a gateway violation.

### ADR-0039 — Infra Consolidation

**SCRAPLING_SERVICE_URL pattern:** All EFs calling scrapling use `Deno.env.get("SCRAPLING_SERVICE_URL")` with fallbacks. Compliant.

**Secret fragmentation (F-EF-06):** 26 EFs use `WATCHDOG_CRON_SECRET`. 3 use `CRON_SECRET` (not in `.env.template`). 3 others use individual function secrets (`PUSH_DISPATCH_SECRET`, `MORNING_DIGEST_SECRET`, `PROCESS_NOTIFICATIONS_SECRET`) — all correctly in `.env.template`. The `CRON_SECRET` gap means `tariff-amendment-sweep`, `obligation-overdue-cron`, `obligation-due-soon-cron` cannot be invoked in any standard env.

### ADR-0077 — PII Handling

No new violations. `gather-workspace-intelligence` Phase B workspace provisioning path correctly skips when user is unauthenticated. `analyze-setup-documents` validates workspace ownership before Storage access. No PII fields observed in EF response payloads audited.

### ADR-0078 — Channel Restriction

Not directly applicable to EF layer (channel enforcement is at stage-engine dispatcher). No EF directly enforces channel restrictions; this is correct per ADR-0078's three-layer model (L1 at dispatcher, not EF).

### ADR-0179 — Browser Mutations via Route Handlers

**F-EF-02a (OPEN):** `wizard-definition.ts` is `"use client"` and imports `invokeEdgeFunction` (a wrapper around `supabase.functions.invoke()`). At line 292, it invokes `finalize-workspace` or `activate-workspace` depending on whether `workspaceId` is present. Both EFs are workspace-scoped mutation surfaces. ADR-0179 requires these to route through `apps/web/src/app/api/**/route.ts` instead.

**Scope clarification:** The original F-EF-02a baseline flagged line 295. The violation is at line 292 (the `invokeEdgeFunction` call). The target EFs (`finalize-workspace`, `activate-workspace`) have JWT auth internally — this is a pattern violation, not an auth bypass. Risk: telemetry parity gap (EFs cannot import `@smartout/telemetry`), CORS drift potential, ADR-0045 violation if email/SMS dispatch is ever added to finalization path.

---

## Verified Intentional (Not Findings)

| EF | Pattern | Rationale |
|----|---------|-----------|
| `stripe-webhook`, `sendgrid-webhook`, `livekit-webhook` | `verify_jwt=false` + provider signature verification | Correct per ADR-0179 webhook exception |
| `accept-invitation` | `verify_jwt=false` + URL token auth | Correct per ADR-0123 pre-workspace exception |
| `workspace-api` | `verify_jwt=false` + API key auth + `requireScope` | ADR-0029 gateway — intentional |
| `livekit-token` | `verify_jwt=true` | Standard JWT — correct |
| `guardian-actions`, `apply-change-proposal`, `shift-clock-compliance` | `verify_jwt=true` | Standard JWT — correct |
| All 26 WATCHDOG_CRON_SECRET EFs | `verify_jwt=false` + `verifyInternalAuth()` or inline cron check | Correct cron pattern; fail-closed on missing env |
| `process-notifications`, `push-dispatch`, `send-morning-digest` | function-specific secrets (all in `.env.template`) | Intentional isolation; correctly configured |
| `scrape-raw-data`, `extract-workspace-data` | JWT passthrough via anon client | Pre-workspace / data-export context; not workspace-api territory |

---

## In-Progress

- **F-EF-02a migration:** No route handler equivalent for `finalize-workspace` / `activate-workspace` exists under `apps/web/src/app/api/`. Migration requires creating `POST /api/onboarding/finalize` and `POST /api/onboarding/activate` route handlers, then updating `wizard-definition.ts` to call those instead.
- **F-EF-05 (identify-company):** Unclear whether this EF is called exclusively by other EFs (safe) or browser-directly (unsafe). No route handler or browser invocation site found in `apps/web/src/`. Recommend adding `verifyInternalAuth()` as a precaution since it serves only Brreg data and all known callers are server-side.

---

## Delta vs 2026-05-13

| Finding | 2026-05-13 | 2026-05-15 | Change |
|---------|-----------|-----------|--------|
| F-EF-03 CRITICAL (5 unauthenticated intel EFs) | OPEN | CLOSED | Closed by `verifyInternalAuth` addition |
| F-EF-04 HIGH (legacy /onboarding ADR-0123) | OPEN | CLOSED | 27 files deleted; no remaining violations |
| F-EF-02a HIGH (browser→EF ADR-0179) | OPEN | OPEN | Unchanged; scope confirmed at line 292 |
| F-EF-05 HIGH (identify-company unauthenticated) | — | NEW | Net-new finding |
| F-EF-06 MEDIUM (CRON_SECRET missing from env template) | — | NEW | Net-new finding |
| F-EF-07 LOW (analyze-setup-documents undocumented surface) | — | NEW | Net-new, low risk |

**Net delta:** −2 findings (1 CRITICAL, 1 HIGH closed), +3 findings (1 HIGH, 1 MEDIUM, 1 LOW new).
**Severity counts (open):** CRITICAL: 0, HIGH: 2, MEDIUM: 1, LOW: 1.
