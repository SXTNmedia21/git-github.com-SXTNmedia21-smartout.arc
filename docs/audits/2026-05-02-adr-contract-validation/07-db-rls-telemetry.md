---
title: "Audit Slice 7 — DB Schema + RLS + emit() Coverage"
status: done
updated: 2026-05-02
created: 2026-05-02
module: platform
tags: [audit, rls, telemetry, emit, adr-0004, adr-0011, adr-0012, adr-0029, adr-0044, adr-0107, adr-0151]
---

## Summary (Top 5 Findings)

1. **CRITICAL — channel_department_access + channel_team_access: RLS enabled, zero policies (default-deny lockout).** Migration `20260519200000` enables RLS on both tables but comments out all policies with "TODO: design the scope-resolution function before applying." All reads/writes are blocked for all users. Intent is "derive visibility from channel_member rows, not these tables directly" — but no bridging trigger exists yet. Tables are in the schema and the migration IS listed as applied. If rows are being inserted server-side they'd fail silently unless done via service-role.

2. **ADR-0004 VIOLATION — gatedMutation does NOT call emit(). 7 tool files use gatedMutation/mutations with zero emit().** Tools `save-report`, `delete-report`, `create-season`, `set-revenue`, `save-playbook`, `compile-journey`, `apply-binding` all call `gatedMutation()` or direct `.insert()/.update()` but have no `emit()` call. The gate path documents "no emit, no DB row, no partial work" for SS-3 — but the normal success path (SS-5) is also missing emit. These mutations land in the DB with no activity_trail, no PostHog event, no engine_event fanout.

3. **ADR-0004 VIOLATION — mobile offline sync (action-map.ts + worker.ts): 11 action types write to DB with zero emit.** The sync worker calls `actionMap[action](payload)` and never emits. Actions include: `punch_in`, `punch_out`, `clock_out`, `complete_task`, `report_deviation`, `send_message`, `request_absence`, `submit_handoff`, `submit_recon`, `update_shift`. No telemetry fires for offline-committed writes. ADR-0134 trust-freeze gate 2 validates payload schema — but has no emit gate.

4. **ADR-0004 VIOLATION — 7 web BFF routes write to DB without emit.** Routes `api/availability/clear`, `api/availability/set` (no emit despite gateAction), `api/emma/tasks` (insert+update), `api/emma/notes` (insert+update), `api/emma/tasks/dismiss`, `api/agent/memory`, `api/emma/memory` all call `.insert()` or `.update()` with no `emit()`. Availability routes document ADR-0151 compliance but omit ADR-0004 compliance.

5. **MEDIUM — salary_type and end_date_reason (platform-level lookup tables in contracts migration) have NO RLS.** Created in `20260519100100` without `ENABLE ROW LEVEL SECURITY`. They're seed-only tables with no workspace_id (correct — they're platform-level codes like tariff_rate_table) but no RLS at all means any authenticated user can read and potentially write via service-role. They need at minimum a read-only RLS policy for all authenticated users (same pattern as `public_holiday`).

---

## Table RLS Audit (50 recent migrations, sampled representative tables)

