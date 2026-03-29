-- Template: Restaurant Locations & Zones
-- Industry:   restaurant (NACE 56.101)
-- Philosophy: Start with what EVERY restaurant has. Less is more.
-- Depends:    workspace must exist
-- Usage:      SELECT template_restaurant_locations(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_locations(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loc_restaurant uuid;
  v_loc_kitchen uuid;
BEGIN
  -- ==========================================================================
  -- LOCATIONS — two physical areas most restaurants share
  -- ==========================================================================

  INSERT INTO public.location (workspace_id, name, slug, location_type, sort_order)
  VALUES (p_workspace_id, 'Restauranten', 'restauranten', 'main', 0)
  ON CONFLICT DO NOTHING
  RETURNING location_id INTO v_loc_restaurant;

  IF v_loc_restaurant IS NULL THEN
    SELECT location_id INTO v_loc_restaurant FROM public.location
    WHERE workspace_id = p_workspace_id AND slug = 'restauranten';
  END IF;

  INSERT INTO public.location (workspace_id, name, slug, location_type, sort_order)
  VALUES (p_workspace_id, 'Kjøkken', 'kjokken', 'kitchen', 1)
  ON CONFLICT DO NOTHING
  RETURNING location_id INTO v_loc_kitchen;

  IF v_loc_kitchen IS NULL THEN
    SELECT location_id INTO v_loc_kitchen FROM public.location
    WHERE workspace_id = p_workspace_id AND slug = 'kjokken';
  END IF;

  -- ==========================================================================
  -- ZONES — Restauranten (gjestesiden)
  -- ==========================================================================

  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order)
  VALUES
    (p_workspace_id, v_loc_restaurant, 'Hovedsal', 'hovedsal',
     'Spisesal med bordplasser.', NULL, 0),
    (p_workspace_id, v_loc_restaurant, 'Inngangsparti', 'inngangsparti',
     'Resepsjon, garderobe, ventesone.', NULL, 1),
    (p_workspace_id, v_loc_restaurant, 'Bar', 'bar',
     'Bardisk og barkrakker.', NULL, 2),
    (p_workspace_id, v_loc_restaurant, 'Gjeste-WC', 'gjeste-wc',
     'Toaletter for gjester.', NULL, 3)
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- ZONES — Kjøkken (produksjonssiden)
  -- ==========================================================================

  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order)
  VALUES
    (p_workspace_id, v_loc_kitchen, 'Varmkjøkken', 'varmkjokken',
     'Hovedproduksjon — varm- og kaldside.', NULL, 0),
    (p_workspace_id, v_loc_kitchen, 'Oppvask', 'oppvask',
     'Oppvaskmaskin og rengjøring.', NULL, 1),
    (p_workspace_id, v_loc_kitchen, 'Kjølerom', 'kjolerom',
     'Kjøle- og fryselagring.', NULL, 2)
  ON CONFLICT DO NOTHING;

END;
$$;
