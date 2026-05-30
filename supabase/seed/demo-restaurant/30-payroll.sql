-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001  | Terrasse d1…2 | Bar d1…3 | Privat d1…4
-- DEPT Operations d0000000-0000-0000-0000-000000000000 | Kitchen d0…1 | Service d0…2 | Bar d0…3
-- PROFILES f0000000-…-{0..9} + new {a..d}; AUTH e0000000-…-{0..9} + new {a..d}
-- LOCAL ONLY — never prod. Idempotent (upsert/delete+insert). password = password123
-- =================================================================================
--
-- 30-payroll.sql — Payroll fixtures: periods, supplement rules, frozen cost snapshots,
--                  calculations, calculation lines, and audit events.
--
-- Principles (non-negotiable):
--   1. Versioning not overwriting — calculation_version = 1
--   2. Idempotency + frozen tariff snapshot — tariff_rate_snapshot frozen via deterministic ORDER BY
--   3. Audit trail (INSERT-only) — every calculation references schedule_shift_id; every event
--      references shift_id + tariff_rate_table_id + rule_type
--   4. Never hardcode rates — ALL rates resolved from public.tariff_rate_table at runtime
--
-- Period strategy (adapted to current-week data from 20-schedule.sql):
--   CLOSED: date_trunc('week',CURRENT_DATE)::date .. CURRENT_DATE-1 (Mon–yesterday)
--   OPEN:   CURRENT_DATE .. last day of current month
--
-- Supplement rules use latest tariff row (highest effective_from) per rate_type.
-- Evening supplement applies to shift hours ≥ 18:00 (simplified: any shift ending after 18:00
-- and containing evening window). Weekend supplement applies to shifts on Sat (dow=6) or Sun (dow=0).
-- Night supplement applies to shifts crossing midnight (end_time = '00:00:00').
--
-- Tariff category fallback: profiles without an employee_payroll_profile row default to ufaglart.
-- Admin profile (f0…0000) is included in the closed shift set but has no payroll profile;
-- rate defaults to ufaglart (198.50/hr) as a safe structural fixture.
-- =================================================================================

SET search_path = public, extensions, pg_catalog;

BEGIN;

-- ============================================================================
-- IDEMPOTENCY — child→parent delete, workspace-scoped
-- Note: calculation_line FK references payroll.supplement_rule (not public.supplement_rule)
-- ============================================================================
DELETE FROM public.shift_pay_calculation_event WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
DELETE FROM payroll.calculation_line             WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
DELETE FROM payroll.calculation                  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
DELETE FROM public.shift_cost_snapshot           WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
DELETE FROM payroll.period                       WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
DELETE FROM payroll.supplement_rule              WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
DELETE FROM public.supplement_rule               WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ============================================================================
-- 1. SUPPLEMENT RULES
-- Stable IDs: e0100000-…-{1..4}
--
-- Two schema targets:
--   A. payroll.supplement_rule — required by calculation_line FK
--   B. public.supplement_rule  — referenced by shift_cost_snapshot.supplements JSONB
--                                and shift_pay_calculation_event.rule_id
--
-- Both get the same stable IDs so references are consistent.
-- Rate values resolved from tariff_rate_table — never literals.
-- payroll.supplement_rule uses typed enums (payroll.supplement_type, payroll.supplement_rate_type).
-- ============================================================================

-- 1a. payroll.supplement_rule (FK target for calculation_line.supplement_rule_id)
INSERT INTO payroll.supplement_rule (
    id, workspace_id,
    name, supplement_type,
    is_active, rate_type, rate_value,
    time_window_start, time_window_end,
    valid_from
)
SELECT
    'e0100000-0000-0000-0000-000000000001'::uuid,
    'b0000000-0000-0000-0000-000000000000',
    'Kveldstillegg',
    'normal'::payroll.supplement_type,
    true,
    'fixed_per_hour'::payroll.supplement_rate_type,
    trt.amount,
    '18:00'::time,
    '23:59'::time,
    trt.effective_from
FROM (
    SELECT DISTINCT ON (rate_type) id, amount, effective_from
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'kveldstillegg'
    ORDER BY rate_type, effective_from DESC
) trt;

INSERT INTO payroll.supplement_rule (
    id, workspace_id,
    name, supplement_type,
    is_active, rate_type, rate_value,
    weekdays,
    valid_from
)
SELECT
    'e0100000-0000-0000-0000-000000000002'::uuid,
    'b0000000-0000-0000-0000-000000000000',
    'Helgetillegg',
    'week_based'::payroll.supplement_type,
    true,
    'fixed_per_hour'::payroll.supplement_rate_type,
    trt.amount,
    ARRAY[6, 0]::integer[],   -- Saturday=6, Sunday=0 (PostgreSQL dow convention)
    trt.effective_from
FROM (
    SELECT DISTINCT ON (rate_type) id, amount, effective_from
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'helgetillegg'
    ORDER BY rate_type, effective_from DESC
) trt;

