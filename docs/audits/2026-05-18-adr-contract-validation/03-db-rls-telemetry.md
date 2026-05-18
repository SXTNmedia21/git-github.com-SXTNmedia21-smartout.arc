---
title: "Smoke Audit — DB / RLS / Telemetry (slice 03)"
status: done
created: 2026-05-18
updated: 2026-05-18
module: audit
tags: [audit, rls, telemetry, migrations, adr-0004, adr-0011, adr-0012, adr-0044]
---

# Smoke Audit 03 — DB / RLS / Telemetry

**Branch:** campaign/ui-shell  
**Scope:** `supabase/migrations/` (new files vs origin/development) · `packages/telemetry/src/registry.ts` · `packages/supabase/src/database.types.ts`  
**ADRs checked:** 0004 · 0011 · 0012 · 0029 · 0044 · 0107 · 0151

---

## New migrations on campaign/ui-shell (vs origin/development)

Focal migrations (new tables or columns):

| Migration | What |
|---|---|
| `20260620142000_profile_active_push_topic.sql` | ADD COLUMN `profile.active_push_topic text NULL` |
| `20260620120200_day_line_table.sql` | CREATE TABLE `day_line` |
| `20260620120300_shift_session_table.sql` | CREATE TABLE `shift_session` |
| `20260620120400_shift_session_day_line_junction.sql` | CREATE TABLE `shift_session_day_line` (junction) |
| `20260620141000_celebration_publication_table.sql` | CREATE TABLE `celebration_publication` |
| `20260620141100_workspace_celebration_config_table.sql` | CREATE TABLE `workspace_celebration_config` |

---

## Findings

### PASS — ADR-0004 (workspace_id everywhere)

- `day_line`: `workspace_id uuid NOT NULL` — `20260620120200:9`
- `shift_session`: `workspace_id uuid NOT NULL` — `20260620120300:8`
- `celebration_publication`: `workspace_id uuid NOT NULL` — `20260620141000:21`
- `workspace_celebration_config`: PK is `workspace_id` — `20260620141100:7`
- `shift_session_day_line`: junction, no workspace_id column — **by design**. RLS gates access through `shift_session.workspace_id` subquery; acceptable under ADR-0004 (junction inherits parent).
- `profile.active_push_topic`: column on existing `profile` table — workspace scoped via profile row.

### PASS — ADR-0011 (RLS on every table)

All new tables have `ALTER TABLE … ENABLE ROW LEVEL SECURITY` before first policy:

- `day_line` — `20260620120200` — JWT select + API key select + JWT insert/update + service_role
- `shift_session` — `20260620120300` — JWT select (self-or-manager) + API key + service_role
- `shift_session_day_line` — `20260620120400` — JWT select + service_role
- `celebration_publication` — `20260620141000` — manager select + API key select (write-path: SECURITY DEFINER RPC only)
- `workspace_celebration_config` — `20260620141100` — member select + admin update + API key select

**Observation (not a violation):** `shift_session` has no JWT INSERT policy. Write path is exclusively via `ensure_shift_session()` SECURITY DEFINER trigger (`20260620130000`) — correct by design. No app-layer INSERT is intended. Not flagged.

**Observation (not a violation):** `shift_session_day_line` has no API key SELECT policy. Junction access is indirectly workspace-gated; omission is deliberate (reads come through shift_session). Not a new violation; consistent with pre-existing pattern on similar junctions.

### PASS — ADR-0012 (SECURITY DEFINER + locked search_path)

All SECURITY DEFINER functions in new migrations have `SET search_path = public`:

- `fn_birthday_cohort_for_workspace` — `20260620141200:27-28`
- `publish_announcement_atomic` (celebration branch) — `20260620141300:46-47`
- `fn_publish_announcement_notifications` — `20260620140300:18-19`
- `publish_announcement_atomic` (base) — `20260620140400:24-25`
- `ensure_shift_session` — `20260620130000:8-9`
- `fn_day_line_back_populate` — `20260620130100:9-10`
- `is_admin_or_manager_active` predicate — `20260620125000:15-16`
- `is_manager_in_workspace` — `20260620140000:12-13`
- `fn_bootstrap_workspace_celebration_config` — `20260620141100` — `SET search_path = public` present

No unlocked SECURITY DEFINER functions found.

### PASS — ADR-0044 (telemetry emit on mutations)

New capability events are registered:

- `celebration.auto_published` · `celebration.skipped_workspace_disabled` · `celebration.skipped_already_published` — interfaces at `registry.ts:4241-4268`, routing at `14472-14487`
- `day_line.created` · `day_line.opening_changed` · `day_line.closing_changed` — interfaces at `10615-10651`, routing at `14422-14432`
- `day_line_item.added` · `day_line_item.notified` — interfaces at `10655-10685`, routing at `14434-14441`
- `shift_session.bound` · `shift_session.clocked_in` · `shift_session.clocked_out` · `shift_session.item_leak_detected` — interfaces at `10687-10762`, routing at `14442-14466`

**MINOR GAP — ADR-0044 — `TaskCreated` type not updated for W2.2 metadata spread:**  
`tools.ts:559-560` spreads `description` and `scheduled_at` into `"task created"` emit metadata. The `TaskCreated` interface (`registry.ts:1144-1158`) does not declare these optional fields. The spread is accepted at runtime (TypeScript structural typing with `[key: string]: unknown` downstream), but the registry type is out-of-sync with the actual payload shape — violating the registry-as-single-source-of-truth intent. Not a routing gap (event routes correctly), but a type-contract drift.  
**Severity: LOW.** Fix: add `description?: string; scheduled_at?: string;` to `TaskCreated.properties.metadata` at `registry.ts:1155-1156`.

### PASS — ADR-0151 (server-derived IDs)

- All new tables use `DEFAULT gen_random_uuid()` for PKs — no client-supplied IDs.
- `active_push_topic` column is text written by authenticated mobile client, not a server-generated ID — outside ADR-0151 scope.

### PASS — database.types.ts regenerated correctly

`active_push_topic: string | null` present on `profile` Row/Insert/Update types at `database.types.ts:15317, 15366, 15417`.

`session_task` Row type includes `description: string | null` at `17790` and `scheduled_at: string | null` at `17794` — W2.2 schema columns reflected.

### N/A — ADR-0029, ADR-0107

- ADR-0029 (workspace-api gateway): no new standalone Edge Functions created in this slice.
- ADR-0107 (workspace_doc_chunk K1b): no new `workspace_doc_chunk` writes in these migrations.

---

## Summary

| ADR | Status | Notes |
|---|---|---|
| 0004 workspace_id | PASS | All new tables compliant; junction pattern acceptable |
| 0011 RLS | PASS | All tables have RLS + policies |
| 0012 SECURITY DEFINER | PASS | All 9 new SECURITY DEFINER functions have locked search_path |
| 0029 gateway | N/A | No new standalone EFs |
| 0044 telemetry emit | PASS with MINOR GAP | `TaskCreated` type missing `description?`/`scheduled_at?` fields |
| 0107 K1b | N/A | Not touched |
| 0151 server IDs | PASS | gen_random_uuid() on all PKs |

**Total new violations: 0 CRITICAL / 0 HIGH / 1 LOW**

LOW-001: `registry.ts:1148-1157` — `TaskCreated.metadata` missing `description?` and `scheduled_at?` optional fields. Runtime emit is correct; type contract drifts from actual payload shape emitted by `task/tools.ts:559-560`.
