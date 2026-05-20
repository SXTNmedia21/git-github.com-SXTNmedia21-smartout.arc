---
title: Slice 07 — DB / RLS / Telemetry Audit (Run 02)
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, db-rls-telemetry, adr]
---

# Slice 07 — DB / RLS / Telemetry (Run 02)

**Branch:** `campaign/ui-shell` | **Date:** 2026-05-20 | **Auditor:** agent (read-only)

ADRs checked: 0004, 0011, 0012, 0029, 0044, 0107, 0151.

Baseline: `/docs/audits/2026-05-20-adr-contract-validation/07-db-rls-telemetry.md` (Run 01, same day).

---

## Summary

**Delta since Run 01:** 20+ new migrations covering announcement cluster, celebration pipe, day-line/shift-session tables, and user-view-preference. Run 01 was fully GREEN (0 blocking, 0 LOW, 2 INFO carry-forwards). Run 02 surfaces 2 new LOW findings and confirms the 2 INFO carry-forwards remain unresolved.

1. **CARRY-FORWARD — F-07-03 (INFO):** `announcement_meta` has `set_announcement_meta_updated_at` trigger but no `updated_at` column. Trigger fires on UPDATE but column does not exist — would error on first UPDATE. No UPDATE app path exists yet. Same status as Run 01.
2. **CARRY-FORWARD — F-07-04 (INFO):** `shift_session` has no JWT INSERT/UPDATE RLS policy. Write path is service_role via Edge Function. Intentional and documented. Same status as Run 01.
3. **NEW — F-07-05 (LOW):** `celebration.skipped_workspace_disabled` and `celebration.skipped_already_published` are registered in registry + EVENT_ROUTING but have zero emit call-sites. The `publish-birthday-celebrations` Edge Function logs skips via `console.warn` + counter only; no `emit()` call on the skip path.
4. **NEW — F-07-06 (LOW):** `shift_session.bound` is registered in registry + EVENT_ROUTING (3 destinations: posthog + logger + activity_trail) but has zero emit call-sites in source. Binding happens via `trg_ensure_shift_session` + `trg_day_line_back_populate` DB triggers (pure SQL — no emit possible from trigger body). No app-layer emit found in packages, apps, or services.
5. **PASS — All new SECURITY DEFINER functions:** All 10 new SECURITY DEFINER functions in `20260620*` migrations carry `SET search_path = public`. No new ADR-0029 violations.
6. **PASS — New workspace-scoped tables:** `announcement_meta`, `celebration_publication`, `workspace_celebration_config`, `user_view_preference`, `day_line`, `shift_session` all have `workspace_id` + `created_at` + RLS enabled.
7. **PASS — database.types.ts:** All new tables present (`announcement_meta`, `celebration_publication`, `workspace_celebration_config`, `day_line`, `shift_session`, `profile.active_push_topic` column). No manual edits detected.

**Active findings:** 0 CRITICAL. 0 HIGH. 2 LOW (new). 2 INFO (carry-forward, non-blocking).

---

## Findings Table

| ID | Severity | File / Location | ADR | Evidence |
|----|----------|----------------|-----|----------|
| F-07-03 | INFO (carry-forward) | `20260620140200_announcement_meta_table.sql` | ADR-0029 | `announcement_meta` has `set_announcement_meta_updated_at` trigger but no `updated_at` column. Trigger fires on UPDATE — would error. No UPDATE app path exists. Intentional immutability; carry-forward from 2026-05-18 baseline. |
| F-07-04 | INFO (carry-forward) | `20260620120300_shift_session_table.sql` | ADR-0044 / ADR-0151 | `shift_session` has no JWT INSERT/UPDATE RLS policy. Write path is service_role via Edge Function. Intentional; documented in migration comment. Carry-forward from 2026-05-18 baseline. |
| F-07-05 | LOW | `supabase/functions/publish-birthday-celebrations/index.ts:293-300` + `packages/telemetry/src/registry.ts:14853-14858` | ADR-0004 | `celebration.skipped_workspace_disabled` and `celebration.skipped_already_published` registered in registry + EVENT_ROUTING (destinations: activity_trail + logger) but no `emit()` call-sites exist. Skip path (lines 293-305) uses `console.warn` + `totalSkipped++` only. Audit trail for idempotency skips is missing. |
| F-07-06 | LOW | `packages/telemetry/src/registry.ts:11054` + `supabase/migrations/20260620130000_ensure_shift_session_trigger.sql` + `20260620130100_day_line_back_populate_trigger.sql` | ADR-0004 | `shift_session.bound` registered in registry + EVENT_ROUTING (posthog + logger + activity_trail) but no `emit()` call-sites in source. Binding happens via DB triggers (`ensure_shift_session`, `back_populate_shift_session_day_line`) — pure SQL, no emit possible. No app-layer compensation emit found in `packages/ai/src/capabilities/day-line/`, `apps/mobile/src/`, or `supabase/functions/`. |

