---
title: "Slice 03 — Edge Functions Auth Perimeter"
status: done
updated: 2026-05-20
created: 2026-05-20
module: edge-functions
tags: [audit, edge-functions, adr-0077, adr-0039, adr-0078, adr-0029]
---

# Slice 03 — Edge Functions Auth Perimeter

## Summary

**EF-01 CLOSED.** PR #432 (b1c43f5903) added `[functions.tariff-amendment-sweep] verify_jwt = false` to `config.toml`. The block is present and documented at lines 649–656. Confirmed CLOSED.

Inventory: 66 EF directories, 62 with explicit `config.toml` entries, 3 user-facing EFs rely on the default `verify_jwt = true` (correct behavior). No hardcoded secrets found. One pre-existing MEDIUM (inline wildcard CORS on browser-callable EFs, ADR-0171 migration backlog) and one new LOW (tariff-amendment-sweep itself has a CORS-hygiene gap). ADR-0078 channel-pin is implemented in engine-dispatch. ADR-0039 scope guard is present in workspace-api gateway. ADR-0029 clean.

**Finding counts: 0 CRITICAL | 0 HIGH | 1 MEDIUM | 1 LOW**

---

## Findings

### EF-01 — CLOSED (Baseline HIGH → Verified Resolved)

| Field | Value |
|---|---|
| ID | EF-01 |
| Status | **CLOSED** |
| Severity | Was HIGH, now resolved |
| Location | `supabase/config.toml` lines 649–656 |
| ADR | ADR-0077 |

PR #432 added the `[functions.tariff-amendment-sweep] verify_jwt = false` block with a full comment block referencing ADR-0077 and the Wave 5 context. The function body itself is internally consistent: CRON_SECRET bearer auth at line 49–51, DEFERRED status comment at line 28 (not scheduled, manual invocation only). Closure confirmed.

---

### EF-02 — MEDIUM (Pre-existing, ADR-0171 migration backlog)

| Field | Value |
|---|---|
| ID | EF-02 |
| Severity | MEDIUM |
| Location | `supabase/functions/extract-workspace-data/index.ts:4–10`, `supabase/functions/call-command/index.ts:5–12`, `supabase/functions/livekit-token/index.ts:5–11` |
| ADR | ADR-0171 (CORS policy) |
| Fix estimate | Low — mechanical swap to `getCorsHeaders(req)` per existing `_shared/cors.ts` |

Three browser-callable EFs use inline hardcoded wildcard CORS (`"Access-Control-Allow-Origin": "*"`) rather than the ADR-0171 tenant-aware `getCorsHeaders(req)` from `_shared/cors.ts`. These EFs perform user authentication via `supabase.auth.getUser()` (i.e., they are reachable from browser contexts), so the apex `smartout.ai` or `getCorsHeaders` echo pattern should apply per ADR-0171.

- `extract-workspace-data` — JWT user-auth via `getUser()` at line 26; inline wildcard CORS at lines 4–9
- `call-command` — JWT user-auth via `getUser()` at line 36; inline wildcard CORS at lines 5–11
- `livekit-token` — `verify_jwt = true` in config, anon-allowed path for demos (line 47), inline wildcard CORS at lines 5–10

Note: ~29 other EFs also have inline wildcard CORS as boilerplate in OPTIONS handlers, but those are cron-internal (verified via `verifyInternalAuth` / WATCHDOG_CRON_SECRET guard) and are not browser-reachable. The pre-existing `_shared/cors.ts` deprecation notice at line 64 acknowledges ~49 un-migrated consumers. This finding tracks the browser-reachable subset only.

---

### EF-03 — LOW (tariff-amendment-sweep inline CORS vs shared pattern)

| Field | Value |
|---|---|
| ID | EF-03 |
| Severity | LOW |
| Location | `supabase/functions/tariff-amendment-sweep/index.ts:37–42` |
| ADR | ADR-0171 |
| Fix estimate | Negligible — swap to `_shared/cors.ts` corsHeaders import |

The function is cron-only and DEFERRED (not scheduled), so the wildcard CORS poses no live exposure. However, the inline definition (`"Access-Control-Allow-Origin": "*"`) diverges from the shared CORS module used across the rest of the fleet. Low priority pending the DEFERRED → activated transition.

---

## Per-ADR Rollup

### ADR-0077 — JWT Enforcement by Default, Opt-Out with Reason

**PASS (with EF-01 closure confirmed).**

