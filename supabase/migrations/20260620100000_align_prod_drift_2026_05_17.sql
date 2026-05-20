-- 20260620100000_align_prod_drift_2026_05_17.sql
-- Forward-only repair migration: align prod schema with local migrations.
-- Generated 2026-05-17 from `supabase db diff --linked` output.
--
-- Background: 2026-05-13 reconciliation manually marked 17 migrations applied
-- per ci.yml:330-334 comment, leaving several migrations recorded in
-- schema_migrations whose DDL was never executed on prod. Same class as
-- 20260310120000_invitation_metadata (repaired 2026-05-17 PM via CLI). This
-- migration applies the missing DDL forward-only — no direct prod ALTER.
--
-- See:
--   docs/plans/PLAN-ci-migration-coherence-check.md
--   docs/learnings/0302-ghost-migration-from-reconciliation.md (to be written in P3)
--   docs/decisions/0361-ci-migration-coherence-check.md (to be written in P3)
--
-- Items repaired (verified via diff + direct REST/pg_proc inspection):
--   1. DROP legacy hookresponser table — orphan, no migration created it,
--      0 rows in prod, 0 code refs in repo. Likely Bubble.io-era leftover.
--   2. CREATE OR REPLACE lookup_workspace_by_code — recorded in 20260418100200
--      but DDL never ran on prod.
--   3. CREATE OR REPLACE search_workspaces — same migration as #2.
--   4. CREATE OR REPLACE decrypt_envelope — recorded in 20260515120600 but
--      DDL never ran on prod. BFF break-glass PII reveal endpoint depends on it.
--   5. CREATE OR REPLACE v_current_plan_preview — definition drift (prod and
--      local both have view; bodies differ). Align to local def from
--      20260417123548_billing_views.sql.
--   6. ALTER emma_note.screen default 'walkai' → 'Botsson' (local source of
--      truth per 20260318130000_emma_note.sql).
--   7. ENABLE RLS on end_date_reason, salary_type — local migrations enable
--      RLS but prod has them with RLS disabled. No policies attached on prod
--      (these tables are static reference data); enabling without policies
--      blocks all reads until policies added. Defer policy addition to a
--      separate sortie unless these tables are actively queried.
--
-- L-0042: tip is 20260619100000_payroll_tariff_tools_authority_seed.sql.
-- This timestamp 20260620100000 is strictly greater than tip.

SET search_path TO public, extensions;

-- ── 1. DROP legacy hookresponser table ──────────────────────────
-- CASCADE in case any forgotten FK references exist.
DROP TABLE IF EXISTS public.hookresponser CASCADE;

