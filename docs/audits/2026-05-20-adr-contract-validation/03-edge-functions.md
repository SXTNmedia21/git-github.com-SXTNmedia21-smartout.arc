---
title: Slice 03 — Edge Functions Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, edge-functions, adr-0029, adr-0039, adr-0077, adr-0078]
---

# Slice 03 — Edge Functions

**ADRs in scope:** 0029, 0039, 0077, 0078
**Functions audited:** 65 directories (61 with config.toml entries; 4 missing by design or JWT-default)
**Baseline:** 2026-05-18 run — slice was numbered 02 (now renumbered to 03 per 2026-05-20 parallel run index). Prior HIGH finding (6 cron EFs missing `verify_jwt=false`) used as delta baseline.
**Delta note:** 2026-05-18 audit had this slice as 02; 2026-05-20 reindexes as 03. No prior 03-edge-functions.md in the 2026-05-18 run — this is a fresh audit against current tip (`campaign/ui-shell`, post `047d3e8a7`).

---

## Summary

| # | Severity | Finding | ADR |
|---|---|---|---|
| 1 | HIGH (PERSISTS) | `tariff-amendment-sweep` still missing `[functions.tariff-amendment-sweep]` in `config.toml` — CRON_SECRET auth unreachable at Supabase gateway | 0077 |
| 2 | LOW (PERSISTS) | `activate-workspace/index.ts:27` parses `workspaceData` from body with only null-check, no field-level validation before RPC | 0077 |
| 3 | INFO | `requireSecrets` helper shipped (`_shared/required-secrets.ts`) — startup-time boot guard for EF secrets. Only wired to `analyze-setup-documents`; other EFs with external-service dependencies not yet wired | — |
| 4 | INFO | 4 functions absent from config.toml: `create-invitation`, `delete-account`, `send-login-code` (JWT-auth, default `verify_jwt=true` sufficient), `tariff-amendment-sweep` (explicitly deferred per docstring) | — |
| 5 | INFO | `analyze-setup-documents` browser-direct invoke pattern confirmed LOW-risk post SMA-350 fix (getUser + workspace-membership guard present) | 0029 |

---

## Findings table

| ID | Severity | File:line | ADR | Evidence |
|---|---|---|---|---|
| EF-01 | HIGH (PERSISTS) | `supabase/functions/tariff-amendment-sweep/index.ts:49` | 0077 | Uses `CRON_SECRET` bearer auth but no `[functions.tariff-amendment-sweep]` in `config.toml` — Supabase gateway rejects non-JWT tokens without explicit `verify_jwt=false`. 5 of 6 prior-flagged cron EFs were fixed (ops-day-brief, ops-learn, ops-monitor, ops-predict, ops-triage); tariff-amendment-sweep persists. Function docstring acknowledges deferral (line 28: "DEFERRED: not scheduled in config.toml") but this is an inconsistent posture — the function code includes active auth, emit, and a note to "add to config.toml when ready" without blocking invocation. |
| EF-02 | LOW (PERSISTS) | `supabase/functions/activate-workspace/index.ts:27` | 0077 | `const { workspaceData } = await req.json()` with only null-check before passing to `activate_workspace_v3` RPC. Unchanged from 2026-05-18. DB constraints are the backstop; not a critical gap but ADR-0077 requires input validation. |
| EF-03 | INFO | `supabase/functions/_shared/required-secrets.ts` (NEW) | — | New startup-gate helper shipping 2026-05-19. Currently wired only to `analyze-setup-documents`. Functions with external-service dependencies (e.g. `gather-workspace-intelligence` using SCRAPLING_AUTH_TOKEN, `livekit-webhook` using LIVEKIT_API_SECRET) are not yet wired. Not a violation but an adoption gap worth tracking. |
| EF-04 | INFO | `supabase/functions/analyze-setup-documents/index.ts:238-266` | 0029 | Browser (`DocumentDropStep.tsx:323`, `"use client"`) → `invokeEdgeFunction(supabase, "analyze-setup-documents")`. EF uses `verify_jwt=false` but now does `getUser()` + workspace-membership profile check before any service-role read (SMA-350 fix). This is NOT a gateway violation: the function is a processing/mutation-adjacent EF (Storage download + AI analysis), not a workspace-data-read endpoint. ADR-0029 mutation table permits this pattern for non-data-read operations with valid JWT validation. Status: LOW-risk / confirmed intentional since 2026-05-15. |

---

## Per-ADR rollup

### ADR-0029 — Workspace API Gateway

