-- ════════════════════════════════════════════════════════════════════════════
-- overtime-cap-policy.sql — ADR-0254 / SMA-352
-- ----------------------------------------------------------------------------
-- pgTAP suite for public.overtime_cap_policy:
--   1. Workspace bootstrap trigger seeds two policy rows (legal_default
--      default + local_tariff_agreement non-default).
--   2. Aml. §10-6 second-ledd ceiling (10/25/200) is DB-enforced via CHECK.
--   3. Aml. §10-6 fourth-ledd ceiling (20/50/300) is DB-enforced via CHECK.
--   4. unntak_10_12 requires NULL caps; any non-NULL is rejected.
--   5. arbeidstilsynet_vedtak requires non-NULL caps; any NULL is rejected.
--   6. Partial unique index forbids two default policies in one workspace.
--   7. ON DELETE CASCADE from workspace cleans up policies.
--
-- Run: psql "$DATABASE_URL" --set ON_ERROR_STOP=1 -f supabase/tests/overtime-cap-policy.sql
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

SELECT plan(14);

-- ─── Bootstrap fresh workspace ──────────────────────────────────────────────

DO $$
DECLARE
  v_company_id   uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.workspace_id', v_workspace_id::text, false);

  INSERT INTO public.company (company_id, name)
    VALUES (v_company_id, 'overtime_cap_policy test co');

  INSERT INTO public.workspace (workspace_id, company_id, name, slug)
    VALUES (v_workspace_id, v_company_id, 'overtime cap ws',
            'ot-cap-ws-' || substr(v_workspace_id::text, 1, 8));
END $$;

-- ─── 1–3. trigger seed — exactly 2 rows, one default, names match ADR ──────

SELECT is(
  (SELECT count(*) FROM public.overtime_cap_policy
    WHERE workspace_id = current_setting('test.workspace_id')::uuid),
  2::bigint,
  'workspace bootstrap seeds exactly 2 overtime_cap_policy rows'
);

SELECT is(
  (SELECT agreement_type::text FROM public.overtime_cap_policy
    WHERE workspace_id = current_setting('test.workspace_id')::uuid
      AND is_default = true),
  'legal_default',
  'default-flagged row uses legal_default tier'
);

SELECT is(
  (SELECT max_weekly_hours FROM public.overtime_cap_policy
    WHERE workspace_id = current_setting('test.workspace_id')::uuid
      AND is_default = true),
  10::numeric,
  'legal_default row caps weekly hours at 10 (Aml. §10-6 second ledd)'
);

-- ─── 4. legal_default exceed ceiling → CHECK fails (weekly) ─────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours)
    VALUES (current_setting('test.workspace_id')::uuid,
            'exceed_weekly_legal_default', 'legal_default', 11, 25, 200)
  $sql$,
  '23514',
  NULL,
  'legal_default weekly > 10 rejected (chk_overtime_cap_legal_default_weekly)'
);

-- ─── 5. legal_default 4-week > 25 → CHECK fails ─────────────────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours)
    VALUES (current_setting('test.workspace_id')::uuid,
            'exceed_4w_legal_default', 'legal_default', 10, 30, 200)
  $sql$,
  '23514',
  NULL,
  'legal_default 4-week > 25 rejected (chk_overtime_cap_legal_default_4week)'
);

-- ─── 6. legal_default yearly > 200 → CHECK fails ────────────────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours)
    VALUES (current_setting('test.workspace_id')::uuid,
            'exceed_yearly_legal_default', 'legal_default', 10, 25, 201)
  $sql$,
  '23514',
  NULL,
  'legal_default yearly > 200 rejected (chk_overtime_cap_legal_default_yearly)'
);

-- ─── 7. local_tariff_agreement at boundary (20/50/300) → OK ─────────────────

SELECT lives_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours)
    VALUES (current_setting('test.workspace_id')::uuid,
            'tariff_at_boundary', 'local_tariff_agreement', 20, 50, 300)
  $sql$,
  'local_tariff_agreement at boundary (20/50/300) accepted'
);

-- ─── 8. local_tariff_agreement weekly > 20 → CHECK fails ────────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours)
    VALUES (current_setting('test.workspace_id')::uuid,
            'exceed_weekly_tariff', 'local_tariff_agreement', 21, 50, 300)
  $sql$,
  '23514',
  NULL,
  'local_tariff_agreement weekly > 20 rejected'
);

-- ─── 9. unntak_10_12 with non-null caps → CHECK fails ───────────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours)
    VALUES (current_setting('test.workspace_id')::uuid,
            'unntak_with_caps', 'unntak_10_12', 10, 25, 200)
  $sql$,
  '23514',
  NULL,
  'unntak_10_12 with non-null caps rejected (chk_overtime_cap_unntak_null)'
);

-- ─── 10. unntak_10_12 with NULL caps → OK ───────────────────────────────────

SELECT lives_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours)
    VALUES (current_setting('test.workspace_id')::uuid,
            'unntak_null_caps', 'unntak_10_12', NULL, NULL, NULL)
  $sql$,
  'unntak_10_12 with NULL caps accepted'
);

-- ─── 11. arbeidstilsynet_vedtak with NULL caps → CHECK fails ────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours)
    VALUES (current_setting('test.workspace_id')::uuid,
            'arbeidstilsynet_with_null', 'arbeidstilsynet_vedtak',
            NULL, 50, 300)
  $sql$,
  '23514',
  NULL,
  'arbeidstilsynet_vedtak with NULL caps rejected'
);

-- ─── 12. partial unique index — second default row rejected ─────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours, is_default)
    VALUES (current_setting('test.workspace_id')::uuid,
            'second_default', 'local_tariff_agreement', 20, 50, 300, true)
  $sql$,
  '23505',
  NULL,
  'second is_default=true row in same workspace rejected (unique index)'
);

-- ─── 13. warn_threshold_pct boundary rejection ──────────────────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.overtime_cap_policy
      (workspace_id, name, agreement_type, max_weekly_hours,
       max_per_4_week_period, max_yearly_hours, warn_threshold_pct)
    VALUES (current_setting('test.workspace_id')::uuid,
            'warn_too_high', 'legal_default', 10, 25, 200, 1.0)
  $sql$,
  '23514',
  NULL,
  'warn_threshold_pct >= 1 rejected'
);

-- ─── 14. employment_contract.overtime_cap_policy_id FK exists ───────────────

SELECT has_column(
  'public', 'employment_contract', 'overtime_cap_policy_id',
  'employment_contract.overtime_cap_policy_id column exists (ADR-0254 §4.B)'
);

-- (cascade-delete behaviour is FK-level guarantee from ON DELETE CASCADE on
-- workspace_id; testing the workspace DELETE end-to-end requires unwinding all
-- workspace-scoped tables which is out of scope for this suite — covered by
-- generic FK-cascade integration tests.)

SELECT * FROM finish();
ROLLBACK;
