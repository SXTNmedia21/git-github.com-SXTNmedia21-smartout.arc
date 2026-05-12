-- 20260527101200_payroll_phase1_supplement_dsl_normalize.sql
-- FIX-2 (CRITICAL) + FIX-5 (CRITICAL): Normalize supplement_rule match_predicate DSL.
--
-- Problem A (FIX-2): Rule 2 (Helgetillegg) uses a nested {"conditions": [{...}]}
-- structure. Rules 1 (Kveldstillegg) and 3-6 (Nattillegg) use a flat shape or
-- a single gate. Two predicate shapes force the calc engine (Day 2) to dispatch
-- on shape — undocumented divergence that will cause silent mismatches.
--
-- Problem B (FIX-5): Rule 1 (Kveldstillegg) uses "time_to": "24:00". Non-standard
-- ISO 8601 — JavaScript Date, luxon, date-fns all reject this value. Calc engine
-- will fail silently or throw at evaluation time.
--
-- Fix: Migrate all 6 rules to the canonical multi-window shape:
--   { "windows": [ { "weekdays": [int], "time_from": "HH:MM", "time_to": "HH:MM" } ],
--     "night_worker_category": "enum"? }
--
-- Design decisions:
--   - Multi-window rules (Helgetillegg) populate windows with N entries.
--   - Single-window rules (Kveldstillegg) wrap in a single-element windows array.
--   - Night-category rules use empty windows [] + night_worker_category gate.
--     Missing/empty windows = no time-window filter applied (gate is category-only).
--   - "24:00" sentinel replaced with "23:59" throughout.
--
-- Source authority: SORTIE-PHASE-1.md T1.4, DYNAMIC-SUPPLEMENTS.md §9, ADR-0250.
-- NOTE: supplement_rule has no `code` column — match on `name` field.

SET search_path TO public, extensions;

-- ─── Rule 1: Kveldstillegg → single-window canonical shape ───────────────────
-- Was: { "weekdays": [1,2,3,4,5], "time_from": "21:00", "time_to": "24:00" }
-- Now: { "windows": [{ "weekdays": [1,2,3,4,5], "time_from": "21:00", "time_to": "23:59" }] }
-- Also fixes FIX-5: "24:00" → "23:59"
UPDATE public.supplement_rule
SET match_predicate = jsonb_build_object(
  'windows',
  jsonb_build_array(
    jsonb_build_object(
      'weekdays', jsonb_build_array(1, 2, 3, 4, 5),
      'time_from', '21:00',
      'time_to',   '23:59'
    )
  )
)
WHERE workspace_id IS NULL
  AND name = 'Kveldstillegg';

-- ─── Rule 2: Helgetillegg → multi-window canonical shape ─────────────────────
-- Was: { "conditions": [{"weekdays":[6],"time_from":"14:00","time_to":"24:00"},
--                        {"weekdays":[7],"time_from":"06:00","time_to":"24:00"}] }
-- Now: { "windows": [{"weekdays":[6],"time_from":"14:00","time_to":"23:59"},
--                     {"weekdays":[7],"time_from":"06:00","time_to":"23:59"}] }
-- Also fixes FIX-5: "24:00" → "23:59" in both windows.
UPDATE public.supplement_rule
SET match_predicate = jsonb_build_object(
  'windows',
  jsonb_build_array(
    jsonb_build_object('weekdays', jsonb_build_array(6), 'time_from', '14:00', 'time_to', '23:59'),
    jsonb_build_object('weekdays', jsonb_build_array(7), 'time_from', '06:00', 'time_to', '23:59')
  )
)
WHERE workspace_id IS NULL
  AND name = 'Helgetillegg';

-- ─── Rules 3-6: Nattillegg → canonical shape with empty windows + category gate ─
-- Was: { "night_worker_category": "..." }  (flat, missing windows key)
-- Now: { "windows": [], "night_worker_category": "..." }
-- Empty windows = no time-window filter; gate is night_worker_category alone.
-- Calc engine can dispatch uniformly on windows key presence.
UPDATE public.supplement_rule
SET match_predicate = jsonb_build_object(
  'windows',            '[]'::jsonb,
  'night_worker_category', match_predicate ->> 'night_worker_category'
)
WHERE workspace_id IS NULL
  AND name IN (
    'Nattillegg nattevakter',
    'Nattillegg manuelt arbeid per time',
    'Nattillegg manuelt arbeid per vakt',
    'Nattillegg ordinær'
  );

-- ─── Update column comment to document canonical shape ────────────────────────
COMMENT ON COLUMN public.supplement_rule.match_predicate IS
  'Canonical DSL shape (as of FIX-2 migration, 2026-05-27): '
  '{ "windows": [ { "weekdays": [int], "time_from": "HH:MM", "time_to": "HH:MM" } ], '
  '"night_worker_category": "night_watch"|"manual"|"ordinary" } '
  'Rules: (1) windows is always present (empty array = no time-window filter). '
  '(2) Multi-window rules populate windows with N entries. '
  '(3) Night-category rules have empty windows + night_worker_category. '
  '(4) "24:00" is forbidden — use "23:59". '
  'Evaluated by evaluateSupplements() in calc-engine. DYNAMIC-SUPPLEMENTS.md §9.';

-- ─── Verification query (run after migration to confirm) ─────────────────────
-- SELECT id, name, match_predicate
-- FROM public.supplement_rule
-- WHERE workspace_id IS NULL
-- ORDER BY name;
-- Expected: 6 rows, all with "windows" key, none with "24:00" string.
--
-- SELECT id, name, match_predicate
-- FROM public.supplement_rule
-- WHERE match_predicate::text LIKE '%24:00%';
-- Expected: 0 rows (FIX-5 satisfied).
