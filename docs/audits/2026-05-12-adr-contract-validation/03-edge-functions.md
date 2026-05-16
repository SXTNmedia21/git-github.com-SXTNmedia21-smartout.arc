---
title: Slice 03 — Edge Functions Audit
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, edge-functions, adr]
---

## Summary (top 5 by severity)

1. **CRITICAL** — `analyze-setup-documents` checks presence of `Authorization` header but never validates the token against a real user (`getUser()` is not called); `workspace_id` is body-supplied with no ownership verification. Caller can download any workspace's Storage documents by guessing/forging a UUID.
2. **HIGH** — `engine-dispatch` `start_process` handler (line 1613) spawns a sub-process engine_state without reading `engine_process.allowed_channels`. ADR-0078 Layer 1 gate is absent for sub-process spawning; channel restriction only exists in the DB-level `gate_action` RPC, not in the dispatcher itself at process-start.
3. **HIGH** — `identify-company` is invoked directly from the browser (`useOnboardingState.ts:612`) and internally uses service-role after only a soft auth check (user presence is optional — provisioning skipped when unauthenticated but Brreg/Google Places still execute). ADR-0029 forbids browser → Edge Function for workspace-scoped mutations; the provisioning path is workspace-scoped.
4. **MEDIUM** — `analyze-setup-documents`, `gather-workspace-intelligence`, `search-brreg`, `scrape-website` are all invoked directly from browser context (onboarding wizard) against Edge Functions rather than Next.js route handlers — contravening ADR-0029 §Mutation Surface Selection for workspace-scoped operations.
5. **MEDIUM** — `contract-lifecycle` uses inline `WATCHDOG_CRON_SECRET` check (lines 6–8) instead of the shared `verifyInternalAuth()` helper, diverging from the canonical pattern and missing the fail-closed 500 when secret is unset.

---

## Findings Table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| EF-01 | CRITICAL | `supabase/functions/analyze-setup-documents/index.ts:197-222` | ADR-0029 | Auth header presence check only; no `getUser()`; `workspace_id` is caller-supplied body param; service-role client created unconditionally — any bearer token passes |
| EF-02 | HIGH | `supabase/functions/engine-dispatch/index.ts:1613-1637` | ADR-0078 | `start_process` handler inserts child `engine_state` without fetching `engine_process.allowed_channels`; no channel gate at dispatcher layer for sub-process spawning |
| EF-03 | HIGH | `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:612` + `identify-company/index.ts:56-59` | ADR-0029 | Browser invokes `identify-company` via `invokeEdgeFunction()`; function runs Brreg/Places calls unconditionally; workspace provisioning gated on user presence but Brreg data leaks unauthenticated |
| EF-04 | MEDIUM | `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:433,585,657` + `DocumentDropStep.tsx:321` | ADR-0029 | `gather-workspace-intelligence`, `search-brreg`, `scrape-website`, `analyze-setup-documents` all invoked directly browser → Edge Function bypassing Next.js route handler requirement |
| EF-05 | MEDIUM | `supabase/functions/contract-lifecycle/index.ts:6-8` | ADR-0029 | Inline cron-secret check duplicates `verifyInternalAuth()` pattern; missing fail-closed 500 when `WATCHDOG_CRON_SECRET` is unset (bare string comparison passes on empty string) |
| EF-06 | MEDIUM | `supabase/functions/analyze-setup-documents/index.ts:218,222` | ADR-0029 | Service-role client instantiated for Storage download without verifying caller owns the workspace; enables cross-workspace Storage read if workspace_id is guessed |
| EF-07 | LOW | `supabase/functions/engine-dispatch/index.ts:2462` | ADR-0078 | Comment `allowed_channels=['system'] so the gate is trivially satisfied` — gate satisfaction is asserted in comment, not verified in code at that call site |

---

## Per-ADR Rollup

### ADR-0029 — Workspace API Gateway

| Function | Verdict | Notes |
|----------|---------|-------|
| `workspace-api` | ✅ compliant | `resolveAuth()` → rate-limit → workspace guard → env check; proper gateway pattern |
| `accept-invitation` | ✅ compliant | ADR-0123 explicit exception; browser-facing pre-workspace |
| `create-invitation` | ✅ compliant | ADR-0123 explicit exception |
| `stripe-webhook` | ✅ compliant | Signature-verified webhook; `verify_jwt=false` per ADR-0029 table |
| `sendgrid-webhook` | ✅ compliant | Provider signature pattern |
| `contract-lifecycle` | ⚠️ partial | Inline cron-secret check vs shared helper (EF-05); functional but non-canonical |
| `identify-company` | 🔴 violation | Browser-invoked workspace mutation (EF-03) |
| `analyze-setup-documents` | 🔴 violation | Auth header presence only, no ownership check, browser-invoked (EF-01, EF-06) |
| `gather-workspace-intelligence` | ⚠️ partial | Browser-invoked (EF-04); function itself has auth; violation is in invocation path |
| `search-brreg` | ⚠️ partial | Browser-invoked (EF-04) |
| `scrape-website` | ⚠️ partial | Browser-invoked (EF-04) |

