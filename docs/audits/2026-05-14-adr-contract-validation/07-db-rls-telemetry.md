---
title: Audit slice 07 — db-rls-telemetry
slice: db-rls-telemetry
mode: smoke
created: 2026-05-14
findings_critical: 0
findings_high: 0
findings_medium: 1
findings_low: 2
---

# Audit slice 07 — db-rls-telemetry

**Scope:** Migrations post-`20260608120000_sortie_a2_d6_rls_with_check.sql` (Sortie A.2 ship).
**ADRs checked:** 0004, 0011, 0012, 0029, 0044, 0107, 0151, 0299, 0303.
**Excluded (per brief):** F-DB-09/10 (D6 WITH CHECK — Sortie A.2 closed), F-DB-11 (gate_action), F-DB-12 (staff_event — Sortie A.3 closed), in-progress `20260614120000_session_task_insert_with_check.sql`.

---

## Findings

### MEDIUM

#### F-DB-13 — `overtime_cap_policy` missing `api_key_read_*` policy

**File:** `supabase/migrations/20260603000000_overtime_cap_policy.sql` (lines 148–171)
**ADR:** 0029
**Evidence:**
```sql
-- overtime_cap_policy has 4 JWT policies (SELECT / INSERT / UPDATE / DELETE)
-- and zero api_key_* policies. grep -c "api_key" returns 0.
CREATE POLICY overtime_cap_policy_select_jwt ON public.overtime_cap_policy FOR SELECT USING (...);
CREATE POLICY overtime_cap_policy_insert_jwt ...
CREATE POLICY overtime_cap_policy_update_jwt ...
CREATE POLICY overtime_cap_policy_delete_jwt ...
-- No api_key_read_overtime_cap_policy policy anywhere in migration chain.
```
**Why violates:** ADR-0029 § Rules & Consequences: "New workspace-scoped tables MUST get both a JWT-based and `api_key_read_*` RLS policy." `overtime_cap_policy` is workspace-scoped (`workspace_id NOT NULL REFERENCES workspace`), created 2026-06-03, and has no `api_key_read` policy. An API-key-authenticated workspace-api request cannot read labor-law cap configuration, breaking the dual-auth parity guarantee.
**Remediation:** Add a migration:
```sql
CREATE POLICY "api_key_read_overtime_cap_policy" ON public.overtime_cap_policy
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```
No behavioral change for JWT callers; pure addition.

---

### LOW

#### F-DB-14 — `tips_workspace_settings` JWT UPDATE policy missing `WITH CHECK`

**File:** `supabase/migrations/20260428220006_tips_workspace_settings.sql` (line 42)
**ADR:** 0299 (pattern — not D6, but same forgeable-workspace class)
**Evidence:**
```sql
CREATE POLICY "jwt_update_tips_workspace_settings" ON tips_workspace_settings
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
-- No WITH CHECK clause.
```
**Why violates:** The UPDATE USING predicate pins the row being updated, but a JWT caller belonging to two workspaces could flip `workspace_id` to a sibling workspace on the UPDATE body — the write lands unchecked. This is the same forgeable-workspace class identified in ADR-0299 §Context. Risk is low (settings table, 1:1 with workspace, single boolean toggle) but the pattern diverges from the agreed defense posture.
**Remediation:**
```sql
DROP POLICY IF EXISTS "jwt_update_tips_workspace_settings" ON tips_workspace_settings;
CREATE POLICY "jwt_update_tips_workspace_settings" ON tips_workspace_settings
  FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
```

---

#### F-DB-15 — `agent_session_whisper` `jwt_admin_rw_whisper` FOR ALL without WITH CHECK

