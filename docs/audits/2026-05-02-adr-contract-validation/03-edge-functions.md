---
title: "Edge Functions — ADR Contract Validation"
status: done
updated: 2026-05-02
created: 2026-05-02
module: edge-functions
tags: [audit, adr-0029, adr-0039, adr-0077, adr-0078, edge-functions]
---

# Slice 03 — Edge Functions ADR Audit

ADRs in scope: ADR-0029 (workspace-api gateway), ADR-0039 (infra consolidation), ADR-0077 (PII handling), ADR-0078 (channel restriction / voice-PII guard).

## Summary — Top 5 Findings

1. **CRITICAL: `engine-dispatch` has zero inbound auth** (`verify_jwt=false`, no bearer token, no HMAC, no cron secret). Any caller — authenticated or anonymous — can POST any `event_type` and inject engine events. 61 functions in the file, gated mutation types only cover `assign_task` / `send_notification` / `update_entity`; `call_rpc` and `start_process` are explicitly noted as not yet gated (ADR-0099 TODO comment at line 2453).

2. **CRITICAL: `validate-settlement` and `process-settlement-image` have zero auth** (`verify_jwt=false`, no bearer, no cron secret). Both use `SUPABASE_SERVICE_ROLE_KEY` internally. `validate-settlement` accepts any `reconciliation_id` and mutates `daily_reconciliation` with no workspace-identity check on the inbound call.

3. **MEDIUM: 11 cron functions use weak guard pattern** `if (cronSecret && authHeader !== ...)` — if `WATCHDOG_CRON_SECRET` env var is absent (misconfigured deploy), the condition short-circuits and the function becomes fully open. Correct pattern is `if (!cronSecret || authHeader !== ...)`.

4. **MEDIUM: `sendgrid-webhook` signature check is conditional** — gated on `WEBHOOK_VERIFICATION_KEY` being set. If the env var is absent, all signatures are skipped silently and the function processes any POST without verification.

5. **LOW: 8 functions are absent from `config.toml`** (`delete-account`, `ops-day-brief`, `ops-learn`, `ops-monitor`, `ops-predict`, `ops-triage`, `send-login-code`, `tariff-amendment-sweep`). They inherit the Supabase default `verify_jwt=true`. This is correct for JWT-auth functions, but undocumented and easy to accidentally break if the default changes.

---

## Function Inventory