**Compliant: 5 / Partial: 4 / Violation: 2**

### ADR-0039 — Infrastructure Consolidation

| Check | Verdict | Notes |
|-------|---------|-------|
| Scrapling URL via `SCRAPLING_SERVICE_URL` env var | ✅ compliant | All 5 scrapling-calling functions use `Deno.env.get("SCRAPLING_SERVICE_URL")` as base, fallback to `host.docker.internal:8000` |
| Path appended separately (not baked in) | ✅ compliant | `scrape-raw-data` appends `/scrape-raw`; `extract-workspace-data` appends `/extract`; `scrape-website` appends `/extract`; `gather-workspace-intelligence` appends `/extract` |
| No per-service compose files | ✅ compliant | No `docker-compose.yml` found inside `supabase/functions/` |
| Scrapling internal-only (no external Caddy route) | ✅ compliant | Not routed through `workspace-api` |

**Compliant: 4 / Partial: 0 / Violation: 0**

### ADR-0077 — Contract Intake PII Handling

| Check | Verdict | Notes |
|-------|---------|-------|
| `contract_data_intake` process seeded `allowed_channels=['chat']` | ✅ compliant | `20260501110000_seed_contract_engine_processes.sql:12-17` |
| `contract_signing` process seeded `allowed_channels=['chat']` | ✅ compliant | `20260501110000_seed_contract_engine_processes.sql:39-44` |
| engine-dispatch context strips dispatcher-level keys (not PII) | ✅ compliant | Lines 332-339 strip `entity_type`, `entity_id`, `assignee_id`, `actor_id`, `correlation_id` |
| PII redaction in engine-dispatch (`pii_redacted` context key) | ✅ compliant | Lines 322,331 confirm `pii_redacted` propagated through context |
| No `personal_number` / `bank_account` returned in Edge Function responses | ✅ compliant | No plaintext PII echo observed in any Edge Function response body |
| `admin_submit_employee_pii` RPC referenced in ADR-0077 amendment | ✅ compliant | Migration `20260526010000_admin_submit_employee_pii_rpc.sql` referenced in ADR |

**Compliant: 6 / Partial: 0 / Violation: 0**

### ADR-0078 — Engine Process Channel Restriction

| Check | Verdict | Notes |
|-------|---------|-------|
| `engine_process.allowed_channels` column exists with DB-level gate (`gate_action` RPC) | ✅ compliant | `20260505110000_unified_authority_gate.sql:94,138` implements channel check |
| `contract_data_intake` seeded `['chat']` | ✅ compliant | Confirmed above |
| `engine-dispatch` top-level trigger spawn reads channel | ✅ compliant | `originating_channel` stamped at line 343; `gate_action` enforces at DB layer |
| `engine-dispatch` `start_process` sub-spawn reads `engine_process.allowed_channels` | 🔴 violation | Lines 1613-1637: no SELECT on `engine_process` before INSERT of child state (EF-02) |
| Push/in-app notification `allowed_channels` (notification routing, not process gate) | ✅ compliant | Lines 784, 2349 correctly scoped to notification delivery |

**Compliant: 4 / Partial: 0 / Violation: 1**

---

## Verified Intentional

- **`contract-lifecycle` uses `WATCHDOG_CRON_SECRET` directly (line 6-8)** — This is a pre-`verifyInternalAuth()` pattern. Flagged as EF-05 (MEDIUM drift), not CRITICAL, because the check is functionally correct when secret is set. However, it lacks the fail-closed 500 of the shared helper.
- **`identify-company` soft auth** — Brreg/Places calls execute without session (public data sources); provisioning is auth-gated. Public-data portion is intentional. The ADR-0029 violation is specifically the workspace-provisioning path being reachable from browser `invoke()`.
- No FP-001 through FP-004 from known-false-positives.md apply to this surface.

---

## In-Progress (mid-campaign)

- **SMA-299 (feat/sma-299-adr-0078-amendment)** — ADR-0078 amendment (Category C proposal tools) is active. EF-02 (`start_process` missing channel gate) is NOT covered by this amendment — SMA-299 adds Category C structural isolation for proposal tools, not for sub-process spawning in `engine-dispatch`. EF-02 is a real finding independent of SMA-299.
- **campaign/services** — No edge functions in this audit surface are tracked under the services campaign. No findings suppressed.