INSERT INTO payroll.supplement_rule (
    id, workspace_id,
    name, supplement_type,
    is_active, rate_type, rate_value,
    time_window_start, time_window_end,
    valid_from
)
SELECT
    'e0100000-0000-0000-0000-000000000003'::uuid,
    'b0000000-0000-0000-0000-000000000000',
    'Nattillegg',
    'normal'::payroll.supplement_type,
    true,
    'fixed_per_hour'::payroll.supplement_rate_type,
    trt.amount,
    '00:00'::time,
    '06:00'::time,
    trt.effective_from
FROM (
    SELECT DISTINCT ON (rate_type) id, amount, effective_from
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'nattillegg_ordinaer'
    ORDER BY rate_type, effective_from DESC
) trt;

INSERT INTO payroll.supplement_rule (
    id, workspace_id,
    name, supplement_type,
    is_active, rate_type, rate_value,
    valid_from
)
SELECT
    'e0100000-0000-0000-0000-000000000004'::uuid,
    'b0000000-0000-0000-0000-000000000000',
    'Helligdagstillegg',
    'holiday'::payroll.supplement_type,
    true,
    'percentage'::payroll.supplement_rate_type,
    trt.amount,
    trt.effective_from
FROM (
    SELECT DISTINCT ON (rate_type) id, amount, effective_from
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'helligdagstillegg'
    ORDER BY rate_type, effective_from DESC
) trt;

-- 1b. public.supplement_rule (referenced by shift_pay_calculation_event.rule_id and shift_cost_snapshot supplements JSONB)
-- Using same stable IDs for cross-reference consistency.
INSERT INTO public.supplement_rule (
    id, workspace_id,
    name, supplement_type,
    is_active, rate_type, rate_value,
    match_predicate, paragraf_ref,
    valid_from
)
SELECT
    'e0100000-0000-0000-0000-000000000001'::uuid,
    'b0000000-0000-0000-0000-000000000000',
    'Kveldstillegg',
    'normal',
    true,
    'fixed_per_hour',
    trt.amount,
    '{"time_of_day":{"from":"18:00","to":"23:59"}}'::jsonb,
    '§ 5.8 Kveldstillegg',
    trt.effective_from
FROM (
    SELECT DISTINCT ON (rate_type) amount, effective_from
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'kveldstillegg'
    ORDER BY rate_type, effective_from DESC
) trt;

INSERT INTO public.supplement_rule (
    id, workspace_id,
    name, supplement_type,
    is_active, rate_type, rate_value,
    match_predicate, paragraf_ref,
    valid_from
)
SELECT
    'e0100000-0000-0000-0000-000000000002'::uuid,
    'b0000000-0000-0000-0000-000000000000',
    'Helgetillegg',
    'week_based',
    true,
    'fixed_per_hour',
    trt.amount,
    '{"day_of_week":["saturday","sunday"]}'::jsonb,
    '§ 5.9 Helgetillegg',
    trt.effective_from
FROM (
    SELECT DISTINCT ON (rate_type) amount, effective_from
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'helgetillegg'
    ORDER BY rate_type, effective_from DESC
) trt;

INSERT INTO public.supplement_rule (
    id, workspace_id,
    name, supplement_type,
    is_active, rate_type, rate_value,
    match_predicate, paragraf_ref,
    valid_from
)
SELECT
    'e0100000-0000-0000-0000-000000000003'::uuid,
    'b0000000-0000-0000-0000-000000000000',
    'Nattillegg',
    'normal',
    true,
    'fixed_per_hour',
    trt.amount,
    '{"time_of_day":{"from":"00:00","to":"06:00"}}'::jsonb,
    '§ 5.8 Nattillegg ordinær',
    trt.effective_from
FROM (
    SELECT DISTINCT ON (rate_type) amount, effective_from
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'nattillegg_ordinaer'
    ORDER BY rate_type, effective_from DESC
) trt;

INSERT INTO public.supplement_rule (
    id, workspace_id,
    name, supplement_type,
    is_active, rate_type, rate_value,
    match_predicate, paragraf_ref,
    valid_from
)
SELECT
    'e0100000-0000-0000-0000-000000000004'::uuid,
    'b0000000-0000-0000-0000-000000000000',
    'Helligdagstillegg',
    'holiday',
    true,
    'percentage',
    trt.amount,
    '{"is_public_holiday":true}'::jsonb,
    '§ 5.10 Helligdagstillegg',
    trt.effective_from
FROM (
    SELECT DISTINCT ON (rate_type) amount, effective_from
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'helligdagstillegg'
    ORDER BY rate_type, effective_from DESC
) trt;

-- ============================================================================
-- 2. PAYROLL PERIODS
-- Stable IDs: c1000000-…-1 (closed), c1000000-…-2 (open)
-- ============================================================================

DO $$
DECLARE
    v_week_start date := date_trunc('week', CURRENT_DATE)::date;
    v_yesterday  date := CURRENT_DATE - 1;
    v_today      date := CURRENT_DATE;
    v_month_end  date := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