| Table | RLS Enabled | Policies (JWT) | Policies (API key) | workspace_id | created_at + updated_at | Verdict |
|---|---|---|---|---|---|---|
| activity_trail | assumed (00005) | Y | Y | Y | created_at only | PASS |
| employee_availability | Y | 4 (SELECT/INSERT/UPDATE/DELETE) | SELECT only | Y | Y | PASS |
| employee_availability_preference | Y (20260518200001) | present | present | Y | Y | PASS |
| personal_task | Y | jwt_own (ALL), service_role (ALL) | api_key_read (SELECT only) | Y | Y | PASS (api_key insert blocked intentionally — owner-only) |
| pension_scheme | Y | 4 JWT + 2 API key | Y | Y | Y | PASS |
| contract_pay_rule | Y | 4 JWT + 2 API key | Y | Y | Y | PASS |
| contract_tip_rule | Y | 4 JWT + 2 API key | Y | Y | Y | PASS |
| contract_obligation | Y | 4 JWT + 2 API key | Y | Y | Y | PASS |
| contract_amendment | Y | 4 JWT + 2 API key | Y | Y | Y | PASS |
| page_knowledge | Y | jwt_read + jwt_write | not seen | nullable | Y | PASS (nullable workspace_id intentional — platform defaults) |
| channel_department_access | Y | **ZERO — commented out** | ZERO | Y | created_at only | **FAIL — zero-policy lockout** |
| channel_team_access | Y | **ZERO — commented out** | ZERO | Y | created_at only | **FAIL — zero-policy lockout** |
| salary_type | NO | N/A | N/A | **none (platform-level)** | created_at only | **WARN — no RLS, platform lookup table** |
| end_date_reason | NO | N/A | N/A | **none (platform-level)** | created_at only | **WARN — no RLS, platform lookup table** |
| invitation | Y (00004) | Y | assumed | Y | Y | PASS |
| user_identity | Y (00004) | SELECT + UPDATE (own) | assumed | N/A (identity layer) | Y | PASS |
| company | Y (00004) | Y | assumed | N/A (identity layer) | Y | PASS |

**Note:** `salary_type` and `end_date_reason` are intentionally platform-scoped (no workspace_id, matches `tariff_rate_table` pattern). However they lack any RLS — unprotected write vector if service-role is ever misconfigured. Low severity since seed-only in practice.

---

## emit() Coverage Audit (sampled 50 mutation files, 294 total)

| Mutation site | emit() called? | Event registered in registry? | workspace_id resolved? | Verdict |
|---|---|---|---|---|
| `packages/ai/src/tools/report/save-report.ts` | **NO** | N/A | Y (ctx.workspaceId) | **FAIL — ADR-0004** |
| `packages/ai/src/tools/report/delete-report.ts` | **NO** | N/A | Y | **FAIL — ADR-0004** |
| `packages/ai/src/tools/season/create-season.ts` | **NO** | N/A | Y | **FAIL — ADR-0004** |
| `packages/ai/src/tools/season/set-revenue.ts` | **NO** | N/A | Y | **FAIL — ADR-0004** |
| `packages/ai/src/tools/season/save-playbook.ts` | **NO** | N/A | Y | **FAIL — ADR-0004** |
| `packages/ai/src/tools/journey-ops/compile-journey.ts` | **NO** | N/A | Y | **FAIL — ADR-0004** |
| `packages/ai/src/tools/journey-ops/apply-binding.ts` | **NO** | N/A | Y | **FAIL — ADR-0004** |
| `apps/web/src/app/api/availability/set/route.ts` | **NO** | N/A | Y (server-derived) | **FAIL — ADR-0004** |
| `apps/web/src/app/api/availability/clear/route.ts` | **NO** | N/A | Y | **FAIL — ADR-0004** |
| `apps/web/src/app/api/emma/tasks/route.ts` | **NO** | N/A | Y (from auth) | **FAIL — ADR-0004** |
| `apps/web/src/app/api/emma/notes/route.ts` | **NO** | N/A | Y | **FAIL — ADR-0004** |
| `apps/mobile/src/lib/sync/action-map.ts` (11 action types) | **NO** | N/A | Y (from payload) | **FAIL — ADR-0004 + ADR-0134** |
| `apps/mobile/src/lib/sync/worker.ts` | **NO** | N/A | N/A | **FAIL — no emit post-sync** |
| `apps/mobile/src/components/shift-timeline/ShiftTimelineContainer.tsx` | YES | Y (shift.list_viewed etc.) | Y via `nonEmpty()` guard | PASS |
| `apps/mobile/src/hooks/mutations/use-resolve-ticket.ts` | YES | assumed | Y | PASS |
| `apps/web/src/components/day/NoteEditDialog.tsx` | **NO** | N/A | N/A | **FAIL — direct supabase.from().insert()** |
| `apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx` | **NO** | N/A | unknown | **FAIL** |
| `apps/web/src/components/dashboard/BudgetSettingsPanel.tsx` | **NO** | N/A | unknown | **FAIL** |
| `apps/web/src/app/api/scrape/company/route.ts` | **NO** | N/A | Y | WARN (scrape, may be intentional) |
| `apps/web/src/app/api/agent/memory/route.ts` | **NO** | N/A | Y | **FAIL** |