- 62 of 66 EF directories have explicit `config.toml` entries
- 3 EFs without entries (`create-invitation`, `delete-account`, `send-login-code`) correctly rely on the default `verify_jwt = true`; all three perform in-body `supabase.auth.getUser()` validation with fail-closed 401 returns
- 4 EFs with explicit `verify_jwt = true`: `livekit-token`, `apply-change-proposal`, `shift-clock-compliance`, `guardian-actions` — all confirmed appropriate
- 58 EFs with `verify_jwt = false`: each uses one of three approved auth patterns: (a) `verifyInternalAuth()` from `_shared/internal-auth.ts` (service role + WATCHDOG_CRON_SECRET dual check), (b) CRON_SECRET/WATCHDOG_CRON_SECRET direct bearer check, (c) signature verification (stripe-webhook, livekit-webhook, sendgrid-webhook)
- `tariff-amendment-sweep` EF-01 confirmed closed; function is DEFERRED with CRON_SECRET auth body already in place for when it activates

### ADR-0039 — Caddy Reverse Proxy + Gateway Pattern

**PASS.**

- `workspace-api` is the sole data endpoint gateway; `requireScope` is imported from `_shared/scope-middleware.ts` (line 5) and called via `requireScope(auth, scope)` throughout
- `scope-middleware.ts` correctly distinguishes JWT callers (full pass-through, RLS handles) from API-key callers (explicit scope check with `*` wildcard support)
- EFs that bridge to internal services (`scrape-raw-data`, `gather-workspace-intelligence`, `identify-company`, `scrape-website`, `extract-workspace-data`) route through `SCRAPLING_SERVICE_URL` / `SCRAPLING_INTERNAL_URL` env vars — both wired via `config.toml` `[edge_runtime.secrets]` at lines 397–403. No hardcoded container hostnames found.

### ADR-0078 — Channel-Pin Derivation in Chat/Voice EFs

**PASS.**

- `engine-dispatch` stamps `originating_channel` at lines 344–345 with `payload.originating_channel ?? "system"` fallback; callers set the channel, function does not override
- `workspace-api` routes through `requireScope` without channel mutation — channel is set upstream in the calling BFF
- No EF found to be silently resetting or overriding channel context

### ADR-0029 — No Hardcoded Secrets

**PASS.**

- Full grep scan for embedded credential patterns (API key formats, long alphanumeric strings) returned zero hits outside `Deno.env.get(...)` calls
- `config.toml` uses `env(VAR)` interpolation for all sensitive values (lines 397–412 for edge runtime secrets; line 53 for vault key)
- `auth.sms.twilio` has dummy local-dev credentials (`AC_local_test_dummy`, `local_test_dummy_token`) at lines 294–296; these are intentionally non-functional placeholder values for local dev, not real credentials

---

## Verified Intentional

| Item | Location | Rationale |
|---|---|---|
| `analyze-setup-documents verify_jwt = false` | `config.toml:492` | Comment at lines 487–492 explains: in-body anon-key client validates bearer token; browser-invocable from onboarding storage-upload path; CORS via `_shared/cors.ts` |
| `livekit-token` anon-allowed path | `index.ts:47` | Demo/pre-signup flow; authenticated path still enforces `getUser()` at line 117 |
| `delete-account` no config entry | `index.ts:28–48` | Default `verify_jwt = true`; fail-closed in-body check is redundant safety |
| `tariff-amendment-sweep` DEFERRED | `index.ts:28–32` | Scaffolded but not scheduled; comment instructs activation steps including `cron` addition |
| Twilio dummy creds | `config.toml:294–296` | `test_otp` block short-circuits before real SMS; values are non-functional |

---

## In-Progress / Campaigns

- `campaign/bubble-migration` — no EF-level changes observed on this branch; webhook-related EFs (`stripe-webhook`, `sendgrid-webhook`, `livekit-webhook`) unmodified in current HEAD
- `campaign/botsson-arena` — `engine-dispatch` and `livekit-token` are stable; no active sub-sortie touching these EFs at time of audit

---

## Baseline Comparison

| Finding | 2026-05-13 Baseline | This Run | Delta |
|---|---|---|---|
| EF-01 tariff-amendment-sweep config.toml | HIGH (open) | **CLOSED** | -1 HIGH |
| Cron EFs 1–5 (ops-*) config blocks | FIXED 2026-05-13 | Confirmed stable | No change |
| Inline wildcard CORS (browser EFs) | Pre-existing | EF-02 MEDIUM | Tracked, not new |
| Hardcoded secrets | 0 | 0 | Clean |

**Net delta: -1 HIGH, +1 MEDIUM (pre-existing, now formally tracked), +1 LOW.**
