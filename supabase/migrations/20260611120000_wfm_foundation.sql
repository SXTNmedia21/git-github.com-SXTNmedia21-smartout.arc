-- ============================================================
-- 20260611120000_wfm_foundation.sql
-- WFM Foundation schema — ADR-0305 (POS), ADR-0306 (marketplace), ADR-0307+0309 (scheduler)
--
-- PURPOSE
-- -------
-- Ships the shared DB foundation for three V1 WFM capabilities:
--   1. POS integration (ADR-0305) — pos_account + pos_sale_event + v_pos_sales_hour view
--   2. Open-shift marketplace (ADR-0306) — schedule_shift_offer_status enum + schedule_shift_offer
--   3. Scheduler bundle (ADR-0307 amended / ADR-0309) — change_proposal.kind taxonomy COMMENT
--
-- This migration ships NO capability tool code and NO authority config rows.
-- Authority seeds ship in 20260611120100_wfm_capability_authority_seed.sql.
-- Vault helper functions ship in 20260611120050_wfm_vault_helper.sql.
--
-- Hard constraint: timestamp 20260611120000 > current tip 20260610100000 (verified).
--
-- References:
--   ADR-0305 (POS adapter pattern + append-only sale-event)
--   ADR-0306 (open-shift marketplace sidecar offer table)
--   ADR-0307 (greedy scheduler V1 — amended; §Persistence superseded by ADR-0309)
--   ADR-0309 (scheduler bundle proposal pattern — single row, atomic accept V1)
--   smartout-database-guide (RLS patterns, enum workflow, migration ordering)
--   secrets-protocol (per-workspace OAuth tokens → Supabase Vault Tier 2, not op://)
-- ============================================================

SET search_path TO public, extensions;

-- ─── 1. POS ACCOUNT TABLE ─────────────────────────────────────────────────────
-- Tracks one Lightspeed K-Series integration per workspace (V1 = one vendor per workspace
-- per UNIQUE constraint). credentials_vault_id references vault.secrets.id; actual token
-- is never stored in this column — only the secret UUID. Vault helper writes the secret
-- and updates this FK (see 20260611120050_wfm_vault_helper.sql).
-- Append/update path: only via Edge Function pos-sync (C1 sortie) + admin OAuth flow.
-- ADR-0305: status='inactive' by default; Edge Function sets 'active' on first successful sync.

CREATE TABLE public.pos_account (
  pos_account_id       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id         UUID        NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  vendor               TEXT        NOT NULL,
  external_account_id  TEXT        NOT NULL,
  credentials_vault_id UUID        NULL     REFERENCES vault.secrets(id) ON DELETE SET NULL,
  sync_state           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at       TIMESTAMPTZ NULL,
  status               TEXT        NOT NULL DEFAULT 'inactive',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- V1: one vendor per workspace. If multi-vendor is needed, add a version row + drop this constraint.
  CONSTRAINT pos_account_vendor_check CHECK (vendor IN ('lightspeed_kseries')),
  CONSTRAINT pos_account_status_check CHECK (status IN ('inactive', 'active', 'auth_failed', 'suspended')),
  -- Idempotency: one active Lightspeed integration per workspace
  CONSTRAINT pos_account_workspace_vendor_unique UNIQUE (workspace_id, vendor)
);

ALTER TABLE public.pos_account ENABLE ROW LEVEL SECURITY;

-- JWT read — workspace member may read their own POS accounts
CREATE POLICY "jwt_read_pos_account" ON public.pos_account
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- API key read — workspace API key may read POS accounts for its workspace
CREATE POLICY "api_key_read_pos_account" ON public.pos_account
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );

-- Service-role write — INSERTs/UPDATEs only via Edge Functions (pos-sync, pos-connect OAuth).
-- The admin OAuth flow and pos-sync are service-role callers.
CREATE POLICY "service_role_write_pos_account" ON public.pos_account
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.pos_account IS
  'ADR-0305: Per-workspace POS integration account. '
  'V1 supports vendor=''lightspeed_kseries'' only (UNIQUE workspace_id+vendor). '
  'credentials_vault_id → vault.secrets.id — token value never stored here. '
  'status lifecycle: inactive → active → auth_failed (Edge Function sets on 401). '
  'All writes via service-role only (pos-sync Edge Function + admin OAuth flow, C1 sortie).';

