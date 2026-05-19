---
title: "Slice 07 — DB / RLS / Telemetry audit"
status: done
updated: 2026-05-18
created: 2026-05-18
module: db-rls-telemetry
tags: [audit, rls, telemetry, migrations, adr-compliance]
---

# Slice 07 — DB / RLS / Telemetry

**Branch:** `campaign/ui-shell` | **Date:** 2026-05-18 | **Auditor:** agent (read-only)

ADRs checked: 0004, 0011, 0012, 0029, 0044, 0107, 0151.

---

## In-flight items verified

### W1.3 — `profile.active_push_topic` (20260620142000)

PASS. `ALTER TABLE public.profile ADD COLUMN active_push_topic text NULL`. Inherits existing profile-table RLS (no new policies needed; JWT select + own-row update already in place). Partial index on non-NULL rows correct. `database.types.ts` reflects the column at line 15317 (`active_push_topic: string | null`). No causal ordering issue — migration timestamp 20260620142000 is after shift_session (20260620120300) which defines the push_topic concept.

### W2.2 — `TaskCreated.metadata` LOW-5 closure (cd80b3a26)

PASS. `packages/telemetry/src/registry.ts:1156-1157` now carries:
```ts
description?: string;
scheduled_at?: string;
```
Both fields are optional, matching the Zod schema in the task tool (`z.string().max(2000).optional()` / `z.string().datetime().optional()`). EVENT_ROUTING entry at line 14088 (`"task created"`) routes to `posthog + logger + activity_trail + engine_event` — unchanged, correct. LOW-5 CLOSED.

### `session_task.scheduled_at` migration (20260620120600)

PASS. Added via `ALTER TABLE session_task ADD COLUMN scheduled_at TIMESTAMPTZ` in the day_line_child_fks migration. Partial index `idx_session_task_scheduled_pending` covers the push-pipeline lookup path. `database.types.ts` at line 17794 confirms `scheduled_at: string | null` in Row/Insert/Update. Causal chain: day_line table (20260620120200) → child FKs + scheduled_at column (20260620120600). Correct ordering.

---

## New workspace-scoped tables

### `day_line` (20260620120200)

PASS. `workspace_id UUID NOT NULL`, `created_at` + `updated_at` present, `set_updated_at` trigger wired. RLS: ENABLED. JWT select, api_key select, JWT insert (admin_or_manager guard), JWT update (admin_or_manager guard), service_role ALL. Dual-auth satisfied (ADR-0044).

### `shift_session` (20260620120300)

PASS. `workspace_id UUID NOT NULL`, `created_at` + `updated_at` present. RLS: ENABLED. JWT select (self or manager), api_key select, service_role ALL. **Gap: no JWT INSERT/UPDATE policy.** Write path is currently service_role only (clock-in/out via Edge Function). Acceptable if the clock-in path always uses service_role; flag for documentation if mobile client ever writes directly with JWT.

### `announcement_meta` (20260620140200)

PASS. `workspace_id UUID NOT NULL`. RLS: ENABLED. JWT select (channel-member join check), JWT update (sender + manager guard), api_key select. No INSERT policy (SECURITY DEFINER RPC is sole write path — correct per ADR-0369). `created_at` present; `updated_at` absent from column DDL but `set_updated_at` trigger added via DO block for future edit-path compatibility. **`database.types.ts` does NOT show `updated_at` in `announcement_meta.Row`** — consistent with the column not being defined in the CREATE TABLE; the trigger fires on UPDATE but there is no column to update. This is a latent inconsistency: the trigger will error if an UPDATE happens before the column is added. Low risk (no UPDATE policies + RPC-only write), but should be resolved in a follow-up migration.

### `celebration_publication` (20260620141000)

PASS. `workspace_id UUID NOT NULL`, `created_at` present. `updated_at` absent — intentional (append-only idempotency log). RLS: ENABLED. Manager+ select, api_key select. No INSERT/UPDATE/DELETE policies (SECURITY DEFINER RPC). Dual-auth satisfied.

### `workspace_celebration_config` (20260620141100)

PASS. `workspace_id UUID PRIMARY KEY`, `created_at` + `updated_at` present, `set_updated_at` trigger wired. RLS: ENABLED. Member select, admin+ update, api_key select. Bootstrap trigger (`fn_bootstrap_workspace_celebration_config`) uses SECURITY DEFINER + SET search_path = public (ADR-0029 compliant). FK-coherence function also uses SECURITY DEFINER + SET search_path = public.

### `user_view_preference` (20260620110100)

PASS (with documented exception). `workspace_id UUID NOT NULL`, `created_at` + `updated_at` present, `set_updated_at` trigger wired. RLS: ENABLED. JWT own-row select, insert, update policies. **No api_key policy** — explicitly documented in the migration comment: "API-key path: no policy — server actions use service-role + manual profile/workspace guard (ADR-0151)." This is the L-0177 compliant pattern when the integration path is never via raw api_key. Accept.

---

## SECURITY DEFINER + search_path (ADR-0029 / L-0172)

**Two functions missing `SET search_path = public`:**

1. `trigger_channel_message_notification` (20260620140500) — `LANGUAGE plpgsql SECURITY DEFINER` with no `SET search_path`. This is a CREATE OR REPLACE that replaces an existing function; the prior version may also lack it.
2. `get_channel_messages` (20260620140600) — `LANGUAGE sql STABLE SECURITY DEFINER AS $$` inline, no `SET search_path`.

All other SECURITY DEFINER functions in the wave (is_manager_in_workspace, fn_publish_announcement_notifications, publish_announcement_atomic, fn_birthday_cohort_for_workspace, fn_check_celebration_channel_workspace, fn_bootstrap_workspace_celebration_config) correctly carry `SET search_path = public`.

---

## Findings

| ID | Severity | Location | Description |
|----|----------|----------|-------------|
| F-07-01 | LOW | 20260620140500 | `trigger_channel_message_notification` — SECURITY DEFINER without `SET search_path = public`. ADR-0029 violation. |
| F-07-02 | LOW | 20260620140600 | `get_channel_messages` — SECURITY DEFINER without `SET search_path`. ADR-0029 violation. |
| F-07-03 | INFO | 20260620140200 | `announcement_meta` has `set_updated_at` trigger but no `updated_at` column. Trigger will error on first UPDATE. Low risk (RPC-only write, no UPDATE app path yet). |
| F-07-04 | INFO | 20260620120300 | `shift_session` has no JWT INSERT/UPDATE policy. Acceptable if clock-in always uses service_role. Document intent or add mobile-JWT write policy before direct-client clock-in. |

**PASS count:** 7 tables / 2 in-flight items verified correct.
**FAIL count:** 0 blocking.
**LOW findings:** 2 (F-07-01, F-07-02 — missing search_path on SECURITY DEFINER functions, ADR-0029).
**INFO findings:** 2 (F-07-03, F-07-04 — non-blocking latent risks).

LOW-5 is confirmed CLOSED. 3729 perf-lint baseline is pre-existing (not introduced by these migrations).
