---
title: "Audit Slice 03 — Edge Functions"
status: done
created: 2026-05-06
updated: 2026-05-06
module: edge-functions
tags: [audit, security, edge-functions, adr-0029, adr-0039, adr-0077, adr-0078]
---

# Audit Slice 03 — Edge Functions

**ADRs in scope:** 0029 (Workspace API Gateway), 0039 (Infra Consolidation), 0077 (PII Handling), 0078 (Channel Restriction)
**Surface:** `supabase/functions/**` — 60 Edge Functions + `config.toml`
**Auditor model:** claude-sonnet-4-6
**Date:** 2026-05-06

---

## Delta vs 2026-05-02 Baseline

| Baseline Finding | Status |
|---|---|
| `engine-dispatch/index.ts:180-240` — `verify_jwt=false` with no bearer/HMAC | **CLOSED** — uses `verifyInternalAuth()` (fail-closed, dual service-role + cron secret) |
| `validate-settlement/index.ts` — no auth, mutates `daily_reconciliation` | **CLOSED** — uses `verifyInternalAuth()` at top of `Deno.serve()` |
| `process-settlement-image/index.ts` — no auth, mutates `settlement_image` | **CLOSED** — uses `verifyInternalAuth()` at top of `Deno.serve()` |
| 11 cron functions with broken `if (cronSecret && authHeader === ...)` | **MOSTLY CLOSED** — 19/20 cron-guarded functions now use fail-closed `if (!cronSecret \|\| authHeader !== ...)`. One survivor below. |

---

## Findings

### CRITICAL

#### C-01 — `journey-stuck-detector`: broken `isAuthorized()` opens when both secrets absent
**File:** `supabase/functions/journey-stuck-detector/index.ts:139`
**ADR:** 0029 (internal auth must be fail-closed)

The function uses a custom `isAuthorized()` instead of `verifyInternalAuth`. Line 139 returns `true` when neither `WATCHDOG_CRON_SECRET` nor `SUPABASE_SERVICE_ROLE_KEY` are set:

```ts
// Line 139
return !cronSecret && !serviceKey;
```

This is the original broken `&&` pattern from the baseline — anyone can call this function in an environment where the env vars are not injected (e.g. a misconfigured deployment or local dev). The function does significant DB reads/writes across `engine_state`, `engine_state_step`, `engine_process`, and `journey_*` tables using the service role key.

**Fix:** Replace `isAuthorized()` with `verifyInternalAuth()` from `_shared/internal-auth.ts`.

---

#### C-02 — `bootstrap-cascade`: `verify_jwt=false`, no caller auth, 42 DB mutations
**File:** `supabase/functions/bootstrap-cascade/index.ts:175-184`
**ADR:** 0029

`bootstrap-cascade` is documented as "service-role only, called internally from activate-workspace / finalize-workspace." However:
- `config.toml` sets `verify_jwt = false`
- The handler performs no inbound auth check whatsoever — it immediately creates an admin client and processes the body
- The body only requires `workspaceId` + `sourcePath` (both are guessable/enumerable)
- It performs 42 DB mutations across `workspace_bootstrap_run`, `department`, `department_operating_hours`, `framework_rule`, `tariff_rate_table`, `planning_cycle`, `season_budget`, `engine_authority_config`, and more — all via service role, bypassing RLS

Any unauthenticated caller can POST `{"workspaceId": "<uuid>", "sourcePath": "<path>"}` and trigger a full cascade seed or data corruption on any workspace.

**Fix:** Add `verifyInternalAuth()` before the adminClient instantiation.

---

### HIGH

#### H-01 — `cleanup-sandbox-workspaces`: module-level `undefined` bypass when env var absent
**File:** `supabase/functions/cleanup-sandbox-workspaces/index.ts:11,16`
**ADR:** 0029

```ts
const WATCHDOG_CRON_SECRET = Deno.env.get("WATCHDOG_CRON_SECRET"); // module-level = undefined if missing

if (!authHeader || authHeader !== `Bearer ${WATCHDOG_CRON_SECRET}`) { // `Bearer undefined`
```

