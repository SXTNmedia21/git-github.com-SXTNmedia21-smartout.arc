---
title: Slice 07 — DB / RLS / Telemetry Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, db-rls-telemetry, adr]
---

# Slice 07 — DB / RLS / Telemetry

**Branch:** `campaign/ui-shell` | **Date:** 2026-05-20 | **Auditor:** agent (read-only)

ADRs checked: 0004, 0011, 0012, 0029, 0044, 0107, 0151.

---

## Summary

1. **CLOSED — F-07-01/F-07-02 (baseline LOW):** `trigger_channel_message_notification` and `get_channel_messages` now carry `SET search_path = public, pg_temp` — both ADR-0029 violations are resolved.
2. **PASS — PR #430 telemetry L-0298 parity:** All 13 new events registered, EVENT_ROUTING populated, and emit call-sites verified with `nonEmpty()` + `getProfileContext()`. No orphaned events.
3. **INFO (carry-forward) — F-07-03:** `announcement_meta` has `set_updated_at` trigger but no `updated_at` column; `database.types.ts` confirms absence. Trigger would error on UPDATE; no UPDATE app path exists yet.
4. **INFO (carry-forward) — F-07-04:** `shift_session` has no JWT INSERT/UPDATE policy; write path is service_role-only via Edge Function. Acceptable until mobile-JWT direct clock-in.
5. **PASS — new migration 20260621000000:** `dispatch_contract_notification()` carries `SECURITY DEFINER SET search_path = public`. No new violations.

---

## Findings table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| F-07-01 | ~~LOW~~ **CLOSED** | `20260620140500:86` | ADR-0029 | `SET search_path = public, pg_temp` now present on `trigger_channel_message_notification`. |
| F-07-02 | ~~LOW~~ **CLOSED** | `20260620140600:45` | ADR-0029 | `SET search_path = public, pg_temp` now present on `get_channel_messages`. |
| F-07-03 | INFO | `20260620140200` | ADR-0029 | `announcement_meta` has `set_updated_at` trigger but no `updated_at` column. Trigger will error on first UPDATE (no current UPDATE policy; RPC-only write path). Carry-forward from 2026-05-18 baseline. |
| F-07-04 | INFO | `20260620120300` | ADR-0044 | `shift_session` has no JWT INSERT/UPDATE RLS policy. Write path is service_role via Edge Function. Document intent before direct-client clock-in. Carry-forward from 2026-05-18 baseline. |

**Active findings:** 0 blocking. 0 LOW. 2 INFO (carry-forward, non-blocking).

---

## PR #430 — L-0298 Telemetry Parity Verification

13 new events shipped via PR #430 (`feat/mobile-voice-runtime-wire`, merged 2026-05-20):

| Event | Registry | EVENT_ROUTING | Emit call-site | ADR-0134 compliant |
|-------|----------|---------------|----------------|-------------------|
| `voice.bootstrap.snapshot_published` | ✅ | `posthog+logger+activity_trail` | `use-botsson-voice-session.ts:1137` | ✅ `nonEmpty` + `getProfileContext` |
| `voice.bootstrap.publish_failed` | ✅ | `posthog+logger+activity_trail` | `use-botsson-voice-session.ts:1160` | ✅ `nonEmpty` + `getProfileContext` |
| `voice.bootstrap.tool_registered` | ✅ | `posthog+logger+activity_trail` | `use-botsson-voice-session.ts:1069` | ✅ `nonEmpty` + `getProfileContext` |
| `voice.bootstrap.tool_register_failed` | ✅ | `posthog+logger+activity_trail` | `use-botsson-voice-session.ts:1082` | ✅ `nonEmpty` + `getProfileContext` |
| `voice.bootstrap.rpc_completed` | ✅ | `posthog+logger+activity_trail` | `use-botsson-voice-session.ts:833` | ✅ `nonEmpty` + `getProfileContext` |
| `voice.bootstrap.rpc_failed` | ✅ | `posthog+logger+activity_trail` | `use-botsson-voice-session.ts:843` | ✅ `nonEmpty` + `getProfileContext` |
| `mobile.chat.message_sent` | ✅ | `posthog+logger+activity_trail` | `use-emma-chat.ts:228` | ✅ `nonEmpty` + `getProfileContext` |
| `mobile.chat.response_received` | ✅ | `posthog+logger+activity_trail` | `use-emma-chat.ts:253` | ✅ `nonEmpty` + `getProfileContext` |
| `mobile.chat.error` | ✅ | `posthog+logger+activity_trail` | `use-emma-chat.ts:278` | ✅ `nonEmpty` + `getProfileContext` |
| `mobile.voice.mic_permission_denied` | ✅ | `posthog+logger+activity_trail` | `use-botsson-voice-session.ts:941` | ✅ `nonEmpty` + `getProfileContext` |
| `mobile.voice.disconnect_recovered` | ✅ | `posthog+logger` (no activity_trail — transient infra) | `use-botsson-voice-session.ts:701` | ✅ `nonEmpty` + `getProfileContext` |
| `mobile.voice.disconnect_failed` | ✅ | `posthog+logger+activity_trail` | `use-botsson-voice-session.ts:647` | ✅ `nonEmpty` + `getProfileContext` |
| `mobile.voice.policy_flipped` | ✅ | `posthog+logger+activity_trail` | `botsson-provider.tsx:315` | ✅ `nonEmpty` + `getProfileContext` |