COMMENT ON COLUMN public.pos_account.credentials_vault_id IS
  'UUID pointer into vault.secrets — Supabase Vault Tier 2. '
  'Written by fn_pos_credentials_upsert() SECURITY DEFINER. '
  'Never store a token value directly in this column.';


-- ─── 2. POS SALE EVENT TABLE ──────────────────────────────────────────────────
-- Append-only canonical event log. No updates; corrections via new event with negative amount.
-- ADR-0305: unique (vendor, external_event_id) for deduplication across re-runs.
-- location_id is nullable — Lightspeed accounts may not map to a department on V1 setup.
-- INSERTs only via service-role (pos-sync Edge Function); no direct user writes.

CREATE TABLE public.pos_sale_event (
  pos_sale_event_id   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id        UUID        NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  pos_account_id      UUID        NOT NULL REFERENCES public.pos_account(pos_account_id) ON DELETE CASCADE,
  location_id         UUID        NULL     REFERENCES public.department(department_id) ON DELETE SET NULL,
  vendor              TEXT        NOT NULL,
  external_event_id   TEXT        NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL,
  gross_amount_minor  BIGINT      NOT NULL,
  net_amount_minor    BIGINT      NOT NULL,
  currency            TEXT        NOT NULL,
  item_count          INT         NOT NULL DEFAULT 0,
  raw_payload         JSONB       NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ADR-0305: 3-char ISO-4217 currency (NOK, SEK, DKK for Nordic V1)
  CONSTRAINT pos_sale_event_currency_check CHECK (char_length(currency) = 3),
  -- Idempotency key — ON CONFLICT DO NOTHING in pos-sync
  CONSTRAINT pos_sale_event_vendor_external_id_unique UNIQUE (vendor, external_event_id)
);

ALTER TABLE public.pos_sale_event ENABLE ROW LEVEL SECURITY;

-- JWT read — workspace member may read sale events for their workspace
CREATE POLICY "jwt_read_pos_sale_event" ON public.pos_sale_event
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- API key read — workspace API key may read sale events
CREATE POLICY "api_key_read_pos_sale_event" ON public.pos_sale_event
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );

-- Service-role INSERT only (pos-sync Edge Function). No UPDATE (append-only).
CREATE POLICY "service_role_insert_pos_sale_event" ON public.pos_sale_event
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Performance index: cascade D4 consumer filters (workspace_id, occurred_at DESC)
CREATE INDEX idx_pos_sale_event_workspace_occurred
  ON public.pos_sale_event (workspace_id, occurred_at DESC);

COMMENT ON TABLE public.pos_sale_event IS
  'ADR-0305: Append-only canonical POS sale-event log. '
  'No UPDATE path — corrections must be new rows with negative amounts. '
  'UNIQUE (vendor, external_event_id) provides idempotency across pos-sync re-runs. '
  'Cascade D4 consumers read via public.v_pos_sales_hour view, never this table directly.';


-- ─── 3. OPEN-SHIFT OFFER ENUM ─────────────────────────────────────────────────
-- ADR-0306: offer lifecycle — open (posted, waiting for claim) → claimed (employee claimed)
-- → approved (manager approved) / expired (past expires_at) / cancelled (poster withdrew).
-- No PARTIAL state V1 (atomic all-or-nothing per ADR-0309 analogy for offers).

CREATE TYPE public.schedule_shift_offer_status AS ENUM (
  'open',
  'claimed',
  'approved',
  'expired',
  'cancelled'
);

COMMENT ON TYPE public.schedule_shift_offer_status IS
  'ADR-0306: Open-shift marketplace offer lifecycle. '
  'open → claimed (employee claims) → approved (manager 1-tap). '
  'Expired via cron/trigger when expires_at < now() AND status=''open''. '
  'Cancelled by poster (any status except approved). '
  'No PARTIAL state V1.';