**Registry observation:** 648 `emit()` call sites found across codebase. `registry.ts` is 289KB — extensive event coverage for core domain events (shifts, sessions, deviations, profiles, invitations, seasons). The gap is specifically at: (a) capability tool layer post-gatedMutation, and (b) offline sync writes.

---

## Per-ADR Rollup

| ADR | Title | Status |
|---|---|---|
| ADR-0004 | Unified telemetry — every mutation emits | **FAIL** — ~20+ mutation sites (7 tools, 11 offline actions, 7+ BFF routes, 3 UI components) missing emit |
| ADR-0011 | user_identity table naming | **PASS** — no `public.user` references found in app code or migrations |
| ADR-0012 | Subscription data on company table | **PASS** — `subscription_plan` + `subscription_status` live on `company` table, no separate subscription table |
| ADR-0029 | workspace-api gateway + RLS scoping | **PASS** — workspace-scoped tables consistently have `workspace_id` + RLS with `get_workspace_ids_for_user()`; gateway pattern observed |
| ADR-0044 | Invitation table naming | **PASS** — table named `invitation` (not `profile_invitation`); no violations in app code |
| ADR-0107 | BotssonProvider Channel Derivation | **PASS** — ADR exists and is `accepted`; channel derivation from session mode pattern present |
| ADR-0151 | profile_id derived server-side | **PASS (partial)** — BFF routes explicitly derive profile_id server-side. BUT UI components (NoteEditDialog, QuickBroadcast) call supabase directly from client without ADR-0151 guard |

---

## Critical Violations

### CV-1: channel_department_access + channel_team_access — RLS zero-policy lockout
**File:** `supabase/migrations/20260519200000_channel_access_scope.sql`  
**Severity:** HIGH  
RLS is enabled on both tables. All policies are commented out. The migration self-declares "intentionally incomplete — add after design pass." This means: (1) any app code trying to insert/read these rows via JWT will get denied; (2) the `access_scope=departments/teams` channel scoping feature is non-functional at the DB layer. Must ship policies before enabling departments/teams scope in the UI.

### CV-2: gatedMutation does not call emit() — 7 capability tools dark to telemetry
**Files:** `packages/ai/src/tools/report/`, `packages/ai/src/tools/season/`, `packages/ai/src/tools/journey-ops/`  
**Severity:** HIGH  
`gatedMutation()` source confirmed: no `emit()` call inside. Comments at lines 32, 35, 99 explicitly state "no emit in SS-3" — but SS-5 (normal success path) also has no emit. These tools create/update seasons, reports, and journeys with zero audit trail in `activity_trail`, zero PostHog analytics, zero `engine_event` fanout.

### CV-3: Mobile offline sync — 11 action types write to DB with zero telemetry
**File:** `apps/mobile/src/lib/sync/action-map.ts`, `worker.ts`  
**Severity:** HIGH  
Offline-committed writes (punch_in, report_deviation, request_absence, etc.) fire through the sync worker with no emit(). ADR-0134 trust-freeze gate validates payload schema at enqueue, but there's no emit gate. Activity_trail is blind to offline mutations — creates audit gaps for punches, deviations, and absence requests committed while offline.

### CV-4: ADR-0151 partial enforcement — UI components bypass BFF, call Supabase directly
**Files:** `apps/web/src/components/day/NoteEditDialog.tsx`, `apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx`  
**Severity:** MEDIUM  
These client components call `createClient()` and `.from().insert()` directly with no `emit()`, no `profile_id` server-derivation, and no gate. NoteEditDialog inserts into `session_note`; QuickBroadcast manages notifications. Both bypass the BFF pattern ADR-0151 requires.