BEGIN
    -- Closed period: Monday of current week → yesterday
    -- Only insert if yesterday >= week_start (i.e., today is not Monday)
    IF v_yesterday >= v_week_start THEN
        INSERT INTO payroll.period (id, workspace_id, start_date, end_date, status, locked_at)
        VALUES (
            'c1000000-0000-0000-0000-000000000001',
            'b0000000-0000-0000-0000-000000000000',
            v_week_start,
            v_yesterday,
            'locked',
            now()
        );
        RAISE NOTICE 'Closed period: % .. %', v_week_start, v_yesterday;
    ELSE
        -- Today is Monday — no closed days this week yet. Use last week as closed period.
        INSERT INTO payroll.period (id, workspace_id, start_date, end_date, status, locked_at)
        VALUES (
            'c1000000-0000-0000-0000-000000000001',
            'b0000000-0000-0000-0000-000000000000',
            v_week_start - 7,
            v_week_start - 1,
            'locked',
            now()
        );
        RAISE NOTICE 'Today is Monday — closed period falls back to LAST week: % .. %', v_week_start - 7, v_week_start - 1;
    END IF;

    -- Open period: today → last day of current month
    INSERT INTO payroll.period (id, workspace_id, start_date, end_date, status)
    VALUES (
        'c1000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000000',
        v_today,
        v_month_end,
        'open'
    );
    RAISE NOTICE 'Open period: % .. %', v_today, v_month_end;
END $$;

-- ============================================================================
-- 3. FROZEN TARIFF SNAPSHOT + SHIFT COST SNAPSHOTS (one per closed-period shift)
--
-- Uses a CTE to pre-compute rates and supplement amounts per shift once,
-- then composes final columns cleanly — avoids repeated subqueries.
--
-- tariff_rate_snapshot = frozen JSONB of ALL platform tariff rows (workspace_id IS NULL,
--   source='riksavtalen'), ordered by rate_type for deterministic bit-identical freeze.
-- ============================================================================