When `WATCHDOG_CRON_SECRET` is not set, the template literal evaluates to `"Bearer undefined"`. The guard passes for any caller sending `Authorization: Bearer undefined`. The function deletes sandbox workspaces and their users via CASCADE.

Compare to the correct pattern in 19 other cron functions: `const cronSecret = Deno.env.get(...)` inside `Deno.serve()` body, with `if (!cronSecret || ...)` fail-closing when undefined.

**Fix:** Move the `Deno.env.get` call inside `Deno.serve()` and add `!cronSecret` as first guard condition.

---

#### H-02 — `search-brreg` + `scrape-website` + `google-places-intelligence` + `web-search-intelligence`: fully public endpoints, `verify_jwt=false`, no auth
**Files:** `supabase/functions/search-brreg/index.ts`, `supabase/functions/scrape-website/index.ts`, `supabase/functions/google-places-intelligence/index.ts`, `supabase/functions/web-search-intelligence/index.ts`
**ADR:** 0029

All four have `verify_jwt = false` in `config.toml` and perform no caller authentication. They make external API calls (Brreg public API, scrapling/Google Places/Serper) using credentials injected via env vars. Zero DB mutations — reads only or proxy-only.

Severity is HIGH not CRITICAL because:
- No DB writes — cannot corrupt workspace data
- External APIs may impose quotas; abuse could exhaust them
- `scrape-website` exposes `SCRAPLING_AUTH_TOKEN` usage (token spent per call)
- `google-places-intelligence` and `web-search-intelligence` expose `GOOGLE_API_KEY` and `SERPER_API_KEY` to quota drain

These are intentionally public for the `/join` onboarding wizard (per CLAUDE.md: "`/join` uses Vercel Route Handlers → scrapling"). The legacy Edge Function path still exists and is unguarded. **ADR-0029 amendment (ADR-0123)** covers `accept-invitation` and `create-invitation` as pre-workspace exceptions but does not extend to these four intelligence functions.

**Recommendation:** Either (a) add a lightweight `x-smartout-onboarding-token` check, or (b) formally register these four as pre-workspace exceptions in ADR-0123 with documented abuse-rate justification.

---

#### H-03 — `gather-workspace-intelligence` + `identify-company`: auth optional, workspace provisioning possible without authentication
**Files:** `supabase/functions/gather-workspace-intelligence/index.ts:136-139`, `supabase/functions/identify-company/index.ts:56-88`
**ADR:** 0029

Both functions use "optional auth" — `auth.getUser()` is called but failure is silently swallowed; the function continues and skips workspace provisioning. This is documented by comments. However, both still:
- Call external APIs (Brreg, scrapling, AI models) on any unauthenticated POST
- Return intelligence data about Norwegian companies without caller verification

Same quota-drain surface as H-02. No DB mutations without auth. Same remediation applies.

---

### MEDIUM

#### M-01 — ADR-0077 PII compliance: `engine_memory.sensitivity` column unverified in code
**ADR:** 0077

ADR-0077 mandates:
1. `engine_memory.sensitivity` column exists (`normal | pii | legal`)
2. Memory manager redacts personnummer and bankkonto regexes before embedding
3. PII rows expire after 7 days
4. `rpc_read_personal_number` / `rpc_read_bank_account` used for reads (no direct column access)

Audit scope (Edge Functions) does not include `services/stage-engine` (memory-manager lives there). No Edge Function directly reads `profile.personal_number` or `profile.bank_account` in plaintext — verified by grep. However, `contract-lifecycle/index.ts` accesses `employment_contract` with service role and does not show evidence of sensitivity-tagging before any memory write.

**Risk:** If `contract-lifecycle` ever feeds data to `engine_memory` without tagging, PII accumulates permanently. Requires cross-slice verification (slice for services/stage-engine).

---

#### M-02 — ADR-0039: standalone Edge Functions access workspace tables directly (gateway bypass)
**ADR:** 0039

ADR-0039 mandates workspace-scoped data endpoints route through `workspace-api`. Many internal cron/orchestration functions legitimately access workspace tables directly using service-role (cron, session management, etc.) — this is by-design for internal orchestration.