| File | Verdict | Notes |
|---|---|---|
| `workspace-api/index.ts` | ✅ compliant | 30+ routes; all workspace-scoped data reads correctly routed here with scope enforcement via `requireScope` |
| `analyze-workspace/index.ts` | ✅ compliant | `verifyInternalAuth` — server-internal pattern per ADR-0123 |
| `gather-workspace-intelligence/index.ts` | ✅ compliant | `verifyInternalAuth` |
| `analyze-setup-documents/index.ts` | ✅ compliant | Browser-direct pattern confirmed as processing-EF exception (not a workspace-data-read). `getUser()` + workspace-membership check present |
| `accept-invitation/index.ts` | ✅ compliant | ADR-0123 explicit pre-workspace exception — token-as-auth |
| `create-invitation`, `delete-account`, `send-login-code` | ✅ compliant | JWT-auth EFs (default `verify_jwt=true`); not workspace-data-read endpoints |
| `publish-birthday-celebrations/index.ts` | ✅ compliant | Cron-only, WATCHDOG_CRON_SECRET, service-role; not a user-facing data API |

**Summary:** 0 violations, 0 new gateway bypasses found. All new functions since 2026-05-18 follow correct auth pattern.

### ADR-0039 — Unified Docker Compose

✅ **NOT APPLICABLE** — Edge Functions run on Deno/Supabase, outside Docker Compose scope. No violation surface.

### ADR-0077 — Contract Intake / PII Handling

| File | Verdict | Notes |
|---|---|---|
| `supabase/functions/tariff-amendment-sweep/index.ts` | 🔴 violation | CRON_SECRET auth with no `verify_jwt=false` config — gateway rejects all calls (persists from 2026-05-18 HIGH) |
| `supabase/functions/activate-workspace/index.ts` | ⚠️ partial | `workspaceData` body field-level validation missing (persists LOW) |
| All other EFs with PII-adjacent ops | ✅ compliant | `send-login-code`, `create-invitation`, `contract-lifecycle` all use JWT getUser before PII access |
| `publish-birthday-celebrations/index.ts` | ✅ compliant | WATCHDOG_CRON_SECRET, no PII fields in response payload |
| `analyze-setup-documents/index.ts` | ✅ compliant | post-SMA-350: getUser + workspace-membership guard; service-role client only activated after auth confirmed |

**Summary:** 1 HIGH (persistent), 1 LOW (persistent). No new PII-echo violations found in any EF response payloads.

### ADR-0078 — Engine Process Channel Restriction

| File | Verdict | Notes |
|---|---|---|
| `engine-dispatch/index.ts:344` | ✅ compliant | `originating_channel` defaults to `"system"` when absent — server-side stamping preserved |
| `engine-dispatch/handlers/day-line-push.ts` | ✅ compliant | APPROVED by council (ADR-0367 §5.7); workspace_id filter confirmed present post-628041add fix |
| `payroll-period-locked-handler/handler.ts:153` | ✅ compliant | `allowed_channels: ["push", "in_app"]` — correct notification-channel enum, not AI-routing |
| `send-login-code/index.ts:38` | ✅ compliant | `channel` is delivery channel (`"email" | "sms"`), not AI session channel; enum validated on line 39 |
| No EF accepts AI session-routing `channel` from client | ✅ compliant | Channel-pinning remains server-side across all audited EFs |

**Summary:** 0 violations. Channel-pinning enforcement intact.

---

## Delta vs 2026-05-18 (slice 02)

| Prior finding | Prior severity | Current status |
|---|---|---|
| 6 cron EFs missing `verify_jwt=false` | HIGH | **5 of 6 FIXED** (ops-day-brief, ops-learn, ops-monitor, ops-predict, ops-triage). `tariff-amendment-sweep` persists — intentionally deferred per docstring but code is active |
| `activate-workspace` body field-level validation | LOW | OPEN — unchanged |
| `analyze-setup-documents` browser-direct pattern | LOW (from 2026-05-15) | CONFIRMED intentional, SMA-350 auth hardening applied |

**New since 2026-05-18:**
- `requireSecrets` helper (`_shared/required-secrets.ts`) — positive improvement (EF-03 INFO)
- `publish-birthday-celebrations` EF added (ADR-0372); `verify_jwt=false` present in config.toml ✅
- `contract-lifecycle/index.ts` URL path update only — no auth changes

---

## Verified intentional

- **analyze-setup-documents browser-direct invoke:** confirmed valid per SMA-350 (getUser + workspace-membership guard). Processing-EF pattern, not a data-read gateway bypass. Last flagged HIGH in 2026-05-10 (F-EF-01); resolved and reclassified LOW/intentional in 2026-05-15 audit.
- **tariff-amendment-sweep missing config.toml entry:** function docstring explicitly marks as deferred: "DEFERRED: not scheduled in config.toml — invoke manually when ready." However the code IS active (auth + business logic complete), so keeping at HIGH to track that it becomes unreachable if anyone attempts a manual cron trigger without the config entry.
- **create-invitation, delete-account, send-login-code absent from config.toml:** All use JWT auth — Supabase default is `verify_jwt=true`, no explicit entry needed. Not a violation.

---

## In-progress (mid-campaign)

No findings in active campaign worktrees. `engine-dispatch/handlers/day-line-push.ts` (ADR-0367 §5.7, council-APPROVED) is compliant post-628041add workspace_id filter fix.