WITH
-- Freeze tariff snapshot once — same JSONB for every snapshot row
tariff_freeze AS (
    SELECT jsonb_agg(
        jsonb_build_object(
            'rate_type',      trt.rate_type,
            'amount',         trt.amount,
            'unit',           trt.unit,
            'effective_from', trt.effective_from
        )
        ORDER BY trt.rate_type
    ) AS snapshot
    FROM public.tariff_rate_table trt
    WHERE trt.workspace_id IS NULL
      AND trt.source = 'riksavtalen'
),
-- Scalar tariff rates (latest effective_from per type)
rates AS (
    SELECT
        (SELECT DISTINCT ON (rate_type) amount FROM public.tariff_rate_table
         WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
         ORDER BY rate_type, effective_from DESC) AS faglart,
        (SELECT DISTINCT ON (rate_type) amount FROM public.tariff_rate_table
         WHERE workspace_id IS NULL AND rate_type = 'minstelonn_ufaglart'
         ORDER BY rate_type, effective_from DESC) AS ufaglart,
        (SELECT DISTINCT ON (rate_type) amount FROM public.tariff_rate_table
         WHERE workspace_id IS NULL AND rate_type = 'kveldstillegg'
         ORDER BY rate_type, effective_from DESC) AS kveld,
        (SELECT DISTINCT ON (rate_type) amount FROM public.tariff_rate_table
         WHERE workspace_id IS NULL AND rate_type = 'helgetillegg'
         ORDER BY rate_type, effective_from DESC) AS helg,
        (SELECT DISTINCT ON (rate_type) amount FROM public.tariff_rate_table
         WHERE workspace_id IS NULL AND rate_type = 'nattillegg_ordinaer'
         ORDER BY rate_type, effective_from DESC) AS natt
),
-- Per-shift computed values
shift_vals AS (
    SELECT
        ss.workspace_id,
        ss.schedule_shift_id,
        ss.employee_id AS profile_id,
        ss.work_hours,
        ss.start_time,
        ss.end_time,
        ss.shift_date,
        ss.breaks,
        COALESCE(ep.has_fagbrev, false)                    AS has_fagbrev,

        -- base_rate per category
        CASE WHEN COALESCE(ep.has_fagbrev, false) = true
             THEN r.faglart ELSE r.ufaglart END            AS base_rate,

        -- kveld hours: portion of shift after 18:00
        CASE
            WHEN ss.end_time = '00:00:00' THEN
                LEAST(ss.work_hours,
                    EXTRACT(EPOCH FROM ('24:00:00'::interval
                        - GREATEST(ss.start_time, '18:00:00'::time)::interval)) / 3600.0)
            WHEN ss.end_time > '18:00:00' THEN
                EXTRACT(EPOCH FROM (ss.end_time - GREATEST(ss.start_time, '18:00:00'::time))) / 3600.0
            ELSE 0
        END                                                AS kveld_hours,

        -- helg hours: full shift on Sat/Sun
        CASE WHEN EXTRACT(dow FROM ss.shift_date) IN (0, 6)
             THEN ss.work_hours ELSE 0 END                 AS helg_hours,

        -- natt hours: 1h assumed post-midnight for fixture
        CASE WHEN ss.end_time = '00:00:00' THEN 1.0 ELSE 0 END AS natt_hours,

        r.kveld                                            AS kveld_rate,
        r.helg                                             AS helg_rate,
        r.natt                                             AS natt_rate
    FROM public.schedule_shift ss
    CROSS JOIN rates r
    LEFT JOIN public.employee_payroll_profile ep
        ON ep.profile_id   = ss.employee_id
       AND ep.workspace_id = ss.workspace_id
    WHERE ss.workspace_id = 'b0000000-0000-0000-0000-000000000000'
      AND ss.employee_id IS NOT NULL
      AND ss.shift_date < CURRENT_DATE
      AND ss.shift_date >= date_trunc('week', CURRENT_DATE)::date
),
-- Final computed financials per shift
shift_financials AS (
    SELECT
        sv.*,
        sv.work_hours * sv.base_rate                       AS base_cost,
        sv.kveld_hours * sv.kveld_rate
            + sv.helg_hours  * sv.helg_rate
            + sv.natt_hours  * sv.natt_rate                AS supplement_cost,

        -- supplements JSONB array (empty array when no supplement applies)
        COALESCE(
            (
                SELECT jsonb_agg(entry ORDER BY entry->>'type')
                FROM (
                    SELECT jsonb_build_object(
                        'type', 'kveldstillegg',
                        'supplement_rule_id', 'e0100000-0000-0000-0000-000000000001',
                        'rate', sv.kveld_rate,
                        'hours', sv.kveld_hours
                    ) AS entry
                    WHERE sv.kveld_hours > 0

                    UNION ALL

                    SELECT jsonb_build_object(
                        'type', 'helgetillegg',
                        'supplement_rule_id', 'e0100000-0000-0000-0000-000000000002',
                        'rate', sv.helg_rate,
                        'hours', sv.helg_hours
                    ) AS entry
                    WHERE sv.helg_hours > 0

                    UNION ALL

                    SELECT jsonb_build_object(
                        'type', 'nattillegg',
                        'supplement_rule_id', 'e0100000-0000-0000-0000-000000000003',
                        'rate', sv.natt_rate,
                        'hours', sv.natt_hours
                    ) AS entry
                    WHERE sv.natt_hours > 0
                ) sup_rows
            ),
            '[]'::jsonb
        )                                                  AS supplements_jsonb
    FROM shift_vals sv
)
INSERT INTO public.shift_cost_snapshot (
    workspace_id, schedule_shift_id, profile_id,
    base_hours, base_rate, base_cost,
    supplements,
    overtime_cost, total_cost,
    tariff_rate_snapshot,
    payroll_period_id, basis,
    base_amount, supplement_amount, total_amount,
    currency, pay_rule_ids,
    regular_cost, night_cost, holiday_cost, gross_cost
)
SELECT
    sf.workspace_id,
    sf.schedule_shift_id,
    sf.profile_id,
    sf.work_hours                                          AS base_hours,
    sf.base_rate,
    sf.base_cost,
    sf.supplements_jsonb                                   AS supplements,
    0                                                      AS overtime_cost,
    sf.base_cost + sf.supplement_cost                      AS total_cost,
    tf.snapshot                                            AS tariff_rate_snapshot,
    'c1000000-0000-0000-0000-000000000001'                 AS payroll_period_id,
    'planned'::snapshot_basis                              AS basis,
    sf.base_cost                                           AS base_amount,
    sf.supplement_cost                                     AS supplement_amount,
    sf.base_cost + sf.supplement_cost                      AS total_amount,
    'NOK'                                                  AS currency,
    '[]'::jsonb                                            AS pay_rule_ids,
    sf.base_cost                                           AS regular_cost,
    sf.natt_hours * sf.natt_rate                           AS night_cost,
    0                                                      AS holiday_cost,
    sf.base_cost + sf.supplement_cost                      AS gross_cost
FROM shift_financials sf
CROSS JOIN tariff_freeze tf;

-- ============================================================================
-- 4. PAYROLL CALCULATIONS (append-only — one per closed-period shift)
--
-- Reuses shift_cost_snapshot (already inserted above) to avoid re-computing rates.
-- actual_start/end from timesheet.time_entry (shift_id + punch_in/punch_out).
-- ============================================================================

INSERT INTO payroll.calculation (
    workspace_id,
    period_id,
    schedule_shift_id,
    profile_id,
    shift_date,
    scheduled_start,
    scheduled_end,
    actual_start,
    actual_end,
    gross_minutes,
    break_minutes_paid,
    break_minutes_unpaid,
    net_working_minutes,
    base_rate,
    base_pay,
    total_supplements,
    total_deductions,
    total_pay,
    calculation_version,
    provenance
)
SELECT
    scs.workspace_id,
    'c1000000-0000-0000-0000-000000000001'              AS period_id,
    scs.schedule_shift_id,
    scs.profile_id,
    ss.shift_date,

    -- scheduled_start: Oslo local time
    (ss.shift_date + ss.start_time) AT TIME ZONE 'Europe/Oslo'  AS scheduled_start,

    -- scheduled_end: midnight-crossing shifts → next day 00:00
    CASE
        WHEN ss.end_time = '00:00:00' THEN
            ((ss.shift_date + 1) + '00:00:00'::time) AT TIME ZONE 'Europe/Oslo'
        ELSE
            (ss.shift_date + ss.end_time) AT TIME ZONE 'Europe/Oslo'
    END                                                 AS scheduled_end,

    -- actual_start/end from timesheet.time_entry (punch_in/punch_out)
    te.punch_in                                         AS actual_start,
    te.punch_out                                        AS actual_end,

    (ss.work_hours * 60)::int                           AS gross_minutes,
    0                                                   AS break_minutes_paid,
    ss.breaks                                           AS break_minutes_unpaid,
    ((ss.work_hours * 60) - ss.breaks)::int             AS net_working_minutes,

    -- pull pre-computed values from shift_cost_snapshot
    scs.base_rate,
    scs.base_amount                                     AS base_pay,
    scs.supplement_amount                               AS total_supplements,
    0                                                   AS total_deductions,
    scs.total_amount                                    AS total_pay,

    1                                                   AS calculation_version,
    jsonb_build_object('source', 'seed', 'file', '30-payroll.sql') AS provenance