However, three functions access workspace data via service-role in patterns that arguably belong behind the gateway:
- `ops-day-brief`, `ops-learn`, `ops-monitor`, `ops-predict`, `ops-triage` — all read `schedule_shift`, `profile`, `department`, `daily_reconciliation` via service-role with cron-secret auth. These are AI-ops functions exposed as callable endpoints.

ADR-0029 mutation surface table explicitly allows "Server-internal scheduled work" via service role. These are cron-guarded and fail-closed. **Severity MEDIUM** because intent matches the ADR exception, but there is no workspace isolation per-tenant — any workspace's data could be processed in a single call.

---

#### M-03 — ADR-0078 channel restriction: `engine_process.allowed_channels` column existence unverified in Edge Functions
**ADR:** 0078

ADR-0078 mandates `engine_process.allowed_channels TEXT[]` column and dispatcher check at process-start. `engine-dispatch/index.ts` (the canonical dispatcher) does NOT show a channel restriction check in the audited region (lines 181–310). The check may be downstream in `executeStep()` or in `services/stage-engine/src/core/dispatcher.ts` (out of EF scope). No `allowed_channels` filter appears in the `engine_trigger` query at line 247-251.

**Risk:** If the process-start channel check is only in stage-engine dispatcher (not `engine-dispatch` EF), then direct calls to `engine-dispatch` (bypassing stage-engine) bypass ADR-0078 Layer 1.

---

### LOW

#### L-01 — `push-dispatch` not in `PUSH_DISPATCH_SECRET` env template
**File:** `supabase/functions/push-dispatch/index.ts:54`
This uses a separate `PUSH_DISPATCH_SECRET` not documented in `config.toml`'s `[edge_runtime.secrets]` section. Fail-closed (500 when missing), but secret management is inconsistent with the `WATCHDOG_CRON_SECRET` pattern. Risk: forgotten in new environment setup.

#### L-02 — `ingest-workspace-knowledge`: dual-auth path not documented in config.toml
**File:** `supabase/functions/ingest-workspace-knowledge/index.ts:236`
Accepts both service-role bearer AND user JWT. Not in `config.toml` verify_jwt section at all — likely defaults to `verify_jwt = true`. Auth logic inside the function is correct but the config.toml omission creates ambiguity about the intended auth surface.

---

## Summary Table

| ID | Severity | Function | Finding |
|---|---|---|---|
| C-01 | CRITICAL | `journey-stuck-detector` | `isAuthorized()` opens fully when both secrets absent |
| C-02 | CRITICAL | `bootstrap-cascade` | No inbound auth, 42 mutations, full cascade seed exploitable |
| H-01 | HIGH | `cleanup-sandbox-workspaces` | Module-level undefined → `Bearer undefined` bypass |
| H-02 | HIGH | `search-brreg`, `scrape-website`, `google-places-intelligence`, `web-search-intelligence` | Fully public, external API quota drain |
| H-03 | HIGH | `gather-workspace-intelligence`, `identify-company` | Optional auth, external API calls without verification |
| M-01 | MEDIUM | `contract-lifecycle` | ADR-0077 PII sensitivity tagging not visible in EF layer |
| M-02 | MEDIUM | ops-* functions | Workspace table access outside gateway (cron-guarded but no per-tenant isolation) |
| M-03 | MEDIUM | `engine-dispatch` | ADR-0078 channel check not visible at EF dispatch layer |
| L-01 | LOW | `push-dispatch` | `PUSH_DISPATCH_SECRET` not in `[edge_runtime.secrets]` |
| L-02 | LOW | `ingest-workspace-knowledge` | Dual-auth not documented in config.toml |

**Counts:** CRITICAL 2 | HIGH 3 (covering 6 functions) | MEDIUM 3 | LOW 2

---

## Baseline Closure Confirmation

All three 2026-05-02 CRITICAL findings are **CLOSED**. The `verifyInternalAuth()` shared helper is correctly implemented (fail-closed: both secrets missing = 500, not open). 19 of 20 cron-guarded functions use the correct `!cronSecret ||` fail-closed pattern.

**Net new CRITICALs this run: 2** (`journey-stuck-detector` + `bootstrap-cascade`).