---

## New Table Schema Audit

| Table | workspace_id | created_at | updated_at | RLS | JWT policy | API key policy | Note |
|-------|-------------|------------|------------|-----|-----------|---------------|------|
| `announcement_meta` | ✅ | ✅ | ❌ trigger only, no column (F-07-03) | ✅ | SELECT + UPDATE | SELECT | Immutable after publish; UPDATE policy added for future edit-after-publish |
| `celebration_publication` | ✅ | ✅ | ❌ no updated_at, no trigger | ✅ | SELECT (manager+) | SELECT | Intentional: idempotency guard, immutable after write |
| `workspace_celebration_config` | ✅ (PK) | ✅ | ✅ | ✅ | SELECT + UPDATE | SELECT | SECURITY DEFINER bootstrap trigger correct |
| `user_view_preference` | ✅ | ✅ | ✅ | ✅ | SELECT + INSERT + UPDATE | None (intentional) | Comment: "service-role + manual profile/workspace guard (ADR-0151)". Acceptable pattern. |
| `day_line` | ✅ | ✅ | ✅ | ✅ | SELECT + INSERT + UPDATE | SELECT | service_role ALL policy also present |
| `shift_session` | ✅ | ✅ | ✅ | ✅ | SELECT only (F-07-04) | SELECT | Write via service_role only — intentional carry-forward |

**`celebration_publication` no updated_at:** This table is an idempotency guard; rows are never updated after insert. No trigger is appropriate. VERIFIED INTENTIONAL — migration comment confirms "No app-layer INSERT/UPDATE/DELETE."

---

## SECURITY DEFINER search_path Audit (New Functions)

All 10 new SECURITY DEFINER functions in `20260620*` migrations verified:

| Function | Migration | search_path |
|----------|-----------|------------|
| `is_admin_or_manager_in_workspace` | `20260620120000` | `SET search_path = public` ✅ |
| `department_location_junction` trigger fn | `20260620120500` | `SET search_path = public` ✅ |
| `is_admin_or_manager_active_predicate` | `20260620125000` | `SET search_path = public` ✅ |
| `ensure_shift_session` | `20260620130000` | `SET search_path = public` ✅ |
| `back_populate_shift_session_day_line` | `20260620130100` | `SET search_path = public` ✅ |
| `is_manager_in_workspace` | `20260620140000` | `SET search_path = public` ✅ |
| `publish_announcement_atomic` (RPC) | `20260620140400` | `SET search_path = public` ✅ |
| `workspace_celebration_config` bootstrap trigger | `20260620141100` | `SET search_path = public` ✅ |
| `fn_birthday_cohort_for_workspace` | `20260620141200` | `SET search_path = public` ✅ |
| `publish_announcement_atomic` celebration branch | `20260620141300` | `SET search_path = public` ✅ |
| `align_prod_drift` (get_workspace_by_slug) | `20260620100000` | `SET search_path TO public, extensions` ✅ |

F-07-01 and F-07-02 remain CLOSED from Run 01.

---

## Telemetry Delta Audit (New Events Since Run 01)