FROM public.shift_cost_snapshot scs
JOIN public.schedule_shift ss
    ON ss.schedule_shift_id = scs.schedule_shift_id
LEFT JOIN timesheet.time_entry te
    ON te.shift_id      = scs.schedule_shift_id
   AND te.workspace_id  = scs.workspace_id
WHERE scs.workspace_id     = 'b0000000-0000-0000-0000-000000000000'
  AND scs.payroll_period_id = 'c1000000-0000-0000-0000-000000000001';

-- ============================================================================
-- 5. CALCULATION LINES (base + supplement lines per calculation)
--
-- One 'base' line per calculation.
-- One 'supplement' line per applicable supplement (kveld/helg/natt).
-- salary_code follows Norwegian payroll conventions: 100=base, 501=kveld, 502=helg, 503=natt.
-- ============================================================================

-- 5a. Base lines (one per calculation)
INSERT INTO payroll.calculation_line (
    workspace_id, calculation_id,
    salary_code, line_type, description,
    hours, rate, amount,
    supplement_rule_id, metadata
)
SELECT
    c.workspace_id,
    c.id                                        AS calculation_id,
    '100'                                       AS salary_code,
    'base'                                      AS line_type,
    'Grunnlønn'                                 AS description,
    (c.gross_minutes::numeric / 60)             AS hours,
    c.base_rate                                 AS rate,
    c.base_pay                                  AS amount,
    NULL                                        AS supplement_rule_id,
    '{}'::jsonb                                 AS metadata
FROM payroll.calculation c
WHERE c.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND c.period_id    = 'c1000000-0000-0000-0000-000000000001';

-- 5b. Kveldstillegg lines (shifts ending after 18:00 or crossing midnight)
INSERT INTO payroll.calculation_line (
    workspace_id, calculation_id,
    salary_code, line_type, description,
    hours, rate, amount,
    supplement_rule_id, metadata
)
SELECT
    c.workspace_id,
    c.id                                        AS calculation_id,
    '501'                                       AS salary_code,
    'supplement'                                AS line_type,
    'Kveldstillegg'                             AS description,
    CASE
        WHEN ss.end_time = '00:00:00' THEN
            LEAST(
                ss.work_hours,
                EXTRACT(EPOCH FROM ('24:00:00'::interval - GREATEST(ss.start_time, '18:00:00'::time)::interval)) / 3600.0
            )
        ELSE
            EXTRACT(EPOCH FROM (ss.end_time - GREATEST(ss.start_time, '18:00:00'::time))) / 3600.0
    END                                         AS hours,
    trt_kveld.amount                            AS rate,
    CASE
        WHEN ss.end_time = '00:00:00' THEN
            LEAST(
                ss.work_hours,
                EXTRACT(EPOCH FROM ('24:00:00'::interval - GREATEST(ss.start_time, '18:00:00'::time)::interval)) / 3600.0
            ) * trt_kveld.amount
        ELSE
            EXTRACT(EPOCH FROM (ss.end_time - GREATEST(ss.start_time, '18:00:00'::time))) / 3600.0 * trt_kveld.amount
    END                                         AS amount,
    'e0100000-0000-0000-0000-000000000001'::uuid AS supplement_rule_id,
    jsonb_build_object('tariff_rate_table_id', trt_kveld.id) AS metadata
FROM payroll.calculation c
JOIN public.schedule_shift ss
    ON ss.schedule_shift_id = c.schedule_shift_id
CROSS JOIN LATERAL (
    SELECT DISTINCT ON (rate_type) id, amount
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'kveldstillegg'
    ORDER BY rate_type, effective_from DESC
) trt_kveld
WHERE c.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND c.period_id    = 'c1000000-0000-0000-0000-000000000001'
  AND (ss.end_time > '18:00:00' OR ss.end_time = '00:00:00');