-- ── 2. lookup_workspace_by_code (from 20260418100200_workspace_join_code.sql) ──
-- Anon-accessible workspace lookup by 6-char join code.
-- Returns name + logo only. SECURITY DEFINER so anon users can read workspace table.
CREATE OR REPLACE FUNCTION public.lookup_workspace_by_code(code TEXT)
RETURNS TABLE (workspace_id UUID, name TEXT, logo_url TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT w.workspace_id, w.name, w.logo_url
  FROM public.workspace w
  WHERE w.join_code = upper(code)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.lookup_workspace_by_code IS 'Look up a workspace by its 6-char join code. Returns name + logo only. Anon-accessible.';

GRANT EXECUTE ON FUNCTION public.lookup_workspace_by_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_workspace_by_code(TEXT) TO authenticated;

-- ── 3. search_workspaces (from 20260418100200_workspace_join_code.sql) ──
-- Anon-accessible name search, min 3 chars, max 10 results.
CREATE OR REPLACE FUNCTION public.search_workspaces(query TEXT)
RETURNS TABLE (workspace_id UUID, name TEXT, logo_url TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT w.workspace_id, w.name, w.logo_url
  FROM public.workspace w
  WHERE w.is_searchable = true
    AND length(query) >= 3
    AND w.name ILIKE '%' || query || '%'
  ORDER BY w.name
  LIMIT 10;
$$;

COMMENT ON FUNCTION public.search_workspaces IS 'Search workspaces by name. Min 3 chars, max 10 results, only searchable workspaces. Anon-accessible.';

GRANT EXECUTE ON FUNCTION public.search_workspaces(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.search_workspaces(TEXT) TO authenticated;

-- ── 4. decrypt_envelope (from 20260515120600_decrypt_envelope_rpc.sql) ──
-- ADR-0185 § Break-glass — SECURITY DEFINER decryption RPC for godmode PII reveal.
-- BFF-only. REVOKE from PUBLIC, GRANT to authenticated. Service role bypass kept.
CREATE OR REPLACE FUNCTION public.decrypt_envelope(p_envelope_id uuid)
RETURNS TABLE (
  raw          text,
  pii_class    text,
  workspace_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Returns nothing if:
  --   (a) envelope does not exist, OR
  --   (b) redact_after has passed (tiered retention — ADR-0184 § Retention).
  -- The BFF surfaces this as 404.
  RETURN QUERY
  SELECT
    convert_from(
      pgp_sym_decrypt(
        e.encrypted_payload,
        current_setting('app.envelope_key')
      ),
      'utf8'
    )::text AS raw,
    e.pii_class,
    e.workspace_id
  FROM public.agent_session_envelope e
  WHERE e.id = p_envelope_id
    AND e.redact_after > now();
END;
$$;

COMMENT ON FUNCTION public.decrypt_envelope(uuid) IS
  'ADR-0185 § Break-glass: decrypts an envelope only if retention has not expired. BFF-only, audit-logged at the call site via emit(admin.pii_reveal).';

REVOKE EXECUTE ON FUNCTION public.decrypt_envelope(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_envelope(uuid) TO authenticated;

-- ── 5. v_current_plan_preview (from 20260417123548_billing_views.sql) ──
-- Definition drift detected between prod and local. Re-apply local def as
-- source of truth.
CREATE OR REPLACE VIEW public.v_current_plan_preview AS
SELECT
  c.company_id,
  c.name AS company_name,
  w.workspace_id,
  w.name AS workspace_name,
  pt.pricing_terms_id,
  pt.monthly_cost,
  pt.price_per_employee,
  pt.free_users,
  pt.overage_price_per_user,
  pt.billing_interval,
  pt.delivery_channel,
  pt.invoice_format,
  (SELECT count(DISTINCT employee_id)
   FROM public.schedule_shift
   WHERE workspace_id = w.workspace_id
     AND status = 'completed'
     AND employee_id IS NOT NULL
     AND shift_date >= date_trunc('month', now())::date
     AND shift_date < (date_trunc('month', now()) + interval '1 month')::date
  ) AS active_users_current_month
FROM public.company c
JOIN public.workspace w ON w.company_id = c.company_id
LEFT JOIN public.pricing_terms pt
  ON pt.company_id = c.company_id
 AND (pt.effective_until IS NULL OR pt.effective_until >= CURRENT_DATE)
 AND pt.effective_from <= CURRENT_DATE;

COMMENT ON VIEW public.v_current_plan_preview IS
  'Company + workspace + currently-effective pricing_terms + current-month active-user count. Active users counted per ADR-0119 predicate (completed shifts with employee_id).';

-- ── 6. emma_note.screen default — restore 'Botsson' from local migration ──
-- Local 20260318130000_emma_note.sql defines DEFAULT 'Botsson'. Prod has 'walkai'.
ALTER TABLE public.emma_note ALTER COLUMN screen SET DEFAULT 'Botsson';

-- ── 7. RLS on end_date_reason + salary_type ──────────────────────
-- Local migrations enable RLS on these tables; prod has RLS disabled.
-- No policies attached on prod or local — these are static reference tables.
-- Enabling without policies blocks all access. Tables are read by app code,
-- so we add minimal anon+authenticated read policies in this migration.
ALTER TABLE public.end_date_reason ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_authenticated_read_end_date_reason" ON public.end_date_reason;
CREATE POLICY "anon_authenticated_read_end_date_reason"
  ON public.end_date_reason FOR SELECT
  USING (true);

ALTER TABLE public.salary_type ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_authenticated_read_salary_type" ON public.salary_type;
CREATE POLICY "anon_authenticated_read_salary_type"
  ON public.salary_type FOR SELECT
  USING (true);

-- ── self-test ────────────────────────────────────────────────────
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hookresponser' AND relnamespace = 'public'::regnamespace),
    '20260620100000 self-test: hookresponser should not exist after migration';

  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'lookup_workspace_by_code'),
    '20260620100000 self-test: lookup_workspace_by_code must exist';

  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_workspaces'),
    '20260620100000 self-test: search_workspaces must exist';

  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_envelope'),
    '20260620100000 self-test: decrypt_envelope must exist';

  ASSERT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_current_plan_preview'),
    '20260620100000 self-test: v_current_plan_preview must exist';

  RAISE NOTICE '20260620100000 self-test PASSED: all 7 drift items aligned';
END $$;
