-- ============================================================================
-- 20260522000100_billing_settlement_rls.sql
--
-- Row Level Security for billing settlement tables.
--
-- Access model:
--   settlement_period  — accountant reads all periods for granted workspaces;
--                        UPDATE only for open→locked transition (not closed).
--   settlement_run     — accountant reads runs where ALL workspace_ids are
--                        in their granted set; INSERT allowed for same set.
--   settlement_artifact — accountant reads via run join; INSERT is
--                         service_role only (enforced by missing INSERT policy).
--
-- Hard rules:
--   ⛔ closed transition (locked→closed) is service_role ONLY — no RLS policy
--      permits authenticated users to write status='closed'.
--   ⛔ INSERT on settlement_artifact has no authenticated policy — service_role
--      only (server action uploads file then inserts with elevated client).
--
-- Depends on:
--   billing.is_accountant_for_company(uuid)    — 20260521000100
--   billing.get_accountant_company_ids(uuid)   — 20260521000100
--
-- ADR-E (2026-05-02), ADR-A (2026-05-02).
-- ============================================================================

-- ─── Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE billing.settlement_period   ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.settlement_run      ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.settlement_artifact ENABLE ROW LEVEL SECURITY;

-- ─── settlement_period — SELECT ──────────────────────────────────────────────
--
-- Accountant may read any period row for workspaces that belong to
-- companies they hold an active grant on.

CREATE POLICY settlement_period_accountant_select
  ON billing.settlement_period
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace w
      WHERE w.workspace_id = settlement_period.workspace_id
        AND billing.is_accountant_for_company(w.company_id)
    )
  );

-- ─── settlement_period — UPDATE (open → locked only) ─────────────────────────
--
-- Accountant may lock a period (advance status from open→locked).
-- The WITH CHECK prevents any other status value being written,
-- specifically blocking authenticated users from setting status='closed'.
-- locked→closed requires service_role (server action runs with elevated client).

CREATE POLICY settlement_period_accountant_update
  ON billing.settlement_period
  FOR UPDATE
  USING (
    status = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.workspace w
      WHERE w.workspace_id = settlement_period.workspace_id
        AND billing.is_accountant_for_company(w.company_id)
    )
  )
  WITH CHECK (
    status = 'locked'
    AND EXISTS (
      SELECT 1
      FROM public.workspace w
      WHERE w.workspace_id = settlement_period.workspace_id
        AND billing.is_accountant_for_company(w.company_id)
    )
  );

-- ─── settlement_period — INSERT ───────────────────────────────────────────────
--
-- Accountant may create a new (open) period for a granted workspace.
-- lock_settlement_period() helper is SECURITY DEFINER and uses UPSERT, so it
-- bypasses this policy; this policy is defense-in-depth for direct client calls.

CREATE POLICY settlement_period_accountant_insert
  ON billing.settlement_period
  FOR INSERT
  WITH CHECK (
    status = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.workspace w
      WHERE w.workspace_id = settlement_period.workspace_id
        AND billing.is_accountant_for_company(w.company_id)
    )
  );

-- ─── settlement_run — SELECT ──────────────────────────────────────────────────
--
-- Accountant may read a run if the initiating user is themselves, OR if
-- ALL workspace_ids in the run belong to companies they hold grants on.
-- The ALL-workspaces check uses a helper function defined below.

CREATE OR REPLACE FUNCTION billing.accountant_has_access_to_run(p_run_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = billing, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM billing.settlement_run r
    WHERE r.run_id = p_run_id
      AND (
        -- initiator can always see their own runs
        r.initiated_by = auth.uid()
        -- OR all workspaces in this run are in accountant's granted set
        OR (
          SELECT bool_and(
            billing.is_accountant_for_company(w.company_id)
          )
          FROM public.workspace w
          WHERE w.workspace_id = ANY(r.workspace_ids)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION billing.accountant_has_access_to_run(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.accountant_has_access_to_run(uuid) TO authenticated;

CREATE POLICY settlement_run_accountant_select
  ON billing.settlement_run
  FOR SELECT
  USING (
    initiated_by = auth.uid()
    OR (
      SELECT bool_and(
        billing.is_accountant_for_company(w.company_id)
      )
      FROM public.workspace w
      WHERE w.workspace_id = ANY(settlement_run.workspace_ids)
    )
  );

-- ─── settlement_run — INSERT ──────────────────────────────────────────────────
--
-- Accountant may create a run only for workspaces within their granted
-- companies. Enforced via WITH CHECK: every element of workspace_ids
-- must belong to a company the caller has an active grant on.
-- initiated_by must match auth.uid() (cannot impersonate another user).

CREATE POLICY settlement_run_accountant_insert
  ON billing.settlement_run
  FOR INSERT
  WITH CHECK (
    initiated_by = auth.uid()
    AND (
      SELECT bool_and(
        billing.is_accountant_for_company(w.company_id)
      )
      FROM public.workspace w
      WHERE w.workspace_id = ANY(settlement_run.workspace_ids)
    )
  );

-- ─── settlement_artifact — SELECT ────────────────────────────────────────────
--
-- Accountant may read artifacts if they have access to the parent run.
-- INSERT is intentionally omitted — service_role only (server action).

CREATE POLICY settlement_artifact_accountant_select
  ON billing.settlement_artifact
  FOR SELECT
  USING (
    billing.accountant_has_access_to_run(settlement_artifact.run_id)
  );