**Result: 13/13 events PASS.** No orphaned registry entries. No emit sites with empty-string fallbacks (L-0083 pattern absent). All mobile emit sites use `try/catch` with swallow — correct per ADR-0134 (telemetry must never break UX).

**Note:** Three additional `voice.bootstrap.snapshot_*` events (`snapshot_sent`, `snapshot_refreshed`, `snapshot_assembly_failed`) are in the registry but were shipped in an earlier PR (pre-#430). Emit call-sites confirmed at `apps/web/src/app/api/emma/voice/snapshot/[version]/route.ts:198` and `apps/web/src/app/api/emma/voice/transcript/route.ts:365,406,424`. All present and correct.

---

## New Migration Audit — 20260621000000

`dispatch_contract_notification()` — URL path update from `/dashboard/contracts` to `/dashboard/people/contracts`.

- `SECURITY DEFINER SET search_path = public` ✅ (ADR-0029 compliant)
- No new workspace-scoped tables — no new RLS audit needed
- `notification_outbox` INSERT uses `v_workspace_id` from contract lookup, not from request body ✅ (ADR-0151 pattern)
- Historic rows with old URLs covered by Next.js `redirect()` stubs per migration comment

---

## Per-ADR rollup

| ADR | Description | Verdict | Notes |
|-----|-------------|---------|-------|
| ADR-0004 | Unified telemetry / activity_trail | ✅ compliant | All 13 new events route to correct destinations; activity_trail used for auditable events only |
| ADR-0011 | `user_identity` naming | ✅ compliant | `dispatch_contract_notification()` joins via `user_identity` correctly (`20260621000000:54`) |
| ADR-0012 | Subscription on company | ✅ compliant | No new company-table mutations in scope |
| ADR-0029 | SECURITY DEFINER + search_path | ✅ compliant | F-07-01/F-07-02 CLOSED; new function compliant. `pg_temp` included in both closed functions |
| ADR-0044 | `invitation` table naming | ✅ compliant | No `workspace_invite` references in scope |
| ADR-0107 | BotssonProvider channel derivation | ✅ compliant | Mobile emit sites use `"mobile"` only in `device_type` data field, not in `channel` field — orthogonal as required |
| ADR-0151 | profile_id server-side derivation | ✅ compliant | All emit sites resolve `profileId` via `getProfileContext()` (server-derived, not client-asserted) |

---

## Verified intentional

- `disconnect_recovered` routes to `posthog+logger` only (no `activity_trail`). Intentional per registry comment: "Transient infra event — not auditable." Contrast with `disconnect_failed` which does include `activity_trail` for degraded-session audit. Pattern is deliberate and consistent.
- `livekit-data-publish.ts` does not call `emit()` directly — it returns a `PublishResult` and delegates telemetry to the caller (`publishSnapshotToRoom` in `use-botsson-voice-session.ts`). This is documented in the module header: "Caller is responsible for emitting telemetry." Not a gap.

---

## In-progress (mid-campaign)

No active-campaign files flagged in this slice scope. All findings above are against `campaign/ui-shell` development tip.
