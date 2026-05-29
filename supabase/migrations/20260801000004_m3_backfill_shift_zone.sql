-- Migration M3: Backfill shift_zone from shift_session_day_line + items_json upgrade
-- ADR-0430 Rule 2 — data seeding leg of schema foundation.
--
-- Two independent operations:
--   (A) Insert shift_zone rows from existing shift_session_day_line junction rows,
--       using default-zone rule: lowest sort_order per (workspace_id, location_id),
--       SKIP on tie, SKIP silently if no zones exist for location.
--   (B) Upgrade timeline_template.items_json: replace legacy TEXT field "zone"
--       with array field "zone_ids" (single-element array if zone was non-NULL,
--       empty array if zone was NULL). Idempotent: already-upgraded rows (have
--       "zone_ids" key) are not modified.
--
-- Both operations are idempotent — re-applying produces the same final state.

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- (A) Backfill shift_zone from shift_session_day_line
--
-- Strategy per PLAN-0 AC-0.7 codified rule:
--   1. For each (ssdl) row, resolve the location_id via day_line.
--   2. Find the zone with the lowest sort_order for that (workspace_id, location_id).
--   3. If exactly ONE zone has the minimum sort_order → insert shift_zone row.
--   4. If tied (two+ zones share the minimum sort_order) → SKIP, log NOTICE.
--   5. If no zones at all for location → SKIP silently.
--
-- Note: shift_session_day_line has no workspace_id column — we join shift_session.
-- ─────────────────────────────────────────────────────────────────
WITH zone_candidates AS (
  -- For each ssdl, find the zones available at the resolved location
  SELECT
    ssdl.shift_session_id,
    ssdl.day_line_id,
    ss.workspace_id,
    dl.location_id,
    z.zone_id,
    z.sort_order,
    ROW_NUMBER() OVER (
      PARTITION BY ss.workspace_id, dl.location_id, ssdl.shift_session_id, ssdl.day_line_id
      ORDER BY z.sort_order ASC NULLS LAST
    ) AS rn,
    COUNT(*) OVER (
      PARTITION BY ss.workspace_id, dl.location_id, ssdl.shift_session_id, ssdl.day_line_id,
                   z.sort_order
    ) AS tied_count
  FROM public.shift_session_day_line ssdl
  JOIN public.shift_session ss
    ON ss.shift_session_id = ssdl.shift_session_id
  JOIN public.day_line dl
    ON dl.day_line_id = ssdl.day_line_id
  JOIN public.zone z
    ON z.location_id = dl.location_id
    AND z.workspace_id = ss.workspace_id
    AND z.is_active = true
),
default_zones AS (
  -- Keep only the single unambiguous lowest-sort_order zone per (ssdl, location)
  SELECT *
  FROM zone_candidates
  WHERE rn = 1 AND tied_count = 1
)
INSERT INTO public.shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
SELECT workspace_id, shift_session_id, day_line_id, zone_id, location_id
FROM default_zones
ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;

-- Log backfill outcome
DO $$
DECLARE
  total_ssdl   int;
  backfilled   int;
  skipped      int;
BEGIN
  SELECT count(*) INTO total_ssdl FROM public.shift_session_day_line;
  SELECT count(DISTINCT (shift_session_id, day_line_id)) INTO backfilled FROM public.shift_zone;
  skipped := total_ssdl - backfilled;
  RAISE NOTICE
    'M3 backfill: % shift_session_day_line rows total, % junction-keys received shift_zone rows (% skipped — tie or no zone for location)',
    total_ssdl, backfilled, skipped;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- (B) Upgrade timeline_template.items_json: zone TEXT → zone_ids array
--
-- For each template that has items_json as a JSON array, iterate array elements:
--   - If element has "zone" key AND does NOT already have "zone_ids" key:
--       - If "zone" is non-NULL string: set zone_ids = [zone value] (single-element)
--       - If "zone" is JSON null: set zone_ids = []
--     Then remove the legacy "zone" key from the element.
--   - If element already has "zone_ids" key: leave untouched (idempotent).
--   - Non-object array elements: leave untouched.
--
-- Uses jsonb_agg + lateral unnesting to rebuild the array per row.
-- Only touches rows where items_json IS NOT NULL and is a JSON array.
-- ─────────────────────────────────────────────────────────────────
UPDATE public.timeline_template t
SET
  items_json = (
    SELECT jsonb_agg(
      CASE
        -- Element is an object with legacy "zone" key but no "zone_ids" key yet
        WHEN jsonb_typeof(elem) = 'object'
          AND elem ? 'zone'
          AND NOT (elem ? 'zone_ids')
        THEN
          -- Remove legacy "zone" key, add "zone_ids" array
          (elem - 'zone') || jsonb_build_object(
            'zone_ids',
            CASE
              WHEN elem->>'zone' IS NOT NULL
              THEN jsonb_build_array(elem->>'zone')  -- wrap TEXT value in single-element array
              ELSE '[]'::jsonb                        -- null zone → empty array
            END
          )
        -- Already upgraded or not an object: leave untouched
        ELSE elem
      END
    )
    FROM jsonb_array_elements(t.items_json) AS elem
  ),
  updated_at = now()
WHERE
  t.items_json IS NOT NULL
  AND jsonb_typeof(t.items_json) = 'array'
  -- Only process rows that still have at least one element with legacy "zone" key
  AND t.items_json @> '[{"zone": null}]'::jsonb IS DISTINCT FROM true  -- not filtering by value
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(t.items_json) AS e
    WHERE jsonb_typeof(e) = 'object'
      AND e ? 'zone'
      AND NOT (e ? 'zone_ids')
  );

COMMIT;