**File:** `supabase/migrations/20260515120300_agent_session_whisper.sql` (line 33)
**ADR:** 0299 (pattern — not D6, admin-only surface)
**Evidence:**
```sql
CREATE POLICY "jwt_admin_rw_whisper" ON public.agent_session_whisper
  FOR ALL
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );
-- No WITH CHECK. FOR ALL merges INSERT/UPDATE/DELETE/SELECT into one predicate.
```
**Why violates:** FOR ALL without WITH CHECK means INSERT/UPDATE body workspace_id is unchecked. The USING predicate filters existing rows but does not validate the body value on write. An admin belonging to two workspaces could insert/update a whisper with a forged sibling `workspace_id`. Risk is limited (admin-only, platform-controlled table, no external API write path), but the pattern is inconsistent with the per-verb + WITH CHECK posture adopted in Sortie A.2.
**Remediation:** Split into per-verb policies:
```sql
DROP POLICY IF EXISTS "jwt_admin_rw_whisper" ON public.agent_session_whisper;
CREATE POLICY "jwt_admin_insert_whisper" ON public.agent_session_whisper
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );
CREATE POLICY "jwt_admin_update_whisper" ON public.agent_session_whisper
  FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_admin_delete_whisper" ON public.agent_session_whisper
  FOR DELETE USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );
-- SELECT is handled by godmode_rw_whisper + the FOR ALL above (which covers SELECT too).
-- After split, add explicit jwt_admin_select_whisper if needed.
```

---

## Verified (no findings)

- **ADR-0004 (RLS everywhere):** All new tables — `overtime_cap_policy`, `staff_event`, `staff_event_attendee`, `agent_session_recording`, `agent_session_envelope`, `agent_session_whisper`, `tip_policy`, `tip_pool`, `tip_distribution`, `tips_workspace_settings` — have `ENABLE ROW LEVEL SECURITY`. Clean.
- **ADR-0011 (workspace_id required):** All workspace-scoped tables above carry `workspace_id UUID NOT NULL REFERENCES workspace(workspace_id)`. Clean.
- **ADR-0029 (api_key_read parity):** `staff_event`, `staff_event_attendee`, `tip_policy`, `tip_pool`, `tip_distribution`, `tips_workspace_settings` all have `api_key_read_*` SELECT policies. `agent_session_recording`, `agent_session_envelope`, `agent_session_whisper` intentionally excluded from API-key read (platform-admin security surface — not a violation). `overtime_cap_policy` flagged as F-DB-13.
- **ADR-0151 (server-derive workspace/actor):** `submit_own_pii` RPC hardened in `20260514000010_secure_submit_own_pii.sql` — workspace_id derived from JWT membership, body-supplied value validated against server-derived value, mismatch raises exception. Pattern correct.
- **ADR-0299 (D6 per-verb WITH CHECK):** Sortie A.2 (`20260608120000`) closed `department_session`, `session_hook`, `deviation`, `personal_task`. Sortie A.3 (`20260609120000`) closed `staff_event` + `staff_event_attendee` (F-DB-12). In-progress `20260614120000_session_task_insert_with_check.sql` closes remaining `session_task` INSERT gap (excluded per brief). `shift_approval` closed in original Sortie A. All D6 tables in scope verified clean or in-progress.
- **ADR-0303 (sister-sweep):** No new D6 tables created in post-A.2 migrations. `overtime_cap_policy` is a D3/config class table (not D6). `staff_event` is calendar class (ADR-0285). Sister-sweep was applied to all applicable D6 tables.
- **ADR-0012 + ADR-0107 (telemetry emit):** `tip_pool`, `tip_distribution`, `staff_event` have `EntityType` entries in `packages/telemetry/src/registry.ts` (lines 166–169). Tips events (`tip_pool created`, `tip_pool approved`, `tip_distribution calculated`, `tip_distribution adjusted`) and staff_event events (`staff_event created`) registered with correct destinations. `payroll.overtime_mode_changed` routes through engine_event for C4 governance audit. Telemetry coverage clean for all new entities.
- **ADR-0044 (dual-auth RLS — JWT + API key):** New public-schema workspace-scoped tables all carry both JWT and API key SELECT policies (with exception noted in F-DB-13). Payroll schema tables maintain convention (`api_key_read_payroll_settings`, `api_key_read_payroll_period`, etc. confirmed from earlier migrations).
- **`call_log` UNIQUE constraint** (`20260611100000`): ALTER-only migration — adds `UNIQUE(call_session_id)` for webhook idempotency. No RLS change. Existing `call_log_api_select` policy (`20260422301000_channel_voice.sql:163`) satisfies ADR-0029. Clean.
- **Payroll Phase 2/3/4 migrations**: No new tables created (Phase 2 adds columns to `change_proposal`; Phase 3 adds columns to `payroll.export_event` + `payroll.export_line`; Phase 4 creates a storage bucket, not a table). Existing payroll RLS policies unmodified. Append-only enforcement on `payroll.export_event` correct (Phase 3 drops JWT UPDATE policy as Bokføringsloven §13 compliance).
