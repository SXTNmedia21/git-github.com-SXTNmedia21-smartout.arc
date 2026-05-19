---
title: "Slice 03 — Edge Functions Audit"
status: done
created: 2026-05-18
updated: 2026-05-18
module: edge-functions
tags: [audit, edge-functions, adr-0029, adr-0039, adr-0077, adr-0078, config.toml]
---

# Slice 03 — Edge Functions Audit

**Scope:** `supabase/functions/**` · ADRs 0029, 0039, 0077, 0078
**Date:** 2026-05-18 · **Mode:** Full audit · **Read-only**

---

## Summary

65 Edge Functions across 56 config.toml entries. 9 functions have no config entry.
The prior smoke run's HIGH finding (6 cron functions dead in prod) is **confirmed**.
3 additional JWT-authenticated functions also lack entries (LOW — default `verify_jwt=true` covers them).
No Zod validation in the two highest-traffic functions (`workspace-api`, `engine-dispatch`).
ADR-0029 gateway pattern is correctly implemented. ADR-0039 infra consolidation compliance is clean.

---

## HIGH — 5 scheduled cron functions missing `verify_jwt = false` in config.toml

Functions: `ops-day-brief`, `ops-learn`, `ops-monitor`, `ops-predict`, `ops-triage`

All five use `WATCHDOG_CRON_SECRET` bearer-token auth in their function bodies. All five are
invoked by pg_cron migrations (confirmed: `20260414230100_ops_day_brief_cron.sql`,
`20260414231000_ops_predict_learn_cron.sql`, `20260414240000_ops_monitor_cron.sql`). `ops-triage`
is DB-trigger-invoked. None of these callers supply a Supabase JWT.

**Effect:** Supabase runtime rejects all requests with 401 before the function body runs.
All five functions are silently dead in production. ADR-0088 (AI Operations Intelligence) is
not executing.

**Fix:** Add to `config.toml` for each:
```toml
[functions.ops-day-brief]
verify_jwt = false

[functions.ops-learn]
verify_jwt = false

[functions.ops-monitor]
verify_jwt = false

[functions.ops-predict]
verify_jwt = false

[functions.ops-triage]
verify_jwt = false
```

---

## DEFERRED (by design) — `tariff-amendment-sweep` missing config entry

Function body includes explicit comment: `DEFERRED: not scheduled in config.toml — invoke manually
when ready.` Comment also documents the config.toml block to add when activating. No fix needed
until the tariff-version-flip sortie ships.

---

## LOW — 3 JWT-authenticated functions missing config entries

Functions: `send-login-code`, `create-invitation`, `delete-account`

All three use in-body JWT validation via an anon-key Supabase client. When a function has no
config entry, Supabase default is `verify_jwt = true`. The calling surfaces (`supabase.functions.invoke()`
from the web app) forward the user's session JWT automatically, so Supabase-level verification
passes before the function body runs. Runtime behavior is correct today.

**Risk:** Undocumented reliance on implicit default behavior. If Supabase ever changes the default
or the functions are invoked without a session context, they will fail silently. Recommend adding
explicit entries with comments matching the pattern used for `analyze-setup-documents` (line 492
in config.toml, which documents why `verify_jwt = false`).

---

## MEDIUM — No Zod input validation in `workspace-api` and `engine-dispatch`

`workspace-api` handler files use `parseInt(url.searchParams.get(...))` without validation or
schema guards. `engine-dispatch` destructures `req.json()` directly:
`const { event_type, payload, workspace_id, idempotency_key } = body` with no shape validation.

Both functions have robust auth gates (`resolveAuth` / `verifyInternalAuth`) but accept arbitrary
JSON shapes through their hot paths. Malformed payloads would reach business logic with `undefined`
fields rather than failing fast at the boundary.

**ADR reference:** ADR-0029 §Mutation Surface Selection requires Zod validation on Edge Function
inputs. The smartout-edge-function-guide skill mandates Zod validation.

**Fix:** Add a `z.object({...}).safeParse(body)` gate at the top of each handler. Shared schema
files in `supabase/functions/_shared/` are the appropriate location.

---

## PASS — ADR-0029 gateway pattern (workspace-api)

`workspace-api` correctly implements the single-entry-point gateway with `resolveAuth` (dual-auth:
JWT or `smo_sk_*` API key), `requireScope` enforcement, and `executeWithWorkspaceContext` for
RLS via PostgreSQL GUC. All workspace-scoped data endpoints route through this gateway.
Standalone functions are explicitly permitted for webhooks and pre-workspace flows per
ADR-0123 amendment.

---

## PASS — ADR-0039 infrastructure consolidation

All Edge Function secrets consumed via `Deno.env.get()`. No hardcoded URLs; scrapling base URL
pattern fixed (audit 2026-04-17 slice 03 note confirmed in function bodies). Unified infra/
directory pattern is not an Edge Function concern but no violations found.

---

## PASS — ADR-0077 / ADR-0078 channel pinning

Channel enforcement happens at the engine-dispatch layer via `originating_channel` stamped from
`payload.originating_channel ?? "system"` (line 344 in engine-dispatch). ADR-0163 (ADR-0078
amendment) documents the known gap: `gate_action` only checks `engine_process.allowed_channels`
when `p_engine_process_id` is passed; ad-hoc chat skips Layer 1. This gap is documented and
accepted. No new violations found in this audit cycle.

---

## PASS — Auth patterns on cron/watchdog functions (configured ones)

All configured cron functions use `WATCHDOG_CRON_SECRET` bearer-token pattern with fail-closed
guard (`!cronSecret || authHeader !== Bearer ${cronSecret}` → 401). Service-role client for DB
writes. Pattern is consistent and correct across: `obligation-overdue-cron`,
`obligation-due-soon-cron`, `heartbeat-dispatcher`, `payroll-period-locked-handler`,
`note-fanout-scheduler`, `daily-session-replenish`, `session-watchdog-demoter`.

---

## PASS — Telemetry emit coverage

18 of 65 functions emit telemetry. Cron and internal-dispatch functions are correctly exempt
(they write to `activity_trail` directly via service role, bypassing the emit path per
ADR-0045 rationale documented in engine_world Phase 1+2 learnings). No mutations-without-emit
found in user-facing Edge Functions.

---

## Action items (read-only — remediation is a separate sortie)

| Priority | Action |
|---|---|
| HIGH | Add `[functions.ops-*]` + `[functions.ops-triage]` entries with `verify_jwt = false` to config.toml |
| MEDIUM | Add Zod input schemas to `workspace-api` handlers and `engine-dispatch` body destructuring |
| LOW | Add explicit `[functions.send-login-code]`, `[functions.create-invitation]`, `[functions.delete-account]` entries with `verify_jwt = true` and rationale comment |
