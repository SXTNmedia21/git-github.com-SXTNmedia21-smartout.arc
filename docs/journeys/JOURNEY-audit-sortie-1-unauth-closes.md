---
title: JOURNEY — Audit Sortie 1, Unauth EF Closes
status: draft
created: 2026-05-06
updated: 2026-05-06
module: edge-functions
tags: [audit, security, edge-functions, journey]
sortie: feat/audit-sortie-1-unauth-closes
---

# User Journeys: Audit Sortie 1 — Unauth EF Closes

These journeys are admin/internal-system flows. No end-user surface — fixes harden the boundary between anonymous internet and Supabase service-role mutations.

---

## Journey: Cron caller invokes journey-stuck-detector with valid bearer

**Precondition:** `WATCHDOG_CRON_SECRET` set in EF env. Cron caller has the secret.

1. Cron service POSTs to `/functions/v1/journey-stuck-detector` with `Authorization: Bearer <WATCHDOG_CRON_SECRET>` → System validates via `verifyInternalAuth()` → System runs stuck-detector logic → User sees 200 + count of stuck journeys handled.

**Postcondition:** Stuck `engine_state` rows transitioned per detector logic.

**Error paths:**
- Anonymous POST (no Authorization header) → System rejects with 401 → User sees "unauthorized".
- Wrong secret in Authorization header → System rejects with 401 → User sees "unauthorized".
- Both `WATCHDOG_CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` missing in env → System refuses to start (500 misconfig) → User sees "service misconfigured" (NOT default-allow as today).

---

## Journey: Internal caller bootstraps cascade for new workspace

**Precondition:** Workspace exists. Caller has internal-auth bearer (engine-dispatch / n8n / CI seed).

1. Internal service POSTs `{workspace_id}` to `/functions/v1/bootstrap-cascade` with valid `Authorization: Bearer <INTERNAL_AUTH_TOKEN>` → System validates via `verifyInternalAuth()` → System seeds 42 cascade rows for the workspace → User sees 200 + bootstrap summary.

**Postcondition:** Workspace has framework + tariff + day_factor + hour_factor seeded; subsequent dimension queries return non-empty.

**Error paths:**
- Anonymous POST with `{workspace_id}` body → System rejects with 401 → User sees "unauthorized" → No DB mutation occurs (NOT 42 mutations as today).
- Valid auth but invalid `workspace_id` → System validates UUID + workspace exists → 404 if not found.
- Cascade already bootstrapped (idempotency) → System returns 200 with "already-bootstrapped" status → No-op.

---

## Journey: Cron caller invokes cleanup-sandbox-workspaces with missing env var

**Precondition:** Pontus or DevOps misconfigures EF deployment — `CLEANUP_CRON_SECRET` env var not set.

1. Cron service POSTs to `/functions/v1/cleanup-sandbox-workspaces` with any Authorization header → System reads env at handler scope → System detects `cronSecret === undefined` → System returns 500 "service misconfigured" → User sees error (NOT a 200 with sandbox workspaces deleted as today's `Bearer ${undefined}` accept-all bug).

**Postcondition:** No workspaces deleted. Misconfig surfaced loudly to ops.

**Error paths:**
- Env var set, wrong secret in request → System rejects with 401.
- Env var set, correct secret, no sandbox workspaces to clean → System returns 200 with "0 cleaned".

---

## Journey: SendGrid posts bounce event with valid signature

**Precondition:** `SENDGRID_WEBHOOK_VERIFICATION_KEY` set in EF env. SendGrid sends signed webhook.

1. SendGrid POSTs bounce event to `/functions/v1/sendgrid-webhook` with `X-Twilio-Email-Event-Webhook-Signature` + `X-Twilio-Email-Event-Webhook-Timestamp` → System reads body + headers → System verifies signature using ECDSA `secp256k1` per SendGrid spec → System processes events → User sees 200, suppression list updated.

**Postcondition:** Affected recipients added to `platform_email_suppression`.

**Error paths:**
- Missing `SENDGRID_WEBHOOK_VERIFICATION_KEY` env var → System returns 500 "service misconfigured" → User sees error → SendGrid retries per its policy (NOT silent accept-all as today).
- Valid env, missing signature header → System rejects with 401.
- Valid env, signature mismatch → System rejects with 401, logs attempted forgery.
- Body parse error → System rejects with 400.
