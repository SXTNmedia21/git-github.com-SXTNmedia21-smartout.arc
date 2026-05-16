---
title: "Audit 2026-05-16 — Edge Functions slice (03)"
status: done
created: 2026-05-16
updated: 2026-05-16
module: edge-functions
tags: [audit, adr-contract-validation, edge-functions, ADR-0029, ADR-0039, ADR-0077, ADR-0078]
---

# Audit 2026-05-16 — Edge Functions (03)

**Scope:** `supabase/functions/**` — 63 Edge Functions  
**ADRs:** ADR-0029 (workspace-api gateway), ADR-0039 (infra consolidation), ADR-0077 (contract PII), ADR-0078 + ADR-0163 (channel + PII enforcement)  
**Run:** smoke — read-only

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| INFO | 2 |

No blocking violations. One medium-severity pattern drift (verify_jwt mismatch on user-facing EFs). One low-severity observation on ADR-0163 Layer 1 silence. ADR-0332 fanout-scheduler (`note-fanout-scheduler`) verified correct.

---

## Per-EF Auth Matrix (selected)

| EF name | verify_jwt | auth pattern | workspace-scoped? | violates ADR? |
|---|---|---|---|---|
| `workspace-api` | false | `requireScope` (scope-middleware.ts:8) | Yes — gateway | No — canonical per ADR-0029 |
| `engine-dispatch` | false | `verifyInternalAuth` (L187 — service role OR cron secret) | Yes | No — internal-only, BFF proxies via service role |
| `call-command` | false | anon key + `getUser()` (L30, L37) | Yes | No — ADR-0054 explicit exception |
| `livekit-token` | true | Supabase JWT auto | Yes | No |
| `guardian-actions` | true | Supabase JWT auto | Yes | No |
| `apply-change-proposal` | true | Supabase JWT auto + role check | Yes | No |
| `shift-clock-compliance` | true | Supabase JWT auto | Yes | No |
| `finalize-workspace` | false | anon key + `getUser()` (L15, L21–22) | Pre-workspace bootstrap | No — expected pattern for pre-workspace path |
| `activate-workspace` | false | anon key + `getUser()` (L17, L24–25) | Pre-workspace bootstrap | No — ADR-0123 pre-workspace exception |
| `stripe-webhook` | false | Stripe `constructEventAsync` (L626) | No — webhook | No |
| `sendgrid-webhook` | false | ECDSA `verifySignature` (L22–39) | No — webhook | No |
| `livekit-webhook` | false | LiveKit SDK signature (L34) | No — webhook | No |
| All cron EFs (session-lifecycle, session-hook-executor, leader-pulse, ops-*, heartbeat-dispatcher, note-fanout-scheduler, obligation-*-cron, watchdog-*, daily-session-replenish, shift-lateness-check, etc.) | false | `WATCHDOG_CRON_SECRET` bearer (each: L33–38 typical) | Platform-internal | No |
| `contract-lifecycle` | false | `WATCHDOG_CRON_SECRET` bearer (L6–7) | Platform-internal | No |
| `send-morning-digest` | false | `MORNING_DIGEST_SECRET` bearer (L128) | Platform-internal | No |

---

## Findings

### F-EF-01 — verify_jwt=false on manually-JWT-authenticated user-facing EFs (MEDIUM)

**ADR:** ADR-0029 (auth boundary)  
**Status:** Shipped — intentional but undocumented deviation  
**Files:** `supabase/config.toml` (finalize-workspace, activate-workspace, call-command entries), `supabase/functions/finalize-workspace/index.ts:15,21`, `supabase/functions/activate-workspace/index.ts:17,24`, `supabase/functions/call-command/index.ts:30,37`

`finalize-workspace`, `activate-workspace`, and `call-command` all have `verify_jwt = false` in `config.toml` but perform manual JWT validation in-body via `createClient(SUPABASE_ANON_KEY) + auth.getUser()`. Functionally equivalent to `verify_jwt = true`, but Supabase's outer gate does not reject unauthenticated requests before the function body runs — this costs one extra RPC round-trip and is silent about the auth model to future maintainers.

`call-command` is additionally ADR-0054 sanctioned for direct client invocation. The manual auth in body is a dual-auth hedge (serves both JWT callers from walkieTalkie + service-role callers from BFF). This is defensible but ADR-0054 does not document why `verify_jwt=false` is needed. `finalize-workspace` and `activate-workspace` are pre-workspace bootstrap (ADR-0123 exception) where the user may not yet have a full session — making `verify_jwt=false` appropriate; the getUser() check IS the auth layer.

**Recommendation:** Add a comment in `config.toml` for each of these three functions citing the rationale (ADR-0054 for call-command; ADR-0123 for finalize/activate). No code change required. Prevents future audit false positives.

---

### F-EF-02 — ADR-0163 Layer 1 silence for ad-hoc agent-router paths (LOW)

**ADR:** ADR-0163 (allowedChannels mandatory)  
**Status:** Documented in ADR-0163 itself — known, not newly discovered  
**Files:** `supabase/functions/engine-dispatch/index.ts:642–692` (gate_action call with `p_engine_process_id`), `services/stage-engine/src/core/agent-router.ts:89–95` (not within EF scope but referenced)

`engine-dispatch` calls `gate_action` with `p_engine_process_id: state.process_id` (L684). ADR-0163 documents that the agent-router does NOT pass `p_engine_process_id` for ad-hoc chat turns, making Layer 1 (process-level channel restriction) silent in that path. Edge Function body correctly implements the gate where it has a process ID — the gap is in the caller (agent-router), not in the EF itself.

This is a **known gap per ADR-0163** (Option 3 filed as follow-up). Not a new finding. Flagged here for completeness as it lives at the boundary of EF behavior.

---

## Info Notes

### I-EF-01 — note-fanout-scheduler auth verified correct (INFO)

`supabase/functions/note-fanout-scheduler/index.ts:43–48` — `WATCHDOG_CRON_SECRET` bearer check before any processing. `verify_jwt = false` in config.toml. ADR-0332 pattern. Matches expectation from audit brief.

### I-EF-02 — timeline-template feature did NOT introduce Edge Functions (INFO)

`apps/web/src/app/api/timeline-template/` exists with `[id]/apply/route.ts` (Next.js BFF route handler). No `supabase/functions/timeline-template*/` directory found. Correct per ADR-0179 (browser mutations via Next.js route handlers).

---

## Theme Analysis

**Dominant auth pattern:** WATCHDOG_CRON_SECRET bearer (30+ cron/internal EFs) — applied consistently.  
**Webhook pattern:** Provider-specific signature verification (Stripe constructEventAsync, SendGrid ECDSA, LiveKit SDK) — all correct.  
**Gateway pattern:** workspace-api is the single external data gateway with scope guards — ADR-0039/0029 satisfied.  
**PII boundary (ADR-0077/0163):** engine-dispatch logs keys only, never values (L949, L1199). PII-safe patterns referenced in 4 distinct comment blocks.

**Architecture health:** The `_shared/internal-auth.ts` shared module (service-role OR cron-secret dual check) is being adopted consistently across newer EFs (engine-dispatch L187, call-command noted). Older cron functions use inline WATCHDOG_CRON_SECRET check — equivalent security, slightly more duplication. No regression vs prior audit.

---

## Coverage

63 Edge Functions audited. 4 directly read. Auth pattern verified via grep on all 63. 
ADRs cross-checked: ADR-0029, ADR-0054, ADR-0077, ADR-0078, ADR-0123, ADR-0163, ADR-0179, ADR-0332.