-- 5c. Helgetillegg lines (Saturday/Sunday shifts)
INSERT INTO payroll.calculation_line (
    workspace_id, calculation_id,
    salary_code, line_type, description,
    hours, rate, amount,
    supplement_rule_id, metadata
)
SELECT
    c.workspace_id,
    c.id                                        AS calculation_id,
    '502'                                       AS salary_code,
    'supplement'                                AS line_type,
    'Helgetillegg'                              AS description,
    (c.gross_minutes::numeric / 60)             AS hours,
    trt_helg.amount                             AS rate,
    (c.gross_minutes::numeric / 60) * trt_helg.amount AS amount,
    'e0100000-0000-0000-0000-000000000002'::uuid AS supplement_rule_id,
    jsonb_build_object('tariff_rate_table_id', trt_helg.id) AS metadata
FROM payroll.calculation c
JOIN public.schedule_shift ss
    ON ss.schedule_shift_id = c.schedule_shift_id
CROSS JOIN LATERAL (
    SELECT DISTINCT ON (rate_type) id, amount
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'helgetillegg'
    ORDER BY rate_type, effective_from DESC
) trt_helg
WHERE c.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND c.period_id    = 'c1000000-0000-0000-0000-000000000001'
  AND EXTRACT(dow FROM ss.shift_date) IN (0, 6);

-- 5d. Nattillegg lines (midnight-crossing shifts)
INSERT INTO payroll.calculation_line (
    workspace_id, calculation_id,
    salary_code, line_type, description,
    hours, rate, amount,
    supplement_rule_id, metadata
)
SELECT
    c.workspace_id,
    c.id                                        AS calculation_id,
    '503'                                       AS salary_code,
    'supplement'                                AS line_type,
    'Nattillegg'                                AS description,
    1.0                                         AS hours,   -- conservative fixture: 1h post-midnight
    trt_natt.amount                             AS rate,
    1.0 * trt_natt.amount                       AS amount,
    'e0100000-0000-0000-0000-000000000003'::uuid AS supplement_rule_id,
    jsonb_build_object('tariff_rate_table_id', trt_natt.id) AS metadata
FROM payroll.calculation c
JOIN public.schedule_shift ss
    ON ss.schedule_shift_id = c.schedule_shift_id
CROSS JOIN LATERAL (
    SELECT DISTINCT ON (rate_type) id, amount
    FROM public.tariff_rate_table
    WHERE workspace_id IS NULL AND rate_type = 'nattillegg_ordinaer'
    ORDER BY rate_type, effective_from DESC
) trt_natt
WHERE c.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND c.period_id    = 'c1000000-0000-0000-0000-000000000001'
  AND ss.end_time = '00:00:00';

-- ============================================================================
-- 6. SHIFT PAY CALCULATION EVENTS (INSERT-only audit trail)
--
-- Derives all values from shift_cost_snapshot (already materialized above)
-- joined to tariff_rate_table for the specific tariff_rate_table_id references.
-- One 'base' event + one event per supplement per shift.
-- calculated_by = 'seed'. shift_period_end_date = CURRENT_DATE - 1.
-- ============================================================================

-- Tariff IDs are resolved via statement-local CTEs inside each INSERT below.
-- NOTE: a TEMP TABLE was tried here but DROPS between the supabase reset seeder's
-- inter-batch COMMITs (pgx/Go driver). CTEs are statement-scoped → batch-safe.

-- 6a. Base events — one per closed shift
-- base_rate from shift_cost_snapshot; tariff_rate_table_id resolved inline via CTE
WITH tariff_ids AS (
    SELECT
        (SELECT id FROM public.tariff_rate_table
         WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
         ORDER BY effective_from DESC LIMIT 1)  AS faglart_id,
        (SELECT id FROM public.tariff_rate_table
         WHERE workspace_id IS NULL AND rate_type = 'minstelonn_ufaglart'
         ORDER BY effective_from DESC LIMIT 1)  AS ufaglart_id,
        (SELECT amount FROM public.tariff_rate_table
         WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
         ORDER BY effective_from DESC LIMIT 1)  AS faglart_amount
)
INSERT INTO public.shift_pay_calculation_event (
    workspace_id, payroll_period_id,
    shift_id, profile_id,
    tariff_rate_table_id,
    rule_type, rate_value_applied, rate_type,
    source_text_applied,
    quantity_value, subtotal, amount_nok,
    provenance, derivation_version, calculated_by,
    shift_period_end_date
)
SELECT
    scs.workspace_id,
    'c1000000-0000-0000-0000-000000000001'           AS payroll_period_id,
    scs.schedule_shift_id                            AS shift_id,
    scs.profile_id,
    -- tariff_rate_table_id: faglart if base_rate matches faglart amount, else ufaglart
    CASE WHEN scs.base_rate = ti.faglart_amount
         THEN ti.faglart_id ELSE ti.ufaglart_id END AS tariff_rate_table_id,
    'base'                                           AS rule_type,
    scs.base_rate                                    AS rate_value_applied,
    'kr_per_time'                                    AS rate_type,
    CASE WHEN scs.base_rate = ti.faglart_amount
         THEN 'minstelonn_faglart' ELSE 'minstelonn_ufaglart' END AS source_text_applied,
    scs.base_hours                                   AS quantity_value,
    scs.base_amount                                  AS subtotal,
    scs.base_amount                                  AS amount_nok,
    jsonb_build_object('source', 'seed', 'file', '30-payroll.sql') AS provenance,
    1                                                AS derivation_version,
    'seed'                                           AS calculated_by,
    (CURRENT_DATE - 1)                               AS shift_period_end_date
