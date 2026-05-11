---
title: "Audit Slice 03 — Edge Functions"
status: done
created: 2026-05-10
updated: 2026-05-10
module: edge-functions
tags: [audit, security, edge-functions, adr-0029, adr-0039, adr-0077, adr-0078, phase-e]
---

# Audit Slice 03 — Edge Functions

**ADRs in scope:** 0029 (Workspace API Gateway), 0039 (Infra Consolidation), 0077 (PII Handling), 0078 (Channel Restriction)
**Surface:** `supabase/functions/**` — 60 Edge Functions + `config.toml`
**Auditor model:** claude-sonnet-4-6
**Date:** 2026-05-10
**Campaign:** `campaign/botsson-arena` (Phase E cutover)

---

## Delta vs 2026-05-06 Baseline

| Baseline Finding | Status |
|---|---|
| C-01 — `journey-stuck-detector`: broken `isAuthorized()` opens when both secrets absent | **CLOSED** — `index.ts:57,530` now uses `verifyInternalAuth()` |
| C-02 — `bootstrap-cascade`: `verify_jwt=false`, no inbound auth | **CLOSED** — `index.ts:183-185` uses `verifyInternalAuth()` (`1d553a4bc`) |
| H-01 — `cleanup-sandbox-workspaces`: `Bearer undefined` bypass | **CLOSED** — `index.ts:19` uses `verifyInternalAuth()` (handler scope, not module scope) |
| 19/20 cron functions fail-closed | **CONFIRMED** — all cron-guarded functions verified fail-closed |

---

## Findings

### HIGH

#### F-EF-01 — `analyze-setup-documents`: header presence check only, service_role bypasses RLS

**File:** `supabase/functions/analyze-setup-documents/index.ts:198-204`
**ADR:** 0029 (auth must be real, not presence-only); 0179 (browser MUST NOT invoke EF for workspace mutations)
**Severity:** HIGH

The function has `verify_jwt = false` in `config.toml`. Its inbound auth check is:

```ts
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401 });
}
```