| Function | Category | verify_jwt | Scope Guard | Dual-Auth | Auth Mechanism | Verdict |
|---|---|---|---|---|---|---|
| `workspace-api` | gateway | false | `requireScope` (✓) | ✓ JWT + API key | `resolveAuth` → JWT or `smo_*` API key | PASS |
| `stripe-webhook` | public-webhook | false | N/A | N/A | Stripe HMAC signature (mandatory, hard fail) | PASS |
| `livekit-webhook` | public-webhook | false | N/A | N/A | LiveKit `WebhookReceiver.receive()` HMAC | PASS |
| `sendgrid-webhook` | public-webhook | false | N/A | N/A | ECDSA sig — **conditional on env var** | PARTIAL |
| `engine-dispatch` | internal | false | `gate_action` RPC (partial) | N/A | **NONE — no inbound auth** | FAIL |
| `validate-settlement` | internal | false | none | N/A | **NONE — no inbound auth** | FAIL |
| `process-settlement-image` | internal | false | none | N/A | **NONE — no inbound auth** | FAIL |
| `livekit-token` | browser | true | channel membership check | N/A | JWT (verify_jwt=true) | PASS |
| `apply-change-proposal` | browser | true | JWT + profile check | N/A | JWT (verify_jwt=true) | PASS |
| `guardian-actions` | browser | false | workspace admin check inline | N/A | JWT inline getUser | PASS |
| `guardian-sweep` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `guardian-notify` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `session-lifecycle` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `session-hook-executor` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `daily-session-replenish` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `contract-lifecycle` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `leader-pulse` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `watchdog-integrity` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `watchdog-uptime` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `obligation-due-soon-cron` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `obligation-overdue-cron` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `emma-task-trigger` | cron | false | `if (cronSecret && ...)` | N/A | Weak cron guard | PARTIAL |
| `heartbeat-dispatcher` | cron | false | `if (!secret \|\| ...)` | N/A | Correct guard | PASS |
| `ops-triage` | cron | false | `if (!cronSecret \|\| ...)` | N/A | Correct guard | PASS |
| `push-dispatch` | internal | false | `PUSH_DISPATCH_SECRET` bearer | N/A | Hard-fail bearer check | PASS |
| `call-command` | browser | false | JWT inline getUser | N/A | JWT inline | PASS |
| `livekit-token` | browser | true | channel membership + AI policy | N/A | JWT (verify_jwt=true) | PASS |
| `send-login-code` | browser | true (default) | JWT + workspace role check | N/A | JWT default | PASS |
| `delete-account` | browser | true (default) | JWT inline getUser | N/A | JWT default | PASS |
| `ops-day-brief` | cron | true (default) | cron secret bearer | N/A | verify_jwt + cron secret double guard | PASS |
| `ops-learn` | cron | true (default) | cron check assumed | N/A | verify_jwt default | INFO |
| `ops-monitor` | cron | true (default) | cron check assumed | N/A | verify_jwt default | INFO |
| `ops-predict` | cron | true (default) | cron check assumed | N/A | verify_jwt default | INFO |
| `tariff-amendment-sweep` | cron | true (default) | `CRON_SECRET` bearer | N/A | JWT default + cron bearer | PASS (not scheduled) |
| `ingest-workspace-knowledge` | internal | false | service role OR JWT | N/A | authHeader mandatory | PASS |
| `bootstrap-cascade` | internal | false | no explicit auth seen | N/A | uses service role internally | INFO |
| `finalize-workspace` | pre-workspace | false | JWT inline getUser | N/A | JWT inline | PASS |
| `activate-workspace` | pre-workspace | false | JWT inline getUser | N/A | JWT inline | PASS |
| `gather-workspace-intelligence` | pre-workspace | false | JWT optional (auth-aware) | N/A | JWT optional per design | PASS |
| `extract-workspace-data` | internal | false | JWT inline getUser | N/A | JWT inline | PASS |
| `analyze-workspace` | internal | false | JWT forwarded | N/A | JWT passthrough | PASS |
| `accept-invitation` | pre-workspace | false | N/A | N/A | token-based invite flow | PASS |
| `journey-stuck-detector` | cron | false | WATCHDOG_CRON_SECRET OR engine-api-key | N/A | Two accepted bearer values | PASS |

---

## Per-ADR Rollup

### ADR-0029 — Workspace API Gateway

**PASS** for the gateway itself. `workspace-api` correctly uses `resolveAuth` dual-auth (JWT + API key), `requireScope`, `executeWithWorkspaceContext` (GUC-based RLS), and environment enforcement (test keys blocked in production).

**VIOLATION — ADR-0179 amendment:** `engine-dispatch` is called from DB triggers and cron, performing workspace-scoped mutations (engine_event, engine_state, engine_state_step) with no inbound auth gate. ADR-0029 table (amended 2026-04-22) permits this pattern for "server-internal scheduled work" with service role — but engine-dispatch has `verify_jwt=false` with *no* service-role check either. Any unauthenticated HTTP POST reaches it. This is not covered by the pre-workspace exceptions in ADR-0123.

**VIOLATION — `validate-settlement`:** performs workspace-scoped reconciliation mutations via service role with zero inbound auth.

### ADR-0039 — Infra Consolidation

**PASS** — Docker Compose + Caddy pattern governs services, not edge functions. All edge functions run on Supabase platform. No infra consolidation violations detected in function code.

### ADR-0077 — PII Handling

**PASS** for `stripe-webhook` — PII redaction via whitelist-only `redactStripeEvent()` (ADR-0141 compliance). No PII stored beyond the explicitly whitelisted billing fields.

**PASS** for `livekit-token` — handles display_name and avatar_url in metadata but no personnummer/bank/adresse fields.

**PASS** for `sendgrid-webhook` — handles email addresses for bounce/unsubscribe tracking. No personnummer/bank/adresse processed through voice channels.

**PASS for `livekit-webhook`** — records profile_id and room metadata. No PII fields in telemetry payload (`channel.call.participant_joined`).

### ADR-0078 — Channel Restriction (voice forbidden for PII)

**PASS for `livekit-token`:** enforces channel-level policy gates (`audio_policy`, `video_policy`, `channel_ai_policy.voice_participation`). AI voice gated separately from human calls. No PII capabilities are exposed through this function — it only issues a LiveKit JWT grant, not capability access.

