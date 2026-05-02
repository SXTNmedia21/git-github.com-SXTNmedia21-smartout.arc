-- ============================================================================
-- 20260521000100_billing_accountant_grant.sql
--
-- Accountant cross-company grant — all NEW objects in `billing` schema.
-- FK references point to public.user_identity and public.company.
-- Existing public tables are untouched (ADR-0118).
--
-- Mental model:
--   public.company_member  = "I work here"
--   billing.accountant_company_grant = "I am Smartout's accountant for this company"
--
-- ADR-A (2026-05-02): accountant access path, option 3 (sibling table, no
-- company_member pollution, SECURITY DEFINER helpers mirror
-- get_workspace_ids_for_user shape).
-- ============================================================================

-- ─── Enum ────────────────────────────────────────────────────────────────────

CREATE TYPE billing.accountant_grant_scope AS ENUM (
  'orders_only',    -- SELECT: invoice, invoice_line_item, invoice_dispatch,
                    --         payment, payment_attempt, billing_activity_log
  'full_kartotek'   -- orders_only + employment_contract + pricing_terms + company_member
);

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE billing.accountant_company_grant (
  grant_id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES public.user_identity(user_id) ON DELETE CASCADE,
  company_id         uuid        NOT NULL REFERENCES public.company(company_id)    ON DELETE CASCADE,
  scope              billing.accountant_grant_scope NOT NULL DEFAULT 'full_kartotek',
  granted_by         uuid        NOT NULL REFERENCES public.user_identity(user_id),
  granted_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at         timestamptz,
  revoked_by         uuid        REFERENCES public.user_identity(user_id),
  revoke_reason      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accountant_company_grant_user_company_unique UNIQUE (user_id, company_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Primary lookup: "which companies is this user an accountant for?"
CREATE INDEX accountant_company_grant_user_active_idx
  ON billing.accountant_company_grant (user_id)
  WHERE revoked_at IS NULL;

-- Secondary lookup: "which accountants cover this company?" (for revocation UI)
CREATE INDEX accountant_company_grant_company_idx
  ON billing.accountant_company_grant (company_id)
  WHERE revoked_at IS NULL;

-- ─── updated_at trigger ──────────────────────────────────────────────────────

-- Re-use the project-wide set_updated_at() function from public.
CREATE TRIGGER set_billing_accountant_company_grant_updated_at
  BEFORE UPDATE ON billing.accountant_company_grant
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE billing.accountant_company_grant ENABLE ROW LEVEL SECURITY;

-- Accountants can SELECT only their own active grant rows.
-- Pontus / godmode bypass via service_role (bypasses RLS entirely).
CREATE POLICY accountant_company_grant_self_select
  ON billing.accountant_company_grant
  FOR SELECT
  USING (user_id = auth.uid() AND revoked_at IS NULL);

-- ─── Table-level grants ──────────────────────────────────────────────────────

GRANT SELECT ON billing.accountant_company_grant TO authenticated;
GRANT ALL    ON billing.accountant_company_grant TO service_role;

-- ─── Helper: get_accountant_company_ids ──────────────────────────────────────
--
-- Returns the list of company_ids for which `p_user_id` holds an active
-- accountant grant. SECURITY DEFINER so it can read billing.accountant_company_grant
-- even when the caller's JWT does not match the row (e.g. when called from an
-- RLS policy that runs in the context of a different table's query).
--
-- Mirror of public.get_workspace_ids_for_user() shape.

CREATE OR REPLACE FUNCTION billing.get_accountant_company_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = billing, public
AS $$
  SELECT array_agg(g.company_id)
  FROM billing.accountant_company_grant g
  WHERE g.user_id = p_user_id
    AND g.revoked_at IS NULL;
$$;

REVOKE ALL  ON FUNCTION billing.get_accountant_company_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.get_accountant_company_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION billing.get_accountant_company_ids(uuid) TO anon;

-- ─── Helper: is_accountant_for_company ───────────────────────────────────────
--
-- Convenience predicate used by RLS policies on public.* tables.
-- Reads billing.accountant_company_grant using the *caller's* auth.uid().
-- SECURITY DEFINER ensures the function can read the grant table regardless
-- of what table the RLS policy is running on.
--
-- Called from public.invoice, public.payment, etc. RLS clauses.
-- Cross-schema function calls in RLS are fully supported by Postgres.

CREATE OR REPLACE FUNCTION billing.is_accountant_for_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = billing, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM billing.accountant_company_grant g
    WHERE g.user_id  = auth.uid()
      AND g.company_id = p_company_id
      AND g.revoked_at IS NULL
  );
$$;

REVOKE ALL  ON FUNCTION billing.is_accountant_for_company(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.is_accountant_for_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION billing.is_accountant_for_company(uuid) TO anon;