FROM public.shift_cost_snapshot scs
CROSS JOIN tariff_ids ti
WHERE scs.workspace_id      = 'b0000000-0000-0000-0000-000000000000'
  AND scs.payroll_period_id = 'c1000000-0000-0000-0000-000000000001';

-- 6b. Kveldstillegg events — only for shifts where kveld supplement > 0
INSERT INTO public.shift_pay_calculation_event (
    workspace_id, payroll_period_id,
    shift_id, profile_id,
    rule_id, tariff_rate_table_id,
    rule_type, rate_value_applied, rate_type,
    source_text_applied,
    quantity_value, subtotal, amount_nok,
    provenance, derivation_version, calculated_by,
    shift_period_end_date
)
SELECT
    scs.workspace_id,
    'c1000000-0000-0000-0000-000000000001'           AS payroll_period_id,
    scs.schedule_shift_id                            AS shift_id,
    scs.profile_id,
    'e0100000-0000-0000-0000-000000000001'::uuid     AS rule_id,
    (SELECT id FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'kveldstillegg'
     ORDER BY effective_from DESC LIMIT 1)           AS tariff_rate_table_id,
    'supplement'                                     AS rule_type,
    sr_kveld.rate_value                              AS rate_value_applied,
    'kr_per_time'                                    AS rate_type,
    'kveldstillegg'                                  AS source_text_applied,
    -- kveld_hours = supplement_amount portion attributable to kveld only
    -- Re-derive from schedule_shift since scs only has aggregate supplement_amount
    CASE
        WHEN ss.end_time = '00:00:00' THEN
            LEAST(ss.work_hours,
                EXTRACT(EPOCH FROM ('24:00:00'::interval
                    - GREATEST(ss.start_time, '18:00:00'::time)::interval)) / 3600.0)
        ELSE
            EXTRACT(EPOCH FROM (ss.end_time - GREATEST(ss.start_time, '18:00:00'::time))) / 3600.0
    END                                              AS quantity_value,
    CASE
        WHEN ss.end_time = '00:00:00' THEN
            LEAST(ss.work_hours,
                EXTRACT(EPOCH FROM ('24:00:00'::interval
                    - GREATEST(ss.start_time, '18:00:00'::time)::interval)) / 3600.0)
        ELSE
            EXTRACT(EPOCH FROM (ss.end_time - GREATEST(ss.start_time, '18:00:00'::time))) / 3600.0
    END * sr_kveld.rate_value                        AS subtotal,
    CASE
        WHEN ss.end_time = '00:00:00' THEN
            LEAST(ss.work_hours,
                EXTRACT(EPOCH FROM ('24:00:00'::interval
                    - GREATEST(ss.start_time, '18:00:00'::time)::interval)) / 3600.0)
        ELSE
            EXTRACT(EPOCH FROM (ss.end_time - GREATEST(ss.start_time, '18:00:00'::time))) / 3600.0
    END * sr_kveld.rate_value                        AS amount_nok,
    jsonb_build_object('source', 'seed', 'file', '30-payroll.sql') AS provenance,
    1                                                AS derivation_version,
    'seed'                                           AS calculated_by,
    (CURRENT_DATE - 1)                               AS shift_period_end_date
FROM public.shift_cost_snapshot scs
JOIN public.schedule_shift ss ON ss.schedule_shift_id = scs.schedule_shift_id
JOIN public.supplement_rule sr_kveld
    ON sr_kveld.id = 'e0100000-0000-0000-0000-000000000001'
WHERE scs.workspace_id      = 'b0000000-0000-0000-0000-000000000000'
  AND scs.payroll_period_id = 'c1000000-0000-0000-0000-000000000001'
  AND (ss.end_time > '18:00:00' OR ss.end_time = '00:00:00');

-- 6c. Helgetillegg events — Saturday/Sunday shifts
INSERT INTO public.shift_pay_calculation_event (
    workspace_id, payroll_period_id,
    shift_id, profile_id,
    rule_id, tariff_rate_table_id,
    rule_type, rate_value_applied, rate_type,
    source_text_applied,
    quantity_value, subtotal, amount_nok,
    provenance, derivation_version, calculated_by,
    shift_period_end_date
)
SELECT
    scs.workspace_id,
    'c1000000-0000-0000-0000-000000000001'           AS payroll_period_id,
    scs.schedule_shift_id                            AS shift_id,
    scs.profile_id,
    'e0100000-0000-0000-0000-000000000002'::uuid     AS rule_id,
    (SELECT id FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'helgetillegg'
     ORDER BY effective_from DESC LIMIT 1)           AS tariff_rate_table_id,
    'supplement'                                     AS rule_type,
    sr_helg.rate_value                               AS rate_value_applied,
    'kr_per_time'                                    AS rate_type,
    'helgetillegg'                                   AS source_text_applied,
    scs.base_hours                                   AS quantity_value,
    scs.base_hours * sr_helg.rate_value              AS subtotal,
    scs.base_hours * sr_helg.rate_value              AS amount_nok,
    jsonb_build_object('source', 'seed', 'file', '30-payroll.sql') AS provenance,
    1                                                AS derivation_version,
    'seed'                                           AS calculated_by,
    (CURRENT_DATE - 1)                               AS shift_period_end_date