This checks only that an `Authorization` header EXISTS — any string value (including `"Bearer garbage"`) passes. The function then creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY` and downloads files from the `setup-documents` Storage bucket, calling Scrapling for extraction and OpenRouter for analysis. The service role bypasses RLS entirely.

A second violation: `DocumentDropStep.tsx:321` calls this function directly via `invokeEdgeFunction(supabase, "analyze-setup-documents", ...)` from inside the dashboard (post-workspace context). ADR-0179 explicitly forbids browser code from invoking Edge Functions for workspace-scoped operations; workspace mutations must route through Next.js route handlers.

**Impact:** Any caller with an arbitrary `Authorization` header and knowledge of a `workspace_id` + storage path (which are opaque UUIDs, so practical risk is low) can trigger AI document analysis billed against the platform's OpenRouter quota. The ADR-0179 violation additionally creates CORS exposure and bypasses telemetry parity (no `emit()` possible in Deno).

**Fix:**
1. Replace header presence check with `verifyInternalAuth()` OR proper JWT validation via `supabase.auth.getUser()` with a real workspace membership check.
2. Move the browser call path to a Next.js route handler at `apps/web/src/app/api/setup/analyze-documents/route.ts` and have it call the Edge Function server-to-server.

---

#### F-EF-02 — ADR-0179 violations: dashboard code calls workspace-scoped Edge Functions directly

**Files:**
- `apps/web/src/app/dashboard/setup/wizard-definition.ts:295` — calls `ingest-workspace-knowledge`
- `apps/web/src/app/dashboard/people/_actions/people-actions.ts:766` — calls `send-login-code`
**ADR:** 0179 (browser MUST NOT invoke Edge Functions for workspace-scoped mutations)
**Severity:** HIGH

Two additional direct browser-to-Edge-Function calls exist in the dashboard (post-workspace, authenticated) context:

1. `setup/wizard-definition.ts:295` — `void invokeEdgeFunction(supabase, "ingest-workspace-knowledge", ...)`. The `ingest-workspace-knowledge` function processes workspace documents and writes to `engine_memory` + `workspace_doc_chunk`. This is a workspace mutation.

2. `people-actions.ts:766` — `supabase.functions.invoke("send-login-code", ...)`. `send-login-code` uses `auth.admin.generateLink()` (service role) and dispatches via SendGrid/Twilio. ADR-0045 mandates email/SMS go through `@smartout/notifications` package; the Edge Function hand-rolls these calls, bypassing suppression and retry logic.

**Note:** The onboarding hooks (`useOnboardingState.ts`) call `gather-workspace-intelligence`, `search-brreg`, `scrape-website`, `identify-company`, and `finalize-workspace` from the `/onboarding` route. These are pre-workspace onboarding flows and are covered by the ADR-0029 amendment (ADR-0123 explicit exceptions). They are NOT violations.

**Impact:** CORS exposure, telemetry parity gap, ADR-0045 bypass on `send-login-code`.

**Fix:** Wrap each call in a Next.js route handler:
- `apps/web/src/app/api/workspace/ingest-knowledge/route.ts`
- `apps/web/src/app/api/people/send-login-code/route.ts`

The route handlers call the EFs server-to-server (service role, no CORS).

---

### MEDIUM

#### F-EF-03 — `livekit-webhook`: wizard room names not filtered; `channelId = "wizard"` leaks into DB lookups

**File:** `supabase/functions/livekit-webhook/index.ts:35-43`
**ADR:** 0029 (fail-gracefully on unexpected input); 0039 (Infra — room name format contract)
**Severity:** MEDIUM

Wizard rooms use the three-segment format `{wsId}:wizard:{userId}` (e.g. `anon:wizard:anon-<uuid>`). The webhook parser:

```ts
const [workspaceId, channelId] = roomName.split(":");
if (!workspaceId || !channelId) { ... }  // guard
```

With a wizard room, `split(":")` returns three elements. Destructuring to two variables gives `workspaceId = "anon"` and `channelId = "wizard"`. Both are truthy, so the null-check guard does NOT short-circuit.

The function then enters the `switch(event.event)` block. For `participant_joined` and `participant_left` events, it calls `getActiveSessionId(supabase, "wizard")` which returns `null` — so no DB write occurs and execution breaks early. For `room_finished`, it queries `channel_call_session WHERE channel_id = 'wizard'`, returns nothing, and does nothing.

Outcome: silent no-op on every wizard LiveKit event. No data corruption, no security breach. However:
- Every wizard call generates console.error noise if the null-check guard fires on edge cases.
- `emitCallEvent` is never called for wizard sessions, so wizard call telemetry (C1 observability) is entirely absent.
- The three-segment room format is not guarded upstream — if the bot also joins, `participant_joined` fires with `identity = "botsson:..."` which gets silently dropped.

**Fix:** Add a wizard-room guard before the switch:

```ts
// Wizard rooms: {wsId}:wizard:{userId} — 3 segments, no channel binding.
// Skip call-session tracking; wizard telemetry is handled by the BFF route.
if (channelId === "wizard") {
  console.info("[livekit-webhook] Wizard room event — skip call-session tracking", roomName);
  return new Response("ok");
}
```

---

#### F-EF-04 — ADR-0078 L1 gap: engine-dispatch does not check `engine_process.allowed_channels` at process-start

**File:** `supabase/functions/engine-dispatch/index.ts:300-370` (process-start path)
**ADR:** 0078 (L1 = process-level check at process-start in dispatcher; hard stop before any steps)
**Severity:** MEDIUM

ADR-0078 defines three enforcement layers:
- **L1:** Process-level `allowed_channels` checked by the dispatcher at `engine_state` creation. Hard stop before any steps execute.
- **L2/L3:** Capability/tool-level defence in depth.

Current implementation: the dispatcher creates `engine_state` with `status = "active"` without querying `engine_process.allowed_channels`. The `gate_action` DB function DOES enforce channel restriction — but only when a GATED_MUTATION_TYPES step executes. Non-mutation steps (`wait_for_event`, `generate_steps`, `cascade_*`, `check_readiness`) run without channel check.

For PII-sensitive processes (e.g. `contract_data_intake` with `allowed_channels = ['chat']`):
1. A voice-channel trigger creates the `engine_state` (PASSES — no L1 check).
2. `wait_for_event` steps execute freely (PASSES — not gated).
3. Only `assign_task` / `send_notification` steps are blocked by `gate_action`.

This means the "hard stop before any tools called" intent of L1 is not met. The process begins and non-mutation phases run before channel enforcement fires.

**Note:** The `engine_process.allowed_channels` column exists and is seeded correctly (e.g. `20260501100300_engine_channel_sensitivity_cancellation.sql`). The gap is dispatcher-only.

**Fix:** Before `supabase.from("engine_state").insert(...)` in the trigger-dispatch path, fetch `engine_process.allowed_channels` and compare against `originatingChannel`. Reject with `engine.process.channel_rejected` telemetry event if mismatch. This is the "L1 hard stop" per ADR-0078.

---

### LOW / INFORMATIONAL

#### F-EF-05 — `livekit-token`: `verify_jwt = true` + wizard anon path — architecture correct, comment potentially confusing

**File:** `supabase/functions/livekit-token/index.ts:34-46` + `supabase/config.toml`
**ADR:** 0029, 0135 (ADR-0282 wizard branch)
**Severity:** INFORMATIONAL

The wizard branch comment says "Allows anonymous (unauthenticated) for pre-signup demos" while `config.toml` has `verify_jwt = true`. This is NOT a bug:

- The `/api/wizard/start` Next.js route handler calls `livekit-token` server-to-server using the Supabase server client.
- For unauthenticated landing-page visitors, the server client sends the anon key as a Supabase JWT — which is a valid JWT that passes `verify_jwt = true` at the gateway.
- Inside the function body, `supabase.auth.getUser()` returns `null` for the anon key → `userId = "anon"` path is taken.
- The wizard branch correctly produces an `"anon:wizard:anon-<uuid>"` room name.

Architecture is sound. The word "unauthenticated" in the comment is accurate from the user's perspective (no user account) but could be misread as "no auth token at all." Consider rewording to "callers without a user session (anon key JWT)" to prevent future confusion.

---

## Closed Baseline Findings (confirmed)

| Finding | Closed by | Evidence |
|---|---|---|
| C-01 — journey-stuck-detector broken auth | botsson-arena Phase D | `index.ts:57` `import verifyInternalAuth` + `:530` usage |
| C-02 — bootstrap-cascade no inbound auth | commit `1d553a4bc` | `index.ts:183-185` verifyInternalAuth gate |
| H-01 — cleanup-sandbox-workspaces Bearer-undefined bypass | commit `2129997b1` | handler-scope auth, not module scope |
| 19 cron functions weak guards | commit `2129997b1` | all verified fail-closed pattern |

---

## Non-Findings (intentional patterns)

| Pattern | Rationale |
|---|---|
| `gather-workspace-intelligence`, `search-brreg`, `scrape-website`, `identify-company`, `finalize-workspace` called from browser in `/onboarding` | Pre-workspace flow; explicit ADR-0029 amendment (ADR-0123) grants exception |
| `validate-settlement`, `process-settlement-image` with `verify_jwt=false` | Both use `verifyInternalAuth()` (internal-only functions per design) |
| Dual `verify_jwt=false` + internal cron auth (guardian-sweep, guardian-notify, emma-task-trigger, fire-delayed-triggers, etc.) | All use fail-closed cron secret guard (`WATCHDOG_CRON_SECRET`) at handler scope |
| `workspace-api` `verify_jwt=false` with `resolveAuth()` | Dual-auth gateway per ADR-0029; API key + JWT both handled |
| `livekit-webhook` `verify_jwt=false` | Legitimate webhook endpoint; uses `WebhookReceiver.receive()` HMAC signature verification |
| `sendgrid-webhook` `verify_jwt=false` | Uses ECDSA P-256 signature verification (`verifySignature()`) |
| `stripe-webhook` `verify_jwt=false` | Uses `stripe.webhooks.constructEventAsync()` signature verification |

---

## Summary

| Severity | Count | New | Closed |
|---|---|---|---|
| CRITICAL | 0 | — | 2 (C-01, C-02) |
| HIGH | 2 | 2 | — |
| MEDIUM | 2 | 2 | — |
| LOW/INFO | 1 | 1 | — |
| **Total open** | **5** | | |

**Immediate action recommended:** F-EF-01 (analyze-setup-documents auth weakness + ADR-0179). The header-presence-only check is the weakest point in the surface; everything else degrades gracefully.
