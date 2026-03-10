-- Template: Restaurant Locations & Zones
-- Industry:   restaurant (NACE 56.101)
-- Locations:  3 (Hovedrestaurant, Uteservering, Cateringbase)
-- Zones:      12 across all locations
-- Depends:    workspace must exist
-- Usage:      SELECT template_restaurant_locations(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_locations(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loc_main uuid;
  v_loc_outdoor uuid;
  v_loc_catering uuid;
BEGIN
  -- ==========================================================================
  -- LOCATIONS
  -- ==========================================================================

  INSERT INTO public.location (workspace_id, name, slug, location_type)
  VALUES (p_workspace_id, 'Hovedrestaurant', 'hovedrestaurant', 'main')
  ON CONFLICT DO NOTHING
  RETURNING location_id INTO v_loc_main;

  IF v_loc_main IS NULL THEN
    SELECT location_id INTO v_loc_main FROM public.location
    WHERE workspace_id = p_workspace_id AND slug = 'hovedrestaurant';
  END IF;

  INSERT INTO public.location (workspace_id, name, slug, location_type)
  VALUES (p_workspace_id, 'Uteservering', 'uteservering', 'outdoor')
  ON CONFLICT DO NOTHING
  RETURNING location_id INTO v_loc_outdoor;

  IF v_loc_outdoor IS NULL THEN
    SELECT location_id INTO v_loc_outdoor FROM public.location
    WHERE workspace_id = p_workspace_id AND slug = 'uteservering';
  END IF;

  INSERT INTO public.location (workspace_id, name, slug, location_type)
  VALUES (p_workspace_id, 'Cateringbase', 'cateringbase', 'kitchen')
  ON CONFLICT DO NOTHING
  RETURNING location_id INTO v_loc_catering;

  IF v_loc_catering IS NULL THEN
    SELECT location_id INTO v_loc_catering FROM public.location
    WHERE workspace_id = p_workspace_id AND slug = 'cateringbase';
  END IF;

  -- ==========================================================================
  -- ZONES — Hovedrestaurant
  -- ==========================================================================

  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order)
  VALUES
    (p_workspace_id, v_loc_main, 'Spisesal', 'spisesal',
     'Hovedsal med bordplasser. 60 sitteplasser.', 60, 0),
    (p_workspace_id, v_loc_main, 'Bar', 'bar-sone',
     'Bardisk med barkrakker. 12 sitteplasser.', 12, 1),
    (p_workspace_id, v_loc_main, 'Kjøkken', 'kjokken-sone',
     'Produksjonskjøkken med varm- og kaldside.', NULL, 2),
    (p_workspace_id, v_loc_main, 'Privat spiserom', 'privat-spiserom',
     'Separat rom for selskaper og møter. 20 plasser.', 20, 3),
    (p_workspace_id, v_loc_main, 'Inngangsparti', 'inngangsparti',
     'Resepsjon, garderobe, ventesone.', NULL, 4),
    (p_workspace_id, v_loc_main, 'Lager', 'lager',
     'Tørrlager, kjølerom og fryserom.', NULL, 5),
    (p_workspace_id, v_loc_main, 'Personalrom', 'personalrom',
     'Garderobe, pauserom, kontor.', NULL, 6)
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- ZONES — Uteservering
  -- ==========================================================================

  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order)
  VALUES
    (p_workspace_id, v_loc_outdoor, 'Terrasse', 'terrasse',
     'Hovedterrasse med parasoller. 40 sitteplasser.', 40, 0),
    (p_workspace_id, v_loc_outdoor, 'Lounge', 'lounge-ute',
     'Sofagrupper med varmelamper. 16 plasser.', 16, 1)
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- ZONES — Cateringbase
  -- ==========================================================================

  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order)
  VALUES
    (p_workspace_id, v_loc_catering, 'Produksjonskjøkken', 'produksjonskjokken',
     'Kjøkken for catering-prep og pakking.', NULL, 0),
    (p_workspace_id, v_loc_catering, 'Lastesone', 'lastesone',
     'Lasting/lossing for leveranser og utkjøring.', NULL, 1),
    (p_workspace_id, v_loc_catering, 'Utstyrslager', 'utstyrslager',
     'Cateringustyr: chafing dishes, bestikk, tallerkener.', NULL, 2)
  ON CONFLICT DO NOTHING;

END;
$$;