**PASS for `call-command`:** JWT-authenticated, human call management only (start/end/mute/respond). No PII fields handled.

**NO VIOLATIONS detected** for ADR-0078 in edge functions. The risk surface (voice channels accessing PII capabilities) is in the stage-engine/agent-router layer (slice 02), not in these edge functions.

---

## Critical Findings

### CF-01: `engine-dispatch` — No Inbound Auth (CRITICAL)

- **File:** `supabase/functions/engine-dispatch/index.ts:180–240`
- **Config:** `verify_jwt=false`, no bearer check, no HMAC
- **Impact:** Any unauthenticated caller can POST `{event_type, payload, workspace_id}` and inject engine events. The event triggers engine_process dispatch. `call_rpc` action type is explicitly NOT in `GATED_MUTATION_TYPES` (comment at line 2453).
- **ADR reference:** Engine-dispatch is internal infrastructure (ADR-0029 table row: "server-internal scheduled work = service role"). The function uses service role internally but does not verify that callers have any credentials.
- **Fix:** Add `WATCHDOG_CRON_SECRET` bearer check (correct pattern: `if (!cronSecret || authHeader !== ...)`), or move to HMAC-signed DB trigger invocation only.

### CF-02: `validate-settlement` + `process-settlement-image` — No Inbound Auth (CRITICAL)

- **Files:** `supabase/functions/validate-settlement/index.ts`, `supabase/functions/process-settlement-image/index.ts`
- **Config:** `verify_jwt=false`, zero auth checks in function body
- **Impact:** `validate-settlement` mutates `daily_reconciliation` (financial data, workspace-scoped) with service role for any supplied `reconciliation_id`. `process-settlement-image` processes images via Google Vision and writes financial parse results. No workspace identity verified on inbound call.
- **Fix:** Add cron/engine-dispatch secret bearer check. These functions are called from engine_process dispatch steps; caller is engine-dispatch itself (once CF-01 is fixed, trust is transitive — but function-level auth is still required).

### CF-03: Weak Cron Guard — 11 Functions (MEDIUM)

- **Pattern:** `if (cronSecret && authHeader !== \`Bearer ${cronSecret}\`)` — evaluates to `false` when `cronSecret` is undefined, skipping the rejection branch entirely.
- **Affected:** `guardian-sweep`, `guardian-notify`, `session-lifecycle`, `session-hook-executor`, `daily-session-replenish`, `contract-lifecycle`, `leader-pulse`, `watchdog-integrity`, `watchdog-uptime`, `obligation-due-soon-cron`, `obligation-overdue-cron`, `emma-task-trigger`
- **Correct pattern:** `if (!cronSecret || authHeader !== ...)` — two functions already use this (`heartbeat-dispatcher`, `ops-triage`).
- **Impact:** If `WATCHDOG_CRON_SECRET` is missing from a deploy (misconfiguration, env drift), all 11 cron functions become fully open. Supabase Vault deployment risk.

### CF-04: `sendgrid-webhook` Conditional Signature Bypass (MEDIUM)

- **File:** `supabase/functions/sendgrid-webhook/index.ts:4,59`
- **Pattern:** `if (WEBHOOK_VERIFICATION_KEY) { ... verify ... }` — if env var not set, all posts accepted.
- **Impact:** Any caller can POST fake email events (bounce/unsubscribe/open) and manipulate `platform_communication_recipient` and `platform_email_suppression` tables.
- **Fix:** Hard-fail if key not configured: return 500 with "webhook key not configured" rather than skipping verification.

### CF-05: `call_rpc` Not Gated in `engine-dispatch` (LOW, tracked)

- **File:** `supabase/functions/engine-dispatch/index.ts:2453–2459`
- **Comment:** `// ADR-0099 note: call_rpc is a gated mutation type. Once gate_action() is landed, add "call_rpc" to GATED_MUTATION_TYPES`
- **Status:** Known debt, explicitly flagged by team. `shift_lifecycle_v1` runs with `allowed_channels=['system']` so gate is trivially satisfied for existing processes. Risk escalates as new `call_rpc`-based processes are added without gating.
- **Fix:** Add `"call_rpc"` and `"start_process"` to `GATED_MUTATION_TYPES` once `gate_action` RPC is confirmed stable.
