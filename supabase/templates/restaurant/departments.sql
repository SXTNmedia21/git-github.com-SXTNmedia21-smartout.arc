-- Template: Restaurant Departments & Positions
-- Industry:   restaurant (NACE 56.101)
-- Departments: 7 (Kjøkken, Restaurant, Bar, Catering, Renhold, Levering, Event)
-- Positions:  ~20 across all departments
-- Depends:    workspace must exist
-- Usage:      SELECT template_restaurant_departments(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_departments(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dept_kitchen uuid;
  v_dept_restaurant uuid;
  v_dept_bar uuid;
  v_dept_catering uuid;
  v_dept_renhold uuid;
  v_dept_levering uuid;
  v_dept_event uuid;
BEGIN
  -- ==========================================================================
  -- DEPARTMENTS
  -- ==========================================================================

  INSERT INTO public.department (workspace_id, name, slug, description, sort_order)
  VALUES (p_workspace_id, 'Kjøkken', 'kjokken', 'Matlaging, mise en place, varemottak', 0)
  ON CONFLICT DO NOTHING
  RETURNING department_id INTO v_dept_kitchen;

  IF v_dept_kitchen IS NULL THEN
    SELECT department_id INTO v_dept_kitchen FROM public.department
    WHERE workspace_id = p_workspace_id AND slug = 'kjokken';
  END IF;

  INSERT INTO public.department (workspace_id, name, slug, description, sort_order)
  VALUES (p_workspace_id, 'Restaurant', 'restaurant', 'Sal, servering, gjestekontakt', 1)
  ON CONFLICT DO NOTHING
  RETURNING department_id INTO v_dept_restaurant;

  IF v_dept_restaurant IS NULL THEN
    SELECT department_id INTO v_dept_restaurant FROM public.department
    WHERE workspace_id = p_workspace_id AND slug = 'restaurant';
  END IF;

  INSERT INTO public.department (workspace_id, name, slug, description, sort_order)
  VALUES (p_workspace_id, 'Bar', 'bar', 'Drikke, cocktails, skjenking', 2)
  ON CONFLICT DO NOTHING
  RETURNING department_id INTO v_dept_bar;

  IF v_dept_bar IS NULL THEN
    SELECT department_id INTO v_dept_bar FROM public.department
    WHERE workspace_id = p_workspace_id AND slug = 'bar';
  END IF;

  INSERT INTO public.department (workspace_id, name, slug, description, sort_order)
  VALUES (p_workspace_id, 'Catering', 'catering', 'Eksternt arrangement, matlaging utenfor huset', 3)
  ON CONFLICT DO NOTHING
  RETURNING department_id INTO v_dept_catering;

  IF v_dept_catering IS NULL THEN
    SELECT department_id INTO v_dept_catering FROM public.department
    WHERE workspace_id = p_workspace_id AND slug = 'catering';
  END IF;

  INSERT INTO public.department (workspace_id, name, slug, description, sort_order)
  VALUES (p_workspace_id, 'Renhold', 'renhold', 'Rengjøring, hygiene, avfallshåndtering', 4)
  ON CONFLICT DO NOTHING
  RETURNING department_id INTO v_dept_renhold;

  IF v_dept_renhold IS NULL THEN
    SELECT department_id INTO v_dept_renhold FROM public.department
    WHERE workspace_id = p_workspace_id AND slug = 'renhold';
  END IF;

  INSERT INTO public.department (workspace_id, name, slug, description, sort_order)
  VALUES (p_workspace_id, 'Levering', 'levering', 'Utkjøring, takeaway, logistikk', 5)
  ON CONFLICT DO NOTHING
  RETURNING department_id INTO v_dept_levering;

  IF v_dept_levering IS NULL THEN
    SELECT department_id INTO v_dept_levering FROM public.department
    WHERE workspace_id = p_workspace_id AND slug = 'levering';
  END IF;

  INSERT INTO public.department (workspace_id, name, slug, description, sort_order)
  VALUES (p_workspace_id, 'Event', 'event', 'Arrangementer, selskaper, spesialtilstelninger', 6)
  ON CONFLICT DO NOTHING
  RETURNING department_id INTO v_dept_event;

  IF v_dept_event IS NULL THEN
    SELECT department_id INTO v_dept_event FROM public.department
    WHERE workspace_id = p_workspace_id AND slug = 'event';
  END IF;

  -- ==========================================================================
  -- POSITIONS (per department)
  -- ==========================================================================

  -- Kjøkken
  INSERT INTO public.position (workspace_id, department_id, name, slug, description, sort_order)
  VALUES
    (p_workspace_id, v_dept_kitchen, 'Kjøkkensjef', 'kjokkensjef', 'Leder kjøkkenet. Ansvar for meny, kvalitet, varekost.', 0),
    (p_workspace_id, v_dept_kitchen, 'Sous Chef', 'sous-chef', 'Nestkommanderende på kjøkkenet. Stedfortreder for kjøkkensjef.', 1),
    (p_workspace_id, v_dept_kitchen, 'Kokk', 'kokk', 'Tilbereder retter etter meny og standard.', 2),
    (p_workspace_id, v_dept_kitchen, 'Kjøkkenassistent', 'kjokkenassistent', 'Bistår kokker med prep, rydding og enklere oppgaver.', 3),
    (p_workspace_id, v_dept_kitchen, 'Oppvaskhjelp', 'oppvaskhjelp', 'Oppvask, renhold av kjøkkenutstyr, sortering.', 4)
  ON CONFLICT DO NOTHING;

  -- Restaurant
  INSERT INTO public.position (workspace_id, department_id, name, slug, description, sort_order)
  VALUES
    (p_workspace_id, v_dept_restaurant, 'Hovmester', 'hovmester', 'Leder sal. Ansvar for gjestekontakt, bordplan, servicekvalitet.', 0),
    (p_workspace_id, v_dept_restaurant, 'Servitør', 'servitor', 'Serverer mat og drikke. Rådgir gjester.', 1),
    (p_workspace_id, v_dept_restaurant, 'Runner', 'runner', 'Bringer mat fra kjøkken til bord. Rydder.', 2)
  ON CONFLICT DO NOTHING;

  -- Bar
  INSERT INTO public.position (workspace_id, department_id, name, slug, description, sort_order)
  VALUES
    (p_workspace_id, v_dept_bar, 'Bartender', 'bartender', 'Mikser drinker, serverer øl/vin, ansvar for baren.', 0),
    (p_workspace_id, v_dept_bar, 'Barback', 'barback', 'Assisterer bartender. Fyller på, rydder, vasker glass.', 1)
  ON CONFLICT DO NOTHING;

  -- Catering
  INSERT INTO public.position (workspace_id, department_id, name, slug, description, sort_order)
  VALUES
    (p_workspace_id, v_dept_catering, 'Cateringsjef', 'cateringsjef', 'Planlegger og leder cateringoppdrag.', 0),
    (p_workspace_id, v_dept_catering, 'Cateringmedarbeider', 'cateringmedarbeider', 'Tilbereder og serverer mat på eksterne arrangement.', 1)
  ON CONFLICT DO NOTHING;

  -- Renhold
  INSERT INTO public.position (workspace_id, department_id, name, slug, description, sort_order)
  VALUES
    (p_workspace_id, v_dept_renhold, 'Renholder', 'renholder', 'Daglig renhold av lokaler, toaletter og fellesareal.', 0),
    (p_workspace_id, v_dept_renhold, 'Renholdsansvarlig', 'renholdsansvarlig', 'Leder renholdsarbeidet. Ansvar for innkjøp av utstyr og midler.', 1)
  ON CONFLICT DO NOTHING;

  -- Levering
  INSERT INTO public.position (workspace_id, department_id, name, slug, description, sort_order)
  VALUES
    (p_workspace_id, v_dept_levering, 'Sjåfør', 'sjafor', 'Kjører ut mat til kunder. Ansvar for bil og leveranser.', 0),
    (p_workspace_id, v_dept_levering, 'Leveringskoordinator', 'leveringskoordinator', 'Koordinerer bestillinger og ruter.', 1)
  ON CONFLICT DO NOTHING;

  -- Event
  INSERT INTO public.position (workspace_id, department_id, name, slug, description, sort_order)
  VALUES
    (p_workspace_id, v_dept_event, 'Eventkoordinator', 'eventkoordinator', 'Planlegger og gjennomfører arrangementer.', 0),
    (p_workspace_id, v_dept_event, 'Eventmedarbeider', 'eventmedarbeider', 'Bistår under arrangementer: rigging, servering, rydding.', 1)
  ON CONFLICT DO NOTHING;

END;
$$;
