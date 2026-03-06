-- Template: Restaurant Budget & Operating Hours
-- Industry:   restaurant (NACE 56.101)
-- Creates:    1 season_budget, 7 day_factors, 18 hour_factors, 7 operating_hours
-- References: Riksavtalen 2024-2026 (NHO Reiseliv / Fellesforbundet)
-- Depends:    season must exist, locations.sql (for operating hours)
-- Usage:      SELECT template_restaurant_budget(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_budget(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_profile uuid;
  v_season_id uuid;
  v_budget_id uuid;
  v_loc_main uuid;
BEGIN
  -- Hent admin/owner-profil (admin foretrekkes, owner som fallback)
  SELECT profile_id INTO v_admin_profile FROM public.profile
  WHERE workspace_id = p_workspace_id AND role IN ('admin', 'owner')
  ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 END
  LIMIT 1;

  IF v_admin_profile IS NULL THEN
    RAISE EXCEPTION 'Ingen admin- eller owner-profil funnet for workspace %', p_workspace_id;
  END IF;

  -- Hent aktiv sesong
  SELECT season_id INTO v_season_id FROM public.season
  WHERE workspace_id = p_workspace_id AND status = 'active' LIMIT 1;

  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'Ingen aktiv sesong funnet for workspace %', p_workspace_id;
  END IF;

  -- Hent hovedlokasjon (for åpningstider)
  SELECT location_id INTO v_loc_main FROM public.location
  WHERE workspace_id = p_workspace_id AND location_type = 'main' LIMIT 1;

  -- ==========================================================================
  -- SESONGBUDSJETT
  -- Norsk mellomklasserestaurant: NOK 8.5M omsetning, 32% lønnskostnad
  -- Gjennomsnittlig kuvert NOK 450, timelønn NOK 220 (Riksavtalen snitt)
  -- ==========================================================================

  INSERT INTO public.season_budget (
    season_id, workspace_id, total_target_revenue, base_price_per_guest,
    season_price_factor, target_labor_percentage, avg_hourly_wage,
    status, created_by
  ) VALUES (
    v_season_id, p_workspace_id, 8500000, 450,
    1.0, 0.32, 220.00,
    'active', v_admin_profile
  )
  ON CONFLICT DO NOTHING
  RETURNING season_budget_id INTO v_budget_id;

  -- Hvis budsjettet allerede fantes, hent eksisterende ID
  IF v_budget_id IS NULL THEN
    SELECT season_budget_id INTO v_budget_id FROM public.season_budget
    WHERE season_id = v_season_id AND workspace_id = p_workspace_id;
  END IF;

  -- ==========================================================================
  -- DAGFAKTORER (0=mandag ... 6=søndag)
  -- Realistisk restaurantmønster: helg tyngst, mandag roligst
  -- ==========================================================================

  INSERT INTO public.day_factor (season_budget_id, workspace_id, weekday, factor)
  VALUES
    (v_budget_id, p_workspace_id, 0, 0.6),   -- Mandag: roligste dag
    (v_budget_id, p_workspace_id, 1, 0.7),   -- Tirsdag
    (v_budget_id, p_workspace_id, 2, 0.85),  -- Onsdag
    (v_budget_id, p_workspace_id, 3, 1.1),   -- Torsdag: etter-jobb-trafikk
    (v_budget_id, p_workspace_id, 4, 1.6),   -- Fredag: travleste ukedag
    (v_budget_id, p_workspace_id, 5, 1.8),   -- Lørdag: topp
    (v_budget_id, p_workspace_id, 6, 1.35)   -- Søndag: brunsj + familiemiddag
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- TIMEFAKTORER (06:00-23:00, 18 timer)
  -- Realistisk omsetningsfordeling: lunsj- og middagstopp
  -- ==========================================================================

  INSERT INTO public.hour_factor (season_budget_id, workspace_id, hour, factor)
  VALUES
    (v_budget_id, p_workspace_id, 6,  0.1),  -- Prep, ingen omsetning
    (v_budget_id, p_workspace_id, 7,  0.2),  -- Tidlig prep
    (v_budget_id, p_workspace_id, 8,  0.3),  -- Kjøkkenet ankommer
    (v_budget_id, p_workspace_id, 9,  0.3),  -- Prep fortsetter
    (v_budget_id, p_workspace_id, 10, 0.4),  -- Før lunsj
    (v_budget_id, p_workspace_id, 11, 0.8),  -- Lunsj starter
    (v_budget_id, p_workspace_id, 12, 1.5),  -- Lunsjtopp
    (v_budget_id, p_workspace_id, 13, 1.3),  -- Lunsj fortsetter
    (v_budget_id, p_workspace_id, 14, 0.6),  -- Rolig ettermiddag
    (v_budget_id, p_workspace_id, 15, 0.4),  -- Dødtid
    (v_budget_id, p_workspace_id, 16, 0.5),  -- Prep til middag
    (v_budget_id, p_workspace_id, 17, 0.9),  -- Tidlig middag
    (v_budget_id, p_workspace_id, 18, 1.6),  -- Middag starter
    (v_budget_id, p_workspace_id, 19, 2.0),  -- Middagstopp
    (v_budget_id, p_workspace_id, 20, 1.8),  -- Middag fortsetter
    (v_budget_id, p_workspace_id, 21, 1.4),  -- Sen middag
    (v_budget_id, p_workspace_id, 22, 0.8),  -- Bar/drikke
    (v_budget_id, p_workspace_id, 23, 0.4)   -- Stenging
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- ÅPNINGSTIDER (hovedlokasjon)
  -- Typisk norsk restaurant: lunsj+middag man-tor, utvidet helg
  -- ==========================================================================

  INSERT INTO public.operating_hours (
    workspace_id, location_id, day_of_week, open_time, close_time, is_closed
  ) VALUES
    (p_workspace_id, v_loc_main, 0, '11:00', '22:00', false),  -- Mandag
    (p_workspace_id, v_loc_main, 1, '11:00', '22:00', false),  -- Tirsdag
    (p_workspace_id, v_loc_main, 2, '11:00', '23:00', false),  -- Onsdag
    (p_workspace_id, v_loc_main, 3, '11:00', '23:00', false),  -- Torsdag
    (p_workspace_id, v_loc_main, 4, '11:00', '01:00', false),  -- Fredag
    (p_workspace_id, v_loc_main, 5, '12:00', '01:00', false),  -- Lørdag
    (p_workspace_id, v_loc_main, 6, '12:00', '22:00', false)   -- Søndag
  ON CONFLICT DO NOTHING;

END;
$$;