-- ─── 4. SCHEDULE SHIFT OFFER TABLE ───────────────────────────────────────────
-- ADR-0306: sidecar to schedule_shift — does NOT duplicate the shift row.
-- One active offer per shift (UNIQUE partial WHERE status IN ('open','claimed')).
-- RLS: workspace member read; write via capability tools (C2 sortie, service-role caller).

CREATE TABLE public.schedule_shift_offer (
  schedule_shift_offer_id  UUID                           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id             UUID                           NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  shift_id                 UUID                           NOT NULL REFERENCES public.schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  posted_by_profile_id     UUID                           NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  posted_at                TIMESTAMPTZ                    NOT NULL DEFAULT now(),
  expires_at               TIMESTAMPTZ                    NULL,
  status                   schedule_shift_offer_status    NOT NULL DEFAULT 'open',
  claimed_by_profile_id    UUID                           NULL     REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  claimed_at               TIMESTAMPTZ                    NULL,
  approved_by_profile_id   UUID                           NULL     REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  approved_at              TIMESTAMPTZ                    NULL,
  cancel_reason            TEXT                           NULL,
  created_at               TIMESTAMPTZ                    NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ                    NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_shift_offer ENABLE ROW LEVEL SECURITY;

-- Unique partial: only one active offer per shift at a time.
-- 'open' = posted, 'claimed' = waiting for manager approval.
-- Once approved/expired/cancelled, a new offer can be posted for the same shift.
CREATE UNIQUE INDEX idx_schedule_shift_offer_active_unique
  ON public.schedule_shift_offer (shift_id)
  WHERE status IN ('open', 'claimed');

-- Performance: manager inbox filters (workspace_id, status, expires_at)
CREATE INDEX idx_schedule_shift_offer_workspace_status
  ON public.schedule_shift_offer (workspace_id, status, expires_at);

-- JWT read — all workspace members may see open offers (employee claim list)
CREATE POLICY "jwt_read_schedule_shift_offer" ON public.schedule_shift_offer
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- API key read — workspace API key may read shift offers
CREATE POLICY "api_key_read_schedule_shift_offer" ON public.schedule_shift_offer
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );

-- Write: capability tools call via service-role (BFF derives identity from JWT, not body).
-- ADR-0151: profile_id / workspace_id are server-derived, never body-supplied.
CREATE POLICY "service_role_write_schedule_shift_offer" ON public.schedule_shift_offer
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.schedule_shift_offer IS
  'ADR-0306: Open-shift marketplace sidecar. References schedule_shift — does NOT duplicate shift rows. '
  'One active offer per shift (UNIQUE partial on status IN (''open'',''claimed'')). '
  'Write path: shift_marketplace capability tools via BFF → service-role caller (C2 sortie). '
  'D6 cascade readers must NEVER read offers for production-state — always read schedule_shift after approval.';


-- ─── 5. POS SALES HOUR VIEW ──────────────────────────────────────────────────
-- ADR-0305: aggregates pos_sale_event to (workspace_id, location_id, hour_bucket, …)
-- for cascade D4 demand-input. Used by future scheduler hour_factor resolution.
-- View in public schema (not cascade.) — fails 5-table threshold for new schema per database-guide.
-- Cascade D4 consumer reads this view; NEVER queries pos_sale_event directly.

CREATE OR REPLACE VIEW public.v_pos_sales_hour AS
SELECT
  pse.workspace_id,
  pse.location_id,
  date_trunc('hour', pse.occurred_at)  AS hour_bucket,
  SUM(pse.gross_amount_minor)          AS gross_minor,
  SUM(pse.net_amount_minor)            AS net_minor,
  COUNT(*)                             AS txn_count
FROM public.pos_sale_event pse
GROUP BY
  pse.workspace_id,
  pse.location_id,
  date_trunc('hour', pse.occurred_at);

