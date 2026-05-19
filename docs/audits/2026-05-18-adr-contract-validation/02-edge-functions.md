---
title: Edge Functions ADR Audit — 2026-05-18
status: done
updated: 2026-05-18
created: 2026-05-18
module: edge-functions
tags: [audit, adr-0029, adr-0039, adr-0077, adr-0078]
---

# Slice 02 — Edge Functions

**Scope:** `supabase/functions/**` | **ADRs:** 0029, 0039, 0077, 0078  
**Functions audited:** 65 directories (56 with config.toml entries)  
**In-flight exempt:** `engine-dispatch/handlers/day-line-push.ts` (council-APPROVED — not flagged)

---

## VIOLATION — ADR-0077: 6 cron functions silently unreachable

**Severity: HIGH**

The following functions use `WATCHDOG_CRON_SECRET` (or `CRON_SECRET`) as their sole auth mechanism but have **no `[functions.<name>]` entry in `config.toml`**. Without an explicit `verify_jwt = false`, the Supabase gateway rejects all non-JWT Bearer tokens before the handler executes — making these functions dead in production.

| Function | Secret used | Config entry |
|---|---|---|
| `ops-day-brief/index.ts:9` | `WATCHDOG_CRON_SECRET` | missing |
| `ops-learn/index.ts:359` | `WATCHDOG_CRON_SECRET` | missing |
| `ops-predict/index.ts:566` | `WATCHDOG_CRON_SECRET` | missing |
| `ops-triage/index.ts:74` | `WATCHDOG_CRON_SECRET` | missing |
| `ops-monitor/index.ts:412` | `WATCHDOG_CRON_SECRET` | missing |
| `tariff-amendment-sweep/index.ts:49` | `CRON_SECRET` | missing |

**Fix:** Add to `supabase/config.toml` for each:
```toml
[functions.<name>]
verify_jwt = false
```

The internal auth guard inside each handler (`Bearer ${cronSecret}`) is correct; the gateway just never lets the request through.

---

## ADR-0029 — workspace-api gateway: PASS

All user-facing workspace-data endpoints route through `workspace-api/index.ts`. Standalone functions returning workspace-scoped data are either cron jobs (service-role, no user context), internal bootstrap utilities (`bootstrap-cascade` via `verifyInternalAuth`), or mutation-only operations (`activate-workspace`, `finalize-workspace` via JWT `getUser`). No new standalone data-read API found outside the gateway.

---

## ADR-0039 — unified Docker Compose: NOT APPLICABLE

Edge Functions run on Deno Deploy / Supabase Local — outside Docker Compose scope. No violation surface.

---

## ADR-0077 — input validation and auth: MOSTLY PASS (1 gap noted)

**Auth patterns across functions:**

- JWT (`getUser`): `activate-workspace`, `finalize-workspace`, `extract-workspace-data`, `call-command`, `livekit-token`, `guardian-actions`, `shift-clock-compliance`, `send-login-code`, `create-invitation`
- Internal auth (`verifyInternalAuth`): `engine-dispatch`, `bootstrap-cascade`, `scrape-raw-data`, `google-places-intelligence`
- Cron secret (WATCHDOG): `session-lifecycle`, `session-hook-executor`, `ops-monitor`, `ops-day-brief`, `ops-triage`, `ops-learn`, `ops-predict`, `ops-monitor`, daily/weekly crons
- Webhook signature: `stripe-webhook`, `sendgrid-webhook`, `livekit-webhook`
- Custom bearer: `push-dispatch` (PUSH_DISPATCH_SECRET), `tariff-amendment-sweep` (CRON_SECRET)

**Input validation:** Manual validation is used where Zod is absent (noted inline: `payroll-period-locked-handler/index.ts:36`). Functions using it implement typed discriminated validators. Not flagged as a violation — ADR-0077 requires validation on input, not specifically Zod.

**Minor gap:** `activate-workspace/index.ts:27` parses `workspaceData` from body (`const { workspaceData } = await req.json()`) with only a null check — no field-level validation before passing to RPC `activate_workspace_v3`. Low severity (RPC enforces DB constraints), noted for completeness.

---

## ADR-0078 — channel-pinning: PASS

`send-login-code/index.ts:38` reads `channel` from body but this is the delivery channel (`"email" | "sms"`) — not the AI routing channel. The enum is validated on line 39. No AI capability routing channel hint is trusted from client in any Edge Function; `engine-dispatch` stamps `originating_channel` from payload but defaults to `"system"` (line 345) when absent. Channel-pinning enforcement remains server-side per ADR-0078.

---

## Summary

| Finding | ADR | Severity | Files |
|---|---|---|---|
| 6 cron functions missing `verify_jwt = false` — silently unreachable | 0077 | HIGH | `ops-day-brief`, `ops-learn`, `ops-predict`, `ops-triage`, `ops-monitor`, `tariff-amendment-sweep` |
| `activate-workspace` body parsed without field validation | 0077 | LOW | `activate-workspace/index.ts:27` |

**day-line-push.ts:** APPROVED by council — not flagged. Idempotency, emit contract, and push auth all correct per ADR-0367 §5.7.