FROM public.shift_cost_snapshot scs
JOIN public.schedule_shift ss ON ss.schedule_shift_id = scs.schedule_shift_id
JOIN public.supplement_rule sr_helg
    ON sr_helg.id = 'e0100000-0000-0000-0000-000000000002'
WHERE scs.workspace_id      = 'b0000000-0000-0000-0000-000000000000'
  AND scs.payroll_period_id = 'c1000000-0000-0000-0000-000000000001'
  AND EXTRACT(dow FROM ss.shift_date) IN (0, 6);

-- 6d. Nattillegg events — midnight-crossing shifts
INSERT INTO public.shift_pay_calculation_event (
    workspace_id, payroll_period_id,
    shift_id, profile_id,
    rule_id, tariff_rate_table_id,
    rule_type, rate_value_applied, rate_type,
    source_text_applied,
    quantity_value, subtotal, amount_nok,
    provenance, derivation_version, calculated_by,
    shift_period_end_date
)
SELECT
    scs.workspace_id,
    'c1000000-0000-0000-0000-000000000001'           AS payroll_period_id,
    scs.schedule_shift_id                            AS shift_id,
    scs.profile_id,
    'e0100000-0000-0000-0000-000000000003'::uuid     AS rule_id,
    (SELECT id FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'nattillegg_ordinaer'
     ORDER BY effective_from DESC LIMIT 1)           AS tariff_rate_table_id,
    'supplement'                                     AS rule_type,
    sr_natt.rate_value                               AS rate_value_applied,
    'kr_per_time'                                    AS rate_type,
    'nattillegg_ordinaer'                            AS source_text_applied,
    1.0                                              AS quantity_value,
    1.0 * sr_natt.rate_value                         AS subtotal,
    1.0 * sr_natt.rate_value                         AS amount_nok,
    jsonb_build_object('source', 'seed', 'file', '30-payroll.sql') AS provenance,
    1                                                AS derivation_version,
    'seed'                                           AS calculated_by,
    (CURRENT_DATE - 1)                               AS shift_period_end_date
FROM public.shift_cost_snapshot scs
JOIN public.schedule_shift ss ON ss.schedule_shift_id = scs.schedule_shift_id
JOIN public.supplement_rule sr_natt
    ON sr_natt.id = 'e0100000-0000-0000-0000-000000000003'
WHERE scs.workspace_id      = 'b0000000-0000-0000-0000-000000000000'
  AND scs.payroll_period_id = 'c1000000-0000-0000-0000-000000000001'
  AND ss.end_time = '00:00:00';

-- ============================================================================
-- 7. VERIFICATION NOTICES
-- ============================================================================
DO $$
DECLARE
    v_periods   int;
    v_sups      int;
    v_snaps     int;
    v_calcs     int;
    v_null_sh   int;
    v_lines     int;
    v_events    int;
BEGIN
    SELECT count(*) INTO v_periods FROM payroll.period           WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
    -- Check payroll schema (FK target) — 4 expected there
    SELECT count(*) INTO v_sups   FROM payroll.supplement_rule   WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
    SELECT count(*) INTO v_snaps  FROM public.shift_cost_snapshot WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000' AND jsonb_array_length(tariff_rate_snapshot) > 0;
    SELECT count(*) INTO v_calcs  FROM payroll.calculation        WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
    SELECT count(*) INTO v_null_sh FROM payroll.calculation       WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000' AND schedule_shift_id IS NULL;
    SELECT count(*) INTO v_lines  FROM payroll.calculation_line   WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
    SELECT count(*) INTO v_events FROM public.shift_pay_calculation_event WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

    RAISE NOTICE '30-payroll.sql verification:';
    RAISE NOTICE '  periods=% (expected 2)', v_periods;
    RAISE NOTICE '  supplement_rules=% (expected 4)', v_sups;
    RAISE NOTICE '  snapshots_with_frozen_tariff=% (expected >0)', v_snaps;
    RAISE NOTICE '  calculations=% (expected >0)', v_calcs;
    RAISE NOTICE '  calculations_with_null_shift=% (expected 0)', v_null_sh;
    RAISE NOTICE '  calculation_lines=% (expected >0)', v_lines;
    RAISE NOTICE '  events=% (expected >0)', v_events;

    IF v_null_sh > 0 THEN
        RAISE EXCEPTION '30-payroll.sql INTEGRITY VIOLATION: % calculations have NULL schedule_shift_id', v_null_sh;
    END IF;
    IF v_periods <> 2 THEN
        RAISE EXCEPTION '30-payroll.sql: expected 2 periods, got %', v_periods;
    END IF;
    IF v_sups <> 4 THEN
        RAISE EXCEPTION '30-payroll.sql: expected 4 supplement_rules, got %', v_sups;
    END IF;
END $$;

COMMIT;