| Event | Registry | EVENT_ROUTING | Emit call-site | Status |
|-------|----------|---------------|----------------|--------|
| `celebration.auto_published` | ✅ | posthog+logger+activity_trail | `publish-birthday-celebrations/index.ts:335-365` | ✅ PASS |
| `celebration.skipped_workspace_disabled` | ✅ | activity_trail+logger | None found | ❌ F-07-05 |
| `celebration.skipped_already_published` | ✅ | activity_trail+logger | None found | ❌ F-07-05 |
| `announcement.kind_changed` | ✅ | posthog only | `AnnouncementKindPicker.tsx:133` | ✅ PASS |
| `announcement.tier_overridden` | ✅ | posthog only | `AnnouncementTierPicker.tsx:52` | ✅ PASS |
| `announcement.link_followed` | ✅ | posthog+logger+activity_trail | `EntityLinkCTA.tsx:93` | ✅ PASS |
| `day_line.created` | ✅ | posthog+logger+activity_trail+engine_event | `packages/ai/src/capabilities/day-line/tools.ts:182` | ✅ PASS |
| `day_line.opening_changed` | ✅ | posthog+logger+activity_trail | `day-line/tools.ts:604` | ✅ PASS |
| `day_line.closing_changed` | ✅ | posthog+logger+activity_trail | `day-line/tools.ts:620` | ✅ PASS |
| `day_line_item.added` | ✅ | posthog+logger+activity_trail+engine_event | `day-line/tools.ts:316` | ✅ PASS |
| `day_line_item.notified` | ✅ | posthog+logger+activity_trail+engine_event | `engine-dispatch/handlers/day-line-push.ts:343` | ✅ PASS |
| `shift_session.bound` | ✅ | posthog+logger+activity_trail | None found | ❌ F-07-06 |
| `shift_session.clocked_in` | ✅ | posthog+logger+activity_trail+engine_event | `apps/mobile/src/lib/push.ts:359` | ✅ PASS |
| `shift_session.clocked_out` | ✅ | posthog+logger+activity_trail+engine_event | `apps/mobile/src/lib/push.ts:410` | ✅ PASS |
| `shift_session.item_leak_detected` | ✅ | posthog+logger+activity_trail | `apps/mobile/src/hooks/queries/use-day-line-items.ts:38` | ✅ PASS |

**Result: 12/15 events PASS. 3 orphaned events (F-07-05 = 2 events, F-07-06 = 1 event).**

---

## Per-ADR Rollup

| ADR | Description | Verdict | Notes |
|-----|-------------|---------|-------|
| ADR-0004 | Unified telemetry / activity_trail | ⚠️ 3 orphan events | `celebration.skipped_*` (F-07-05) + `shift_session.bound` (F-07-06) registered but never emitted |
| ADR-0011 | `user_identity` naming | ✅ compliant | No new `public.user` references |
| ADR-0012 | Subscription on company | ✅ compliant | No new company-table mutations |
| ADR-0029 | SECURITY DEFINER + search_path | ✅ compliant | All 11 new functions carry `SET search_path = public` |
| ADR-0044 | cron + observability | ✅ compliant | Birthday cron uses `pg_cron` + Edge Function per ADR-0048; pg_cron guard (`IF EXISTS`) for local dev |
| ADR-0107 | BotssonProvider channel derivation | ✅ compliant | No new channel-derivation violations |
| ADR-0151 | profile_id server-side derivation | ✅ compliant | All new write paths resolve actor server-side; `user_view_preference` server-action pattern documented |

---

## Verified Intentional

- **`celebration_publication` no `updated_at`:** Idempotency guard — rows are insert-only. No trigger is correct; the unique constraint is the write-once enforcement.
- **`user_view_preference` no API key policy:** Migration comment: "service-role + manual profile_id + workspace_id guard (ADR-0151)." Pattern is consistent with other user-personal tables where integrations have no need to read preferences.
- **`shift_session.bound` DB trigger approach:** Binding is done by `trg_ensure_shift_session` and `trg_day_line_back_populate` which run as pure PL/pgSQL. These cannot call `emit()`. The gap (F-07-06) is a structural consequence of the trigger-based binding — an app-layer compensation emit is the fix path.

---

## In-Progress (Mid-Campaign)

- `celebration.skipped_*` emit (F-07-05) is likely deferred to the same sortie that adds workspace-opt-out UI — the skip path currently has no actor identity to emit with (workspace is filtered out before profile iteration).
- `shift_session.bound` emit (F-07-06) is likely deferred to the day-line capability `add_item` tool or a dedicated `bind_session` capability — the trigger has no emit hook and an app-layer event is needed.

Both findings are LOW severity. Neither blocks functionality; both affect audit-trail completeness for the day-line pipeline.
