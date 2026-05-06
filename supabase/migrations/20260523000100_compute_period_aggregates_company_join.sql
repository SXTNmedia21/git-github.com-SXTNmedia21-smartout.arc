-- 20260523000100_compute_period_aggregates_company_join.sql
-- Fix: compute_period_aggregates joined invoice via i.workspace_id which doesn't exist.
-- public.invoice is company-scoped (column: company_id only). Resolve workspace's
-- company_id and join via i.company_id = w.company_id instead.
--
-- Discovered: 2026-05-02 during M8 Erik UAT walkthrough. lock fix unblocked
-- locking; next step compute_period_aggregates failed with
-- "column i.workspace_id does not exist".

CREATE OR REPLACE FUNCTION billing.compute_period_aggregates(p_workspace_ids uuid[], p_period_start date, p_period_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'billing', 'public'
AS $function$
DECLARE
  v_result          jsonb := '{}'::jsonb;
  v_by_workspace    jsonb := '{}'::jsonb;
  v_totals          jsonb;
  v_discrepancies   jsonb := '[]'::jsonb;
  v_ws_id           uuid;
  v_ws_rec          record;
  v_inv_rec         record;
  v_total_excl      numeric := 0;
  v_total_incl      numeric := 0;
  v_total_paid      numeric := 0;
  v_total_outstanding numeric := 0;
  v_vat_25          numeric := 0;
  v_vat_15          numeric := 0;
  v_vat_12          numeric := 0;
  v_status_summary  text;
  v_pct_paid        numeric;
  v_overdue_count   integer;
BEGIN
  -- Iterate over each workspace
  FOREACH v_ws_id IN ARRAY p_workspace_ids LOOP

    -- Workspace + company meta
    SELECT
      w.workspace_id,
      w.name                        AS workspace_name,
      c.name                        AS company_name,
      c.company_id                  AS company_id,
      COALESCE(c.org_number, '')    AS org_nr,
      -- aggregate invoice totals for this workspace in period
      COALESCE(SUM(i.amount_excl_vat), 0)          AS sum_excl,
      COALESCE(SUM(i.amount_incl_vat), 0)          AS sum_incl,
      COUNT(i.invoice_id)                           AS cnt_orders,
      COALESCE(SUM(
        CASE WHEN i.status = 'paid' THEN i.amount_incl_vat ELSE 0 END
      ), 0)                                         AS sum_paid,
      COALESCE(SUM(
        CASE WHEN i.status IN ('issued','sent','overdue')
             THEN i.amount_incl_vat ELSE 0 END
      ), 0)                                         AS sum_outstanding,
      COUNT(CASE WHEN i.status = 'overdue' THEN 1 END) AS cnt_overdue
    INTO v_ws_rec
    FROM public.workspace w
    JOIN public.company   c ON c.company_id = w.company_id
    LEFT JOIN public.invoice i
      ON  i.company_id = w.company_id
      AND i.issue_date   >= p_period_start
      AND i.issue_date   <= p_period_end
      AND i.status       NOT IN ('void', 'draft')
    WHERE w.workspace_id = v_ws_id
    GROUP BY w.workspace_id, w.name, c.name, c.company_id, c.org_number;

    IF NOT FOUND THEN
      CONTINUE;  -- workspace not found — skip silently
    END IF;

    -- Derive status_summary label
    IF v_ws_rec.cnt_orders = 0 THEN
      v_status_summary := '— ingen ordre';
    ELSIF v_ws_rec.sum_outstanding = 0 THEN
      v_status_summary := '100% mottatt';
    ELSE
      v_pct_paid := ROUND(
        (v_ws_rec.sum_paid / NULLIF(v_ws_rec.sum_incl, 0)) * 100
      );
      v_overdue_count := v_ws_rec.cnt_overdue::integer;
      IF v_overdue_count > 0 THEN
        v_status_summary := v_pct_paid::text || '% (' || v_overdue_count::text || ' forfalt)';
      ELSE
        v_status_summary := v_pct_paid::text || '% betalt';
      END IF;
    END IF;

    -- Accumulate per-workspace VAT breakdown
    SELECT
      COALESCE(SUM(CASE WHEN ili.vat_rate = 0.25 THEN ili.vat_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ili.vat_rate = 0.15 THEN ili.vat_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ili.vat_rate = 0.12 THEN ili.vat_amount ELSE 0 END), 0)
    INTO v_vat_25, v_vat_15, v_vat_12
    FROM public.invoice_line_item ili
    JOIN public.invoice i ON i.invoice_id = ili.invoice_id
    WHERE i.company_id = (SELECT company_id FROM public.workspace WHERE workspace_id = v_ws_id)
      AND i.issue_date   >= p_period_start
      AND i.issue_date   <= p_period_end
      AND i.status       NOT IN ('void', 'draft');

    -- Accumulate totals
    v_total_excl        := v_total_excl        + v_ws_rec.sum_excl;
    v_total_incl        := v_total_incl        + v_ws_rec.sum_incl;
    v_total_paid        := v_total_paid        + v_ws_rec.sum_paid;
    v_total_outstanding := v_total_outstanding + v_ws_rec.sum_outstanding;

    -- Build per-workspace JSONB entry
    v_by_workspace := v_by_workspace || jsonb_build_object(
      v_ws_id::text,
      jsonb_build_object(
        'company_name',      v_ws_rec.company_name,
        'workspace_name',    v_ws_rec.workspace_name,
        'count_orders',      v_ws_rec.cnt_orders,
        'amount_excl_vat',   v_ws_rec.sum_excl,
        'amount_incl_vat',   v_ws_rec.sum_incl,
        'amount_paid',       v_ws_rec.sum_paid,
        'amount_outstanding', v_ws_rec.sum_outstanding,
        'status_summary',    v_status_summary
      )
    );

    -- Collect discrepancies for this workspace

    -- Overdue invoices (> 14 days past due_date)
    FOR v_inv_rec IN
      SELECT i.invoice_id::text,
             v_ws_rec.company_name,
             (CURRENT_DATE - i.due_date) AS days_overdue
      FROM public.invoice i
      WHERE i.company_id = (SELECT company_id FROM public.workspace WHERE workspace_id = v_ws_id)
        AND i.issue_date   >= p_period_start
        AND i.issue_date   <= p_period_end
        AND i.status       = 'overdue'
        AND i.due_date     < CURRENT_DATE - INTERVAL '14 days'
    LOOP
      v_discrepancies := v_discrepancies || jsonb_build_array(
        jsonb_build_object(
          'type',         'overdue',
          'invoice_id',   v_inv_rec.invoice_id,
          'company_name', v_inv_rec.company_name,
          'days_overdue', v_inv_rec.days_overdue,
          'severity',     CASE WHEN v_inv_rec.days_overdue > 30 THEN 'high' ELSE 'medium' END
        )
      );
    END LOOP;

    -- Partial payments (paid amount < invoice amount)
    FOR v_inv_rec IN
      SELECT i.invoice_id::text,
             i.amount_incl_vat                                                AS expected,
             COALESCE(SUM(p.amount), 0)                                       AS received
      FROM public.invoice i
      LEFT JOIN public.payment p ON p.invoice_id = i.invoice_id
        AND p.status = 'confirmed'
      WHERE i.company_id = (SELECT company_id FROM public.workspace WHERE workspace_id = v_ws_id)
        AND i.issue_date   >= p_period_start
        AND i.issue_date   <= p_period_end
        AND i.status       NOT IN ('void','draft','paid')
      GROUP BY i.invoice_id, i.amount_incl_vat
      HAVING COALESCE(SUM(p.amount), 0) > 0
         AND COALESCE(SUM(p.amount), 0) < i.amount_incl_vat
    LOOP
      v_discrepancies := v_discrepancies || jsonb_build_array(
        jsonb_build_object(
          'type',       'partial_payment',
          'invoice_id', v_inv_rec.invoice_id,
          'expected',   v_inv_rec.expected,
          'received',   v_inv_rec.received,
          'severity',   'medium'
        )
      );
    END LOOP;

    -- Missing org_nr on company (GDPR: company_id only, no personal data)
    IF v_ws_rec.org_nr = '' THEN
      v_discrepancies := v_discrepancies || jsonb_build_array(
        jsonb_build_object(
          'type',         'missing_org_nr',
          'company_id',   v_ws_rec.company_id::text,
          'company_name', v_ws_rec.company_name,
          'severity',     'low'
        )
      );
    END IF;

  END LOOP;  -- end workspace loop

  -- Build totals object
  v_totals := jsonb_build_object(
    'amount_excl_vat',   v_total_excl,
    'vat_breakdown',     jsonb_build_object(
                           '0.25', v_vat_25,
                           '0.15', v_vat_15,
                           '0.12', v_vat_12
                         ),
    'amount_incl_vat',   v_total_incl,
    'amount_paid',       v_total_paid,
    'amount_outstanding', v_total_outstanding
  );

  v_result := jsonb_build_object(
    'by_workspace',  v_by_workspace,
    'totals',        v_totals,
    'discrepancies', v_discrepancies
  );

  RETURN v_result;
END;
$function$

;