COMMENT ON VIEW public.v_pos_sales_hour IS
  'ADR-0305: Hourly POS sales aggregate for cascade D4 demand-input. '
  'Groups pos_sale_event by workspace + location + hour_bucket. '
  'hour_bucket = date_trunc(''hour'', occurred_at). '
  'Cascade D4 scheduler reads this; NEVER query pos_sale_event directly. '
  'location_id nullable — unmapped accounts produce NULL rows (handle in caller).';


-- ─── 6. CHANGE_PROPOSAL.KIND TAXONOMY COMMENT UPDATE ────────────────────────
-- ADR-0309: scheduler bundle proposals use kind='scheduler_bundle'.
-- No DDL change — kind is already a TEXT column (added in 20260604000002).
-- This COMMENT update documents the new value and its JSONB payload shape.
-- Zod validation lives in capability tool body (C3 sortie), not in a DB CHECK
-- (per Q3 resolution from 20260604000002 — avoids cross-campaign DDL churn).

COMMENT ON COLUMN public.change_proposal.kind IS
  'Application-domain classifier for the proposal type. '
  'Accepted values: '
  '  ''wage_line_override'' — payroll line override (Phase 2, ADR-0292). '
  '     Payload shape (in changes JSONB): '
  '       { calculation_id, original_amount_cents, proposed_amount_cents, '
  '         reason (≥10 chars), category, period_id }. '
  '  ''scheduler_bundle'' — greedy solver proposal (ADR-0307 amended, ADR-0309). '
  '     Payload shape (in changes JSONB): '
  '       { solver_version, solver_run_id, solver_inputs_hash, objective_score, '
  '         gap_count, proposed_shifts[], gaps[] }. '
  '     Accepts: all-or-nothing V1 (status pending→applied). '
  '     No partial-accept V1 — re-run solver with adjusted constraints. '
  '     V2 migration paths: V2a (proposal_group_id column) or V2b (partial_applied enum value) '
  '     — escalate per ADR-0309 when any workspace logs >2 partial-accept requests/cycle. '
  '  NULL — pre-Phase-2 cascade proposals created before this column existed. '
  'DO NOT add new values here without a migration comment + Zod schema in capability tool. '
  'DO NOT convert to enum without coordinating helpdesk, billing, and daily-operation campaigns.';

COMMENT ON TABLE public.change_proposal IS
  'Cascade: A proposed change awaiting review/approval. '
  'kind column classifies app-domain proposals: ''wage_line_override'' (ADR-0292) + '
  '''scheduler_bundle'' (ADR-0309). '
  'kind=''wage_line_override'' payload (changes JSONB): '
  '{ calculation_id: uuid, original_amount_cents: int, proposed_amount_cents: int, '
  'reason: text (min 10 chars), category: manual_adjustment|tariff_interpretation|'
  'shift_data_error|other, period_id: uuid }. '
  'kind=''scheduler_bundle'' payload (changes JSONB): '
  '{ solver_version, solver_run_id, solver_inputs_hash, objective_score, gap_count, '
  'proposed_shifts[], gaps[] } — immutable after creation (ADR-0309 Cascade Invariants 3/5/8). '
  'Zod-validated at capability tool level (Q3: no DB CHECK to avoid cross-campaign DDL churn). '
  'ADR-0292 (payroll override-applier semantics). ADR-0309 (scheduler bundle pattern).';


-- ─── 7. UPDATED_AT TRIGGERS ──────────────────────────────────────────────────
-- Reuse existing moddatetime trigger if available, else create lightweight versions.
-- Both new tables need updated_at auto-maintenance.

DO $$
BEGIN
  -- pos_account updated_at trigger
  -- Uses public.set_updated_at() — the project's canonical updated_at trigger function.
  -- (moddatetime extension is not enabled in this project; set_updated_at() is at public.set_updated_at)
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_pos_account'
      AND tgrelid = 'public.pos_account'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_pos_account
      BEFORE UPDATE ON public.pos_account
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- schedule_shift_offer updated_at trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_schedule_shift_offer'
      AND tgrelid = 'public.schedule_shift_offer'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_schedule_shift_offer
      BEFORE UPDATE ON public.schedule_shift_offer
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;
